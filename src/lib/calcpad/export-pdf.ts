import { assetUrl } from "@/lib/calcpad/asset-url";
import { collapsePaperFolds } from "@/lib/calcpad/paper-fold";

/** CSS px per millimetre at the standard 96 dpi used by browsers. */
const MM = 96 / 25.4;

const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const MARGIN_LEFT_MM = 30;
const MARGIN_RIGHT_MM = 20;
const MARGIN_TOP_MM = 30;
const MARGIN_BOTTOM_MM = 30;
const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - MARGIN_LEFT_MM - MARGIN_RIGHT_MM; // 160
const CONTENT_HEIGHT_MM = PAGE_HEIGHT_MM - MARGIN_TOP_MM - MARGIN_BOTTOM_MM; // 237

const CONTENT_WIDTH_PX = CONTENT_WIDTH_MM * MM;
const CONTENT_HEIGHT_PX = CONTENT_HEIGHT_MM * MM;

const KEEP_SELECTOR = [
  "svg",
  "img",
  "canvas",
  "figure",
  ".js-plotly-plot",
  ".plot",
  "[data-plot]",
].join(",");

const BLOCK_RE = /^(P|H1|H2|H3|H4|H5|H6|TABLE|UL|OL|PRE|BLOCKQUOTE|DIV|SECTION|ARTICLE|DL|HR|FIGURE)$/;
const HEADING_RE = /^H[1-6]$/;

function reportTitle(fileName: string) {
  return fileName.replace(/\.(cpd|cpdz|txt|html|pdf)$/i, "") || "worksheet";
}

function waitForImages(root: ParentNode) {
  const images = [...root.querySelectorAll("img")];
  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        }),
    ),
  );
}

function replaceCanvases(source: HTMLElement, clone: HTMLElement) {
  const from = source.querySelectorAll("canvas");
  const to = clone.querySelectorAll("canvas");
  from.forEach((canvas, i) => {
    const target = to[i];
    if (!target) return;
    try {
      const img = document.createElement("img");
      img.src = canvas.toDataURL("image/png");
      img.alt = "plot";
      img.className = canvas.className || "plot";
      img.style.maxWidth = "100%";
      img.style.height = "auto";
      img.style.display = "block";
      target.replaceWith(img);
    } catch {
      /* tainted canvas */
    }
  });
}

function parseLen(raw: string | null | undefined): number {
  if (!raw) return 0;
  const m = /^([\d.]+)\s*(px|pt|mm|cm|in)?$/i.exec(raw.trim());
  if (!m) return 0;
  const n = parseFloat(m[1]);
  switch ((m[2] || "px").toLowerCase()) {
    case "pt":
      return (n * 96) / 72;
    case "mm":
      return n * MM;
    case "cm":
      return n * MM * 10;
    case "in":
      return n * 96;
    default:
      return n;
  }
}

function styleLength(style: string, prop: "width" | "height"): number {
  const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, "i").exec(style);
  return parseLen(m?.[1] ?? "");
}

function isElement(node: Node): node is HTMLElement {
  return node.nodeType === Node.ELEMENT_NODE;
}

function graphicCssSize(el: Element) {
  const style = el.getAttribute("style") ?? "";
  let w = styleLength(style, "width");
  let h = styleLength(style, "height");
  if (!w || !h) {
    const r = el.getBoundingClientRect();
    w = w || r.width;
    h = h || r.height;
  }
  if ((!w || !h) && el.tagName.toLowerCase() === "svg") {
    const vb = (el.getAttribute("viewBox") || el.getAttribute("viewbox") || "")
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
      w = w || vb[2];
      h = h || vb[3];
    }
  }
  if (w > CONTENT_WIDTH_PX && w > 0) {
    const s = CONTENT_WIDTH_PX / w;
    w = CONTENT_WIDTH_PX;
    h = h * s;
  }
  return { w: Math.max(1, w), h: Math.max(1, h) };
}

/**
 * Calcpad SVGs ship with retina attributes (e.g. width="2350px") and a CSS
 * size in pt. Browsers layout to the CSS size; html2canvas often paints the
 * attribute size and overflows the page. Rasterize at the CSS size so the
 * box we paginate is the box we paint.
 */
