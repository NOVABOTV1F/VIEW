import { bitrateFor, resolutionSize, type GearSettings } from "@/lib/gear";
import { C } from "@/lib/palette";
import type { Clip, PageDoc } from "@/lib/types";
import { formatClock, readingMinutes } from "@/lib/text";
import { hostOf } from "@/lib/url";

let epoch = 0;
let recordingActive = false;

type Phase = "hold" | "play" | "end" | "count";

type Block =
  | {
      t: "kicker" | "title" | "meta" | "h" | "p";
      lines: string[];
      y: number;
      h: number;
      size: number;
      color: string;
      weight: number;
    }
  | { t: "img"; img: HTMLImageElement; y: number; h: number; dw: number; dh: number };

type Model = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  settings: GearSettings;
  doc: PageDoc | null;
  urlLabel: string;
  blocks: Block[];
  chromeH: number;
  maxScroll: number;
  video: HTMLVideoElement | null;
};

type Sink = {
  add: (canvas: HTMLCanvasElement, timestamp: number) => void;
  finish: () => Promise<Blob>;
};

function px(width: number, value: number) {
  return Math.max(1, Math.round(value * (width / 1280)));
}

function font(weight: number, size: number) {
  return `${weight} ${Math.max(10, Math.round(size))}px Manrope, "Segoe UI", sans-serif`;
}

let scratch: CanvasRenderingContext2D | null = null;

function measureCtx() {
  if (!scratch) {
    const canvas = document.createElement("canvas");
    scratch = canvas.getContext("2d");
  }
  if (!scratch) throw new Error("Canvas tidak tersedia");
  return scratch;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    } else {
      current = next;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && lines.join(" ").length + 8 < text.length) {
    const last = lines[maxLines - 1] ?? "";
    lines[maxLines - 1] = `${last.slice(0, Math.max(0, last.length - 1))}…`;
  }
  return lines;
}

