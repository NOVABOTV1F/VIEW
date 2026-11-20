import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { copyText, downloadBlob, fetchPage } from "@/lib/actions";
import { C } from "@/lib/palette";
import { grabPng } from "@/lib/stage";
import { useStudio } from "@/lib/store";
import type { PageDoc } from "@/lib/types";
import { contrastRatio, errorText, formatClock, pageText, readingMinutes, slugify } from "@/lib/text";
import { hostOf, normalizeUrl } from "@/lib/url";
import { Btn, controlClass } from "@/components/ui";

const TOOLS = [
  ["cek", "Cek tautan"],
  ["teks", "Ekstrak teks"],
  ["heading", "Daftar heading"],
  ["tautan", "Kumpulan tautan"],
  ["qr", "Kode QR"],
  ["baca", "Estimasi baca"],
  ["shot", "Screenshot diam"],
  ["stop", "Stopwatch"],
  ["catatan", "Catatan sesi"],
  ["fps", "Pengukur FPS"],
  ["mundur", "Timer mundur"],
  ["slug", "Slug berkas"],
  ["csv", "Ekspor CSV"],
  ["kontras", "Kontras palet"],
  ["info", "Info halaman"],
] as const;

function useMeta() {
  const [busy, setBusy] = useState(false);
  const [doc, setDoc] = useState<PageDoc | null>(null);
  async function run() {
    setBusy(true);
    try {
      const next = await fetchPage("meta");
      if (next) setDoc(next);
    } finally {
      setBusy(false);
    }
  }
  return { busy, doc, run };
}

function CekTool() {
  const { busy, doc, run } = useMeta();
  return (
    <div>
      <Btn variant="ghost" onClick={() => void run()} disabled={busy}>
        {busy ? "Memeriksa…" : "Periksa tautan"}
      </Btn>
      {doc ? (
        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-muted">Status</dt><dd className="font-bold">{doc.status}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">Waktu</dt><dd className="font-bold">{doc.ms} ms</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">Tipe</dt><dd className="truncate font-bold">{doc.contentType || "—"}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">Host</dt><dd className="truncate font-bold">{hostOf(doc.finalUrl)}</dd></div>
          <p className="pt-1 font-semibold">{doc.title}</p>
          {doc.error ? <p className="text-bad">{doc.error}</p> : null}
        </dl>
      ) : null}
    </div>
  );
}

function TeksTool() {
  const { busy, doc, run } = useMeta();
  const toast = useStudio((s) => s.toastMsg);
  const text = doc ? pageText(doc) : "";
  return (
    <div>
      <div className="flex gap-2">
        <Btn variant="ghost" onClick={() => void run()} disabled={busy}>{busy ? "Mengambil…" : "Ambil teks"}</Btn>
        <Btn variant="outline" disabled={!text} onClick={() => void copyText(text).then((ok) => toast(ok ? "Teks disalin" : "Gagal menyalin"))}>Salin</Btn>
      </div>
      <textarea readOnly value={text} className={`${controlClass} mt-3 h-36`} placeholder="Teks halaman muncul di sini" />
    </div>
  );
}

function HeadingTool() {
  const { busy, doc, run } = useMeta();
  return (
    <div>
      <Btn variant="ghost" onClick={() => void run()} disabled={busy}>{busy ? "Mengambil…" : "Ambil heading"}</Btn>
      <ul className="mt-3 space-y-1 text-sm">
        {doc?.headings.length ? doc.headings.map((heading, index) => (
          <li key={`${heading.text}-${index}`} className="font-semibold" style={{ paddingLeft: `${(heading.level - 1) * 0.75}rem` }}>
            H{heading.level} · {heading.text}
          </li>
        )) : doc ? <li className="text-muted">Tidak ada heading.</li> : null}
      </ul>
    </div>
  );
}

