import type { TextBlock } from "@/lib/types";

export type ParsedPage = {
  title: string;
  description: string;
  siteName: string;
  blocks: TextBlock[];
  links: { href: string; text: string }[];
  imageUrls: { src: string; alt: string }[];
};

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
};

function decode(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n: string) => {
      const code = Number(n);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => {
      const code = Number.parseInt(n, 16);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    })
    .replace(/&([a-z]+);/gi, (match, name: string) => ENTITIES[name.toLowerCase()] ?? match);
}

function strip(value: string): string {
  return decode(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function cleanHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ");
}

function metaContent(html: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const a = new RegExp(
    `<meta[^>]+(?:name|property)=["']${escaped}["'][^>]*content=["']([\\s\\S]*?)["'][^>]*>`,
    "i",
  );
  const b = new RegExp(
    `<meta[^>]+content=["']([\\s\\S]*?)["'][^>]*(?:name|property)=["']${escaped}["'][^>]*>`,
    "i",
  );
  return strip((html.match(a) || html.match(b) || [])[1] || "");
}

function attr(tag: string, name: string): string {
  const re = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const match = tag.match(re);
  return decode(match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim();
}

function absolute(src: string, base: string): string {
  if (!src || src.startsWith("data:") || src.startsWith("blob:") || src.startsWith("javascript:")) return src;
  try {
    return new URL(src, base).toString();
  } catch {
    return "";
  }
}

function chunkText(text: string): TextBlock[] {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 40);
  const blocks: TextBlock[] = [];
  let bucket = "";
  for (const sentence of sentences) {
    if ((bucket + " " + sentence).trim().length > 320 && bucket) {
      blocks.push({ kind: "p", text: bucket });
      bucket = sentence;
    } else {
      bucket = bucket ? `${bucket} ${sentence}` : sentence;
    }
    if (blocks.length >= 24) break;
  }
  if (bucket && blocks.length < 24) blocks.push({ kind: "p", text: bucket });
  return blocks;
}

export function parseHtml(html: string, finalUrl: string): ParsedPage {
  const cleaned = cleanHtml(html);
  const titleTag = strip((cleaned.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
  const title = titleTag || metaContent(cleaned, "og:title") || "";
  const description = metaContent(cleaned, "description") || metaContent(cleaned, "og:description");
  let siteName = metaContent(cleaned, "og:site_name");
  try {
    if (!siteName) siteName = new URL(finalUrl).hostname.replace(/^www\./, "");
  } catch {
    siteName = siteName || "";
  }

  const blocks: TextBlock[] = [];
  const blockRe = /<(h[1-3]|p)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(cleaned)) && blocks.length < 40) {
    const text = strip(match[2] || "");
    if (text.length < 2) continue;
    if (match[1]?.toLowerCase().startsWith("h")) {
      const level = Number(match[1].slice(1)) || 2;
      blocks.push({ kind: "h", level, text: text.slice(0, 180) });
    } else if (text.length > 1) {
      blocks.push({ kind: "p", text: text.slice(0, 700) });
    }
  }

  if (blocks.filter((block) => block.kind === "p").length < 2) {
    const body = strip(
      (cleaned.replace(/<(nav|footer|header|form|aside)\b[^>]*>[\s\S]*?<\/\1>/gi, " ").match(
        /<body[^>]*>([\s\S]*?)<\/body>/i,
      ) || [])[1] || cleaned,
    );
    const extra = chunkText(body).filter(
      (block) => block.kind === "p" && !blocks.some((have) => have.kind === "p" && have.text === block.text),
    );
    blocks.push(...extra.slice(0, 12));
  }

  const links: { href: string; text: string }[] = [];
  const linkRe = /<a\b[^>]*>[\s\S]*?<\/a>/gi;
  let linkMatch: RegExpExecArray | null;
  while ((linkMatch = linkRe.exec(cleaned)) && links.length < 30) {
    const tag = linkMatch[0];
    const href = absolute(attr(tag, "href"), finalUrl);
    if (!href.startsWith("http://") && !href.startsWith("https://")) continue;
    const text = strip(tag).slice(0, 120) || href;
    if (links.some((link) => link.href === href)) continue;
    links.push({ href, text });
  }

  const imageUrls: { src: string; alt: string }[] = [];
  const pushImage = (srcRaw: string, alt: string) => {
    const src = srcRaw.startsWith("data:") ? srcRaw : absolute(srcRaw, finalUrl);
    if (!src || imageUrls.some((image) => image.src === src)) return;
    if (src.startsWith("data:") && (src.length > 180_000 || src.includes("svg"))) return;
    imageUrls.push({ src, alt: alt.slice(0, 140) });
  };
  const ogImage = metaContent(cleaned, "og:image");
  if (ogImage) pushImage(ogImage, title);
  const imgRe = /<img\b[^>]*>/gi;
  let imgMatch: RegExpExecArray | null;
  while ((imgMatch = imgRe.exec(cleaned)) && imageUrls.length < 6) {
    const tag = imgMatch[0];
    const src = attr(tag, "src") || attr(tag, "data-src");
    if (!src) continue;
    pushImage(src, attr(tag, "alt"));
  }

  return { title, description, siteName, blocks, links, imageUrls };
}

export function countWords(parts: string[]): number {
  return parts
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}
