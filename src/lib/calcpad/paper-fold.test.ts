import assert from "node:assert/strict";
import { test } from "node:test";
import { collapsePaperFolds } from "./paper-fold.ts";

function fragment(html: string) {
  const tpl = globalThis.document?.createElement("template");
  if (tpl) {
    tpl.innerHTML = html;
    return tpl.content;
  }
  throw new Error("DOM template not available");
}

test("collapsePaperFolds turns unfold back into fold", { skip: typeof document === "undefined" }, () => {
  const root = fragment(`<div class="unfold"><h1>A</h1><p>body</p></div>`);
  collapsePaperFolds(root);
  const el = root.querySelector("div")!;
  assert.equal(el.className, "fold");
  assert.equal(el.children.length, 2);
});

test("collapsePaperFolds prune keeps only the heading", { skip: typeof document === "undefined" }, () => {
  const root = fragment(`<div class="fold"><h1>A</h1><p>secret</p><h3>more</h3></div>`);
  collapsePaperFolds(root, { prune: true });
  const el = root.querySelector("div")!;
  assert.equal(el.children.length, 1);
  assert.equal(el.firstElementChild?.tagName, "H1");
  assert.equal(el.textContent?.trim(), "A");
});
