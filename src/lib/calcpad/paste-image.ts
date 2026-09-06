/** Clipboard / drop images → Calcpad HTML comment with an inline data URI. */

export const IMAGE_LINE_WIDTH = 96;
export const MAX_IMAGE_SIDE = 1600;
const PNG_SIZE_LIMIT = 1_200_000;
const MAX_DISPLAY_SIDE = 8000;

const IMAGE_TYPE = /^image\/(png|jpe?g|gif|webp|bmp|svg\+xml)$/i;
const IMG_LINE = /^['"]<img\b/i;
const DATA_SRC = /src\s*=\s*["'](data:image\/[^"']+)["']/i;
const ALT_ATTR = /alt\s*=\s*["']([^"']*)["']/i;
const STYLE_ATTR = /style\s*=\s*["']([^"']*)["']/i;
const DATA_MIME = /^data:(image\/[a-z0-9.+-]+)/i;
const WIDTH_PX = /(?:^|;)\s*width\s*:\s*(\d+(?:\.\d+)?)px/i;
const HEIGHT_PX = /(?:^|;)\s*height\s*:\s*(\d+(?:\.\d+)?)px/i;

export type ImageDisplaySize = { width: number; height: number };

export function continueLongLine(text: string, width = IMAGE_LINE_WIDTH): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if (line.length <= width) {
      out.push(line);
      continue;
    }
    let rest = line;
    while (rest.length > width) {
      out.push(`${rest.slice(0, width)} _`);
      rest = rest.slice(width);
    }
    if (rest) out.push(rest);
  }
  return out.join("\n");
}

export function joinContinuedLines(source: string): string {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let acc = "";
  for (const raw of lines) {
    const line = raw.trim();
    if (acc) acc = acc.endsWith(" _") ? acc.slice(0, -2) + line : `${acc} ${line}`;
    else acc = line;
    if (acc.endsWith(" _")) continue;
    out.push(acc);
    acc = "";
  }
  if (acc) out.push(acc.endsWith(" _") ? acc.slice(0, -2) : acc);
  return out.join("\n");
}

export function clampDisplayDim(n: number) {
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(MAX_DISPLAY_SIDE, Math.round(n));
}

export function imageDisplayStyle(width: number, height: number): string {
  const w = clampDisplayDim(width);
  const h = clampDisplayDim(height);
  return `width:${w}px;height:${h}px;max-width:100%;aspect-ratio:${w}/${h};display:block`;
}

export function parseImageDisplaySize(style: string | undefined | null): ImageDisplaySize | null {
  if (!style) return null;
  const w = WIDTH_PX.exec(style);
  if (!w) return null;
  const width = clampDisplayDim(Number(w[1]));
  const h = HEIGHT_PX.exec(style);
  const height = h ? clampDisplayDim(Number(h[1])) : 0;
  return { width, height };
}

export function sizeFromWidth(width: number, naturalW: number, naturalH: number): ImageDisplaySize {
  const nw = Math.max(1, naturalW);
  const nh = Math.max(1, naturalH);
  const w = clampDisplayDim(width);
  return { width: w, height: clampDisplayDim(w * (nh / nw)) };
}

export function sizeFromHeight(height: number, naturalW: number, naturalH: number): ImageDisplaySize {
  const nw = Math.max(1, naturalW);
  const nh = Math.max(1, naturalH);
  const h = clampDisplayDim(height);
  return { width: clampDisplayDim(h * (nw / nh)), height: h };
}