async function rasterizeSvg(svg: SVGSVGElement, doc: Document) {
  const { w, h } = graphicCssSize(svg);
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const vb =
    clone.getAttribute("viewBox") ||
    clone.getAttribute("viewbox") ||
    `0 0 ${w} ${h}`;
  clone.setAttribute("viewBox", vb);
  clone.removeAttribute("viewbox");
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  clone.setAttribute("preserveAspectRatio", "xMidYMid meet");
  clone.style.width = `${w}px`;
  clone.style.height = `${h}px`;
  clone.style.maxWidth = "100%";
  clone.style.overflow = "hidden";

  const xml = new XMLSerializer().serializeToString(clone);
  const href = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
  const probe = doc.createElement("img");
  await new Promise<void>((resolve) => {
    probe.onload = () => resolve();
    probe.onerror = () => resolve();
    probe.src = href;
  });

  const img = doc.createElement("img");
  img.alt = "plot";
  img.className = svg.getAttribute("class") || "plot";
  img.style.cssText = `display:block;width:${w}px;height:${h}px;max-width:100%;`;

  if (probe.naturalWidth) {
    const scale = 2;
    const canvas = doc.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(probe, 0, 0, canvas.width, canvas.height);
      img.src = canvas.toDataURL("image/png");
    } else {
      img.src = href;
    }
  } else {
    img.src = href;
  }

  await new Promise<void>((resolve) => {
    if (img.complete && img.naturalWidth) {
      resolve();
      return;
    }
    img.onload = () => resolve();
    img.onerror = () => resolve();
  });
  svg.replaceWith(img);
}

function wrapKeepTogether(root: HTMLElement) {
  root.querySelectorAll(KEEP_SELECTOR).forEach((el) => {
    if (el.closest(".pdf-keep")) return;
    const wrap = el.ownerDocument.createElement("div");
    wrap.className = "pdf-keep";
    el.parentNode?.insertBefore(wrap, el);
    wrap.appendChild(el);
  });
}

function hasPageBreak(el: HTMLElement) {
  const style = `${el.getAttribute("style") ?? ""};${el.style?.cssText ?? ""}`;
  if (/break-after\s*:\s*page/i.test(style) || /page-break-after\s*:\s*always/i.test(style)) {
    return true;
  }
  return [...el.querySelectorAll("[style]")].some((child) => {
    const s = child.getAttribute("style") ?? "";
    return /break-after\s*:\s*page/i.test(s) || /page-break-after\s*:\s*always/i.test(s);
  });
}

function isBreakOnly(el: HTMLElement) {
  if (!hasPageBreak(el)) return false;
  const text = (el.textContent ?? "").replace(/\u00a0/g, " ").trim();
  if (text) return false;
  return !el.querySelector("img, svg, canvas, table, .pdf-keep");
}

function isHeadingUnit(el: HTMLElement) {
  if (HEADING_RE.test(el.tagName)) return true;
  const first = el.firstElementChild as HTMLElement | null;
  return !!first && HEADING_RE.test(first.tagName) && el.children.length === 1;
}

function makeUnit(doc: Document, nodes: Node[]) {
  const unit = doc.createElement("div");
  unit.className = "pdf-unit";
  nodes.forEach((node) => unit.appendChild(node));
  return unit;
}

function collectUnits(root: HTMLElement): HTMLElement[] {
  const doc = root.ownerDocument;
  const units: HTMLElement[] = [];
  let buffer: Node[] = [];

  const flush = () => {
    const meaningful = buffer.filter((node) => {
      if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? "").trim().length > 0;
      if (isElement(node) && node.tagName === "BR") return false;
      return true;
    });
    if (!meaningful.length) {
      buffer = [];
      return;
    }
    units.push(makeUnit(doc, meaningful));
    buffer = [];
  };

  for (const node of [...root.childNodes]) {
    if (isElement(node) && node.classList.contains("pdf-keep")) {
      flush();
      units.push(node);
      continue;
    }
    if (isElement(node) && node.tagName === "BR") {
      flush();
      continue;
    }
    if (isElement(node) && BLOCK_RE.test(node.tagName)) {
      flush();
      if (node.querySelector(".pdf-keep, svg, img, canvas, table")) {
        wrapKeepTogether(node);
        const inner = collectUnits(node);
        if (hasPageBreak(node) && inner.length) {
          inner[inner.length - 1].dataset.breakAfter = "page";
        }
        if (isBreakOnly(node) && !inner.length) {
          const brk = makeUnit(doc, []);
          brk.dataset.breakAfter = "page";
          brk.dataset.breakOnly = "1";
          units.push(brk);
        } else {
          units.push(...inner);
        }
      } else if (isBreakOnly(node)) {
        const brk = makeUnit(doc, []);
        brk.dataset.breakAfter = "page";
        brk.dataset.breakOnly = "1";
        units.push(brk);
      } else {
        const unit = makeUnit(doc, [node]);
        if (hasPageBreak(node)) unit.dataset.breakAfter = "page";
        units.push(unit);
      }
      continue;
    }
    buffer.push(node);
  }
  flush();
  return units;
}

