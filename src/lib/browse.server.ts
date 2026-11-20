import "@tanstack/react-start/server-only";
import { countWords, parseHtml } from "@/lib/parse-html";
import type { PageDoc, TextBlock } from "@/lib/types";
import { isBlockedHostname, normalizeUrl } from "@/lib/url";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const looked = new Map<string, Promise<void>>();

async function assertResolved(hostname: string): Promise<void> {
  if (isBlockedHostname(hostname)) throw new Error("Tautan ke jaringan lokal ditolak");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":")) return;
  const key = hostname.toLowerCase();
  let pending = looked.get(key);
  if (!pending) {
    pending = (async () => {
      const { lookup } = await import("node:dns/promises");
      let records: { address: string }[] = [];
      try {
        records = await lookup(hostname, { all: true, verbatim: true });
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code === "ENOTFOUND" || code === "EAI_AGAIN") throw new Error("Nama tautan tidak ditemukan");
        return;
      }
      if (records.length === 0) throw new Error("Nama tautan tidak ditemukan");
      for (const record of records) {
        if (isBlockedHostname(record.address)) throw new Error("Tautan ke jaringan lokal ditolak");
      }
    })().catch((error) => {
      looked.delete(key);
      throw error;
    });
    looked.set(key, pending);
  }
  await pending;
}

async function readCap(res: Response, max: number): Promise<{ bytes: Uint8Array; truncated: boolean }> {
  const declared = Number(res.headers.get("content-length") || 0);
  if (declared > max * 4) throw new Error("Berkas terlalu besar");
  if (!res.body) return { bytes: new Uint8Array(), truncated: false };
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    if (total + value.byteLength > max) {
      chunks.push(value.subarray(0, max - total));
      total = max;
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
    total += value.byteLength;
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes, truncated };
}

