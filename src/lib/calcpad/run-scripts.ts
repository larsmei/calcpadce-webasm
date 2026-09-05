const loadedSrc = new Set<string>();
const loading = new Map<string, Promise<void>>();

type ExtractedScript = { src: string | null; code: string };

function extractScripts(html: string): ExtractedScript[] {
  const out: ExtractedScript[] = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const attrs = match[1] ?? "";
    const srcMatch = attrs.match(/\bsrc\s*=\s*("([^"]*)"|'([^']*)')/i);
    const src = srcMatch?.[2] ?? srcMatch?.[3] ?? null;
    out.push({ src, code: match[2] ?? "" });
  }
  return out;
}

function loadExternalScript(src: string): Promise<void> {
  if (loadedSrc.has(src)) return Promise.resolve();
  const pending = loading.get(src);
  if (pending) return pending;

  const task = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.dataset.calcpadCdn = "1";
    script.onload = () => {
      loadedSrc.add(src);
      resolve();
    };
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(script);
  }).finally(() => {
    loading.delete(src);
  });
  loading.set(src, task);
  return task;
}

function runInlineScript(code: string) {
  const script = document.createElement("script");
  script.text = code;
  document.body.appendChild(script);
  script.remove();
}

/**
 * React innerHTML inserts inert <script> nodes (they appear in document.scripts
 * but never run). Always parse the engine HTML string and load real tags into
 * <head>, then run inline code.
 */
export async function runEmbeddedScripts(html: string, signal?: AbortSignal): Promise<void> {
  for (const item of extractScripts(html)) {
    if (signal?.aborted) return;
    if (item.src) {
      await loadExternalScript(item.src);
      continue;
    }
    if (item.code.trim()) runInlineScript(item.code);
  }
}
