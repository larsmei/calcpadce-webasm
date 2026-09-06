import { RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";
import { findWorksheetImageRanges, imageKindLabel, type WorksheetImageRange } from "./paste-image";

export const toggleImageFold = StateEffect.define<number>();
export const IMAGE_SIZE_EVENT = "calcpad-image-size";

function chevron(expanded: boolean) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 12 12");
  svg.setAttribute("width", "12");
  svg.setAttribute("height", "12");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("cm-image-fold-chevron");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", expanded ? "M2.5 4.5 L6 8 L9.5 4.5" : "M4.5 2.5 L8 6 L4.5 9.5");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.6");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.appendChild(path);
  return svg;
}

function resizeIcon() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("width", "14");
  svg.setAttribute("height", "14");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute(
    "d",
    "M3 8 V3 h5 M13 8 V3 h-5 M3 8 v5 h5 M13 8 v5 h-5",
  );
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.5");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.appendChild(path);
  return svg;
}

function bindToggle(el: HTMLElement, view: EditorView, from: number) {
  const go = (event: Event) => {
    if ((event.target as HTMLElement | null)?.closest?.(".cm-image-fold-resize")) return;
    event.preventDefault();
    event.stopPropagation();
    view.dispatch({ effects: toggleImageFold.of(from) });
  };
  el.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  el.addEventListener("click", go);
  el.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") go(event);
  });
}

function bindResize(el: HTMLElement, view: EditorView, from: number) {
  const go = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    view.dom.dispatchEvent(
      new CustomEvent(IMAGE_SIZE_EVENT, { bubbles: true, detail: { from } }),
    );
  };
  el.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  el.addEventListener("click", go);
}

class ImageFoldWidget extends WidgetType {
  constructor(readonly range: WorksheetImageRange) {
    super();
  }

  eq(other: ImageFoldWidget) {
    return (
      this.range.from === other.range.from &&
      this.range.to === other.range.to &&
      this.range.dataUri === other.range.dataUri &&
      this.range.alt === other.range.alt &&
      this.range.style === other.range.style &&
      this.range.lineCount === other.range.lineCount
    );
  }

  toDOM(view: EditorView) {
    const { alt, dataUri, mime, lineCount, from, width, height } = this.range;
    const kind = imageKindLabel(mime);
    const lines = lineCount === 1 ? "1 line" : `${lineCount} lines`;
    const dims = width && height ? `${width} × ${height} · ` : "";
    const wrap = document.createElement("div");
    wrap.className = "cm-image-fold";
    wrap.tabIndex = 0;
    wrap.setAttribute("role", "button");
    wrap.setAttribute("aria-expanded", "false");
    wrap.setAttribute("aria-label", `Expand ${alt}`);
    wrap.title = "Click to show source";

    const thumb = document.createElement("img");
    thumb.src = dataUri;
    thumb.alt = "";
    thumb.draggable = false;

    const text = document.createElement("div");
    text.className = "cm-image-fold-text";
    const title = document.createElement("div");
    title.className = "cm-image-fold-title";
    title.textContent = alt;
    const meta = document.createElement("div");
    meta.className = "cm-image-fold-meta";
    meta.textContent = `${kind} · ${dims}${lines}`;
    text.append(title, meta);

    const resize = document.createElement("button");
    resize.type = "button";
    resize.className = "cm-image-fold-resize";
    resize.title = "Change display size";
    resize.setAttribute("aria-label", `Change size of ${alt}`);
    resize.append(resizeIcon());
    bindResize(resize, view, from);

    wrap.append(thumb, text, resize, chevron(false));
    bindToggle(wrap, view, from);
    return wrap;
  }

  ignoreEvent() {
    return true;
  }

  get block() {
    return true;
  }

  get estimatedHeight() {
    return 48;
  }
}

class ImageUnfoldWidget extends WidgetType {
  constructor(
    readonly from: number,
    readonly alt: string,
  ) {
    super();
  }

  eq(other: ImageUnfoldWidget) {
    return this.from === other.from && this.alt === other.alt;
  }

  toDOM(view: EditorView) {
    const wrap = document.createElement("div");
    wrap.className = "cm-image-unfold";
    wrap.tabIndex = 0;
    wrap.setAttribute("role", "button");
    wrap.setAttribute("aria-expanded", "true");
    wrap.setAttribute("aria-label", `Collapse ${this.alt}`);
    wrap.title = "Click to hide source";
    const label = document.createElement("span");
    label.textContent = `Collapse ${this.alt}`;

    const resize = document.createElement("button");
    resize.type = "button";
    resize.className = "cm-image-fold-resize";
    resize.title = "Change display size";
    resize.setAttribute("aria-label", `Change size of ${this.alt}`);
    resize.append(resizeIcon());
    bindResize(resize, view, this.from);

    wrap.append(chevron(true), label, resize);
    bindToggle(wrap, view, this.from);
    return wrap;
  }

