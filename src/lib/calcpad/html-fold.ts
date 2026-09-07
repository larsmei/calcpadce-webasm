import { foldEffect, foldGutter, foldKeymap, foldService, codeFolding, unfoldAll } from "@codemirror/language";
import { keymap, EditorView } from "@codemirror/view";
import type { EditorState } from "@codemirror/state";

export type HtmlFoldRange = {
  openLine: number;
  closeLine: number;
  foldFrom: number;
  foldTo: number;
  heading: string;
};

const DIV_OPEN = /^\s*'+\s*<div\b/i;
const DIV_CLOSE = /^\s*'+\s*<\/div\s*>/i;
const DIV_TAG = /<div\b([^>]*)>/i;
const CLASS_ATTR = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;
const HEADING_TAG = /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i;

export function isHtmlDivOpen(line: string) {
  return DIV_OPEN.test(line);
}

export function isHtmlDivClose(line: string) {
  return DIV_CLOSE.test(line);
}

export function isFoldDivOpen(line: string) {
  if (!isHtmlDivOpen(line)) return false;
  const tag = line.match(DIV_TAG);
  if (!tag) return false;
  const cls = tag[1].match(CLASS_ATTR);
  if (!cls) return false;
  const value = cls[1] ?? cls[2] ?? cls[3] ?? "";
  return /\bfold\b/i.test(value);
}

function stripTags(html: string) {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&/gi, "&")
    .replace(/</gi, "<")
    .replace(/>/gi, ">")
    .replace(/"/gi, '"')
    .trim();
}

export function headingFromFoldLines(lines: string[], openLine: number, closeLine: number) {
  for (let i = openLine + 1; i < closeLine; i++) {
    const raw = lines[i]?.trim() ?? "";
    if (!raw) continue;
    const body = raw.startsWith("'") ? raw.slice(1) : raw;
    const heading = body.match(HEADING_TAG);
    if (heading) {
      const text = stripTags(heading[1]);
      if (text) return text;
    }
    const text = stripTags(body);
    if (text) return text.slice(0, 80);
  }
  return "fold";
}

export function findHtmlFoldRanges(text: string): HtmlFoldRange[] {
  const lines = text.split("\n");
  const starts: number[] = [];
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    starts.push(offset);
    offset += lines[i].length + (i < lines.length - 1 ? 1 : 0);
  }

  const stack: { line: number; fold: boolean }[] = [];
  const ranges: HtmlFoldRange[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isHtmlDivOpen(line)) {
      stack.push({ line: i, fold: isFoldDivOpen(line) });
      continue;
    }
    if (!isHtmlDivClose(line) || !stack.length) continue;
    const open = stack.pop()!;
    if (!open.fold) continue;
    const foldFrom = starts[open.line] + lines[open.line].length;
    const foldTo = starts[i] + lines[i].length;
    if (foldFrom >= foldTo) continue;
    ranges.push({
      openLine: open.line,
      closeLine: i,
      foldFrom,
      foldTo,
      heading: headingFromFoldLines(lines, open.line, i),
    });
  }
  return ranges;
}

function htmlFoldService(state: EditorState, lineStart: number, _lineEnd: number) {
  const line = state.doc.lineAt(lineStart);
  if (!isFoldDivOpen(line.text)) return null;
  const hit = findHtmlFoldRanges(state.doc.toString()).find((range) => range.foldFrom === line.to);
  if (!hit) return null;
  return { from: hit.foldFrom, to: hit.foldTo };
}

function placeholderLabel(text: string, from: number, to: number) {
  const hit = findHtmlFoldRanges(text).find((range) => range.foldFrom === from && range.foldTo === to);
  if (!hit) return "…";
  const inner = hit.closeLine - hit.openLine;
  const lines = inner <= 1 ? "1 line" : `${inner} lines`;
  return `${hit.heading} · ${lines}`;
}

export function htmlFoldEffectsForDoc(text: string) {
  return findHtmlFoldRanges(text)
    .filter((range) => range.foldFrom < range.foldTo)
    .map((range) => foldEffect.of({ from: range.foldFrom, to: range.foldTo }));
}

export function foldHtmlSections(view: EditorView) {
  unfoldAll(view);
  const effects = htmlFoldEffectsForDoc(view.state.doc.toString());
  if (effects.length) view.dispatch({ effects });
}

const htmlFoldTheme = EditorView.theme({
  ".cm-foldGutter": {
    width: "14px",
  },
  ".cm-foldGutter .cm-gutterElement": {
    padding: "0 2px 0 0",
    color: "#7a93a8",
    cursor: "pointer",
    fontSize: "11px",
    lineHeight: "1.55",
  },
  ".cm-html-fold-placeholder": {
    display: "inline-block",
    marginLeft: "6px",
    padding: "0 8px",
    border: "1px solid #c5d3e0",
    borderRadius: "4px",
    background: "#eef4fa",
    color: "#35536c",
    fontFamily: "var(--font-sans, 'Segoe UI', system-ui, sans-serif)",
    fontSize: "12px",
    lineHeight: "1.6",
    verticalAlign: "middle",
    cursor: "pointer",
  },
  ".cm-html-fold-placeholder:hover": {
    background: "#e1ebf4",
    borderColor: "#9bb4c9",
  },
});

export const htmlFold = [
  codeFolding({
    preparePlaceholder: (state, range) => placeholderLabel(state.doc.toString(), range.from, range.to),
    placeholderDOM: (_view, onclick, prepared) => {
      const el = document.createElement("span");
      el.className = "cm-foldPlaceholder cm-html-fold-placeholder";
      el.textContent = typeof prepared === "string" && prepared ? prepared : "…";
      el.title = "Unfold section";
      el.onclick = onclick;
      return el;
    },
  }),
  foldGutter({
    openText: "▾",
    closedText: "▸",
  }),
  foldService.of(htmlFoldService),
  keymap.of(foldKeymap),
  htmlFoldTheme,
];
