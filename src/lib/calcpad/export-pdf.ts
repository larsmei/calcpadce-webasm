import { assetUrl } from "@/lib/calcpad/asset-url";

const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;
const PAGE_MARGIN_PX = 40;
const INNER_WIDTH = A4_WIDTH_PX - PAGE_MARGIN_PX * 2;
const INNER_HEIGHT = A4_HEIGHT_PX - PAGE_MARGIN_PX * 2;
const KEEP_SELECTOR = [
  "svg",
  "img",
  "canvas",
  "figure",
  ".js-plotly-plot",
  ".plot",
  "[data-plot]",
].join(",");

function reportTitle(fileName: string) {
  return fileName.replace(/\.(cpd|txt|html)$/i, "") || "worksheet";
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
      img.style.maxWidth = "100%";
      img.style.height = "auto";
      target.replaceWith(img);
    } catch {
      /* tainted canvas */
    }
  });
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

function isElement(node: Node): node is HTMLElement {
  return node.nodeType === Node.ELEMENT_NODE;
}

function isKeep(node: Node): node is HTMLElement {
  return isElement(node) && node.classList.contains("pdf-keep");
}

function isBlock(node: Node): node is HTMLElement {
  if (!isElement(node)) return false;
  return /^(P|H1|H2|H3|H4|H5|H6|TABLE|UL|OL|PRE|BLOCKQUOTE|DIV|SECTION|ARTICLE|HR|DL)$/.test(
    node.tagName,
  );
}

function heightOf(el: HTMLElement) {
  return el.getBoundingClientRect().height;
}

function collectUnits(root: HTMLElement) {
  const doc = root.ownerDocument;
  const units: HTMLElement[] = [];
  const buffer: Node[] = [];

  const flush = () => {
    if (!buffer.length) return;
    const unit = doc.createElement("div");
    unit.className = "pdf-unit";
    buffer.forEach((node) => unit.appendChild(node));
    units.push(unit);
    buffer.length = 0;
  };

  for (const node of [...root.childNodes]) {
    if (isKeep(node)) {
      flush();
      units.push(node);
      continue;
    }
    if (isBlock(node) && node.querySelector(".pdf-keep")) {
      flush();
      wrapKeepTogether(node);
      for (const child of collectUnits(node)) units.push(child);
      continue;
    }
    if (isBlock(node)) {
      flush();
      const unit = doc.createElement("div");
      unit.className = "pdf-unit";
      unit.appendChild(node);
      units.push(unit);
      continue;
    }
    buffer.push(node);
  }
  flush();
  return units;
}

function fitKeep(unit: HTMLElement, maxHeight: number) {
  const graphic = unit.querySelector<HTMLElement>("svg, img, canvas, table, .js-plotly-plot");
  const target = graphic ?? unit;
  target.style.maxWidth = "100%";
  target.style.maxHeight = `${maxHeight}px`;
  target.style.height = "auto";
  target.style.width = "auto";
  target.style.display = "block";
  if (heightOf(unit) <= maxHeight + 1) return;
  const h = heightOf(unit);
  const scale = Math.max(0.2, (maxHeight - 2) / h);
  unit.style.transform = `scale(${scale})`;
  unit.style.transformOrigin = "top left";
  unit.style.height = `${h * scale}px`;
  unit.style.overflow = "hidden";
}

function makePage(doc: Document) {
  const page = doc.createElement("section");
  page.className = "pdf-page";
  const inner = doc.createElement("div");
  inner.className = "pdf-page-inner";
  page.appendChild(inner);
  return { page, inner };
}

function splitTallUnit(unit: HTMLElement, maxHeight: number) {
  const table = unit.matches("table") ? unit : unit.querySelector(":scope > table, :scope > * > table");
  if (!table || heightOf(unit) <= maxHeight + 1) return [unit];

  const doc = unit.ownerDocument;
  const thead = table.querySelector("thead");
  const rowParent = table.querySelector("tbody") ?? table;
  const rows = [...rowParent.querySelectorAll(":scope > tr")];
  if (rows.length < 2) return [unit];

  const chunks: HTMLElement[] = [];
  let currentTable: HTMLElement | null = null;
  let currentWrap: HTMLElement | null = null;
  let used = 0;

  const open = () => {
    currentWrap = doc.createElement("div");
    currentWrap.className = "pdf-unit";
    currentTable = table.cloneNode(false) as HTMLElement;
    if (thead) currentTable.appendChild(thead.cloneNode(true));
    const body = table.querySelector("tbody") ? doc.createElement("tbody") : currentTable;
    if (body !== currentTable) currentTable.appendChild(body);
    currentWrap.appendChild(currentTable);
    used = thead ? 24 : 0;
    return body;
  };

  let body = open();
  for (const row of rows) {
    body.appendChild(row);
    currentWrap!.style.position = "absolute";
    currentWrap!.style.visibility = "hidden";
    unit.parentElement?.appendChild(currentWrap!);
    const h = heightOf(currentWrap!);
    currentWrap!.style.position = "";
    currentWrap!.style.visibility = "";
    if (h > maxHeight && body.children.length > 1) {
      body.removeChild(row);
      chunks.push(currentWrap!);
      body = open();
      body.appendChild(row);
    }
  }
  if (currentWrap) chunks.push(currentWrap);
  unit.remove();
  return chunks.length ? chunks : [unit];
}

