import {
  AFRelationship,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRawStream,
  PDFStream,
  PDFString,
  decodePDFRawStream,
} from "pdf-lib";
import {
  readUiOverrides,
  withUiOverridesComment,
  worksheetAttachName,
} from "./worksheet-meta.ts";

export const CPD_ATTACH_DESC = "CalcpadCE worksheet source";
export { readUiOverrides, withUiOverridesComment, worksheetAttachName } from "./worksheet-meta.ts";

function isCpdName(name: string) {
  return /\.cpdz?$/i.test(name.trim());
}

function decodePdfText(obj: unknown): string {
  if (obj instanceof PDFString || obj instanceof PDFHexString) return obj.decodeText();
  return "";
}

function streamBytes(stream: PDFStream): Uint8Array {
  if (stream instanceof PDFRawStream) return decodePDFRawStream(stream).decode();
  return stream.getContents();
}

function filespecPayload(spec: PDFDict): { name: string; data: Uint8Array } | null {
  const ef = spec.lookupMaybe(PDFName.of("EF"), PDFDict);
  if (!ef) return null;
  const file =
    ef.lookupMaybe(PDFName.of("F"), PDFStream) ??
    ef.lookupMaybe(PDFName.of("UF"), PDFStream);
  if (!file) return null;
  const name =
    decodePdfText(spec.lookupMaybe(PDFName.of("UF"), PDFString, PDFHexString)) ||
    decodePdfText(spec.lookupMaybe(PDFName.of("F"), PDFString, PDFHexString));
  return { name, data: streamBytes(file) };
}

function walkNameTree(node: PDFDict, out: PDFDict[]) {
  const names = node.lookupMaybe(PDFName.of("Names"), PDFArray);
  if (names) {
    for (let i = 1; i < names.size(); i += 2) {
      const spec = names.lookupMaybe(i, PDFDict);
      if (spec) out.push(spec);
    }
  }
  const kids = node.lookupMaybe(PDFName.of("Kids"), PDFArray);
  if (kids) {
    for (let i = 0; i < kids.size(); i++) {
      const kid = kids.lookupMaybe(i, PDFDict);
      if (kid) walkNameTree(kid, out);
    }
  }
}

function collectFilespecs(pdf: PDFDocument): PDFDict[] {
  const specs: PDFDict[] = [];
  const names = pdf.catalog.lookupMaybe(PDFName.of("Names"), PDFDict);
  const embedded = names?.lookupMaybe(PDFName.of("EmbeddedFiles"), PDFDict);
  if (embedded) walkNameTree(embedded, specs);

  const af = pdf.catalog.lookupMaybe(PDFName.of("AF"), PDFArray);
  if (af) {
    for (let i = 0; i < af.size(); i++) {
      const spec = af.lookupMaybe(i, PDFDict);
      if (spec) specs.push(spec);
    }
  }

  for (const page of pdf.getPages()) {
    const annots = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
    if (!annots) continue;
    for (let i = 0; i < annots.size(); i++) {
      const annot = annots.lookupMaybe(i, PDFDict);
      if (!annot) continue;
      const subtype = annot.lookupMaybe(PDFName.of("Subtype"), PDFName);
      const kind = subtype?.asString();
      if (kind !== "/FileAttachment" && kind !== "FileAttachment") continue;
      const spec = annot.lookupMaybe(PDFName.of("FS"), PDFDict);
      if (spec) specs.push(spec);
    }
  }
  return specs;
}

export type CpdAttachment = {
  name: string;
  source: string;
  uiOverrides: Record<string, string>;
};

export async function embedWorksheetAttachment(
  pdfBytes: Uint8Array,
  source: string,
  fileName: string,
  uiOverrides: Record<string, string> = {},
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes);
  const payload = withUiOverridesComment(source, uiOverrides);
  const bytes = new TextEncoder().encode(payload);
  const now = new Date();
  await pdf.attach(bytes, worksheetAttachName(fileName), {
    mimeType: "text/plain",
    description: CPD_ATTACH_DESC,
    creationDate: now,
    modificationDate: now,
    afRelationship: AFRelationship.Source,
  });
  const saved = await pdf.save({ useObjectStreams: false });
  const out = new Uint8Array(saved.byteLength);
  out.set(saved);
  return out;
}

export async function extractCpdAttachment(
  pdfBytes: Uint8Array | ArrayBuffer,
): Promise<CpdAttachment | null> {
  const bytes = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const found: CpdAttachment[] = [];
  for (const spec of collectFilespecs(pdf)) {
    const payload = filespecPayload(spec);
    if (!payload) continue;
    const name = payload.name || "worksheet.cpd";
    if (!isCpdName(name)) continue;
    const source = new TextDecoder("utf-8").decode(payload.data).replace(/^\uFEFF/, "");
    if (!source.trim()) continue;
    found.push({ name, source, uiOverrides: readUiOverrides(source) });
  }
  return found[0] ?? null;
}
