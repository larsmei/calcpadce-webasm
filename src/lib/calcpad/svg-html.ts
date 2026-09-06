/** Turn Calcpad equation spans inside SVG/HTML tags into plain values. */

const EQ_SPAN = /<span\s+class="eq"[^>]*>([\s\S]*?)<\/span>/gi;
const CSS_UNIT_SPACE = /(\d(?:\.\d+)?)\s+(pt|px|em|ex|mm|cm|in|pc|vh|vw|%)(?=\s|;|"|'|$)/gi;

function eqSpanToValue(inner: string): string {
  const text = inner
    .replace(/<[^>]+>/g, "")
    .replace(/[\u2009\u00a0]/g, " ")
    .replace(/[\u2212\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  const eq = text.lastIndexOf("=");
  const value = (eq >= 0 ? text.slice(eq + 1) : text).trim();
  return value;
}

function flattenEqSpans(block: string): string {
  return block.replace(EQ_SPAN, (_, inner: string) => eqSpanToValue(inner)).replace(CSS_UNIT_SPACE, "$1$2");
}

/**
 * `'<svg viewbox="'-10' …` without `#val` emits `<span class="eq">` inside
 * attributes. The HTML parser then splits the svg tag and the drawing vanishes.
 * Replace those spans with the numeric result so the markup stays a real SVG.
 */
export function flattenSvgEquations(html: string): string {
  if (!html.includes('class="eq"')) return html;
  let out = html.replace(/<svg\b[\s\S]*?<\/svg>/gi, (block) => flattenEqSpans(block));
  // Opening tags whose attributes still contain an eq span (unclosed svg, other HTML).
  for (let i = 0; i < 32; i++) {
    const next = out.replace(
      /<([a-zA-Z][^>]*?)<span\s+class="eq"[^>]*>([\s\S]*?)<\/span>/g,
      (_, start: string, inner: string) => `<${start}${eqSpanToValue(inner)}`,
    );
    if (next === out) break;
    out = next;
  }
  return out.replace(/<svg\b[\s\S]*?<\/svg>/gi, (block) => block.replace(CSS_UNIT_SPACE, "$1$2"));
}