  ignoreEvent() {
    return true;
  }

  get block() {
    return true;
  }

  get estimatedHeight() {
    return 28;
  }
}

function isFullReplace(tr: { startState: { doc: { length: number } }; changes: { iterChangedRanges: (f: (fromA: number, toA: number) => void) => void } }) {
  let full = false;
  tr.changes.iterChangedRanges((fromA, toA) => {
    if (fromA === 0 && toA === tr.startState.doc.length) full = true;
  });
  return full;
}

function buildDecos(text: string, expanded: number[]): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const open = new Set(expanded);
  for (const range of findWorksheetImageRanges(text)) {
    if (open.has(range.from)) {
      builder.add(
        range.from,
        range.from,
        Decoration.widget({
          widget: new ImageUnfoldWidget(range.from, range.alt),
          block: true,
          side: -1,
        }),
      );
    } else {
      builder.add(
        range.from,
        range.to,
        Decoration.replace({
          widget: new ImageFoldWidget(range),
          block: true,
        }),
      );
    }
  }
  return builder.finish();
}

type FoldState = { expanded: number[]; decos: DecorationSet };

const imageFoldState = StateField.define<FoldState>({
  create(state) {
    return { expanded: [], decos: buildDecos(state.doc.toString(), []) };
  },
  update(value, tr) {
    let expanded = value.expanded;
    if (tr.docChanged) {
      expanded = isFullReplace(tr) ? [] : expanded.map((pos) => tr.changes.mapPos(pos, 1));
    }
    for (const effect of tr.effects) {
      if (effect.is(toggleImageFold)) {
        const pos = effect.value;
        expanded = expanded.includes(pos) ? expanded.filter((p) => p !== pos) : [...expanded, pos];
      }
    }
    if (!tr.docChanged && !tr.effects.some((effect) => effect.is(toggleImageFold))) return value;
    const text = tr.state.doc.toString();
    const valid = new Set(findWorksheetImageRanges(text).map((range) => range.from));
    expanded = expanded.filter((pos) => valid.has(pos));
    return { expanded, decos: buildDecos(text, expanded) };
  },
  provide: (field) => EditorView.decorations.from(field, (value) => value.decos),
});

const imageFoldTheme = EditorView.theme({
  ".cm-image-fold, .cm-image-unfold": {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    boxSizing: "border-box",
    width: "calc(100% - 12px)",
    maxWidth: "32rem",
    margin: "4px 8px 4px 2px",
    border: "1px solid #c5ddc5",
    background: "#f3f8f3",
    color: "#215c21",
    cursor: "pointer",
    userSelect: "none",
    fontFamily: "var(--font-sans, 'Segoe UI', system-ui, sans-serif)",
  },
  ".cm-image-fold": {
    minHeight: "44px",
    padding: "6px 8px 6px 10px",
    borderRadius: "6px",
  },
  ".cm-image-unfold": {
    minHeight: "28px",
    padding: "4px 8px 4px 10px",
    borderRadius: "6px 6px 0 0",
    marginBottom: "0",
    borderBottom: "none",
    fontSize: "12px",
  },
  ".cm-image-fold:hover, .cm-image-unfold:hover, .cm-image-fold:focus-visible, .cm-image-unfold:focus-visible": {
    background: "#e7f2e7",
    outline: "none",
    borderColor: "#8fbf8f",
  },
  ".cm-image-fold img": {
    width: "44px",
    height: "32px",
    objectFit: "cover",
    borderRadius: "3px",
    background: "#ffffff",
    border: "1px solid #d3e6d3",
    flex: "none",
    pointerEvents: "none",
  },
  ".cm-image-fold-text": {
    minWidth: 0,
    flex: "1 1 auto",
  },
  ".cm-image-fold-title": {
    fontSize: "12.5px",
    fontWeight: "600",
    lineHeight: "1.25",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  ".cm-image-fold-meta": {
    fontSize: "11px",
    color: "#5b7a5b",
    lineHeight: "1.3",
  },
  ".cm-image-fold-chevron": {
    flex: "none",
    opacity: "0.7",
  },
  ".cm-image-fold-resize": {
    display: "grid",
    placeItems: "center",
    flex: "none",
    width: "28px",
    height: "28px",
    margin: "0",
    padding: "0",
    border: "1px solid #c5ddc5",
    borderRadius: "5px",
    background: "#ffffff",
    color: "#215c21",
    cursor: "pointer",
  },
  ".cm-image-fold-resize:hover": {
    background: "#dcecdc",
    borderColor: "#8fbf8f",
  },
});

export const imageFold = [imageFoldState, imageFoldTheme];
