import { useEffect, useRef } from "react";
import { EditorView, keymap, highlightActiveLine, lineNumbers, highlightActiveLineGutter, drawSelection } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { HighlightStyle, syntaxHighlighting, bracketMatching, indentOnInput } from "@codemirror/language";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { autocompletion, closeBrackets, completionKeymap, type CompletionContext } from "@codemirror/autocomplete";
import { tags } from "@lezer/highlight";
import { calcpadLanguage, CALCPAD_COMPLETIONS } from "@/lib/calcpad/language";
import {
  filesToWorksheetImages,
  imageSnippetAtCursor,
  imagesToInsert,
} from "@/lib/calcpad/paste-image";

const highlight = HighlightStyle.define([
  { tag: tags.comment, color: "#008000" },
  { tag: tags.keyword, color: "#ff00ff" },
  { tag: tags.atom, color: "#ff00ff" },
  { tag: tags.standard(tags.name), color: "#ff00ff" },
  { tag: tags.number, color: "#0000ff" },
  { tag: tags.bool, color: "#0000ff" },
  { tag: tags.unit, color: "#0000ff" },
  { tag: tags.literal, color: "#ff0000" },
  { tag: tags.operator, color: "#000000" },
  { tag: tags.variableName, color: "#000000" },
  { tag: tags.function(tags.variableName), color: "#ff00ff" },
  { tag: tags.meta, color: "#ff00ff" },
  { tag: tags.bracket, color: "#000000" },
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
      color: "#1e293b",
    },
    ".cm-scroller": {
      fontFamily: "var(--font-mono)",
      lineHeight: "1.55",
      overflow: "auto",
    },
    ".cm-content": { caretColor: "#006db0", padding: "12px 0 48px" },
    ".cm-gutters": {
      backgroundColor: "transparent",
      color: "#94a3b8",
      border: "none",
    },
    ".cm-activeLine": { backgroundColor: "rgba(0,109,176,0.06)" },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: "#006db0" },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
      backgroundColor: "rgba(0,109,176,0.18) !important",
    },
    ".cm-cursor": { borderLeftColor: "#006db0" },
    ".cm-tooltip": {
      backgroundColor: "#ffffff",
      border: "1px solid #d8dde4",
      color: "#1e293b",
    },
    ".cm-tooltip-autocomplete ul li[aria-selected]": {
      backgroundColor: "rgba(0,109,176,0.12)",
    },
  },
  { dark: false },
);

function insertSnippet(view: EditorView, snippet: string, from: number, to: number) {
  if (!snippet) return;
  const { insert } = imageSnippetAtCursor(view.state.doc.toString(), from, to, snippet);
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + insert.length },
    scrollIntoView: true,
  });
  view.focus();
}

async function insertClipboardImages(view: EditorView, files: File[], from: number, to: number) {
  const snippet = await filesToWorksheetImages(files);
  if (!snippet || !view.dom.isConnected) return;
  const max = view.state.doc.length;
  insertSnippet(view, snippet, Math.min(from, max), Math.min(to, max));
}

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
          EditorView.domEventHandlers({
            paste(event, v) {
              const images = imagesToInsert(event.clipboardData, "paste");
              if (!images.length) return false;
              event.preventDefault();
              const { from, to } = v.state.selection.main;
              void insertClipboardImages(v, images, from, to);
              return true;
            },
            drop(event, v) {
              const images = imagesToInsert(event.dataTransfer, "drop");
              if (!images.length) return false;
              event.preventDefault();
              const pos =
                v.posAtCoords({ x: event.clientX, y: event.clientY }) ??
                v.state.selection.main.head;
              void insertClipboardImages(v, images, pos, pos);
              return true;
            },
            dragover(event) {
              if (![...(event.dataTransfer?.types ?? [])].includes("Files")) return false;
              event.preventDefault();
              if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
              return true;
            },
          }),
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
