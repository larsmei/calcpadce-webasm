import assert from "node:assert/strict";
import { test } from "node:test";
import {
  continueLongLine,
  imageSnippetAtCursor,
  joinContinuedLines,
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
