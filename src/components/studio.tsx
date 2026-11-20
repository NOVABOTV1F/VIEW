import { useEffect, useState, type ReactNode } from "react";
import {
  ChevronDown,
  Download,
  ExternalLink,
  MoreVertical,
  Pencil,
  Play,
  Search,
  Settings,
  Square,
  Trash2,
  Video,
} from "lucide-react";
import { confirmDialog, downloadHist, fetchPage } from "@/lib/actions";
import { servicePing } from "@/lib/browse.functions";
import { OWNER_GATE } from "@/lib/owner-gate";
import { drawStill } from "@/lib/record-engine";
import { stageCanvas } from "@/lib/stage";
import { useStudio } from "@/lib/store";
import { effectiveGear } from "@/lib/gear";
import { errorText, formatBytes, formatClock } from "@/lib/text";
import { normalizeUrl } from "@/lib/url";
import { CvPanel } from "@/components/cv-panel";
import { GearFields } from "@/components/gear-fields";
import { OwnerPanel } from "@/components/owner-panel";
import { useRecorder } from "@/components/use-recorder";
import { Btn, Card, cn } from "@/components/ui";

export function Studio() {
  const hydrate = useStudio((s) => s.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") useStudio.getState().setDialog(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main className="mx-auto w-full max-w-studio px-4 pt-4 pb-16">
      <Header />
      <RecorderCard />
      <CvPanel />
      <StageCard />
      <HistoryCard />
      <DashCard />
      <OwnerPanel />
      <p className="mt-5 px-2 text-center text-xs leading-relaxed text-muted">
        Studio membaca tautan publik, menggambar halamannya, lalu menggulir dan merekam. Mode Layar memakai izin tangkapan browser untuk situs yang butuh JavaScript. Video tetap di perangkat ini. Siap dipublikasikan ke Vercel.
      </p>
      <Toast />
      <Confirm />
    </main>
  );
}

function Header() {
  const banner = useStudio((s) => s.owner.banner);
  const unlocked = useStudio((s) => s.unlocked);
  return (
    <header className="px-1 pt-3 pb-1">
      <p className="text-xs font-bold tracking-widest text-pink">PEREKAM WEB</p>
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-display font-extrabold tracking-tight">
          QWEN<span className="text-pink">XYXF</span>
        </h1>
        {unlocked ? <span className="mb-1 rounded-full bg-pink-light px-3 py-1 text-xs font-extrabold text-pink-dark">Owner</span> : null}
      </div>
      <p className="mt-1 text-sm text-muted">Automated Smooth Scrolling Capture</p>
      {banner ? <p className="mt-3 rounded-control bg-pink-light px-3 py-2 text-sm font-semibold text-pink-dark">{banner}</p> : null}
    </header>
  );
}

