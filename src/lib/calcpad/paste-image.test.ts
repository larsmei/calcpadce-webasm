import assert from "node:assert/strict";
import { test } from "node:test";
import {
  continueLongLine,
  detachInlineImages,
  findWorksheetImageRanges,
  imageKindLabel,
  imageSnippetAtCursor,
  joinContinuedLines,
  reattachInlineImages,
  worksheetImageComment,
} from "./paste-image.ts";

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";

test("continueLongLine uses Calcpad ' _' joins", () => {
  const wrapped = continueLongLine("abcdefghij", 4);
  assert.equal(wrapped, "abcd _\nefgh _\nij");
  assert.equal(joinContinuedLines(wrapped), "abcdefghij");
});

test("worksheet image comment is a single-quote HTML img that joins back to a data URI", () => {
  const comment = worksheetImageComment(TINY_PNG, "shot");
  assert.match(comment, /^'<img class="worksheet-image"/);
  const joined = joinContinuedLines(comment);
  assert.match(joined, /src="data:image\/png;base64,/);
  assert.match(joined, /alt="shot"/);
  assert.doesNotMatch(joined, / _/);
});

test("image snippet splits the current line at the cursor", () => {
  const doc = "r = 5 cm\nh = 12";
  const from = 5;
  const { insert } = imageSnippetAtCursor(doc, from, from, "'<img src=\"x\">");
  const next = doc.slice(0, from) + insert + doc.slice(from);
  assert.equal(next, "r = 5\n'<img src=\"x\">\n cm\nh = 12");
});

test("image snippet on an empty line does not add a leading newline", () => {
  const doc = "r = 1\n\nh = 2";
  const from = 6;
  const { insert } = imageSnippetAtCursor(doc, from, from, "'<img src=\"x\">");
  assert.equal(insert.startsWith("\n"), false);
  assert.equal(insert.endsWith("\n"), true);
});

test("findWorksheetImageRanges covers a wrapped screenshot as one block", () => {
  const img = worksheetImageComment(TINY_PNG, "shot");
  const doc = `r = 1 cm\n${img}\nh = 2 cm\n`;
  const ranges = findWorksheetImageRanges(doc);
  assert.equal(ranges.length, 1);
  assert.equal(ranges[0].alt, "shot");
  assert.equal(ranges[0].mime, "image/png");
  assert.equal(imageKindLabel(ranges[0].mime), "PNG");
  assert.ok(ranges[0].lineCount >= 1);
  assert.equal(doc.slice(ranges[0].from, ranges[0].from + 5), "'<img");
  assert.equal(doc.slice(ranges[0].to, ranges[0].to + 6), "h = 2 ");
  assert.match(joinContinuedLines(doc.slice(ranges[0].from, ranges[0].to)), /src="data:image\/png/);
});

test("findWorksheetImageRanges skips remote img comments", () => {
  const doc = `'<img src="https://example.com/a.png" alt="remote">\nr = 1\n`;
  assert.equal(findWorksheetImageRanges(doc).length, 0);
});

test("findWorksheetImageRanges finds two pasted images", () => {
  const a = worksheetImageComment(TINY_PNG, "one");
  const b = worksheetImageComment(TINY_PNG, "two");
  const doc = `${a}\n${b}\n`;
  const ranges = findWorksheetImageRanges(doc);
  assert.equal(ranges.length, 2);
  assert.equal(ranges[0].alt, "one");
  assert.equal(ranges[1].alt, "two");
});

test("detachInlineImages replaces data URIs with cid placeholders and keeps line count", () => {
  const img = worksheetImageComment(TINY_PNG, "shot");
  const doc = `r = 1 cm\n${img}\nh = 2 cm\n`;
  const before = doc.split("\n").length;
  const { source, images } = detachInlineImages(doc);
  assert.equal(images.length, 1);
  assert.equal(images[0], TINY_PNG);
  assert.match(source, /src="cid:cpd-img-0"/);
  assert.doesNotMatch(source, /data:image\/png;base64,/);
  assert.equal(source.split("\n").length, before);
  const html = `'<img class="worksheet-image" src="cid:cpd-img-0" alt="shot">`;
  assert.match(reattachInlineImages(html, images), /src="data:image\/png;base64,/);
});

test("detachInlineImages is a no-op without data URIs", () => {
  const doc = "r = 1 cm\n";
  const { source, images } = detachInlineImages(doc);
  assert.equal(source, doc);
  assert.equal(images.length, 0);
});