function ellipsis(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let value = text;
  while (value.length > 1 && ctx.measureText(`${value}…`).width > maxWidth) value = value.slice(0, -1);
  return `${value}…`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

async function prepareAssets(doc: PageDoc | null) {
  if (typeof document !== "undefined" && document.fonts) {
    try {
      await document.fonts.load("700 48px Manrope");
      await document.fonts.ready;
    } catch {
      /* system font remains usable */
    }
  }
  if (!doc) return [];
  const images = await Promise.all(
    doc.images.map(
      (image) =>
        new Promise<HTMLImageElement | null>((resolve) => {
          const el = new Image();
          el.onload = () => resolve(el.naturalWidth > 0 ? el : null);
          el.onerror = () => resolve(null);
          el.src = image.dataUrl;
        }),
    ),
  );
  return images.flatMap((image) => (image ? [image] : []));
}

function layout(settings: GearSettings, doc: PageDoc | null, images: HTMLImageElement[], width: number, height: number) {
  const ctx = measureCtx();
  const scale = settings.fontScale / 100;
  const margin = px(width, settings.margin);
  const contentW = Math.max(80, width - margin * 2);
  const chromeH = settings.showUrlBar ? px(width, 78) : 0;
  const blocks: Block[] = [];
  if (!doc) return { blocks, chromeH, maxScroll: 0 };
  let y = px(width, 28);

  const pushText = (
    kind: Block["t"] & string,
    text: string,
    size: number,
    weight: number,
    color: string,
    maxLines: number,
    gap: number,
  ) => {
    if (kind === "img") return;
    ctx.font = font(weight, size);
    const lines = wrap(ctx, text, contentW, maxLines);
    if (lines.length === 0) return;
    const lineHeight = Math.round(size * 1.35);
    const blockH = lines.length * lineHeight;
    blocks.push({ t: kind as "kicker", lines, y, h: blockH, size, color, weight });
    y += blockH + gap;
  };

  const pushImage = (img: HTMLImageElement) => {
    const maxH = px(width, 340);
    const fit = Math.min(contentW / img.naturalWidth, maxH / img.naturalHeight, 1);
    const dw = Math.max(1, Math.round(img.naturalWidth * fit));
    const dh = Math.max(1, Math.round(img.naturalHeight * fit));
    blocks.push({ t: "img", img, y, h: dh, dw, dh });
    y += dh + px(width, 16);
  };

  pushText("kicker", (doc.siteName || hostOf(doc.finalUrl)).toUpperCase(), px(width, 15) * scale, 700, C.pink, 1, px(width, 10));
  pushText("title", doc.title || hostOf(doc.finalUrl), px(width, 40) * scale, 800, C.ink, 4, px(width, 12));
  if (doc.description) pushText("meta", doc.description, px(width, 18) * scale, 500, C.muted, 4, px(width, 12));
  const minutes = readingMinutes(doc.words);
  pushText(
    "meta",
    `${doc.words} kata${minutes ? ` · ${minutes} mnt baca` : ""}${doc.ok ? "" : ` · status ${doc.status}`}`,
    px(width, 15) * scale,
    700,
    doc.ok ? C.muted : C.bad,
    2,
    px(width, 20),
  );

  let imageIndex = 0;
  let paragraphs = 0;
  for (const block of doc.blocks) {
    if (block.kind === "h") {
      pushText("h", block.text, px(width, 26) * scale, 800, C.pinkDark, 3, px(width, 8));
    } else {
      pushText("p", block.text, px(width, 18) * scale, 500, C.ink, 12, px(width, 12));
      paragraphs += 1;
      const image = images[imageIndex];
      if (image && paragraphs % 2 === 0) {
        pushImage(image);
        imageIndex += 1;
      }
    }
  }
  while (imageIndex < images.length) {
    const image = images[imageIndex];
    if (!image) break;
    pushImage(image);
    imageIndex += 1;
  }
  y += px(width, 28);
  const viewH = Math.max(1, height - chromeH);
  return { blocks, chromeH, maxScroll: Math.max(0, y - viewH) };
}

export function timeline(settings: GearSettings, maxScroll: number) {
  const pxPerSec = 40 + settings.scrollSpeed * 70;
  const onePass = maxScroll > 8 ? Math.max(900, (maxScroll / pxPerSec) * 1000) : 0;
  let bodyMs = settings.maxDuration * 1000;
  if (settings.autoScroll && maxScroll >= 8 && settings.fullPage && !settings.pingpong) {
    bodyMs = Math.min(settings.maxDuration * 1000, onePass);
  }
  bodyMs = Math.max(1000, bodyMs);
  const endMs = settings.endCard ? 1400 : 0;
  return { bodyMs, totalMs: bodyMs + endMs, pxPerSec };
}

function scrollAt(elapsed: number, settings: GearSettings, maxScroll: number, pxPerSec: number) {
  if (!settings.autoScroll || maxScroll < 8) return 0;
  const duration = (maxScroll / pxPerSec) * 1000;
  let unit = elapsed / Math.max(1, duration);
  if (settings.pingpong) {
    const tri = unit % 2;
    unit = tri <= 1 ? tri : 2 - tri;
  } else {
    unit = Math.min(1, Math.max(0, unit));
  }
  if (settings.easing === "smooth") {
    const eased = Math.min(1, Math.max(0, unit));
    unit = eased * eased * (3 - 2 * eased);
  }
  return unit * maxScroll;
}

function paint(model: Model, elapsed: number, phase: Phase, count: number, totalMs: number, pxPerSec: number) {
  const { ctx, w, h, settings } = model;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, w, h);

  if (phase === "end") {
    ctx.fillStyle = C.pinkLight;
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = C.pink;
    ctx.font = font(800, px(w, 18));
    ctx.fillText("QWENXYXF", w / 2, h / 2 - px(w, 52));
    ctx.fillStyle = C.ink;
    ctx.font = font(800, px(w, 36) * (settings.fontScale / 100));
    ctx.fillText(ellipsis(ctx, model.doc?.title || "Rekaman selesai", w - px(w, 100)), w / 2, h / 2);
    ctx.fillStyle = C.muted;
    ctx.font = font(600, px(w, 16));
    ctx.fillText(ellipsis(ctx, model.urlLabel, w - px(w, 100)), w / 2, h / 2 + px(w, 42));
  } else if (model.video) {
    const videoW = model.video.videoWidth;
    const videoH = model.video.videoHeight;
    if (videoW > 0 && videoH > 0) {
      const scale = Math.max(w / videoW, h / videoH);
      const dw = videoW * scale;
      const dh = videoH * scale;
      ctx.drawImage(model.video, (w - dw) / 2, (h - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = C.pinkLight;
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = "center";
      ctx.fillStyle = C.pinkDark;
      ctx.font = font(700, px(w, 24));
      ctx.fillText("Menunggu gambar layar", w / 2, h / 2);
    }
  } else if (!model.doc) {
    ctx.fillStyle = C.pinkLight;
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = "center";
    ctx.fillStyle = C.ink;
    ctx.font = font(800, px(w, 40));
    ctx.fillText("QWENXYXF", w / 2, h / 2 - px(w, 12));
    ctx.fillStyle = C.muted;
    ctx.font = font(600, px(w, 18));
    ctx.fillText("Muat tautan untuk pratinjau scroll", w / 2, h / 2 + px(w, 28));
  } else {
    const scroll = phase === "play" ? scrollAt(elapsed, settings, model.maxScroll, pxPerSec) : 0;
    const margin = px(w, settings.margin);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, model.chromeH, w, h - model.chromeH);
    ctx.clip();
    ctx.translate(0, model.chromeH - scroll);
    for (const block of model.blocks) {
      if (block.y + block.h < scroll - 50 || block.y > scroll + (h - model.chromeH) + 50) continue;
      if (block.t === "img") {
        ctx.save();
        roundRect(ctx, margin, block.y, block.dw, block.dh, px(w, 14));
        ctx.clip();
        ctx.drawImage(block.img, margin, block.y, block.dw, block.dh);
        ctx.restore();
        continue;
      }
      ctx.fillStyle = block.color;
      ctx.font = font(block.weight, block.size);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const lineHeight = Math.round(block.size * 1.35);
      block.lines.forEach((line, index) => ctx.fillText(line, margin, block.y + index * lineHeight));
    }
    ctx.restore();
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  if (settings.showUrlBar && phase !== "end") {
    const chrome = model.chromeH || px(w, 78);
    ctx.fillStyle = C.pinkLight;
    ctx.fillRect(0, 0, w, chrome);
    const cy = chrome / 2;
    [C.pink, C.pinkDark, C.muted].forEach((color, index) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px(w, 26) + index * px(w, 20), cy, px(w, 5), 0, Math.PI * 2);
      ctx.fill();
    });
    const pillX = px(w, 96);
    const pillW = w - pillX - px(w, 22);
    const pillH = px(w, 34);
    ctx.fillStyle = C.bg;
    roundRect(ctx, pillX, cy - pillH / 2, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.fillStyle = C.muted;
    ctx.font = font(600, px(w, 15));
    ctx.fillText(ellipsis(ctx, model.urlLabel, pillW - px(w, 24)), pillX + px(w, 12), cy);
  }

  if (phase === "count") {
    ctx.fillStyle = "rgb(255 255 255 / 0.78)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = C.pinkDark;
    ctx.font = font(800, px(w, 112));
    ctx.textAlign = "center";
    ctx.fillText(String(count), w / 2, h / 2);
  }

  if (settings.timestamp && (phase === "play" || phase === "end")) {
    const label = formatClock(elapsed);
    ctx.font = font(700, px(w, 16));
    ctx.textAlign = "left";
    const tw = ctx.measureText(label).width + px(w, 18);
    const tx = px(w, 18);
    const ty = (phase === "end" ? px(w, 18) : model.chromeH + px(w, 14));
    ctx.fillStyle = C.pinkLight;
    roundRect(ctx, tx, ty, tw, px(w, 30), px(w, 10));
    ctx.fill();
    ctx.fillStyle = C.pinkDark;
    ctx.fillText(label, tx + px(w, 9), ty + px(w, 15));
  }

  if (settings.cursorGhost && phase === "play") {
    const margin = px(w, settings.margin);
    const cx = margin + (w - margin * 2) * (0.58 + 0.26 * Math.sin(elapsed / 680));
    const cy = model.chromeH + (h - model.chromeH) * (0.46 + 0.16 * Math.cos(elapsed / 860));
    const ripple = (elapsed % 1400) / 1400;
    ctx.beginPath();
    ctx.strokeStyle = C.pink;
    ctx.globalAlpha = 1 - ripple;
    ctx.lineWidth = px(w, 3);
    ctx.arc(cx, cy, px(w, 14) + ripple * px(w, 34), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.pink;
    ctx.beginPath();
    ctx.arc(cx, cy, px(w, 11), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.bg;
    ctx.beginPath();
    ctx.arc(cx, cy, px(w, 4), 0, Math.PI * 2);
    ctx.fill();
  }

  if (settings.watermark && phase !== "count") {
    const label = "QWENXYXF";
    ctx.font = font(800, px(w, 16) * (settings.fontScale / 100));
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = C.pinkDark;
    ctx.globalAlpha = 0.92;
    ctx.fillText(label, w - px(w, 20), h - px(w, 22));
    ctx.globalAlpha = 1;
  }

  if (settings.progressBar && (phase === "play" || phase === "end")) {
    const progress = phase === "end" || totalMs <= 0 ? 1 : Math.min(1, elapsed / totalMs);
    const bar = px(w, 8);
    ctx.fillStyle = C.pinkLight;
    ctx.fillRect(0, h - bar, w, bar);
    ctx.fillStyle = C.pink;
    ctx.fillRect(0, h - bar, Math.max(0, w * progress), bar);
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.globalAlpha = 1;
}

function mount(
  canvas: HTMLCanvasElement,
  settings: GearSettings,
  doc: PageDoc | null,
  images: HTMLImageElement[],
  urlLabel: string,
  video: HTMLVideoElement | null,
): Model {
  const { w, h } = resolutionSize(settings.resolution);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas tidak tersedia");
  const laid = layout(settings, video ? null : doc, video ? [] : images, w, h);
  return {
    canvas,
    ctx,
    w,
    h,
    settings,
    doc,
    urlLabel,
    blocks: laid.blocks,
    chromeH: settings.showUrlBar ? px(w, 78) : 0,
    maxScroll: video ? 0 : laid.maxScroll,
    video,
  };
}

function canvasTainted(ctx: CanvasRenderingContext2D) {
  try {
    ctx.getImageData(0, 0, 1, 1);
    return false;
  } catch {
    return true;
  }
}

function webmSink(stream: MediaStream, bitrate: number): Sink {
  if (typeof MediaRecorder === "undefined") throw new Error("Perekam video tidak tersedia");
  const mime = ["video/webm;codecs=vp8", "video/webm;codecs=vp9", "video/webm"].find((item) =>
    MediaRecorder.isTypeSupported(item),
  );
  if (!mime) throw new Error("WEBM tidak didukung browser ini");
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate });
  const chunks: Blob[] = [];
  let resolve: (blob: Blob) => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const done = new Promise<Blob>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  recorder.onerror = () => reject(new Error("Perekam WEBM gagal"));
  recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
  recorder.start(200);
  return {
    add() {},
    async finish() {
      if (recorder.state !== "inactive") {
        if (typeof recorder.requestData === "function") recorder.requestData();
        recorder.stop();
      }
      return done;
    },
  };
}

async function mp4Sink(canvas: HTMLCanvasElement, fps: number, bitrate: number): Promise<Sink> {
  if (typeof VideoEncoder === "undefined") throw new Error("MP4 tidak didukung");
  const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
  const width = canvas.width;
  const height = canvas.height;
  const codecs = ["avc1.640033", "avc1.640028", "avc1.4d0028", "avc1.42001f"];
  let codec = "";
  for (const candidate of codecs) {
    const support = await VideoEncoder.isConfigSupported({ codec: candidate, width, height, bitrate, framerate: fps });
    if (support.supported) {
      codec = support.config?.codec || candidate;
      break;
    }
  }
  if (!codec) throw new Error("MP4 tidak didukung");
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: "avc", width, height, frameRate: fps },
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });
  let failed: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (error) => {
      failed = error instanceof Error ? error : new Error("Encoder MP4 gagal");
    },
  });
  encoder.configure({ codec, width, height, bitrate, framerate: fps, latencyMode: "realtime" });
  const frameDur = Math.round(1_000_000 / fps);
  return {
    add(source, timestamp) {
      if (failed || encoder.state !== "configured" || encoder.encodeQueueSize > 8) return;
      const frame = new VideoFrame(source, { timestamp, duration: frameDur });
      try {
        encoder.encode(frame, { keyFrame: timestamp % 2_000_000 < frameDur });
      } finally {
        frame.close();
      }
    },
    async finish() {
      if (failed) throw failed;
      await encoder.flush();
      if (encoder.state !== "closed") encoder.close();
      muxer.finalize();
      return new Blob([target.buffer], { type: "video/mp4" });
    },
  };
}

