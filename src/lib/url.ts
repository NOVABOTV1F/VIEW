function ipv4Blocked(a: number, b: number): boolean {
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  return false;
}

export function isBlockedHostname(hostname: string): boolean {
  let h = hostname.toLowerCase().replace(/\.$/, "");
  if (h.startsWith("[") && h.endsWith("]")) h = h.slice(1, -1);
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) {
    return true;
  }
  if (h === "metadata.google.internal" || h === "0.0.0.0" || h === "::" || h === "::1") return true;

  const mapped = h.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return isBlockedHostname(mapped[1]);

  if (/^\d+$/.test(h)) {
    const n = Number(h);
    if (!Number.isSafeInteger(n) || n < 0 || n > 0xffffffff) return true;
    const a = (n >>> 24) & 255;
    const b = (n >>> 16) & 255;
    const c = (n >>> 8) & 255;
    const d = n & 255;
    return isBlockedHostname(`${a}.${b}.${c}.${d}`);
  }

  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const parts = v4.slice(1).map(Number);
    if (parts.some((n) => n > 255)) return true;
    return ipv4Blocked(parts[0] ?? 0, parts[1] ?? 0);
  }

  if (h.includes(":")) {
    if (h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80") || h === "::1") return true;
  }
  return false;
}

export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length < 3) throw new Error("Isi tautan dulu");
  if (trimmed.length > 2000) throw new Error("Tautan terlalu panjang");
  const withProto = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withProto);
  } catch {
    throw new Error("Tautan tidak valid");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Hanya tautan http atau https");
  }
  if (url.username || url.password) throw new Error("Tautan dengan sandi tertanam ditolak");
  if (isBlockedHostname(url.hostname)) throw new Error("Tautan ke jaringan lokal ditolak");
  return url.toString();
}

export function hostOf(raw: string): string {
  try {
    return new URL(raw).hostname.replace(/^www\./, "");
  } catch {
    return raw;
  }
}
