import { browsePage } from "@/lib/browse.functions";
import { clearVideos, deleteVideo, loadVideo, saveVideo } from "@/lib/idb";
import { useStudio } from "@/lib/store";
import type { Clip, PageDoc } from "@/lib/types";
import { errorText, formatBytes, slugify } from "@/lib/text";
import { hostOf, normalizeUrl } from "@/lib/url";

let fullSeq = 0;

export async function fetchPage(mode: "full" | "meta"): Promise<PageDoc | null> {
  const studio = useStudio.getState();
  let target = "";
  try {
    target = normalizeUrl(studio.url);
  } catch (error) {
    studio.toastMsg(errorText(error));
    return null;
  }
  const seq = mode === "full" ? ++fullSeq : 0;
  if (mode === "full") studio.setLoading(true);
  try {
    const doc = await browsePage({ data: { url: target, mode } });
    if (mode === "full" && seq !== fullSeq) return null;
    if (mode === "full") {
      useStudio.getState().setDoc(doc, target, "full");
      useStudio.getState().pushLog(`Muat ${hostOf(doc.finalUrl)} · ${doc.status}`);
      useStudio.getState().toastMsg(doc.ok ? "Halaman siap direkam" : doc.error || "Halaman tidak lengkap, kartu tetap bisa direkam");
    }
    return doc;
  } catch (error) {
    if (mode === "full" && seq !== fullSeq) return null;
    useStudio.getState().toastMsg(errorText(error));
    return null;
  } finally {
    if (mode === "full" && seq === fullSeq) useStudio.getState().setLoading(false);
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2500);
}

export async function saveRecording(clip: Clip, name: string, settingsLabel: string) {
  const id = `r_${Date.now()}`;
  const stored = await saveVideo(id, clip.blob);
  const studio = useStudio.getState();
  studio.setHistory([
    {
      id,
      name: name.slice(0, 80) || "Rekaman",
      created: Date.now(),
      settings: settingsLabel,
      size: clip.blob.size,
      format: clip.ext,
      durationMs: clip.durationMs,
    },
    ...studio.history,
  ]);
  studio.setPlayback(URL.createObjectURL(clip.blob));
  studio.pushLog(`Rekaman ${clip.ext.toUpperCase()} · ${formatBytes(clip.blob.size)}`);
  studio.toastMsg(stored ? "Rekaman selesai — siap diunduh" : "Rekaman ada di sesi ini. Unduh sekarang, penyimpanan perangkat menolak simpan permanen.");
}

export async function downloadHist(id: string) {
  const studio = useStudio.getState();
  const item = studio.history.find((entry) => entry.id === id);
  if (!item) return;
  const blob = await loadVideo(id);
  if (!blob) {
    studio.toastMsg("Video tidak ada lagi di perangkat ini");
    return;
  }
  downloadBlob(blob, `${studio.gear.filePrefix}_${slugify(item.name)}.${item.format}`);
  studio.pushLog(`Unduh ${item.name}`);
  studio.toastMsg("Unduhan dimulai");
  studio.setOpenMenu(null);
}

export async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = value;
      area.setAttribute("readonly", "true");
      area.style.position = "fixed";
      area.style.left = "-999px";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export async function confirmDialog() {
  const dialog = useStudio.getState().dialog;
  if (!dialog) return;
  if (dialog.kind === "delete") {
    await deleteVideo(dialog.id);
    const studio = useStudio.getState();
    studio.setHistory(studio.history.filter((item) => item.id !== dialog.id));
    studio.toastMsg("Video dihapus");
    studio.pushLog("Hapus satu video");
  } else {
    await clearVideos();
    const studio = useStudio.getState();
    studio.setHistory([]);
    studio.setPlayback(null);
    if (dialog.kind === "wipe") {
      studio.setNotes("");
      studio.setLog([]);
      studio.pushLog("Hapus semua data lokal");
      studio.toastMsg("Data lokal dihapus");
    } else {
      studio.toastMsg("Semua riwayat dihapus");
      studio.pushLog("Hapus semua riwayat");
    }
  }
  useStudio.getState().setDialog(null);
}
