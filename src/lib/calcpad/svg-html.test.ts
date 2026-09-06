import assert from "node:assert/strict";
import { test } from "node:test";
import { flattenSvgEquations } from "./svg-html.ts";

const BROKEN = `<svg viewbox=" <span class="eq">-10 = -10</span>   <span class="eq">-10 = -10</span>   <span class="eq">20 = 20</span>   <span class="eq">20 = 20</span> " xmlns="http://www.w3.org/2000/svg" version="1.1" style="font-family: Segoe UI; font-size:8px; width: <span class="eq">20 = 20</span> pt; height: <span class="eq">20 = 20</span> pt">
<style>.joint{fill:orangeRed;}</style>
<circle cx=" <span class="eq">0 = 0</span> " cy=" <span class="eq">0 = 0</span> " r=" <span class="eq">5 = 5</span> " class="joint" />
</svg>`;

test("flattenSvgEquations turns eq spans into values inside svg", () => {
  const out = flattenSvgEquations(BROKEN);
  assert.match(out, /viewbox="\s*-10\s+-10\s+20\s+20\s*"/i);
  assert.match(out, /width:\s*20pt/);
  assert.match(out, /height:\s*20pt/);
  assert.match(out, /cx="\s*0\s*"/);
  assert.match(out, /cy="\s*0\s*"/);
  assert.match(out, /r="\s*5\s*"/);
  assert.doesNotMatch(out, /class="eq"/);
  assert.match(out, /class="joint"/);
});

test("flattenSvgEquations leaves #val svg and report equations alone", () => {
  const ok = `<svg viewBox="-10 -10 20 20" style="width:20pt;height:20pt"><circle cx="0" cy="0" r="5"/></svg><span class="eq">V = 1.5</span>`;
  assert.equal(flattenSvgEquations(ok), ok);
});

test("flattenSvgEquations is a no-op without eq spans", () => {
  assert.equal(flattenSvgEquations("<p>hello</p>"), "<p>hello</p>");
});
