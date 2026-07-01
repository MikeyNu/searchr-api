import { createHash } from "node:crypto";

export function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function lower(value) {
  return clean(value).toLowerCase();
}

export function unique(items) {
  const seen = new Set();
  return items
    .map(clean)
    .filter(Boolean)
    .filter((item) => {
      const key = lower(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function words(value) {
  return lower(value)
    .replace(/[^a-z0-9\s+-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

export function htmlToText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/li>|<\/h[1-6]>|<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .trim();
}

export function stableHash(value) {
  return createHash("sha256").update(clean(value).toLowerCase()).digest("hex");
}

export function slug(value) {
  const result = lower(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return result || "item";
}

export function splitSentences(text) {
  return clean(text)
    .split(/(?:\.|\n|;|\u2022|- )+/)
    .map(clean)
    .filter((line) => line.length > 8)
    .slice(0, 20);
}
