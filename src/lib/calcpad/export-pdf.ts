import { assetUrl } from "@/lib/calcpad/asset-url";

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

function addCanvasPages(
  pdf: InstanceType<typeof import("jspdf").jsPDF>,
  canvas: HTMLCanvasElement,
) {
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const usableW = pageW - margin * 2;
  const usableH = pageH - margin * 2;
  const pxPerMm = canvas.width / usableW;
  const pagePx = usableH * pxPerMm;

  let offset = 0;
  let first = true;
  while (offset < canvas.height - 0.5) {
    const sliceH = Math.min(pagePx, canvas.height - offset);
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = Math.max(1, Math.ceil(sliceH));
    const ctx = slice.getContext("2d");
    if (!ctx) break;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, offset, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
    if (!first) pdf.addPage();
    first = false;
    pdf.addImage(
      slice.toDataURL("image/jpeg", 0.93),
      "JPEG",
      margin,
      margin,
      usableW,
      slice.height / pxPerMm,
    );
    offset += sliceH;
  }
}

export async function exportPdfReport(fileName: string, html: string, paper?: HTMLElement | null) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
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
  iframe.style.cssText =
    "position:fixed;left:-14000px;top:0;width:794px;height:1600px;border:0;background:#fff;";
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
<style>
html, body { margin: 0; padding: 0; background: #ffffff; color: #111111; }
body { padding: 24px 28px 40px; font-family: 'Segoe UI', Helvetica, Arial, sans-serif; }
${css}
.calcpad-paper { margin: 0 !important; max-width: none !important; background: #fff !important; color: #111 !important; }
img, svg, canvas { max-width: 100%; height: auto; }
</style>
</head>
<body><div class="calcpad-paper">${bodyHtml}</div></body>
</html>`);
  doc.close();
  await waitForImages(doc);
  const contentH = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
  iframe.style.height = `${contentH + 8}px`;
  await new Promise((r) => requestAnimationFrame(() => r(null)));

  try {
    const canvas = await html2canvas(doc.body, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      windowWidth: 794,
      height: contentH,
      windowHeight: contentH,
      onclone: (cloned) => {
        cloned.documentElement.style.color = "#111111";
        cloned.body.style.background = "#ffffff";
        cloned.body.style.color = "#111111";
      },
    });
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const title = reportTitle(fileName);
    pdf.setProperties({ title: `${title} — CalcpadCE`, creator: "CalcpadCE WebAssembly" });
    addCanvasPages(pdf, canvas);
    pdf.save(`${title}.pdf`);
  } finally {
    iframe.remove();
  }
}
