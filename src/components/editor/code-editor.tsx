import { useEffect, useRef, useState } from "react";
import { EditorView, keymap, highlightActiveLine, lineNumbers, highlightActiveLineGutter, drawSelection } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { HighlightStyle, syntaxHighlighting, bracketMatching, indentOnInput } from "@codemirror/language";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { autocompletion, closeBrackets, completionKeymap, type CompletionContext } from "@codemirror/autocomplete";
import { tags } from "@lezer/highlight";
import { calcpadLanguage, CALCPAD_COMPLETIONS } from "@/lib/calcpad/language";
import { IMAGE_SIZE_EVENT, imageFold } from "@/lib/calcpad/image-fold";
import { foldHtmlSections, htmlFold } from "@/lib/calcpad/html-fold";
import { setEditorInsertHandler } from "@/lib/calcpad/greek";
import { ImageSizeDialog } from "@/components/editor/image-size-dialog";
import {
  blobToPreparedImage,
  findWorksheetImageRanges,
  imageSnippetAtCursor,
  imagesToInsert,
  rewriteWorksheetImageStyle,
  worksheetImageComment,
  type ImageDisplaySize,
  type PreparedWorksheetImage,
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

type PendingInsert = PreparedWorksheetImage & { from: number; to: number };
type PendingResize = {
  from: number;
  dataUri: string;
  alt: string;
  naturalWidth: number;
  naturalHeight: number;
  width: number;
  height: number;
};

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
  const queueRef = useRef<PendingInsert[]>([]);
  const insertPosRef = useRef<{ from: number; to: number } | null>(null);
  const [pendingInsert, setPendingInsert] = useState<PendingInsert | null>(null);
  const [pendingResize, setPendingResize] = useState<PendingResize | null>(null);

  function showNextInsert() {
    const next = queueRef.current.shift() ?? null;
    setPendingInsert(next);
  }

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
          imageFold,
          htmlFold,
          EditorView.domEventHandlers({
            paste(event, v) {
              const images = imagesToInsert(event.clipboardData, "paste");
              if (!images.length) return false;
              event.preventDefault();
              const { from, to } = v.state.selection.main;
              void queueClipboardImages(v, images, from, to);
              return true;
            },
            drop(event, v) {
              const images = imagesToInsert(event.dataTransfer, "drop");
              if (!images.length) return false;
              event.preventDefault();
              const pos =
                v.posAtCoords({ x: event.clientX, y: event.clientY }) ??
                v.state.selection.main.head;
              void queueClipboardImages(v, images, pos, pos);
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
              let full = false;
              update.changes.iterChangedRanges((fromA, toA) => {
                if (fromA === 0 && toA === update.startState.doc.length) full = true;
              });
              if (full) {
                const view = update.view;
                queueMicrotask(() => {
                  if (viewRef.current === view) foldHtmlSections(view);
                });
              }
            }
          }),
        ],
      }),
    });
    viewRef.current = view;
    queueMicrotask(() => {
      if (viewRef.current === view) foldHtmlSections(view);
    });

    const onSize = (event: Event) => {
      const from = (event as CustomEvent<{ from?: number }>).detail?.from;
      if (typeof from !== "number") return;
      const range = findWorksheetImageRanges(view.state.doc.toString()).find((item) => item.from === from);
      if (!range) return;
      const naturalWidth = range.width && range.width > 0 ? range.width : 800;
      const naturalHeight = range.height && range.height > 0 ? range.height : Math.round(naturalWidth * 0.75);
      setPendingResize({
        from: range.from,
        dataUri: range.dataUri,
        alt: range.alt,
        naturalWidth,
        naturalHeight,
        width: range.width ?? naturalWidth,
        height: range.height && range.height > 0 ? range.height : naturalHeight,
      });
      void (async () => {
        try {
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("size"));
            img.src = range.dataUri;
          });
          const nw = Math.max(1, img.naturalWidth || img.width || naturalWidth);
          const nh = Math.max(1, img.naturalHeight || img.height || naturalHeight);
          setPendingResize((cur) =>
            cur && cur.from === range.from
              ? {
                  ...cur,
                  naturalWidth: nw,
                  naturalHeight: nh,
                  width: range.width ?? nw,
                  height: range.height && range.height > 0 ? range.height : nh,
                }
              : cur,
          );
        } catch {
          /* keep parsed size */
        }
      })();
    };
    view.dom.addEventListener(IMAGE_SIZE_EVENT, onSize);
    setEditorInsertHandler((text) => {
      const v = viewRef.current;
      if (!v || !text) return;
      const { from, to } = v.state.selection.main;
      v.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + text.length },
        scrollIntoView: true,
      });
      v.focus();
    });

    async function queueClipboardImages(v: EditorView, files: File[], from: number, to: number) {
      const prepared: PendingInsert[] = [];
      for (const file of files) {
        const name = file.name.replace(/\.[^.]+$/, "") || "screenshot";
        try {
          const item = await blobToPreparedImage(file, name);
          prepared.push({ ...item, from, to });
        } catch {
          /* skip unreadable clipboard items */
        }
      }
      if (!prepared.length || !v.dom.isConnected) return;
      insertPosRef.current = { from: prepared[0].from, to: prepared[0].to };
      queueRef.current = prepared;
      showNextInsert();
    }

    return () => {
      setEditorInsertHandler(null);
      view.dom.removeEventListener(IMAGE_SIZE_EVENT, onSize);
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

  function confirmInsert(size: ImageDisplaySize) {
    const view = viewRef.current;
    const item = pendingInsert;
    if (!view || !item) return;
    const max = view.state.doc.length;
    const pos = insertPosRef.current ?? { from: item.from, to: item.to };
    const from = Math.min(pos.from, max);
    const to = Math.min(pos.to, max);
    const snippet = worksheetImageComment(item.dataUri, item.alt, size);
    const { insert } = imageSnippetAtCursor(view.state.doc.toString(), from, to, snippet);
    insertSnippet(view, snippet, from, to);
    insertPosRef.current = { from: from + insert.length, to: from + insert.length };
    showNextInsert();
  }

  function confirmResize(size: ImageDisplaySize) {
    const view = viewRef.current;
    const item = pendingResize;
    if (!view || !item) return;
    const range = findWorksheetImageRanges(view.state.doc.toString()).find((entry) => entry.from === item.from);
    setPendingResize(null);
    if (!range) return;
    const doc = view.state.doc.toString();
    const nextDoc = rewriteWorksheetImageStyle(doc, range, size);
    const insert = nextDoc.slice(range.from, nextDoc.length - (doc.length - range.to));
    view.dispatch({
      changes: { from: range.from, to: range.to, insert },
      scrollIntoView: true,
    });
    view.focus();
  }

  return (
    <>
      <div ref={hostRef} className="h-full min-h-0 w-full" />
      <ImageSizeDialog
        open={Boolean(pendingInsert)}
        title="Image size"
        confirmLabel="Insert"
        previewSrc={pendingInsert?.dataUri}
        naturalWidth={pendingInsert?.width ?? 1}
        naturalHeight={pendingInsert?.height ?? 1}
        width={pendingInsert?.width ?? 1}
        height={pendingInsert?.height ?? 1}
        onOpenChange={(open) => {
          if (!open) {
            queueRef.current = [];
            setPendingInsert(null);
          }
        }}
        onConfirm={confirmInsert}
      />
      <ImageSizeDialog
        open={Boolean(pendingResize)}
        title="Image size"
        confirmLabel="Apply"
        previewSrc={pendingResize?.dataUri}
        naturalWidth={pendingResize?.naturalWidth ?? 1}
        naturalHeight={pendingResize?.naturalHeight ?? 1}
        width={pendingResize?.width ?? 1}
        height={pendingResize?.height ?? 1}
        onOpenChange={(open) => {
          if (!open) setPendingResize(null);
        }}
        onConfirm={confirmResize}
      />
    </>
  );
}
