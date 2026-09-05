import { useEffect, useRef } from "react";
import { EditorView, keymap, highlightActiveLine, lineNumbers, highlightActiveLineGutter, drawSelection } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { HighlightStyle, syntaxHighlighting, bracketMatching, indentOnInput } from "@codemirror/language";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { autocompletion, closeBrackets, completionKeymap, type CompletionContext } from "@codemirror/autocomplete";
import { tags } from "@lezer/highlight";
import { calcpadLanguage, CALCPAD_COMPLETIONS } from "@/lib/calcpad/language";

const highlight = HighlightStyle.define([
  { tag: tags.comment, color: "#6f7c76", fontStyle: "italic" },
  { tag: tags.keyword, color: "#7ec8b8" },
  { tag: tags.atom, color: "#d4b483" },
  { tag: tags.number, color: "#c9d4ce" },
  { tag: tags.bool, color: "#c9d4ce" },
  { tag: tags.operator, color: "#9aa8a2" },
  { tag: tags.variableName, color: "#d7e4de" },
  { tag: tags.function(tags.variableName), color: "#8ec4ff" },
  { tag: tags.definition(tags.variableName), color: "#e8ece9" },
  { tag: tags.meta, color: "#8fb9ae" },
  { tag: tags.bracket, color: "#7d8a85" },
  { tag: tags.literal, color: "#d4b483" },
]);

function completions(context: CompletionContext) {
  const word = context.matchBefore(/[$#A-Za-z_][\w$]*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  return {
    from: word.from,
    options: CALCPAD_COMPLETIONS.map((c) => ({
      label: c.label,
      type: c.type,
      info: c.info,
    })),
  };
}

const theme = EditorView.theme(
  {
    "&": {
      height: "100%",
      fontSize: "13.5px",
      backgroundColor: "transparent",
      color: "#e7ece9",
    },
    ".cm-scroller": {
      fontFamily: "var(--font-mono)",
      lineHeight: "1.55",
      overflow: "auto",
    },
    ".cm-content": { caretColor: "#1c8a78", padding: "12px 0 48px" },
    ".cm-gutters": {
      backgroundColor: "transparent",
      color: "#5c6662",
      border: "none",
    },
    ".cm-activeLine": { backgroundColor: "rgba(255,255,255,0.035)" },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: "#9aa8a2" },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
      backgroundColor: "rgba(28,138,120,0.28) !important",
    },
    ".cm-cursor": { borderLeftColor: "#2ea58f" },
    ".cm-tooltip": {
      backgroundColor: "#161b1e",
      border: "1px solid rgba(231,236,233,0.12)",
      color: "#e7ece9",
    },
    ".cm-tooltip-autocomplete ul li[aria-selected]": {
      backgroundColor: "rgba(28,138,120,0.22)",
    },
  },
  { dark: true },
);

type Props = {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  focusLine?: { line: number; key: number } | null;
};

export function CodeEditor({ value, onChange, onRun, focusLine }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onRunRef = useRef(onRun);
  onChangeRef.current = onChange;
  onRunRef.current = onRun;

  useEffect(() => {
    if (!hostRef.current) return;
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          drawSelection(),
          history(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          highlightSelectionMatches(),
          calcpadLanguage,
          syntaxHighlighting(highlight),
          autocompletion({ override: [completions] }),
          keymap.of([
            indentWithTab,
            ...defaultKeymap,
            ...historyKeymap,
            ...searchKeymap,
            ...completionKeymap,
            {
              key: "Mod-Enter",
              run: () => {
                onRunRef.current();
                return true;
              },
            },
          ]),
          theme,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !focusLine) return;
    const n = Math.max(1, Math.min(focusLine.line, view.state.doc.lines));
    const line = view.state.doc.line(n);
    view.dispatch({
      selection: { anchor: line.from, head: line.to },
      effects: EditorView.scrollIntoView(line.from, { y: "center" }),
    });
    view.focus();
  }, [focusLine]);

  return <div ref={hostRef} className="h-full min-h-0 w-full" />;
}
