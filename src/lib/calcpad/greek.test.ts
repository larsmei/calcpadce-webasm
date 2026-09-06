import assert from "node:assert/strict";
import { test } from "node:test";
import {
  GREEK_LOWER,
  GREEK_UPPER,
  insertEditorText,
  peekEditorInsertQueue,
  setEditorInsertHandler,
} from "./greek.ts";

test("greek alphabet has 24 lower and 24 upper letters", () => {
  assert.equal(GREEK_LOWER.length, 24);
  assert.equal(GREEK_UPPER.length, 24);
  assert.equal(GREEK_LOWER[0].ch, "α");
  assert.equal(GREEK_LOWER[15].ch, "π");
  assert.equal(GREEK_LOWER[23].ch, "ω");
  assert.equal(GREEK_UPPER[0].ch, "Α");
  assert.equal(GREEK_UPPER[3].ch, "Δ");
  assert.equal(GREEK_UPPER[23].ch, "Ω");
  const chars = [...GREEK_LOWER, ...GREEK_UPPER].map((item) => item.ch);
  assert.equal(new Set(chars).size, 48);
});

test("insertEditorText queues until a handler is registered", () => {
  setEditorInsertHandler(null);
  insertEditorText("π");
  assert.equal(peekEditorInsertQueue(), "π");
  let got = "";
  setEditorInsertHandler((text) => {
    got = text;
  });
  assert.equal(got, "π");
  assert.equal(peekEditorInsertQueue(), "");
  insertEditorText("Δ");
  assert.equal(got, "Δ");
  setEditorInsertHandler(null);
});