function LinkTool() {
  const { busy, doc, run } = useMeta();
  const setUrl = useStudio((s) => s.setUrl);
  const toast = useStudio((s) => s.toastMsg);
  return (
    <div>
      <Btn variant="ghost" onClick={() => void run()} disabled={busy}>{busy ? "Mengambil…" : "Ambil tautan"}</Btn>
      <ul className="mt-3 space-y-2">
        {doc?.links.slice(0, 12).map((link) => (
          <li key={link.href} className="rounded-control border border-line p-2">
            <p className="truncate text-sm font-bold">{link.text}</p>
            <p className="truncate text-xs text-muted">{link.href}</p>
            <div className="mt-2 flex gap-2">
              <Btn variant="outline" className="min-h-9 flex-1" onClick={() => { setUrl(link.href); toast("Tautan dipasang di kolom"); }}>Pakai</Btn>
              <Btn variant="ghost" className="min-h-9 flex-1" onClick={() => window.open(link.href, "_blank", "noopener,noreferrer")}>Buka</Btn>
            </div>
          </li>
        ))}
        {doc && doc.links.length === 0 ? <li className="text-sm text-muted">Tidak ada tautan.</li> : null}
      </ul>
    </div>
  );
}

function QrTool() {
  const url = useStudio((s) => s.url);
  const toast = useStudio((s) => s.toastMsg);
  const [src, setSrc] = useState("");
  async function make() {
    try {
      const target = normalizeUrl(url);
      const qr = await import("qrcode");
      const data = await qr.toDataURL(target, {
        margin: 1,
        width: 280,
        errorCorrectionLevel: "M",
        color: { dark: C.ink, light: C.bg },
      });
      setSrc(data);
    } catch (error) {
      toast(errorText(error));
    }
  }
  return (
    <div>
      <Btn variant="ghost" onClick={() => void make()}>Buat QR</Btn>
      {src ? (
        <div className="mt-3">
          <img src={src} alt="Kode QR tautan" className="w-40 rounded-control border border-line" />
          <Btn className="mt-3" variant="outline" onClick={() => {
            const anchor = document.createElement("a");
            anchor.href = src;
            anchor.download = "qwenxyxf-qr.png";
            anchor.click();
            toast("QR diunduh");
          }}>Unduh PNG</Btn>
        </div>
      ) : null}
    </div>
  );
}

function BacaTool() {
  const { busy, doc, run } = useMeta();
  return (
    <div>
      <Btn variant="ghost" onClick={() => void run()} disabled={busy}>{busy ? "Menghitung…" : "Hitung bacaan"}</Btn>
      {doc ? (
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat n={String(doc.words)} label="Kata" />
          <Stat n={String(readingMinutes(doc.words))} label="Menit" />
          <Stat n={String(pageText(doc).length)} label="Karakter" />
        </div>
      ) : null}
    </div>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className="rounded-control bg-pink-light p-2">
      <p className="text-lg font-extrabold text-pink-dark">{n}</p>
      <p className="text-xs font-semibold text-muted">{label}</p>
    </div>
  );
}

function ShotTool() {
  const toast = useStudio((s) => s.toastMsg);
  return (
    <Btn variant="ghost" onClick={() => void grabPng().then((blob) => {
      if (!blob) {
        toast("Belum ada gambar");
        return;
      }
      downloadBlob(blob, `QWENXYXF_shot_${Date.now()}.png`);
      toast("Screenshot diunduh");
    })}>Simpan PNG</Btn>
  );
}

