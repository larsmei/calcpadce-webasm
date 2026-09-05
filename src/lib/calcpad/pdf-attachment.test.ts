import assert from "node:assert/strict";
import { test } from "node:test";
import { PDFDocument } from "pdf-lib";
import {
  embedWorksheetAttachment,
  extractCpdAttachment,
} from "./pdf-attachment.ts";
import { readUiOverrides, withUiOverridesComment, worksheetAttachName } from "./worksheet-meta.ts";

test("worksheetAttachName keeps a .cpd suffix", () => {
  assert.equal(worksheetAttachName("beam.cpd"), "beam.cpd");
  assert.equal(worksheetAttachName("report.pdf"), "report.cpd");
  assert.equal(worksheetAttachName("my sheet.txt"), "my_sheet.cpd");
});

test("uiOverrides comment roundtrips", () => {
  const src = withUiOverridesComment("r = 1\n", { "L:1": "8" });
  assert.match(src, /uiOverrides/);
  assert.equal(readUiOverrides(src)["L:1"], "8");
});

test("embed and extract a .cpd attachment", async () => {
  const doc = await PDFDocument.create();
  doc.addPage();
  const empty = await doc.save();
  const source = "r = ? {5} cm\nV = π*r^2\n";
  const withAtt = await embedWorksheetAttachment(empty, source, "beam.cpd", {
    "L:1": "8",
  });
  const found = await extractCpdAttachment(withAtt);
  assert.ok(found);
  assert.equal(found.name, "beam.cpd");
  assert.match(found.source, /r = \? \{5\} cm/);
  assert.equal(found.uiOverrides["L:1"], "8");
});

test("PDF without a .cpd attachment returns null", async () => {
  const doc = await PDFDocument.create();
  doc.addPage();
  await doc.attach(new TextEncoder().encode("hello"), "notes.txt", {
    mimeType: "text/plain",
  });
  const bytes = await doc.save();
  assert.equal(await extractCpdAttachment(bytes), null);
});