async function fetchChecked(raw: string, accept: string, max: number, timeoutMs: number) {
  let current = new URL(normalizeUrl(raw));
  for (let hop = 0; hop < 5; hop += 1) {
    await assertResolved(current.hostname);
    const res = await fetch(current, {
      redirect: "manual",
      headers: { accept, "user-agent": UA, "accept-language": "id,en;q=0.8" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error("Pengalihan tanpa tujuan");
      current = new URL(location, current);
      continue;
    }
    const body = await readCap(res, max);
    return {
      status: res.status,
      finalUrl: current.toString(),
      contentType: (res.headers.get("content-type") || "").split(";")[0]?.trim().toLowerCase() || "",
      ...body,
    };
  }
  throw new Error("Terlalu banyak pengalihan");
}

function sniff(bytes: Uint8Array, contentType: string): "html" | "image" | "other" {
  if (contentType.startsWith("image/")) return "image";
  if (/html|xml|text\/plain/.test(contentType)) return "html";
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "image";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image";
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return "image";
  const head = new TextDecoder().decode(bytes.slice(0, 240)).trimStart().toLowerCase();
  if (head.startsWith("<!doctype") || head.startsWith("<html") || head.includes("<body") || head.includes("<p")) {
    return "html";
  }
  return "other";
}

function imageMime(bytes: Uint8Array, contentType: string): string {
  if (contentType.startsWith("image/") && !contentType.includes("svg")) return contentType;
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return "image/gif";
  if (bytes[0] === 0x52 && bytes[1] === 0x49) return "image/webp";
  return "image/jpeg";
}

function baseDoc(partial: Partial<PageDoc> & Pick<PageDoc, "requestedUrl" | "finalUrl" | "status" | "ms">): PageDoc {
  const blocks = partial.blocks ?? [];
  const paragraphs = blocks.flatMap((block) => (block.kind === "p" ? [block.text] : []));
  const headings = blocks.flatMap((block) => (block.kind === "h" ? [{ level: block.level, text: block.text }] : []));
  const words = countWords([partial.title || "", partial.description || "", ...blocks.map((block) => block.text)]);
  return {
    ok: partial.ok ?? false,
    error: partial.error ?? "",
    status: partial.status,
    ms: partial.ms,
    requestedUrl: partial.requestedUrl,
    finalUrl: partial.finalUrl,
    contentType: partial.contentType ?? "",
    title: partial.title || hostOfSafe(partial.finalUrl),
    description: partial.description ?? "",
    siteName: partial.siteName || hostOfSafe(partial.finalUrl),
    blocks,
    headings,
    paragraphs,
    links: partial.links ?? [],
    images: partial.images ?? [],
    words,
    truncated: partial.truncated ?? false,
  };
}

function hostOfSafe(raw: string): string {
  try {
    return new URL(raw).hostname.replace(/^www\./, "");
  } catch {
    return raw;
  }
}

async function fetchImage(src: string): Promise<{ alt: string; dataUrl: string } | null> {
  if (src.startsWith("data:image/") && !src.includes("svg") && src.length < 180_000) {
    return { alt: "", dataUrl: src };
  }
  if (!src.startsWith("http://") && !src.startsWith("https://")) return null;
  try {
    const fetched = await fetchChecked(src, "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8", 260_000, 5000);
    if (fetched.status < 200 || fetched.status >= 300) return null;
    if (sniff(fetched.bytes, fetched.contentType) !== "image") return null;
    if (fetched.contentType.includes("svg")) return null;
    const mime = imageMime(fetched.bytes, fetched.contentType);
    return { alt: "", dataUrl: `data:${mime};base64,${Buffer.from(fetched.bytes).toString("base64")}` };
  } catch {
    return null;
  }
}

function fallbackBlocks(finalUrl: string, reason: string): TextBlock[] {
  return [
    {
      kind: "p",
      text: reason,
    },
    {
      kind: "p",
      text: `Tautan: ${finalUrl}. Mode Layar bisa merekam tampilan asli di tab browser. Studio tetap merekam kartu ini.`,
    },
  ];
}

export async function loadDocument(rawUrl: string, mode: "full" | "meta"): Promise<PageDoc> {
  const requestedUrl = normalizeUrl(rawUrl);
  const started = Date.now();
  const fetched = await fetchChecked(requestedUrl, "text/html,application/xhtml+xml;q=0.9,*/*;q=0.7", 1_200_000, 9000);
  const ms = Date.now() - started;
  const kind = sniff(fetched.bytes, fetched.contentType);
  const base = {
    requestedUrl,
    finalUrl: fetched.finalUrl,
    status: fetched.status,
    ms,
    contentType: fetched.contentType || kind,
    truncated: fetched.truncated,
  };

  if (kind === "image") {
    const mime = imageMime(fetched.bytes, fetched.contentType);
    const dataUrl = `data:${mime};base64,${Buffer.from(fetched.bytes).toString("base64")}`;
    return baseDoc({
      ...base,
      ok: fetched.status >= 200 && fetched.status < 300,
      error: fetched.status >= 400 ? `Server menjawab ${fetched.status}` : "",
      title: hostOfSafe(fetched.finalUrl),
      description: "Berkas gambar langsung dari tautan.",
      blocks: [{ kind: "p", text: "Gambar dari tautan ini direkam sebagai satu halaman." }],
      images: mode === "full" ? [{ alt: "", dataUrl }] : [],
    });
  }

  if (kind !== "html") {
    return baseDoc({
      ...base,
      ok: false,
      error: `Bukan halaman HTML (${fetched.contentType || "tipe tidak diketahui"})`,
      blocks: fallbackBlocks(
        fetched.finalUrl,
        `Server menjawab ${fetched.status} dengan tipe ${fetched.contentType || "tidak diketahui"}.`,
      ),
    });
  }

  const html = new TextDecoder("utf-8", { fatal: false }).decode(fetched.bytes);
  const parsed = parseHtml(html, fetched.finalUrl);
  let blocks = parsed.blocks;
  if (blocks.length === 0) {
    blocks = fallbackBlocks(
      fetched.finalUrl,
      "Halaman ini hampir tidak mengirim teks (sering terjadi pada situs yang hanya hidup lewat JavaScript).",
    );
  }
  const images =
    mode === "full"
      ? (await Promise.all(parsed.imageUrls.slice(0, 4).map(async (image) => {
          const got = await fetchImage(image.src);
          return got ? { alt: image.alt, dataUrl: got.dataUrl } : null;
        }))).flatMap((image) => (image ? [image] : [])).slice(0, 3)
      : [];

  const ok = fetched.status >= 200 && fetched.status < 400;
  return baseDoc({
    ...base,
    ok,
    error: ok ? "" : `Server menjawab ${fetched.status}`,
    title: parsed.title,
    description: parsed.description,
    siteName: parsed.siteName,
    blocks,
    links: parsed.links,
    images,
  });
}
