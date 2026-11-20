import { createServerFn } from "@tanstack/react-start";
import { normalizeUrl } from "@/lib/url";

export const servicePing = createServerFn({ method: "GET" }).handler(async () => {
  return { ok: true as const, now: Date.now() };
});

export const browsePage = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const source = input && typeof input === "object" ? (input as { url?: unknown; mode?: unknown }) : {};
    if (typeof source.url !== "string") throw new Error("Tautan tidak valid");
    return {
      url: normalizeUrl(source.url),
      mode: source.mode === "meta" ? ("meta" as const) : ("full" as const),
    };
  })
  .handler(async ({ data }) => {
    const { loadDocument } = await import("./browse.server");
    return loadDocument(data.url, data.mode);
  });
