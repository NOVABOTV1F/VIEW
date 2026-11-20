export type TextBlock =
  | { kind: "h"; level: number; text: string }
  | { kind: "p"; text: string };

export type PageDoc = {
  ok: boolean;
  error: string;
  status: number;
  ms: number;
  requestedUrl: string;
  finalUrl: string;
  contentType: string;
  title: string;
  description: string;
  siteName: string;
  blocks: TextBlock[];
  headings: { level: number; text: string }[];
  paragraphs: string[];
  links: { href: string; text: string }[];
  images: { alt: string; dataUrl: string }[];
  words: number;
  truncated: boolean;
};

export type HistMeta = {
  id: string;
  name: string;
  created: number;
  settings: string;
  size: number;
  format: "webm" | "mp4";
  durationMs: number;
};

export type LogItem = { t: number; msg: string };

export type Clip = {
  blob: Blob;
  ext: "webm" | "mp4";
  durationMs: number;
};
