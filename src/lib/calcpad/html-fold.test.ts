import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { findHtmlFoldRanges, headingFromFoldLines, isFoldDivOpen } from "./html-fold.ts";

test("isFoldDivOpen matches class=fold and ignores unfold / other divs", () => {
  assert.equal(isFoldDivOpen(`'<div class="fold">`), true);
  assert.equal(isFoldDivOpen(`'<div class='fold'>`), true);
  assert.equal(isFoldDivOpen(`'<div class="fold extra">`), true);
  assert.equal(isFoldDivOpen(`'<div class="unfold">`), false);
  assert.equal(isFoldDivOpen(`'<div style="color:red">`), false);
  assert.equal(isFoldDivOpen(`'</div>`), false);
});

test("findHtmlFoldRanges finds headings and nested pairs", () => {
  const src = `'<div class="fold">
'<h1>Outer</h1>
'<div class="fold">
'<h2>Inner</h2>
'secret
'</div>
'</div>
`;
  const ranges = findHtmlFoldRanges(src);
  assert.equal(ranges.length, 2);
  const inner = ranges.find((r) => r.heading === "Inner");
  const outer = ranges.find((r) => r.heading === "Outer");
  assert.ok(inner);
  assert.ok(outer);
  assert.equal(inner.openLine, 2);
  assert.equal(inner.closeLine, 5);
  assert.equal(outer.openLine, 0);
  assert.equal(outer.closeLine, 6);
  assert.ok(outer.foldFrom < inner.foldFrom);
  assert.ok(outer.foldTo > inner.foldTo);
});

test("non-fold inner divs do not close the fold early", () => {
  const src = `'<div class="fold">
'<h3>Title</h3>
'<div style="padding:1em">
'inside
'</div>
'</div>
`;
  const ranges = findHtmlFoldRanges(src);
  assert.equal(ranges.length, 1);
  assert.equal(ranges[0].heading, "Title");
  assert.equal(ranges[0].closeLine, 5);
});

test("headingFromFoldLines falls back to the first quoted line", () => {
  assert.equal(headingFromFoldLines(["'<div class=\"fold\">", "'Hello world", "'</div>"], 0, 2), "Hello world");
});

test("fold-sections example has two collapsed ranges", () => {
  const src = readFileSync(new URL("../../../public/examples/fold-sections.cpd", import.meta.url), "utf8");
  const ranges = findHtmlFoldRanges(src);
  assert.equal(ranges.length, 2);
  assert.equal(ranges[0].heading, "Allgemeine Hydraulikberechnungen");
  assert.equal(ranges[1].heading, "Zweite Sektion");
});
