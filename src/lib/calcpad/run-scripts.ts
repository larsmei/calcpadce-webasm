const loadedSrc = new Set<string>();
const loading = new Map<string, Promise<void>>();

function loadExternalScript(src: string): Promise<void> {
  if (loadedSrc.has(src)) return Promise.resolve();
  const pending = loading.get(src);
  if (pending) return pending;

  const absolute = new URL(src, window.location.href).href;
  if ([...document.scripts].some((s) => s.src === absolute)) {
    loadedSrc.add(src);
    return Promise.resolve();
  }

  const task = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
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
 * innerHTML does not execute <script>. Calcpad worksheets emit Plotly/three.js/d3
 * that way, so we replay src tags (once) then inline code, in document order.
 */
export async function runEmbeddedScripts(root: HTMLElement, html: string): Promise<void> {
  let scripts = Array.from(root.querySelectorAll("script"));
  if (scripts.length === 0 && /<script/i.test(html)) {
    scripts = Array.from(new DOMParser().parseFromString(html, "text/html").querySelectorAll("script"));
  }
  for (const node of scripts) {
    const src = node.getAttribute("src");
    if (src) {
      node.remove();
      await loadExternalScript(src);
      continue;
    }
    const code = node.textContent ?? "";
    node.remove();
    if (code.trim()) runInlineScript(code);
  }
}
