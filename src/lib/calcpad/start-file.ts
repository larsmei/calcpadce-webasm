import { assetUrl } from "./asset-url";
import { DEFAULT_WORKSHEET } from "./types";

export const START_FILE_NAME = "start.cpd";
export const EMBEDDED_FILE_NAME = "worksheet.cpd";

function normalizeSource(source: string) {
  return source.replace(/\r\n/g, "\n").trim();
}

/** True when the store still holds the built-in sample (first visit / reset). */
export function isEmbeddedDefault(source: string, fileName: string) {
  if (fileName !== EMBEDDED_FILE_NAME) return false;
  return normalizeSource(source) === normalizeSource(DEFAULT_WORKSHEET);
}

function looksLikeHtml(text: string, contentType: string | null) {
  if ((contentType || "").toLowerCase().includes("text/html")) return true;
  const head = text.slice(0, 256).trimStart().toLowerCase();
  return head.startsWith("<!doctype html") || head.startsWith("<html");
}

/** Load `examples/start.cpd`. Returns null if missing, empty, or an HTML fallback. */
export async function fetchStartWorksheet(): Promise<string | null> {
  try {
    const res = await fetch(assetUrl(`examples/${START_FILE_NAME}`), {
      cache: "no-cache",
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text.trim()) return null;
    if (looksLikeHtml(text, res.headers.get("content-type"))) return null;
    return text;
  } catch {
    return null;
  }
}

export function waitForStoreHydration(persist: {
  hasHydrated: () => boolean;
  onFinishHydration: (fn: () => void) => () => void;
}): Promise<void> {
  if (persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsub = persist.onFinishHydration(() => {
      window.clearTimeout(t);
      unsub();
      resolve();
    });
    const t = window.setTimeout(() => {
      unsub();
      resolve();
    }, 2000);
  });
}
