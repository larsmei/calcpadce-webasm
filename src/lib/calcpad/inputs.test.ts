import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyInputValues,
  splitWidgetValue,
  widgetTargetName,
} from "./inputs.ts";

test("applyInputValues writes mapped dropdown values into ? fields", () => {
  const src = "'<p id=\"pt\">'x = ? {11}', 'y = ? {12}'</p>\n";
  assert.equal(
    applyInputValues(src, ["21", "22"]),
    "'<p id=\"pt\">'x = ? {21}', 'y = ? {22}'</p>\n",
  );
});

test("splitWidgetValue splits Calcpad select values on semicolons", () => {
  assert.deepEqual(splitWidgetValue("21;22"), ["21", "22"]);
  assert.deepEqual(splitWidgetValue(" 5m ; 10kN "), ["5m", "10kN"]);
  assert.deepEqual(splitWidgetValue("12"), ["12"]);
});

test("widgetTargetName ignores #UI widgets and the Units select", () => {
  assert.equal(widgetTargetName(null), null);
});