function paginateUnits(root: HTMLElement, incoming: HTMLElement[]) {
  const units: HTMLElement[] = [];
  for (const unit of incoming) {
    if (unit.classList.contains("pdf-keep")) {
      units.push(unit);
      continue;
    }
    root.appendChild(unit);
    units.push(...splitTallUnit(unit, INNER_HEIGHT));
  }

  const doc = root.ownerDocument;
  const pages: HTMLElement[] = [];
  let current = makePage(doc);
  let used = 0;
  root.appendChild(current.page);

  const startPage = () => {
    pages.push(current.page);
    current = makePage(doc);
    root.appendChild(current.page);
    used = 0;
  };

  for (const unit of units) {
    current.inner.appendChild(unit);
    if (unit.classList.contains("pdf-keep")) fitKeep(unit, INNER_HEIGHT);
    const h = heightOf(unit);
    if (used > 0 && used + h > INNER_HEIGHT) {
      startPage();
      current.inner.appendChild(unit);
      if (unit.classList.contains("pdf-keep")) fitKeep(unit, INNER_HEIGHT);
      used = heightOf(unit);
    } else {
      used += h;
    }
  }
  pages.push(current.page);
  return pages;
}

const PRINT_CSS = `
html, body { margin: 0; padding: 0; background: #ffffff; color: #111111; }
body { font-family: 'Segoe UI', Helvetica, Arial, sans-serif; }
.pdf-pages { width: ${A4_WIDTH_PX}px; background: #fff; color: #111; }
.pdf-page {
  width: ${A4_WIDTH_PX}px;
  height: ${A4_HEIGHT_PX}px;
  padding: ${PAGE_MARGIN_PX}px;
  box-sizing: border-box;
  background: #ffffff;
  overflow: hidden;
  page-break-after: always;
}
.pdf-page-inner { width: ${INNER_WIDTH}px; }
.pdf-keep, .pdf-unit { break-inside: avoid; page-break-inside: avoid; }
.pdf-keep { max-width: 100%; }
.pdf-keep svg, .pdf-keep img, .pdf-keep canvas, .pdf-keep table {
  max-width: 100%;
  height: auto;
  display: block;
}
`;

export async function exportPdfReport(fileName: string, html: string, paper?: HTMLElement | null) {
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
    replaceCanvases(paper, clone);
    bodyHtml = clone.innerHTML;
  }

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;left:-16000px;top:0;width:" +
    A4_WIDTH_PX +
    "px;height:" +
    A4_HEIGHT_PX +
    "px;border:0;background:#fff;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc) {
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
<div class="pdf-measure" style="width:${INNER_WIDTH}px;background:#fff;color:#111;"></div>
<div class="pdf-pages"></div>
</body>
</html>`);
  doc.close();

  const measure = doc.querySelector<HTMLElement>(".pdf-measure");
  const pagesRoot = doc.querySelector<HTMLElement>(".pdf-pages");
  if (!measure || !pagesRoot) {
    iframe.remove();
    throw new Error("PDF frame is missing layout roots");
  }
  measure.innerHTML = bodyHtml;
  wrapKeepTogether(measure);
  await waitForImages(measure);

  const units = collectUnits(measure);
  const pages = paginateUnits(pagesRoot, units);
  iframe.style.height = `${Math.max(A4_HEIGHT_PX, pages.length * A4_HEIGHT_PX)}px`;
  await waitForImages(pagesRoot);
  await new Promise((r) => requestAnimationFrame(() => r(null)));

  try {
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const title = reportTitle(fileName);
    pdf.setProperties({ title: `${title} — CalcpadCE`, creator: "CalcpadCE WebAssembly" });

    for (let i = 0; i < pages.length; i++) {
      const canvas = await html2canvas(pages[i], {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        width: A4_WIDTH_PX,
        height: A4_HEIGHT_PX,
        windowWidth: A4_WIDTH_PX,
        windowHeight: A4_HEIGHT_PX,
      });
      if (i > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.93), "JPEG", 0, 0, 210, 297);
    }
    pdf.save(`${title}.pdf`);
  } finally {
    iframe.remove();
  }
}
