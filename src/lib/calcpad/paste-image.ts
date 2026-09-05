/** Clipboard / drop images → Calcpad HTML comment with an inline data URI. */

export const IMAGE_LINE_WIDTH = 96;
export const MAX_IMAGE_SIDE = 1600;
const PNG_SIZE_LIMIT = 1_200_000;

const IMAGE_TYPE = /^image\/(png|jpe?g|gif|webp|bmp|svg\+xml)$/i;

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
