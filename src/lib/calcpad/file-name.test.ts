import assert from "node:assert/strict";
import { test } from "node:test";
import { ensureCpdFileName } from "./file-name.ts";

test("ensureCpdFileName appends .cpd when missing", () => {
  assert.equal(ensureCpdFileName("beam"), "beam.cpd");
  assert.equal(ensureCpdFileName("  beam-design  "), "beam-design.cpd");
});

test("ensureCpdFileName keeps .cpd and .cpdz", () => {
  assert.equal(ensureCpdFileName("Beam.CPD"), "Beam.cpd");
  assert.equal(ensureCpdFileName("lib.cpdz"), "lib.cpdz");
});

test("ensureCpdFileName strips txt/pdf then adds .cpd", () => {
  assert.equal(ensureCpdFileName("notes.txt"), "notes.cpd");
  assert.equal(ensureCpdFileName("report.PDF"), "report.cpd");
});

test("ensureCpdFileName falls back when empty", () => {
  assert.equal(ensureCpdFileName("   "), "worksheet.cpd");
});
