import { create } from "zustand";
import {
  DEFAULT_GEAR,
  DEFAULT_OWNER,
  sanitizeGear,
  sanitizeOwner,
  type GearSettings,
  type OwnerState,
} from "@/lib/gear";
import { ownerMatches } from "@/lib/owner-gate";
import type { HistMeta, LogItem, PageDoc } from "@/lib/types";

const GEAR_KEY = "qwenxyxf_gear";
const OWNER_KEY = "qwenxyxf_owner";
const HIST_KEY = "qwenxyxf_history";
const NOTES_KEY = "qwenxyxf_notes";
const LOG_KEY = "qwenxyxf_log";
const URL_KEY = "qwenxyxf_url";
const MODE_KEY = "qwenxyxf_mode";
const UNLOCK_KEY = "qwenxyxf_owner_session";

export type DialogState =
  | { kind: "clear" }
  | { kind: "delete"; id: string }
  | { kind: "wipe" }
  | null;

type ToastState = { id: number; msg: string } | null;

type StudioState = {
  hydrated: boolean;
  url: string;
  mode: "studio" | "screen";
  gearOpen: boolean;
  cvOpen: boolean;
  xcvxOpen: boolean;
  gear: GearSettings;
  owner: OwnerState;
  unlocked: boolean;
  doc: PageDoc | null;
  loadedFor: string;
  loadedMode: "" | "full" | "meta";
  loading: boolean;
  recording: boolean;
  timer: string;
  history: HistMeta[];
  notes: string;
  log: LogItem[];
  toast: ToastState;
  dialog: DialogState;
  playbackUrl: string | null;
  editingId: string | null;
  openMenu: string | null;
  hydrate: () => void;
  toastMsg: (msg: string) => void;
  setGear: (gear: GearSettings) => void;
  setOwner: (owner: OwnerState) => void;
  setUrl: (url: string) => void;
  setMode: (mode: "studio" | "screen") => void;
  toggleGear: () => void;
  toggleCv: () => void;
  toggleXcvx: () => void;
  setDoc: (doc: PageDoc | null, loadedFor: string, loadedMode: "" | "full" | "meta") => void;
  setLoading: (value: boolean) => void;
  setRecording: (value: boolean) => void;
  setTimer: (value: string) => void;
  setHistory: (history: HistMeta[]) => void;
  setNotes: (notes: string) => void;
  pushLog: (msg: string) => void;
  setLog: (log: LogItem[]) => void;
  unlock: (accs: string, pw: string, username: string) => boolean;
  lockSession: () => void;
  setDialog: (dialog: DialogState) => void;
  setPlayback: (url: string | null) => void;
  setEditingId: (id: string | null) => void;
  setOpenMenu: (id: string | null) => void;
};

function readJson(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function sanitizeHistory(input: unknown): HistMeta[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 30).flatMap((item) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : null;
    if (!row || typeof row.id !== "string") return [];
    const created = Number(row.created);
    const size = Number(row.size);
    const durationMs = Number(row.durationMs);
    return [
      {
        id: row.id,
        name: typeof row.name === "string" && row.name.trim() ? row.name.slice(0, 80) : "Rekaman",
        created: Number.isFinite(created) ? created : Date.now(),
        settings: typeof row.settings === "string" ? row.settings.slice(0, 80) : "",
        size: Number.isFinite(size) ? Math.max(0, size) : 0,
        format: row.format === "mp4" ? "mp4" : "webm",
        durationMs: Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0,
      },
    ];
  });
}

function sanitizeLog(input: unknown): LogItem[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 40).flatMap((item) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : null;
    if (!row || typeof row.msg !== "string") return [];
    const t = Number(row.t);
    return [{ t: Number.isFinite(t) ? t : Date.now(), msg: row.msg.slice(0, 160) }];
  });
}

let toastSeq = 1;

