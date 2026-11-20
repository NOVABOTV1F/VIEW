export type GearSettings = {
  scrollSpeed: number;
  fps: number;
  delay: number;
  maxDuration: number;
  fontScale: number;
  margin: number;
  resolution: "720p" | "1080p" | "1440p";
  format: "webm" | "mp4";
  bitrate: "low" | "med" | "high";
  easing: "linear" | "smooth";
  filePrefix: string;
  autoScroll: boolean;
  fullPage: boolean;
  pingpong: boolean;
  watermark: boolean;
  timestamp: boolean;
  cursorGhost: boolean;
  showUrlBar: boolean;
  progressBar: boolean;
  endCard: boolean;
};

export type OwnerState = {
  features: GearSettings;
  lockGear: boolean;
  forceWatermark: boolean;
  durationCap: number;
  allowStudio: boolean;
  allowScreen: boolean;
  banner: string;
};

export const DEFAULT_GEAR: GearSettings = {
  scrollSpeed: 6,
  fps: 30,
  delay: 0,
  maxDuration: 12,
  fontScale: 100,
  margin: 48,
  resolution: "1080p",
  format: "mp4",
  bitrate: "med",
  easing: "smooth",
  filePrefix: "QWENXYXF",
  autoScroll: true,
  fullPage: true,
  pingpong: false,
  watermark: true,
  timestamp: true,
  cursorGhost: true,
  showUrlBar: true,
  progressBar: true,
  endCard: true,
};

export const DEFAULT_OWNER: OwnerState = {
  features: DEFAULT_GEAR,
  lockGear: false,
  forceWatermark: false,
  durationCap: 0,
  allowStudio: true,
  allowScreen: true,
  banner: "",
};

export type GearField = {
  n: number;
  key: keyof GearSettings;
  label: string;
  group: "Gerak" | "Gambar" | "Lapisan" | "Berkas";
  kind: "range" | "select" | "bool" | "text";
  min?: number;
  max?: number;
  step?: number;
  options?: readonly string[];
};

export const GEAR_FIELDS: readonly GearField[] = [
  { n: 1, key: "scrollSpeed", label: "Kecepatan scroll", group: "Gerak", kind: "range", min: 1, max: 10, step: 1 },
  { n: 2, key: "autoScroll", label: "Auto scroll", group: "Gerak", kind: "bool" },
  { n: 3, key: "fullPage", label: "Full page capture", group: "Gerak", kind: "bool" },
  { n: 4, key: "easing", label: "Easing scroll", group: "Gerak", kind: "select", options: ["linear", "smooth"] },
  { n: 5, key: "pingpong", label: "Ping-pong scroll", group: "Gerak", kind: "bool" },
  { n: 6, key: "fontScale", label: "Skala huruf", group: "Gerak", kind: "range", min: 80, max: 140, step: 5 },
  { n: 7, key: "margin", label: "Margin halaman", group: "Gerak", kind: "range", min: 16, max: 80, step: 4 },
  { n: 8, key: "fps", label: "FPS", group: "Gambar", kind: "range", min: 10, max: 60, step: 1 },
  { n: 9, key: "resolution", label: "Resolusi", group: "Gambar", kind: "select", options: ["720p", "1080p", "1440p"] },
  { n: 10, key: "bitrate", label: "Bitrate", group: "Gambar", kind: "select", options: ["low", "med", "high"] },
  { n: 11, key: "format", label: "Format ekspor", group: "Gambar", kind: "select", options: ["webm", "mp4"] },
  { n: 12, key: "delay", label: "Jeda mulai (detik)", group: "Gambar", kind: "range", min: 0, max: 10, step: 1 },
  { n: 13, key: "maxDuration", label: "Durasi maks (detik)", group: "Gambar", kind: "range", min: 3, max: 180, step: 1 },
  { n: 14, key: "watermark", label: "Watermark QWENXYXF", group: "Lapisan", kind: "bool" },
  { n: 15, key: "timestamp", label: "Stempel waktu", group: "Lapisan", kind: "bool" },
  { n: 16, key: "cursorGhost", label: "Kursor bayangan", group: "Lapisan", kind: "bool" },
  { n: 17, key: "showUrlBar", label: "Bilah URL", group: "Lapisan", kind: "bool" },
  { n: 18, key: "progressBar", label: "Bilah progres", group: "Lapisan", kind: "bool" },
  { n: 19, key: "endCard", label: "Kartu akhir", group: "Lapisan", kind: "bool" },
  { n: 20, key: "filePrefix", label: "Awalan nama berkas", group: "Berkas", kind: "text" },
];