function RecorderCard() {
  const url = useStudio((s) => s.url);
  const setUrl = useStudio((s) => s.setUrl);
  const mode = useStudio((s) => s.mode);
  const setMode = useStudio((s) => s.setMode);
  const loading = useStudio((s) => s.loading);
  const recording = useStudio((s) => s.recording);
  const timer = useStudio((s) => s.timer);
  const gearOpen = useStudio((s) => s.gearOpen);
  const toggleGear = useStudio((s) => s.toggleGear);
  const cvOpen = useStudio((s) => s.cvOpen);
  const toggleCv = useStudio((s) => s.toggleCv);
  const gear = useStudio((s) => s.gear);
  const setGear = useStudio((s) => s.setGear);
  const owner = useStudio((s) => s.owner);
  const xcvxOpen = useStudio((s) => s.xcvxOpen);
  const toggleXcvx = useStudio((s) => s.toggleXcvx);
  const unlocked = useStudio((s) => s.unlocked);
  const unlock = useStudio((s) => s.unlock);
  const lockSession = useStudio((s) => s.lockSession);
  const toast = useStudio((s) => s.toastMsg);
  const doc = useStudio((s) => s.doc);
  const { toggle, preview } = useRecorder();
  const allow = mode === "studio" ? owner.allowStudio : owner.allowScreen;
  const cap = owner.durationCap > 0 ? owner.durationCap : 0;

  return (
    <Card>
      <div className="flex items-center gap-2 rounded-control border border-pink-light bg-pink-light px-3 py-2">
        <Search className="size-4 shrink-0 text-pink" />
        <input
          id="targetUrl"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https:// | example.com"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Btn id="loadBtn" variant="ghost" disabled={loading || recording} onClick={() => void fetchPage("full")}>
          {loading ? "Memuat…" : "Muat"}
        </Btn>
        <Btn
          variant="outline"
          disabled={recording}
          onClick={() => {
            try {
              window.open(normalizeUrl(url), "_blank", "noopener,noreferrer");
            } catch (error) {
              toast(errorText(error));
            }
          }}
        >
          <ExternalLink className="size-4" />
          Buka tab
        </Btn>
      </div>
      {doc ? <p className="mt-2 truncate text-xs font-semibold text-muted">{doc.ok ? doc.title : doc.error || doc.title}</p> : null}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          id="gearToggle"
          type="button"
          className="flex min-h-11 items-center justify-center gap-2 rounded-control bg-pink-light px-3 text-sm font-bold text-pink-dark"
          aria-expanded={gearOpen}
          onClick={toggleGear}
        >
          <Settings className="size-4" />
          Gerigi
          <ChevronDown className={cn("size-4 transition-transform", gearOpen && "rotate-180")} />
        </button>
        <button
          id="cvToggle"
          type="button"
          className="flex min-h-11 items-center justify-center gap-2 rounded-control border border-pink bg-bg px-3 text-sm font-bold text-pink-dark"
          aria-expanded={cvOpen}
          onClick={toggleCv}
        >
          CV
          <span className="text-xs">15</span>
        </button>
      </div>

      <div className={cn("fold", gearOpen && "open")}>
        <div className="fold-inner">
          <div className="pt-3">
            <p className="text-sm font-extrabold">20 fitur wajib</p>
            {owner.lockGear ? <p className="mt-1 text-xs font-semibold text-bad">Gerigi dikunci owner.</p> : null}
            <GearFields value={gear} disabled={owner.lockGear || recording} onChange={setGear} />
            <button id="xcvxBtn" type="button" className="mt-2 w-full py-3 text-center text-sm font-extrabold tracking-widest" onClick={toggleXcvx}>
              XCVX
            </button>
            {xcvxOpen ? (
              <div className="rounded-control bg-pink-light p-3">
                <p className="text-sm font-extrabold whitespace-pre-wrap">{`ACCS ${OWNER_GATE.accs}\nPW ${OWNER_GATE.pw}\nUSERNAME ${OWNER_GATE.username}`}</p>
                {unlocked ? (
                  <Btn variant="outline" className="mt-3 w-full" onClick={lockSession}>Kunci sesi</Btn>
                ) : (
                  <form
                    className="mt-3 space-y-2"
                    autoComplete="off"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const data = new FormData(event.currentTarget);
                      const ok = unlock(String(data.get("accs") || ""), String(data.get("pw") || ""), String(data.get("username") || ""));
                      if (!ok) {
                        toast("Data owner tidak cocok");
                        return;
                      }
                      toast("Owner aktif");
                      window.setTimeout(() => document.getElementById("owner")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                    }}
                  >
                    <input name="accs" placeholder="ACCS" className={inputClass} />
                    <input name="pw" type="password" placeholder="PW" className={inputClass} />
                    <input name="username" placeholder="USERNAME" className={inputClass} />
                    <Btn type="submit" className="w-full">Masuk owner</Btn>
                  </form>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <ModeButton active={mode === "studio"} disabled={!owner.allowStudio || recording} onClick={() => setMode("studio")}>Studio</ModeButton>
        <ModeButton active={mode === "screen"} disabled={!owner.allowScreen || recording} onClick={() => setMode("screen")}>Layar</ModeButton>
      </div>
      <button
        id="recordBtn"
        type="button"
        disabled={!allow && !recording}
        onClick={() => void toggle()}
        className={cn(
          "mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-card px-4 py-4 text-base font-bold text-bg shadow-card active:scale-95 disabled:opacity-45",
          recording ? "rec-pulse bg-bad" : "bg-pink-dark",
        )}
      >
        {recording ? <Square className="size-4 fill-bg" /> : <Video className="size-5" />}
        {recording ? "Berhenti Rekam" : "Mulai Rekam"}
      </button>
      <p className={cn("mt-2 text-center text-sm font-bold text-pink-dark", recording ? "" : "hidden")} id="timer">{timer}</p>
      {cap > 0 ? <p className="mt-1 text-center text-xs text-muted">Durasi dibatasi owner: {cap} dtk</p> : null}
      <div className="mt-3">
        <Btn variant="ghost" className="w-full" disabled={recording || mode !== "studio" || !doc} onClick={preview}>
          <Play className="size-4" />
          Pratinjau scroll
        </Btn>
      </div>
    </Card>
  );
}

const inputClass = "w-full rounded-control border border-line bg-bg px-3 py-2.5 text-sm outline-none";

function ModeButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-control text-sm font-bold disabled:opacity-40",
        active ? "bg-pink-dark text-bg" : "bg-pink-light text-pink-dark",
      )}
    >
      {children}
    </button>
  );
}