function StopTool() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);
  useEffect(() => {
    if (!running) return;
    const origin = performance.now() - elapsed;
    const id = window.setInterval(() => setElapsed(performance.now() - origin), 80);
    return () => window.clearInterval(id);
    // Restart only when the watch is started or stopped, not on every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);
  return (
    <div>
      <p className="font-extrabold text-pink-dark">{formatClock(elapsed)}</p>
      <div className="mt-2 flex gap-2">
        <Btn variant="ghost" className="flex-1" onClick={() => setRunning((v) => !v)}>{running ? "Jeda" : "Mulai"}</Btn>
        <Btn variant="outline" className="flex-1" onClick={() => setLaps((list) => [elapsed, ...list].slice(0, 8))}>Putaran</Btn>
        <Btn variant="outline" className="flex-1" onClick={() => { setRunning(false); setElapsed(0); setLaps([]); }}>Reset</Btn>
      </div>
      <ul className="mt-2 text-xs text-muted">
        {laps.map((lap, index) => <li key={`${lap}-${index}`}>Putaran {laps.length - index}: {formatClock(lap)}</li>)}
      </ul>
    </div>
  );
}

function NotesTool() {
  const notes = useStudio((s) => s.notes);
  const setNotes = useStudio((s) => s.setNotes);
  return (
    <textarea
      value={notes}
      onChange={(event) => setNotes(event.target.value)}
      maxLength={4000}
      placeholder="Catatan sesi rekam, tersimpan di perangkat ini"
      className={`${controlClass} h-32`}
    />
  );
}

function FpsTool() {
  const [fps, setFps] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  async function measure() {
    setBusy(true);
    const samples: number[] = [];
    let last = performance.now();
    const origin = last;
    await new Promise<void>((resolve) => {
      const step = (now: number) => {
        samples.push(now - last);
        last = now;
        if (now - origin >= 1000) resolve();
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    const avg = samples.reduce((sum, item) => sum + item, 0) / Math.max(1, samples.length);
    setFps(Math.round(1000 / avg));
    setBusy(false);
  }
  return (
    <div>
      <Btn variant="ghost" onClick={() => void measure()} disabled={busy}>{busy ? "Mengukur…" : "Ukur 1 detik"}</Btn>
      {fps !== null ? <p className="mt-2 text-lg font-extrabold text-pink-dark">{fps} FPS</p> : null}
    </div>
  );
}

function MundurTool() {
  const [seconds, setSeconds] = useState(5);
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (left === null) return;
    if (left <= 0) {
      beep();
      setLeft(null);
      return;
    }
    const id = window.setTimeout(() => setLeft((value) => (value === null ? null : value - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [left]);
  return (
    <div>
      <label className="mb-2 block text-xs font-semibold text-muted">
        Detik
        <input type="number" min={1} max={600} value={seconds} onChange={(event) => setSeconds(Number(event.target.value) || 1)} className={`${controlClass} mt-1`} />
      </label>
      <p className="mb-2 font-extrabold text-pink-dark">{left === null ? "Siaga" : formatClock(left * 1000)}</p>
      <div className="flex gap-2">
        <Btn variant="ghost" className="flex-1" onClick={() => setLeft(Math.max(1, Math.min(600, seconds)))}>Mulai</Btn>
        <Btn variant="outline" className="flex-1" onClick={() => setLeft(null)}>Batal</Btn>
      </div>
    </div>
  );
}

function beep() {
  const Ctx = window.AudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = 880;
  osc.connect(gain);
  gain.connect(ctx.destination);
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.04, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
  osc.start(now);
  osc.stop(now + 0.28);
  osc.onended = () => void ctx.close();
}

function SlugTool() {
  const url = useStudio((s) => s.url);
  const prefix = useStudio((s) => s.gear.filePrefix);
  const toast = useStudio((s) => s.toastMsg);
  const [extra, setExtra] = useState("");
  let base = extra.trim();
  if (!base) {
    try {
      base = url.trim() ? new URL(normalizeUrl(url)).hostname : "rekaman";
    } catch {
      base = url.trim() || "rekaman";
    }
  }
  const slug = `${prefix}_${slugify(base)}`;
  return (
    <div>
      <input value={extra} onChange={(event) => setExtra(event.target.value)} placeholder="Kosongkan untuk memakai tautan" className={controlClass} />
      <p className="mt-2 truncate text-sm font-bold">{slug}</p>
      <Btn variant="outline" className="mt-2" onClick={() => void copyText(slug).then((ok) => toast(ok ? "Slug disalin" : "Gagal menyalin"))}>Salin</Btn>
    </div>
  );
}

function CsvTool() {
  const history = useStudio((s) => s.history);
  const toast = useStudio((s) => s.toastMsg);
  return (
    <div>
      <p className="mb-2 text-sm text-muted">{history.length} baris riwayat.</p>
      <Btn variant="ghost" onClick={() => {
        const header = "nama,tanggal,pengaturan,ukuran,format,durasi_ms";
        const rows = history.map((item) => [item.name, new Date(item.created).toISOString(), item.settings, String(item.size), item.format, String(item.durationMs)].map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","));
        downloadBlob(new Blob([[header, ...rows].join("\n")], { type: "text/csv" }), "qwenxyxf-riwayat.csv");
        toast(history.length ? "CSV diunduh" : "CSV hanya berisi tajuk");
      }}>Unduh CSV</Btn>
    </div>
  );
}

const PAIRS: [string, string, string][] = [
  ["Tinta di putih", C.ink, C.bg],
  ["Tinta di merah muda muda", C.ink, C.pinkLight],
  ["Putih di merah muda tua", C.bg, C.pinkDark],
  ["Putih di aksen", C.bg, C.pink],
  ["Aksen tua di putih", C.pinkDark, C.bg],
  ["Redup di putih", C.muted, C.bg],
  ["Putih di status baik", C.bg, C.ok],
  ["Putih di status buruk", C.bg, C.bad],
];

function KontrasTool() {
  return (
    <ul className="space-y-2">
      {PAIRS.map(([label, fg, bg]) => {
        const ratio = contrastRatio(fg, bg);
        const pass = ratio >= 4.5 ? "Lulus AA" : ratio >= 3 ? "AA besar" : "Di bawah AA";
        return (
          <li key={label} className="flex items-center justify-between gap-2 text-sm">
            <span className="rounded-control px-2 py-1 font-bold" style={{ color: fg, background: bg }}>{label}</span>
            <span className="shrink-0 font-bold text-pink-dark">{ratio.toFixed(2)} · {pass}</span>
          </li>
        );
      })}
    </ul>
  );
}

function InfoTool() {
  const loaded = useStudio((s) => s.doc);
  const { busy, doc, run } = useMeta();
  const shown = doc ?? loaded;
  return (
    <div>
      <Btn variant="ghost" onClick={() => void run()} disabled={busy}>{busy ? "Membaca…" : "Segarkan info"}</Btn>
      {shown ? (
        <ul className="mt-3 space-y-1 text-sm">
          <li className="font-bold">{shown.title}</li>
          <li className="text-muted">{shown.finalUrl}</li>
          <li>{shown.words} kata · {shown.headings.length} heading · {shown.links.length} tautan · {shown.images.length} gambar</li>
          <li>{shown.ms} ms · {shown.truncated ? "konten terpotong" : "konten utuh"} · status {shown.status}</li>
        </ul>
      ) : <p className="mt-2 text-sm text-muted">Muat atau segarkan sebuah tautan.</p>}
    </div>
  );
}

const VIEWS = [CekTool, TeksTool, HeadingTool, LinkTool, QrTool, BacaTool, ShotTool, StopTool, NotesTool, FpsTool, MundurTool, SlugTool, CsvTool, KontrasTool, InfoTool];

export function CvPanel() {
  const open = useStudio((s) => s.cvOpen);
  const [active, setActive] = useState(0);
  if (!open) return null;
  return (
    <section className="mt-4 rounded-card border border-line bg-bg p-4 shadow-card">
      <h2 className="text-base font-extrabold">CV · 15 tool</h2>
      <p className="mt-1 text-xs text-muted">Alat bantu di samping gerigi. Semua berjalan di perangkat ini, pembaca tautan lewat layanan aplikasi.</p>
      <div className="mt-2">
        {TOOLS.map(([id, label], index) => {
          const View = VIEWS[index] ?? CekTool;
          const shown = active === index;
          return (
            <div key={id} className="border-b border-line last:border-b-0">
              <button
                type="button"
                className="flex min-h-11 w-full items-center justify-between text-left"
                aria-expanded={shown}
                onClick={() => setActive(shown ? -1 : index)}
              >
                <span className="text-sm font-bold">
                  <span className="mr-2 text-xs text-muted">{String(index + 1).padStart(2, "0")}</span>
                  {label}
                </span>
                <ChevronDown className={`size-4 text-pink transition-transform ${shown ? "rotate-180" : ""}`} />
              </button>
              <div className={shown ? "pb-3" : "hidden"}>
                <View />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