export const OPTION_LABEL: Record<string, string> = {
  "720p": "720p",
  "1080p": "1080p",
  "1440p": "1440p",
  webm: "WEBM",
  mp4: "MP4",
  low: "Rendah",
  med: "Sedang",
  high: "Tinggi",
  linear: "Linear",
  smooth: "Mulus",
};

export const FIELD_GROUPS = ["Gerak", "Gambar", "Lapisan", "Berkas"] as const;

function obj(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" ? (input as Record<string, unknown>) : {};
}

function num(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function sanitizeGear(input: unknown, base: GearSettings = DEFAULT_GEAR): GearSettings {
  const o = obj(input);
  const one = <T extends string>(key: keyof GearSettings, allowed: readonly T[], fallback: T): T =>
    allowed.includes(o[key] as T) ? (o[key] as T) : fallback;
  const prefix = typeof o.filePrefix === "string" ? o.filePrefix.trim().slice(0, 32) : "";
  return {
    scrollSpeed: Math.round(clamp(num(o.scrollSpeed, base.scrollSpeed), 1, 10)),
    fps: Math.round(clamp(num(o.fps, base.fps), 10, 60)),
    delay: Math.round(clamp(num(o.delay, base.delay), 0, 10)),
    maxDuration: Math.round(clamp(num(o.maxDuration, base.maxDuration), 3, 180)),
    fontScale: Math.round(clamp(num(o.fontScale, base.fontScale), 80, 140)),
    margin: Math.round(clamp(num(o.margin, base.margin), 16, 80)),
    resolution: one("resolution", ["720p", "1080p", "1440p"] as const, base.resolution),
    format: one("format", ["webm", "mp4"] as const, base.format),
    bitrate: one("bitrate", ["low", "med", "high"] as const, base.bitrate),
    easing: one("easing", ["linear", "smooth"] as const, base.easing),
    filePrefix: prefix || base.filePrefix,
    autoScroll: typeof o.autoScroll === "boolean" ? o.autoScroll : base.autoScroll,
    fullPage: typeof o.fullPage === "boolean" ? o.fullPage : base.fullPage,
    pingpong: typeof o.pingpong === "boolean" ? o.pingpong : base.pingpong,
    watermark: typeof o.watermark === "boolean" ? o.watermark : base.watermark,
    timestamp: typeof o.timestamp === "boolean" ? o.timestamp : base.timestamp,
    cursorGhost: typeof o.cursorGhost === "boolean" ? o.cursorGhost : base.cursorGhost,
    showUrlBar: typeof o.showUrlBar === "boolean" ? o.showUrlBar : base.showUrlBar,
    progressBar: typeof o.progressBar === "boolean" ? o.progressBar : base.progressBar,
    endCard: typeof o.endCard === "boolean" ? o.endCard : base.endCard,
  };
}

export function sanitizeOwner(input: unknown): OwnerState {
  const o = obj(input);
  return {
    features: sanitizeGear(o.features, DEFAULT_GEAR),
    lockGear: o.lockGear === true,
    forceWatermark: o.forceWatermark === true,
    durationCap: Math.round(clamp(num(o.durationCap, 0), 0, 180)),
    allowStudio: o.allowStudio !== false,
    allowScreen: o.allowScreen !== false,
    banner: typeof o.banner === "string" ? o.banner.slice(0, 120) : "",
  };
}

export function effectiveGear(gear: GearSettings, owner: OwnerState): GearSettings {
  const maxDuration = owner.durationCap > 0 ? Math.min(gear.maxDuration, owner.durationCap) : gear.maxDuration;
  return {
    ...gear,
    watermark: owner.forceWatermark ? true : gear.watermark,
    maxDuration: Math.max(3, maxDuration),
  };
}

export function resolutionSize(resolution: GearSettings["resolution"]): { w: number; h: number } {
  if (resolution === "720p") return { w: 1280, h: 720 };
  if (resolution === "1440p") return { w: 2560, h: 1440 };
  return { w: 1920, h: 1080 };
}

export function bitrateFor(gear: GearSettings): number {
  const base = gear.bitrate === "low" ? 1_200_000 : gear.bitrate === "high" ? 6_000_000 : 2_800_000;
  const scale = gear.resolution === "720p" ? 1 : gear.resolution === "1440p" ? 2.1 : 1.5;
  return Math.round(base * scale);
}
