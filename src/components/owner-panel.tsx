import { useState, type ReactNode } from "react";
import { DEFAULT_GEAR, DEFAULT_OWNER, sanitizeOwner, type OwnerState } from "@/lib/gear";
import { downloadBlob } from "@/lib/actions";
import { useStudio } from "@/lib/store";
import { Btn, controlClass, Switch } from "@/components/ui";
import { GearFields } from "@/components/gear-fields";

export function OwnerPanel() {
  const unlocked = useStudio((s) => s.unlocked);
  const owner = useStudio((s) => s.owner);
  const setOwner = useStudio((s) => s.setOwner);
  const setGear = useStudio((s) => s.setGear);
  const setMode = useStudio((s) => s.setMode);
  const mode = useStudio((s) => s.mode);
  const log = useStudio((s) => s.log);
  const history = useStudio((s) => s.history);
  const toast = useStudio((s) => s.toastMsg);
  const pushLog = useStudio((s) => s.pushLog);
  const setDialog = useStudio((s) => s.setDialog);
  const setLog = useStudio((s) => s.setLog);
  const [openTool, setOpenTool] = useState(0);

  if (!unlocked) return null;

  const patch = (partial: Partial<OwnerState>) => setOwner({ ...owner, ...partial });

  const tools: { title: string; body: ReactNode }[] = [
    {
      title: "Kunci gerigi",
      body: (
        <Row label="Kunci 20 fitur di gerigi">
          <Switch on={owner.lockGear} label="Kunci gerigi" onClick={() => patch({ lockGear: !owner.lockGear })} />
        </Row>
      ),
    },
    {
      title: "Paksa watermark",
      body: (
        <Row label="Watermark QWENXYXF selalu menyala saat rekam">
          <Switch on={owner.forceWatermark} label="Paksa watermark" onClick={() => patch({ forceWatermark: !owner.forceWatermark })} />
        </Row>
      ),
    },
    {
      title: "Batas durasi",
      body: (
        <label className="block text-xs font-semibold text-muted">
          <span className="mb-1 flex justify-between">Plafon detik <b className="text-pink-dark">{owner.durationCap === 0 ? "mati" : owner.durationCap}</b></span>
          <input data-owner="durationCap" type="range" min={0} max={180} step={1} value={owner.durationCap} onChange={(event) => patch({ durationCap: Number(event.target.value) })} className="w-full accent-pink" />
        </label>
      ),
    },
    {
      title: "Izinkan Studio",
      body: (
        <Row label="Mode Studio bisa dipakai">
          <Switch
            on={owner.allowStudio}
            label="Izinkan Studio"
            onClick={() => {
              const allowStudio = !owner.allowStudio;
              patch({ allowStudio });
              if (!allowStudio && mode === "studio" && owner.allowScreen) setMode("screen");
            }}
          />
        </Row>
      ),
    },
    {
      title: "Izinkan Layar",
      body: (
        <Row label="Mode tangkap layar bisa dipakai">
          <Switch
            on={owner.allowScreen}
            label="Izinkan Layar"
            onClick={() => {
              const allowScreen = !owner.allowScreen;
              patch({ allowScreen });
              if (!allowScreen && mode === "screen" && owner.allowStudio) setMode("studio");
            }}
          />
        </Row>
      ),
    },
    {
      title: "Banner",
      body: (
        <input
          value={owner.banner}
          maxLength={120}
          placeholder="Teks di bawah nama aplikasi"
          onChange={(event) => patch({ banner: event.target.value })}
          className={controlClass}
        />
      ),
    },
    {
      title: "Ekspor JSON",
      body: (
        <Btn variant="ghost" onClick={() => {
          downloadBlob(new Blob([JSON.stringify({ version: 1, owner }, null, 2)], { type: "application/json" }), "qwenxyxf-owner.json");
          pushLog("Ekspor kendali owner");
          toast("Pengaturan owner diunduh");
        }}>Unduh pengaturan</Btn>
      ),
    },
    {
      title: "Impor JSON",
      body: (
        <input
          type="file"
          accept="application/json"
          className="block w-full text-sm"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            void file.text().then((text) => {
              const parsed = JSON.parse(text) as { owner?: unknown };
              const next = sanitizeOwner(parsed.owner ?? parsed);
              setOwner(next);
              pushLog("Impor kendali owner");
              toast("Kendali diimpor. Terapkan 20 fitur bila perlu.");
            }).catch(() => toast("Berkas JSON tidak valid"));
          }}
        />
      ),
    },
    {
      title: "Hapus data",
      body: <Btn variant="danger" onClick={() => setDialog({ kind: "wipe" })}>Hapus video, catatan, dan log</Btn>,
    },
    {
      title: "Log dan reset",
      body: (
        <div>
          <ul className="mb-3 max-h-36 space-y-1 overflow-auto text-xs text-muted">
            {log.length === 0 ? <li>Belum ada aktivitas.</li> : log.map((item) => (
              <li key={`${item.t}-${item.msg}`}>{new Date(item.t).toLocaleString("id-ID")} · {item.msg}</li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Btn variant="outline" className="flex-1" onClick={() => {
              const lines = [
                "QWENXYXF laporan",
                new Date().toISOString(),
                navigator.userAgent,
                `video ${history.length}`,
                ...log.map((item) => `${new Date(item.t).toISOString()} ${item.msg}`),
              ];
              downloadBlob(new Blob([lines.join("\n")], { type: "text/plain" }), "qwenxyxf-log.txt");
              toast("Laporan diunduh");
            }}>Unduh log</Btn>
            <Btn variant="ghost" className="flex-1" onClick={() => {
              setOwner(DEFAULT_OWNER);
              setGear(DEFAULT_GEAR);
              setLog([]);
              pushLog("Reset kendali owner");
              toast("Kendali owner kembali ke bawaan");
            }}>Reset</Btn>
          </div>
        </div>
      ),
    },
  ];

  return (
    <section id="owner" className="mt-4 rounded-card border border-line bg-bg p-4 shadow-card">
      <h2 className="text-base font-extrabold">Kendali owner</h2>
      <p className="mt-1 text-xs text-muted">10 tool mengunci perilaku aplikasi. 20 fitur di bawah jadi isi gerigi setelah diterapkan.</p>
      <div className="mt-3">
        {tools.map((tool, index) => {
          const shown = openTool === index;
          return (
            <div key={tool.title} className="border-b border-line last:border-b-0">
              <button type="button" className="flex min-h-11 w-full items-center justify-between text-left" aria-expanded={shown} onClick={() => setOpenTool(shown ? -1 : index)}>
                <span className="text-sm font-bold">
                  <span className="mr-2 text-xs text-muted">{String(index + 1).padStart(2, "0")}</span>
                  {tool.title}
                </span>
              </button>
              {shown ? <div className="pb-3">{tool.body}</div> : null}
            </div>
          );
        })}
      </div>
      <h3 className="mt-5 text-sm font-extrabold">20 fitur owner</h3>
      <GearFields value={owner.features} onChange={(features) => patch({ features })} />
      <Btn className="mt-2 w-full" onClick={() => {
        setGear(owner.features);
        pushLog("20 fitur owner diterapkan");
        toast("20 fitur diterapkan ke perekam");
      }}>Terapkan 20 fitur ke perekam</Btn>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-semibold">{label}</span>
      {children}
    </div>
  );
}