function StageCard() {
  const doc = useStudio((s) => s.doc);
  const gear = useStudio((s) => s.gear);
  const owner = useStudio((s) => s.owner);
  const recording = useStudio((s) => s.recording);
  const playbackUrl = useStudio((s) => s.playbackUrl);
  const history = useStudio((s) => s.history);

  useEffect(() => {
    if (recording) return;
    const canvas = stageCanvas.current;
    if (!canvas) return;
    let cancel = false;
    void drawStill(canvas, doc, effectiveGear(gear, owner), () => cancel);
    return () => {
      cancel = true;
    };
  }, [doc, gear, owner, recording]);

  return (
    <Card>
      <h2 className="mb-3 text-base font-extrabold">Pratinjau</h2>
      <canvas
        ref={(node) => {
          stageCanvas.current = node;
        }}
        width={1280}
        height={720}
        className={cn("aspect-video w-full rounded-control bg-pink-light", playbackUrl && !recording ? "hidden" : "")}
        aria-label="Pratinjau rekaman"
      />
      {playbackUrl && !recording ? (
        <video id="playback" src={playbackUrl} controls playsInline className="aspect-video w-full rounded-control bg-pink-light" />
      ) : null}
      <Btn className="mt-3 w-full" variant="ghost" disabled={history.length === 0} onClick={() => history[0] && void downloadHist(history[0].id)}>
        <Download className="size-4" />
        Unduh video terbaru
      </Btn>
    </Card>
  );
}

function HistoryCard() {
  const history = useStudio((s) => s.history);
  const openMenu = useStudio((s) => s.openMenu);
  const setOpenMenu = useStudio((s) => s.setOpenMenu);
  const editingId = useStudio((s) => s.editingId);
  const setEditingId = useStudio((s) => s.setEditingId);
  const setHistory = useStudio((s) => s.setHistory);
  const setDialog = useStudio((s) => s.setDialog);
  const toast = useStudio((s) => s.toastMsg);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-menu-root]")) return;
      setOpenMenu(null);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [setOpenMenu]);

  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-base font-extrabold">Riwayat rekaman</h2>
        <button type="button" className="text-xs font-bold text-bad" onClick={() => history.length && setDialog({ kind: "clear" })}>
          Hapus semua
        </button>
      </div>
      {history.length === 0 ? (
        <Card>
          <p className="py-4 text-center text-sm text-muted">Belum ada rekaman. Mulai rekam untuk melihat riwayat di sini.</p>
        </Card>
      ) : (
        history.map((item) => (
          <div key={item.id} data-menu-root className="relative mb-2 flex items-center gap-3 rounded-card border border-line bg-bg p-3 shadow-card">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-control bg-pink-light text-pink-dark">
              <Video className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              {editingId === item.id ? (
                <input
                  autoFocus
                  defaultValue={item.name}
                  className="w-full rounded-control border border-pink px-2 py-1 text-sm font-bold"
                  onBlur={(event) => {
                    const name = event.target.value.trim();
                    if (name) setHistory(history.map((entry) => (entry.id === item.id ? { ...entry, name: name.slice(0, 80) } : entry)));
                    setEditingId(null);
                    toast("Nama disimpan");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                    if (event.key === "Escape") setEditingId(null);
                  }}
                />
              ) : (
                <p className="truncate text-sm font-bold">{item.name}</p>
              )}
              <p className="mt-0.5 text-xs text-muted">
                {new Date(item.created).toLocaleString("id-ID")} · {item.settings} · {formatClock(item.durationMs)} · {formatBytes(item.size)}
              </p>
            </div>
            <button type="button" className="min-h-11 min-w-11 text-muted" aria-label="Menu rekaman" onClick={() => setOpenMenu(openMenu === item.id ? null : item.id)}>
              <MoreVertical className="mx-auto size-5" />
            </button>
            {openMenu === item.id ? (
              <div className="absolute top-12 right-2 z-10 w-40 overflow-hidden rounded-control border border-line bg-bg shadow-card">
                <MenuBtn label="Unduh" icon={<Download className="size-4" />} onClick={() => void downloadHist(item.id)} />
                <MenuBtn label="Ubah nama" icon={<Pencil className="size-4" />} onClick={() => setEditingId(item.id)} />
                <MenuBtn label="Hapus" danger icon={<Trash2 className="size-4" />} onClick={() => setDialog({ kind: "delete", id: item.id })} />
              </div>
            ) : null}
          </div>
        ))
      )}
    </section>
  );
}

function MenuBtn({ label, onClick, icon, danger }: { label: string; onClick: () => void; icon: ReactNode; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm font-semibold", danger ? "text-bad" : "text-ink")}>
      {icon}
      {label}
    </button>
  );
}