function scaleGraphicToFit(unit: HTMLElement, maxHeight: number) {
  const g = unit.querySelector<HTMLElement>("img, svg, canvas");
  if (!g) return;
  const r = g.getBoundingClientRect();
  const uh = unit.getBoundingClientRect().height || r.height;
  if (uh <= maxHeight || uh <= 0) return;
  const s = (maxHeight - 2) / uh;
  if (s >= 1) return;
  const w = Math.max(1, r.width * s);
  const h = Math.max(1, r.height * s);
  g.style.width = `${w}px`;
  g.style.height = `${h}px`;
  g.style.maxWidth = "100%";
  g.style.display = "block";
}

function shrinkUntilFits(unit: HTMLElement, pack: HTMLElement) {
  const g = unit.querySelector<HTMLElement>("img, svg, canvas");
  if (!g) return;
  let guard = 0;
  while (packOverflows(pack) && guard++ < 8) {
    const extra = pack.scrollHeight - pack.clientHeight + 2;
    const r = g.getBoundingClientRect();
    if (r.height <= extra + 24) break;
    const nextH = r.height - extra;
    const s = nextH / r.height;
    g.style.width = `${Math.max(1, r.width * s)}px`;
    g.style.height = `${Math.max(1, nextH)}px`;
  }
}

function splitTable(unit: HTMLElement, pack: HTMLElement, maxHeight: number): HTMLElement[] {

  const table = unit.matches("table") ? (unit as HTMLTableElement) : unit.querySelector(":scope table");
  if (!table) return [unit];
  const doc = unit.ownerDocument;
  const thead = table.querySelector("thead");
  const rowParent = table.querySelector("tbody") ?? table;
  const rows = [...rowParent.querySelectorAll(":scope > tr")];
  if (rows.length < 2) return [unit];

  const chunks: HTMLElement[] = [];
  const open = () => {
    const wrap = doc.createElement("div");
    wrap.className = "pdf-unit";
    const next = table.cloneNode(false) as HTMLElement;
    if (thead) next.appendChild(thead.cloneNode(true));
    const body = table.querySelector("tbody") ? doc.createElement("tbody") : next;
    if (body !== next) next.appendChild(body);
    wrap.appendChild(next);
    return { wrap, body };
  };

  let { wrap, body } = open();
  for (const row of rows) {
    body.appendChild(row);
    pack.appendChild(wrap);
    if (wrap.getBoundingClientRect().height > maxHeight && body.children.length > 1) {
      body.removeChild(row);
      wrap.remove();
      chunks.push(wrap);
      ({ wrap, body } = open());
      body.appendChild(row);
      pack.appendChild(wrap);
    }
  }
  wrap.remove();
  chunks.push(wrap);
  unit.remove();
  return chunks.length ? chunks : [unit];
}

function splitTallUnit(unit: HTMLElement, pack: HTMLElement, maxHeight: number): HTMLElement[] {
  if (unit.classList.contains("pdf-keep")) return [unit];
  if (unit.querySelector("table") || unit.matches("table")) {
    pack.appendChild(unit);
    const tall = unit.getBoundingClientRect().height > maxHeight;
    unit.remove();
    if (tall) return splitTable(unit, pack, maxHeight);
    return [unit];
  }
  const blocks = [...unit.children].filter(
    (child): child is HTMLElement =>
      isElement(child) && (BLOCK_RE.test(child.tagName) || child.classList.contains("pdf-keep")),
  );
  if (blocks.length > 1) {
    const doc = unit.ownerDocument;
    return blocks.map((child) => {
      const wrap = doc.createElement("div");
      wrap.className = child.classList.contains("pdf-keep") ? "pdf-keep" : "pdf-unit";
      wrap.appendChild(child);
      return wrap;
    });
  }
  return [unit];
}

function packOverflows(pack: HTMLElement) {
  return pack.scrollHeight > pack.clientHeight + 1;
}

