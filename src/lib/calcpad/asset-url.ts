/** Public-asset URL that respects Vite `base` (root `/` on Apache, subpath on GH Pages). */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || "/";
  const prefix = base.endsWith("/") ? base : `${base}/`;
  const rel = path.replace(/^\/+/, "");
  return `${prefix}${rel}`;
}
