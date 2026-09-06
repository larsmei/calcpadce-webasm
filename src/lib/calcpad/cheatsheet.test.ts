import assert from "node:assert/strict";
import { test } from "node:test";
import { CHEATSHEET, cheatsheetInsertText, filterCheatsheet } from "./cheatsheet.ts";

test("cheatsheet covers the main Calcpad topics", () => {
  const ids = CHEATSHEET.map((s) => s.id);
  for (const id of ["basics", "units", "form", "output", "flow", "macros", "commands", "linear", "functions", "html", "settings"]) {
    assert.ok(ids.includes(id), `missing section ${id}`);
  }
  assert.ok(CHEATSHEET.every((s) => s.rows.length > 0));
  const rows = CHEATSHEET.flatMap((s) => s.rows);
  assert.ok(rows.length >= 60, `expected a complete sheet, got ${rows.length} rows`);
});

test("filterCheatsheet matches names, syntax and section titles", () => {
  const plot = filterCheatsheet("plot");
  assert.ok(plot.some((s) => s.rows.some((r) => r.syntax.includes("$Plot"))));
  const form = filterCheatsheet("Form / Results");
  assert.equal(form.length, 1);
  assert.equal(form[0]?.id, "form");
  assert.deepEqual(filterCheatsheet(""), CHEATSHEET);
  assert.equal(filterCheatsheet("xyzzy-no-such").length, 0);
});

test("cheatsheetInsertText uses insert override when present", () => {
  assert.equal(cheatsheetInsertText({ name: "A", syntax: "shown", insert: "typed" }), "typed");
  assert.equal(cheatsheetInsertText({ name: "A", syntax: "shown" }), "shown");
});