async function makeCanvasSink(
  canvas: HTMLCanvasElement,
  settings: GearSettings,
  onNotice?: (message: string) => void,
): Promise<{ sink: Sink; ext: "webm" | "mp4" }> {
  const bitrate = bitrateFor(settings);
  if (settings.format === "mp4") {
    try {
      return { sink: await mp4Sink(canvas, settings.fps, bitrate), ext: "mp4" };
    } catch {
      onNotice?.("MP4 tidak didukung di browser ini. Disimpan sebagai WEBM.");
    }
  }
  return { sink: webmSink(canvas.captureStream(settings.fps), bitrate), ext: "webm" };
}

async function runFrames(
  my: number,
  model: Model,
  bodyMs: number,
  totalMs: number,
  pxPerSec: number,
  onFrame: (index: number, elapsed: number) => void,
) {
  const frameMs = 1000 / model.settings.fps;
  const started = performance.now();
  let last = -1;
  await new Promise<void>((resolve) => {
    const step = (now: number) => {
      if (epoch !== my) {
        resolve();
        return;
      }
      const elapsed = now - started;
      let index = Math.floor(elapsed / frameMs);
      if (index > last + 4) last = index - 1;
      const target = Math.min(index, last + 2);
      while (last < target) {
        last += 1;
        const ms = Math.min(totalMs, last * frameMs);
        paint(model, ms, ms >= bodyMs ? "end" : "play", 0, totalMs, pxPerSec);
        onFrame(last, ms);
      }
      if (elapsed >= totalMs) resolve();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

async function countdown(
  my: number,
  model: Model,
  seconds: number,
  totalMs: number,
  pxPerSec: number,
  onTimer: (label: string) => void,
) {
  for (let n = seconds; n > 0; n -= 1) {
    if (epoch !== my) return false;
    onTimer(formatClock(n * 1000));
    paint(model, 0, "count", n, totalMs, pxPerSec);
    const until = performance.now() + 1000;
    while (performance.now() < until) {
      if (epoch !== my) return false;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  }
  return epoch === my;
}

export async function drawStill(
  canvas: HTMLCanvasElement,
  doc: PageDoc | null,
  settings: GearSettings,
  cancelled: () => boolean,
) {
  if (recordingActive) return;
  const my = ++epoch;
  const images = await prepareAssets(doc);
  if (cancelled() || epoch !== my || recordingActive) return;
  const model = mount(canvas, settings, doc, images, doc?.finalUrl || "Studio QWENXYXF", null);
  const time = timeline(settings, model.maxScroll);
  paint(model, 0, "hold", 0, time.totalMs, time.pxPerSec);
}

export function beginPreview(canvas: HTMLCanvasElement, doc: PageDoc, settings: GearSettings) {
  if (recordingActive) return;
  const my = ++epoch;
  void (async () => {
    const images = await prepareAssets(doc);
    if (epoch !== my || recordingActive) return;
    const model = mount(canvas, settings, doc, images, doc.finalUrl, null);
    const time = timeline(settings, model.maxScroll);
    const cap = Math.min(time.totalMs, 8000);
    await runFrames(my, model, Math.min(time.bodyMs, cap), cap, time.pxPerSec, () => undefined);
  })();
}

export function stopLive() {
  epoch += 1;
}

type RecordArgs = {
  canvas: HTMLCanvasElement;
  settings: GearSettings;
  onTimer: (label: string) => void;
  onNotice?: (message: string) => void;
};

function startSession() {
  recordingActive = true;
  return ++epoch;
}

export function beginStudioRecord(args: RecordArgs & { doc: PageDoc }): { stop: () => void; done: Promise<Clip | null> } {
  const my = startSession();
  let sink: Sink | null = null;
  const done = (async (): Promise<Clip | null> => {
    try {
      const images = await prepareAssets(args.doc);
      if (epoch !== my) return null;
      const model = mount(args.canvas, args.settings, args.doc, images, args.doc.finalUrl, null);
      const time = timeline(args.settings, model.maxScroll);
      const ready = await countdown(my, model, args.settings.delay, time.totalMs, time.pxPerSec, args.onTimer);
      if (!ready) return null;
      const made = await makeCanvasSink(args.canvas, args.settings, args.onNotice);
      sink = made.sink;
      if (epoch !== my) {
        await sink.finish().catch(() => undefined);
        sink = null;
        return null;
      }
      let actual = 0;
      const frameUs = Math.round(1_000_000 / args.settings.fps);
      await runFrames(my, model, time.bodyMs, time.totalMs, time.pxPerSec, (index, ms) => {
        actual = ms;
        args.onTimer(formatClock(ms));
        sink?.add(args.canvas, index * frameUs);
      });
      const blob = await sink.finish();
      sink = null;
      if (blob.size < 500) return null;
      return { blob, ext: made.ext, durationMs: actual || time.totalMs };
    } finally {
      recordingActive = false;
      if (sink) await sink.finish().catch(() => undefined);
    }
  })();
  return {
    stop() {
      if (epoch === my) epoch += 1;
    },
    done,
  };
}

export function beginScreenRecord(
  args: RecordArgs & { stream: MediaStream; urlLabel: string },
): { stop: () => void; done: Promise<Clip | null> } {
  const my = startSession();
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = args.stream;
  video.style.display = "none";
  document.body.appendChild(video);
  const stopTracks = () => args.stream.getTracks().forEach((track) => track.stop());
  args.stream.getVideoTracks()[0]?.addEventListener("ended", () => {
    if (epoch === my) epoch += 1;
  });
  let sink: Sink | null = null;
  const done = (async (): Promise<Clip | null> => {
    try {
      await video.play().catch(() => undefined);
      if (epoch !== my) return null;
      const screenSettings = { ...args.settings, autoScroll: false, fullPage: false, pingpong: false };
      const model = mount(args.canvas, screenSettings, null, [], args.urlLabel, video);
      const time = timeline(screenSettings, 0);
      const ready = await countdown(my, model, args.settings.delay, time.totalMs, time.pxPerSec, args.onTimer);
      if (!ready) return null;
      paint(model, 0, "play", 0, time.totalMs, time.pxPerSec);
      const tainted = canvasTainted(model.ctx);
      let ext: "webm" | "mp4" = args.settings.format === "mp4" ? "mp4" : "webm";
      if (tainted) {
        args.onNotice?.("Browser menutup overlay pada tangkapan layar. Video layar tetap direkam.");
        sink = webmSink(args.stream, bitrateFor(args.settings));
        ext = "webm";
        const started = performance.now();
        await new Promise<void>((resolve) => {
          const step = () => {
            const elapsed = performance.now() - started;
            args.onTimer(formatClock(elapsed));
            if (epoch !== my || elapsed >= time.totalMs) resolve();
            else requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        });
      } else {
        const made = await makeCanvasSink(args.canvas, args.settings, args.onNotice);
        sink = made.sink;
        ext = made.ext;
        if (epoch !== my) {
          await sink.finish().catch(() => undefined);
          sink = null;
          return null;
        }
        const frameUs = Math.round(1_000_000 / args.settings.fps);
        await runFrames(my, model, time.bodyMs, time.totalMs, time.pxPerSec, (index, ms) => {
          args.onTimer(formatClock(ms));
          sink?.add(args.canvas, index * frameUs);
        });
      }
      const blob = sink ? await sink.finish() : null;
      sink = null;
      if (!blob || blob.size < 500) return null;
      return { blob, ext, durationMs: time.totalMs };
    } finally {
      recordingActive = false;
      if (sink) await sink.finish().catch(() => undefined);
      stopTracks();
      video.remove();
    }
  })();
  return {
    stop() {
      if (epoch === my) epoch += 1;
    },
    done,
  };
}