export function worksheetImageComment(
  dataUri: string,
  alt = "screenshot",
  size?: ImageDisplaySize,
): string {
  const safeAlt = alt.replace(/["<>\n]/g, " ").trim() || "screenshot";
  const style = size
    ? imageDisplayStyle(size.width, size.height)
    : "max-width:100%;height:auto;display:block";
  const html = `'<img class="worksheet-image" style="${style}" alt="${safeAlt}" src="${dataUri}">`;
  return continueLongLine(html);
}

export function rewriteWorksheetImageStyle(
  source: string,
  range: WorksheetImageRange,
  size: ImageDisplaySize,
): string {
  const original = source.slice(range.from, range.to);
  const trailingNl = original.endsWith("\n");
  const joined = joinContinuedLines(original.replace(/\s+$/g, ""));
  const style = imageDisplayStyle(size.width, size.height);
  const next = STYLE_ATTR.test(joined)
    ? joined.replace(STYLE_ATTR, `style="${style}"`)
    : joined.replace(/<img\b/i, `<img style="${style}"`);
  return source.slice(0, range.from) + continueLongLine(next) + (trailingNl ? "\n" : "") + source.slice(range.to);
}

/** Split the current line so the image sits on its own lines at `from`/`to`. */
export function imageSnippetAtCursor(doc: string, from: number, to: number, snippet: string) {
  let insert = snippet.replace(/\s+$/g, "") + "\n";
  if (from > 0 && doc[from - 1] !== "\n") insert = "\n" + insert;
  return { from, to, insert };
}

export function isImageFile(file: File | Blob): boolean {
  return IMAGE_TYPE.test(file.type);
}

export function imagesFromDataTransfer(dt: DataTransfer | null | undefined): File[] {
  if (!dt) return [];
  const out: File[] = [];
  const seen = new Set<File>();
  const add = (file: File | null | undefined) => {
    if (!file || !isImageFile(file) || seen.has(file)) return;
    seen.add(file);
    out.push(file);
  };
  for (const file of dt.files) add(file);
  for (const item of dt.items) {
    if (item.kind === "file" && IMAGE_TYPE.test(item.type)) add(item.getAsFile() ?? undefined);
  }
  return out;
}

/** Paste: images only when the clipboard is not also carrying real text. Drop: always. */
export function imagesToInsert(dt: DataTransfer | null | undefined, mode: "paste" | "drop"): File[] {
  const images = imagesFromDataTransfer(dt);
  if (!images.length) return [];
  if (mode === "drop") return images;
  const text = (dt?.getData("text/plain") ?? "").trim();
  return text ? [] : images;
}

export type WorksheetImageRange = {
  from: number;
  to: number;
  dataUri: string;
  alt: string;
  mime: string;
  style: string;
  width: number | null;
  height: number | null;
  lineCount: number;
};

export function imageKindLabel(mime: string) {
  if (/jpeg/i.test(mime)) return "JPEG";
  if (/png/i.test(mime)) return "PNG";
  if (/webp/i.test(mime)) return "WebP";
  if (/gif/i.test(mime)) return "GIF";
  if (/svg/i.test(mime)) return "SVG";
  return "Image";
}

/** Locate pasted `'<img src="data:image…">` comments, including ` _` continuations. */
export function findWorksheetImageRanges(source: string): WorksheetImageRange[] {
  const ranges: WorksheetImageRange[] = [];
  const n = source.length;
  let i = 0;
  while (i < n) {
    const lineFrom = i;
    while (i < n && source[i] !== "\n") i++;
    const line = source.slice(lineFrom, i);
    const body = line.replace(/^[ \t]*/, "");
    if (IMG_LINE.test(body)) {
      let joined = line.trimEnd();
      let lineCount = 1;
      let end = i;
      while (joined.endsWith(" _") && i < n) {
        if (source[i] === "\n") i += 1;
        const nextFrom = i;
        while (i < n && source[i] !== "\n") i++;
        joined = joined.slice(0, -2) + source.slice(nextFrom, i).trim();
        end = i;
        lineCount += 1;
      }
      const srcMatch = DATA_SRC.exec(joined);
      if (srcMatch) {
        let to = end;
        if (to < n && source[to] === "\n") to += 1;
        const alt = ALT_ATTR.exec(joined)?.[1]?.trim() || "screenshot";
        const mime = DATA_MIME.exec(srcMatch[1])?.[1] ?? "image";
        const style = STYLE_ATTR.exec(joined)?.[1] ?? "";
        const size = parseImageDisplaySize(style);
        ranges.push({
          from: lineFrom,
          to,
          dataUri: srcMatch[1],
          alt,
          mime,
          style,
          width: size?.width ?? null,
          height: size?.height ?? null,
          lineCount,
        });
      }
    }
    if (i < n && source[i] === "\n") i += 1;
  }
  return ranges;
}

const IMG_PLACEHOLDER_SRC = /src\s*=\s*(["'])cid:cpd-img-(\d+)\1/gi;

/** Swap bulky data-URI screenshots for short cid: placeholders before WASM parse. */
export function detachInlineImages(source: string): { source: string; images: string[] } {
  // Do not probe for the contiguous "data:image/" substring — Calcpad ` _` wrapping
  // can split it across lines (`src="d _\nata:image/...`). Range scan joins first.
  if (!source.includes("<img")) return { source, images: [] };
  const ranges = findWorksheetImageRanges(source);
  if (!ranges.length) return { source, images: [] };
  const images: string[] = [];
  let out = "";
  let last = 0;
  for (const range of ranges) {
    out += source.slice(last, range.from);
    const i = images.length;
    images.push(range.dataUri);
    const alt = range.alt.replace(/["<>\n]/g, " ").trim() || "screenshot";
    const style = range.style.replace(/"/g, "").trim();
    const styleAttr = style ? ` style="${style}"` : "";
    const line = `'<img class="worksheet-image" src="cid:cpd-img-${i}" alt="${alt}"${styleAttr}>\n`;
    const extra = Math.max(0, range.lineCount - 1);
    out += extra ? line + "'\n".repeat(extra) : line;
    last = range.to;
  }
  out += source.slice(last);
  return { source: out, images };
}

export function reattachInlineImages(html: string, images: string[]): string {
  if (!images.length || !html.includes("cid:cpd-img-")) return html;
  return html.replace(IMG_PLACEHOLDER_SRC, (match, quote: string, n: string) => {
    const uri = images[Number(n)];
    return uri ? `src=${quote}${uri}${quote}` : match;
  });
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image"));
    reader.readAsDataURL(blob);
  });
}

function naturalSizeFromDataUri(dataUri: string): Promise<ImageDisplaySize> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: Math.max(1, img.naturalWidth || img.width || 1),
        height: Math.max(1, img.naturalHeight || img.height || 1),
      });
    };
    img.onerror = () => reject(new Error("Could not read image size"));
    img.src = dataUri;
  });
}