function packPages(units: HTMLElement[], pack: HTMLElement): HTMLElement[][] {
  const pages: HTMLElement[][] = [];
  let current: HTMLElement[] = [];

  const commit = () => {
    if (!current.length) return;
    pages.push(current);
    current = [];
    pack.replaceChildren();
  };

  const accept = (unit: HTMLElement) => {
    pack.appendChild(unit);
    current.push(unit);
  };

  const fitOnEmptyPage = (unit: HTMLElement) => {
    accept(unit);
    if (!packOverflows(pack)) return;
    pack.removeChild(unit);
    current.pop();
    const parts = splitTallUnit(unit, pack, pack.clientHeight);
    if (parts.length === 1) {
      accept(parts[0]);
      scaleGraphicToFit(parts[0], pack.clientHeight);
      shrinkUntilFits(parts[0], pack);
      return;
    }
    for (const part of parts) {
      if (!current.length) {
        accept(part);
        if (packOverflows(pack)) scaleGraphicToFit(part, pack.clientHeight);
        continue;
      }
      pack.appendChild(part);
      if (packOverflows(pack)) {
        pack.removeChild(part);
        commit();
        accept(part);
        if (packOverflows(pack)) scaleGraphicToFit(part, pack.clientHeight);
      } else {
        current.push(part);
      }
    }
  };

  for (const unit of units) {
    if (unit.dataset.breakOnly === "1") {
      commit();
      continue;
    }

    if (!current.length) {
      fitOnEmptyPage(unit);
    } else {
      pack.appendChild(unit);
      if (packOverflows(pack)) {
        pack.removeChild(unit);
        const moved: HTMLElement[] = [];
        while (current.length && isHeadingUnit(current[current.length - 1])) {
          moved.unshift(current.pop() as HTMLElement);
        }
        commit();
        for (const heading of moved) accept(heading);
        pack.appendChild(unit);
        if (packOverflows(pack)) {
          pack.removeChild(unit);
          if (unit.classList.contains("pdf-keep") && current.length) {
            accept(unit);
            shrinkUntilFits(unit, pack);
            if (packOverflows(pack)) {
              pack.removeChild(unit);
              current.pop();
              commit();
              fitOnEmptyPage(unit);
            }
          } else if (current.length) {
            commit();
            fitOnEmptyPage(unit);
          } else {
            fitOnEmptyPage(unit);
          }
        } else {
          current.push(unit);
        }
      } else {
        current.push(unit);
      }
    }

    if (unit.dataset.breakAfter === "page") commit();
  }
  commit();
  return pages;
}

const PRINT_CSS = `
html, body {
  margin: 0 !important;
  padding: 0 !important;
  max-width: none !important;
  width: ${CONTENT_WIDTH_MM}mm !important;
  background: #ffffff !important;
  color: #111111;
  overflow: hidden !important;
}
body {
  font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
  font-size: 11pt;
  line-height: 150%;
}
.lineLink, .errorHeader, .no-print, .no-screen { display: none !important; }
.value:after { display: none !important; }
.fold { height: auto !important; overflow: hidden !important; }
.fold > :not(:first-child) { display: none !important; }
.unfold { height: auto !important; overflow: visible !important; }
.side { float: none !important; max-width: 100% !important; }
.ref { float: right; }
.pdf-measure {
  width: ${CONTENT_WIDTH_MM}mm;
  max-width: ${CONTENT_WIDTH_MM}mm;
  background: #fff;
  color: #111;
}
.pdf-pack {
  box-sizing: border-box;
  width: ${CONTENT_WIDTH_MM}mm;
  max-width: ${CONTENT_WIDTH_MM}mm;
  height: ${CONTENT_HEIGHT_MM}mm;
  max-height: ${CONTENT_HEIGHT_MM}mm;
  overflow: hidden;
  background: #ffffff;
  color: #111;
}
.pdf-keep, .pdf-unit {
  max-width: 100%;
  box-sizing: border-box;
}
.pdf-keep {
  display: block;
  overflow: hidden;
  page-break-inside: avoid;
  break-inside: avoid;
}
.pdf-keep img, .pdf-keep svg, .pdf-keep canvas, img.plot, svg.plot {
  display: block;
  max-width: 100%;
  height: auto;
}
.pdf-unit {
  margin: 0;
  padding: 0;
}
`;