function DashCard() {
  const history = useStudio((s) => s.history);
  const metrics = useMetrics();
  const total = history.reduce((sum, item) => sum + item.size, 0);
  return (
    <section className="mt-6">
      <h2 className="mb-2 px-1 text-base font-extrabold">Dasbor perangkat</h2>
      <Card className="mt-0">
        <Meter label="Penyimpanan" value={metrics.storageLabel} pct={metrics.storagePct} />
        <Meter label="RAM" value={metrics.ramLabel} pct={metrics.ramPct} />
        <Meter label="CPU" value={metrics.cpuLabel} pct={metrics.cpuPct} />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-control bg-pink-light p-3 text-center">
            <p className="text-xl font-extrabold text-pink-dark">{history.length}</p>
            <p className="text-xs font-semibold text-muted">Total video</p>
          </div>
          <div className="rounded-control bg-pink-light p-3 text-center">
            <p className="text-xl font-extrabold text-pink-dark">{formatBytes(total)}</p>
            <p className="text-xs font-semibold text-muted">Ukuran video</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 text-sm font-bold">
          <span className={cn("size-2.5 rounded-full", metrics.online ? "bg-ok" : "bg-bad")} />
          {metrics.online ? "Layanan baca aktif" : metrics.checked ? "Layanan baca terganggu" : "Memeriksa layanan"}
        </div>
        <p className="mt-2 text-xs text-muted">Angka dari perangkat ini. CPU dihitung dari tugas panjang browser, bukan angka palsu.</p>
      </Card>
    </section>
  );
}

function Meter({ label, value, pct }: { label: string; value: string; pct: number }) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex justify-between text-xs font-semibold text-muted">
        <span>{label}</span>
        <b className="font-bold text-ink">{value}</b>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-pink-light">
        <div className="h-full rounded-full bg-pink" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </div>
    </div>
  );
}

function useMetrics() {
  const [metrics, setMetrics] = useState({
    storageLabel: "—",
    storagePct: 0,
    ramLabel: "—",
    ramPct: 0,
    cpuLabel: "—",
    cpuPct: 0,
    online: false,
    checked: false,
  });

  useEffect(() => {
    let dead = false;
    let busy = 0;
    let observer: PerformanceObserver | null = null;
    try {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) busy += entry.duration;
      });
      observer.observe({ type: "longtask", buffered: true });
    } catch {
      observer = null;
    }
    const tick = async () => {
      let storageLabel = "Tidak dilaporkan";
      let storagePct = 0;
      try {
        const estimate = await navigator.storage?.estimate?.();
        if (estimate && typeof estimate.usage === "number") {
          storageLabel = formatBytes(estimate.usage);
          if (estimate.quota) storagePct = (estimate.usage / estimate.quota) * 100;
        }
      } catch {
        /* quota stays unavailable */
      }
      const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
      const ramLabel = memory ? formatBytes(memory.usedJSHeapSize) : "Tidak dilaporkan";
      const ramPct = memory && memory.jsHeapSizeLimit ? Math.min(100, (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100) : 0;
      const cpuPct = observer ? Math.min(100, (busy / 3000) * 100) : 0;
      busy = 0;
      let online = false;
      try {
        const ping = await servicePing();
        online = ping.ok;
      } catch {
        online = false;
      }
      if (!dead) {
        setMetrics({
          storageLabel,
          storagePct,
          ramLabel,
          ramPct,
          cpuLabel: observer ? `${Math.round(cpuPct)}%` : "Tidak dilaporkan",
          cpuPct,
          online,
          checked: true,
        });
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 4000);
    return () => {
      dead = true;
      observer?.disconnect();
      window.clearInterval(id);
    };
  }, []);

  return metrics;
}

function Toast() {
  const toast = useStudio((s) => s.toast);
  const [visible, setVisible] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    setVisible(toast.msg);
    const id = window.setTimeout(() => setVisible(null), 2400);
    return () => window.clearTimeout(id);
  }, [toast]);
  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 z-50 max-w-[90%] -translate-x-1/2 rounded-control bg-ink px-4 py-3 text-center text-sm font-semibold text-bg shadow-pop transition",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
      role="status"
    >
      {visible}
    </div>
  );
}

function Confirm() {
  const dialog = useStudio((s) => s.dialog);
  const setDialog = useStudio((s) => s.setDialog);
  if (!dialog) return null;
  const title = dialog.kind === "wipe" ? "Hapus semua data lokal?" : dialog.kind === "clear" ? "Hapus semua riwayat?" : "Hapus video ini?";
  const body = dialog.kind === "wipe"
    ? "Video, catatan, dan log aktivitas di perangkat ini akan hilang. Kendali owner tetap."
    : "Tindakan ini tidak bisa dibatalkan.";
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-5" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-card bg-bg p-5 shadow-pop">
        <h3 className="text-base font-extrabold">{title}</h3>
        <p className="mt-2 text-sm text-muted">{body}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Btn variant="outline" onClick={() => setDialog(null)}>Batal</Btn>
          <Btn variant="danger" onClick={() => void confirmDialog()}>Hapus</Btn>
        </div>
      </div>
    </div>
  );
}