async function rasterToDataUri(blob: Blob): Promise<{ dataUri: string; width: number; height: number }> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    const dataUri = await blobToDataUri(blob);
    return { dataUri, width: 1, height: 1 };
  }
  const bitmap = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height, 1));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      const dataUri = await blobToDataUri(blob);
      return { dataUri, width: bitmap.width, height: bitmap.height };
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    const png = canvas.toDataURL("image/png");
    if (png.startsWith("data:image/png") && png.length <= PNG_SIZE_LIMIT) {
      return { dataUri: png, width: w, height: h };
    }
    const jpeg = canvas.toDataURL("image/jpeg", 0.84);
    return {
      dataUri: jpeg.startsWith("data:image/jpeg") ? jpeg : png,
      width: w,
      height: h,
    };
  } finally {
    bitmap.close();
  }
}

export type PreparedWorksheetImage = {
  dataUri: string;
  alt: string;
  width: number;
  height: number;
};

export async function blobToPreparedImage(file: Blob, alt = "screenshot"): Promise<PreparedWorksheetImage> {
  const raster = await rasterToDataUri(file);
  if (!raster.dataUri.startsWith("data:image/")) throw new Error("Not an image");
  let { width, height } = raster;
  if (width < 2 && height < 2 && typeof Image !== "undefined") {
    try {
      const natural = await naturalSizeFromDataUri(raster.dataUri);
      width = natural.width;
      height = natural.height;
    } catch {
      width = 800;
      height = 600;
    }
  }
  const safeAlt = alt.replace(/["<>\n]/g, " ").trim() || "screenshot";
  return { dataUri: raster.dataUri, alt: safeAlt, width, height };
}

export async function fileToWorksheetImage(file: Blob, alt = "screenshot"): Promise<string> {
  const prepared = await blobToPreparedImage(file, alt);
  return worksheetImageComment(prepared.dataUri, prepared.alt, {
    width: prepared.width,
    height: prepared.height,
  });
}

export async function filesToWorksheetImages(files: File[]): Promise<string> {
  const parts: string[] = [];
  for (const file of files) {
    const name = file.name.replace(/\.[^.]+$/, "") || "screenshot";
    try {
      parts.push(await fileToWorksheetImage(file, name));
    } catch {
      /* skip unreadable clipboard items */
    }
  }
  return parts.join("\n");
}