export async function exportPdfReport(
  fileName: string,
  html: string,
  paper?: HTMLElement | null,
  source?: string,
  uiOverrides?: Record<string, string>,
) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  let css = "";
  try {
    css = await fetch(assetUrl("calcpad-output.css")).then((r) => r.text());
  } catch {
    css = "";
  }

  let bodyHtml = html;
  if (paper) {
    const clone = paper.cloneNode(true) as HTMLElement;
    clone.className = "calcpad-paper";
    clone.removeAttribute("style");
    clone.querySelectorAll("script").forEach((s) => s.remove());
    clone.querySelectorAll(".lineLink, .errorHeader").forEach((s) => s.remove());
    collapsePaperFolds(clone, { prune: true });
    replaceCanvases(paper, clone);
    bodyHtml = clone.innerHTML;
  }

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    `width:${Math.ceil(CONTENT_WIDTH_PX + 8)}px`,
    `height:${Math.ceil(CONTENT_HEIGHT_PX + 8)}px`,
    "border:0",
    "background:#fff",
    "opacity:1",
    "pointer-events:none",
    "z-index:2147483647",
  ].join(";");
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    throw new Error("Could not open PDF frame");
  }

  doc.open();
  doc.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>${css}\n${PRINT_CSS}</style>
</head>
<body>
<div class="pdf-measure"></div>
<div class="pdf-pack"></div>
</body>
</html>`);
  doc.close();

  const measure = doc.querySelector<HTMLElement>(".pdf-measure");
  const pack = doc.querySelector<HTMLElement>(".pdf-pack");
  if (!measure || !pack) {
    iframe.remove();
    throw new Error("PDF frame is missing layout roots");
  }

  measure.innerHTML = bodyHtml;
  collapsePaperFolds(measure, { prune: true });
  wrapKeepTogether(measure);
  await waitForImages(measure);
  for (const svg of [...measure.querySelectorAll("svg")]) {
    try {
      await rasterizeSvg(svg as SVGSVGElement, doc);
    } catch {
      const { w, h } = graphicCssSize(svg);
      svg.setAttribute("width", String(w));
      svg.setAttribute("height", String(h));
      (svg as SVGElement).style.width = `${w}px`;
      (svg as SVGElement).style.height = `${h}px`;
    }
  }
  await waitForImages(measure);
  try {
    await doc.fonts.ready;
  } catch {
    /* ignore */
  }
  await new Promise((r) => win.requestAnimationFrame(() => r(null)));

  const units = collectUnits(measure);
  measure.remove();
  pack.replaceChildren();
  const pages = packPages(units, pack);
  const title = reportTitle(fileName);

  const saveWithWorksheet = async (pdf: InstanceType<typeof jsPDF>) => {
    const raw = new Uint8Array(pdf.output("arraybuffer") as ArrayBuffer);
    const attached =
      source != null && source.length
        ? await (await import("./pdf-attachment.ts")).embedWorksheetAttachment(
            raw,
            source,
            fileName,
            uiOverrides ?? {},
          )
        : raw;
    const copy = new Uint8Array(attached.byteLength);
    copy.set(attached);
    const blob = new Blob([copy], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  try {
    const pdf = new jsPDF({
      unit: "mm",
      format: "a4",
      orientation: "portrait",
      compress: true,
    });
    pdf.setProperties({ title: `${title} — CalcpadCE`, creator: "CalcpadCE WebAssembly" });

    if (!pages.length) {
      await saveWithWorksheet(pdf);
      return;
    }

    for (let i = 0; i < pages.length; i++) {
      pack.replaceChildren();
      for (const unit of pages[i]) pack.appendChild(unit);
      await waitForImages(pack);
      await new Promise((r) => win.requestAnimationFrame(() => r(null)));

      const width = pack.offsetWidth || Math.round(CONTENT_WIDTH_PX);
      const height = pack.offsetHeight || Math.round(CONTENT_HEIGHT_PX);
      const canvas = await html2canvas(pack, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
        width,
        height,
        windowWidth: width,
        windowHeight: height,
      });

      if (i > 0) pdf.addPage("a4", "p");
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, PAGE_WIDTH_MM, PAGE_HEIGHT_MM, "F");
      pdf.addImage(
        canvas,
        "PNG",
        MARGIN_LEFT_MM,
        MARGIN_TOP_MM,
        CONTENT_WIDTH_MM,
        CONTENT_HEIGHT_MM,
        undefined,
        "FAST",
      );
    }
    await saveWithWorksheet(pdf);
  } finally {
    iframe.remove();
  }
}
