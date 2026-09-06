import assert from "node:assert/strict";
import { test } from "node:test";
import {
  continueLongLine,
  detachInlineImages,
  findWorksheetImageRanges,
  imageDisplayStyle,
  imageKindLabel,
  imageSnippetAtCursor,
  joinContinuedLines,
  parseImageDisplaySize,
  reattachInlineImages,
  rewriteWorksheetImageStyle,
  sizeFromHeight,
  sizeFromWidth,
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

test("display size keeps aspect ratio", () => {
  assert.deepEqual(sizeFromWidth(200, 400, 300), { width: 200, height: 150 });
  assert.deepEqual(sizeFromHeight(150, 400, 300), { width: 200, height: 150 });
  assert.match(imageDisplayStyle(200, 150), /width:200px;height:150px/);
  assert.deepEqual(parseImageDisplaySize("max-width:100%;width:200px;height:150px"), {
    width: 200,
    height: 150,
  });
});

test("worksheet image comment can store a display size in style", () => {
  const comment = worksheetImageComment(TINY_PNG, "shot", { width: 320, height: 240 });
  const joined = joinContinuedLines(comment);
  assert.match(joined, /style="width:320px;height:240px;/);
  assert.match(joined, /src="data:image\/png;base64,/);
  const ranges = findWorksheetImageRanges(`${comment}\n`);
  assert.equal(ranges[0].width, 320);
  assert.equal(ranges[0].height, 240);
});

test("rewriteWorksheetImageStyle changes only the style, not the data URI", () => {
  const comment = worksheetImageComment(TINY_PNG, "shot", { width: 10, height: 10 });
  const doc = `r = 1\n${comment}\nh = 2\n`;
  const range = findWorksheetImageRanges(doc)[0];
  const next = rewriteWorksheetImageStyle(doc, range, { width: 200, height: 200 });
  const updated = findWorksheetImageRanges(next)[0];
  assert.equal(updated.dataUri, range.dataUri);
  assert.equal(updated.width, 200);
  assert.equal(updated.height, 200);
  assert.match(next, /r = 1/);
  assert.match(next, /h = 2/);
});

test("detachInlineImages keeps the display style on the placeholder", () => {
  const comment = worksheetImageComment(TINY_PNG, "shot", { width: 80, height: 40 });
  const { source, images } = detachInlineImages(`r\n${comment}\n`);
  assert.equal(images.length, 1);
  assert.match(source, /style="width:80px;height:40px;/);
  assert.match(source, /src="cid:cpd-img-0"/);
});

test("detachInlineImages finds data URIs even when wrapping splits data:image/", () => {
  const img = worksheetImageComment(TINY_PNG, "shot");
  assert.equal(img.includes("data:image/"), false, "fixture must actually split the marker");
  const { source, images } = detachInlineImages(`r = 1\n${img}\n`);
  assert.equal(images.length, 1);
  assert.equal(images[0], TINY_PNG);
  assert.match(source, /src="cid:cpd-img-0"/);
  assert.doesNotMatch(source, /data:image\/png;base64,/);
});
