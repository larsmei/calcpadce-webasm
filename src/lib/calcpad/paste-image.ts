/** Clipboard / drop images → Calcpad HTML comment with an inline data URI. */

export const IMAGE_LINE_WIDTH = 96;
export const MAX_IMAGE_SIDE = 1600;
const PNG_SIZE_LIMIT = 1_200_000;

const IMAGE_TYPE = /^image\/(png|jpe?g|gif|webp|bmp|svg\+xml)$/i;
const IMG_LINE = /^['"]<img\b/i;
const DATA_SRC = /src\s*=\s*["'](data:image\/[^"']+)["']/i;
const ALT_ATTR = /alt\s*=\s*["']([^"']*)["']/i;
const DATA_MIME = /^data:(image\/[a-z0-9.+-]+)/i;

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

export function worksheetImageComment(dataUri: string, alt = "screenshot"): string {
  const safeAlt = alt.replace(/["<>\n]/g, " ").trim() || "screenshot";
  const html = `'<img class="worksheet-image" src="${dataUri}" alt="${safeAlt}" style="max-width:100%;height:auto;display:block">`;
  return continueLongLine(html);
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
        ranges.push({ from: lineFrom, to, dataUri: srcMatch[1], alt, mime, lineCount });
      }
    }
    if (i < n && source[i] === "\n") i += 1;
  }
  return ranges;
}

const IMG_PLACEHOLDER_SRC = /src\s*=\s*(["'])cid:cpd-img-(\d+)\1/gi;

/** Swap bulky data-URI screenshots for short cid: placeholders before WASM parse. */
export function detachInlineImages(source: string): { source: string; images: string[] } {
  if (!source.includes("data:image/")) return { source, images: [] };
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
    const line = `'<img class="worksheet-image" src="cid:cpd-img-${i}" alt="${alt}">\n`;
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

async function rasterToDataUri(blob: Blob): Promise<string> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    return blobToDataUri(blob);
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
    if (!ctx) return blobToDataUri(blob);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    const png = canvas.toDataURL("image/png");
    if (png.startsWith("data:image/png") && png.length <= PNG_SIZE_LIMIT) return png;
    const jpeg = canvas.toDataURL("image/jpeg", 0.84);
    return jpeg.startsWith("data:image/jpeg") ? jpeg : png;
  } finally {
    bitmap.close();
  }
}

export async function fileToWorksheetImage(file: Blob, alt = "screenshot"): Promise<string> {
  const dataUri = await rasterToDataUri(file);
  if (!dataUri.startsWith("data:image/")) throw new Error("Not an image");
  return worksheetImageComment(dataUri, alt);
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