export const useStudio = create<StudioState>((set, get) => ({
  hydrated: false,
  url: "",
  mode: "studio",
  gearOpen: false,
  cvOpen: false,
  xcvxOpen: false,
  gear: DEFAULT_GEAR,
  owner: DEFAULT_OWNER,
  unlocked: false,
  doc: null,
  loadedFor: "",
  loadedMode: "",
  loading: false,
  recording: false,
  timer: "00:00",
  history: [],
  notes: "",
  log: [],
  toast: null,
  dialog: null,
  playbackUrl: null,
  editingId: null,
  openMenu: null,
  hydrate: () => {
    if (get().hydrated || typeof window === "undefined") return;
    const savedUrl = localStorage.getItem(URL_KEY) || "";
    const savedMode = localStorage.getItem(MODE_KEY) === "screen" ? "screen" : "studio";
    set({
      hydrated: true,
      url: savedUrl.slice(0, 500),
      mode: savedMode,
      gear: sanitizeGear(readJson(GEAR_KEY), DEFAULT_GEAR),
      owner: sanitizeOwner(readJson(OWNER_KEY)),
      history: sanitizeHistory(readJson(HIST_KEY)),
      notes: typeof localStorage.getItem(NOTES_KEY) === "string" ? (localStorage.getItem(NOTES_KEY) || "").slice(0, 4000) : "",
      log: sanitizeLog(readJson(LOG_KEY)),
      unlocked: sessionStorage.getItem(UNLOCK_KEY) === "1",
    });
  },
  toastMsg: (msg) => set({ toast: { id: toastSeq++, msg } }),
  setGear: (gear) => {
    const next = sanitizeGear(gear, get().gear);
    set({ gear: next });
    if (get().hydrated) writeJson(GEAR_KEY, next);
  },
  setOwner: (owner) => {
    const next = sanitizeOwner(owner);
    set({ owner: next });
    if (get().hydrated) writeJson(OWNER_KEY, next);
  },
  setUrl: (url) => {
    const next = url.slice(0, 500);
    set({ url: next });
    if (get().hydrated) localStorage.setItem(URL_KEY, next);
  },
  setMode: (mode) => {
    set({ mode });
    if (get().hydrated) localStorage.setItem(MODE_KEY, mode);
  },
  toggleGear: () => set({ gearOpen: !get().gearOpen }),
  toggleCv: () => set({ cvOpen: !get().cvOpen }),
  toggleXcvx: () => set({ xcvxOpen: !get().xcvxOpen }),
  setDoc: (doc, loadedFor, loadedMode) => set({ doc, loadedFor, loadedMode }),
  setLoading: (loading) => set({ loading }),
  setRecording: (recording) => set({ recording }),
  setTimer: (timer) => set({ timer }),
  setHistory: (history) => {
    const next = history.slice(0, 30);
    set({ history: next });
    if (get().hydrated) writeJson(HIST_KEY, next);
  },
  setNotes: (notes) => {
    const next = notes.slice(0, 4000);
    set({ notes: next });
    if (get().hydrated) localStorage.setItem(NOTES_KEY, next);
  },
  setLog: (log) => {
    const next = log.slice(0, 40);
    set({ log: next });
    if (get().hydrated) writeJson(LOG_KEY, next);
  },
  pushLog: (msg) => {
    const next = [{ t: Date.now(), msg: msg.slice(0, 160) }, ...get().log].slice(0, 40);
    get().setLog(next);
  },
  unlock: (accs, pw, username) => {
    if (!ownerMatches(accs, pw, username)) return false;
    sessionStorage.setItem(UNLOCK_KEY, "1");
    set({ unlocked: true });
    get().pushLog("Owner masuk");
    return true;
  },
  lockSession: () => {
    sessionStorage.removeItem(UNLOCK_KEY);
    set({ unlocked: false });
    get().pushLog("Sesi owner dikunci");
  },
  setDialog: (dialog) => set({ dialog, openMenu: dialog ? null : get().openMenu }),
  setPlayback: (url) => {
    const prev = get().playbackUrl;
    if (prev && prev !== url) URL.revokeObjectURL(prev);
    set({ playbackUrl: url });
  },
  setEditingId: (editingId) => set({ editingId, openMenu: null }),
  setOpenMenu: (openMenu) => set({ openMenu }),
}));
