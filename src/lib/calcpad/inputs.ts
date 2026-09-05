/** Replace Calcpad `?` / `? {value}` placeholders in source order, skipping comments. */
export function applyInputValues(source: string, values: string[]): string {
  let i = 0;
  let out = "";
  const n = source.length;
  let k = 0;
  while (k < n) {
    const c = source[k];
    if (c === "'" || c === '"') {
      const start = k;
      k += 1;
      while (k < n && source[k] !== c && source[k] !== "\n") k += 1;
      if (k < n && source[k] === c) k += 1;
      out += source.slice(start, k);
      continue;
    }
    if (c === "?" && i < values.length) {
      let end = k + 1;
      const brace = source.slice(end).match(/^\s*\{[^}]*\}/);
      if (brace) end += brace[0].length;
      const raw = values[i++]?.trim() ?? "";
      out += raw ? `? {${raw}}` : "?";
      k = end;
      continue;
    }
    out += c;
    k += 1;
  }
  return out;
}

export function collectPaperInputs(root: HTMLElement): string[] {
  const nodes = root.querySelectorAll(
    "input[name='Var'], input[class*='input-'], u[class*='input-']",
  );
  return Array.from(nodes, (node) =>
    node instanceof HTMLInputElement
      ? node.value
      : (node.textContent ?? "").replace(/\u2009/g, "").trim(),
  );
}

export function formHtml(html: string, mode: "form" | "results") {
  if (mode !== "form") return html;
  return html.replace(/<u class="(input-\d+)">([^<]*)<\/u>/g, (_m, cls: string, val: string) => {
    const v = val.replace(/\u2009/g, "").trim();
    const size = Math.max(4, v.length + 1);
    return `<input type="text" name="Var" class="${cls}" value=${JSON.stringify(v)} size="${size}">`;
  });
}

export function hydrateUiDatagrids(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>(".calcpad-ui-datagrid").forEach((el) => {
    if (el.querySelector("table")) return;
    const rows = Math.max(1, Number(el.dataset.uiRows || "1"));
    const cols = Math.max(1, Number(el.dataset.uiColumns || "1"));
    const grid = (el.dataset.uiValues || "").split("|").map((row) => row.split(";"));
    const colHeaders = (el.dataset.uiColHeaders || "").split(",").map((s) => s.trim());
    const rowHeaders = (el.dataset.uiRowHeaders || "").split(",").map((s) => s.trim());
    const hasCol = colHeaders.some(Boolean);
    const hasRow = rowHeaders.some(Boolean);

    const table = document.createElement("table");
    table.className = "calcpad-ui-grid";
    if (hasCol) {
      const thead = document.createElement("thead");
      const tr = document.createElement("tr");
      if (hasRow) tr.appendChild(document.createElement("th"));
      for (let c = 0; c < cols; c++) {
        const th = document.createElement("th");
        th.textContent = colHeaders[c] || String(c + 1);
        tr.appendChild(th);
      }
      thead.appendChild(tr);
      table.appendChild(thead);
    }
    const tbody = document.createElement("tbody");
    for (let r = 0; r < rows; r++) {
      const tr = document.createElement("tr");
      if (hasRow) {
        const th = document.createElement("th");
        th.textContent = rowHeaders[r] || String(r + 1);
        tr.appendChild(th);
      }
      for (let c = 0; c < cols; c++) {
        const td = document.createElement("td");
        const input = document.createElement("input");
        input.type = "text";
        input.value = (grid[r]?.[c] ?? "0").trim();
        input.size = Math.max(4, input.value.length + 1);
        td.appendChild(input);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    el.replaceChildren(table);
  });
}

function serializeDatagrid(el: HTMLElement): string {
  const rows = [...el.querySelectorAll("tbody tr")];
  if (!rows.length) return el.dataset.uiValues ? `[${el.dataset.uiValues}]` : "[]";
  const body = rows
    .map((tr) =>
      [...tr.querySelectorAll("input")]
        .map((input) => input.value.trim() || "0")
        .join("; "),
    )
    .join(" | ");
  return `[${body}]`;
}

export function collectUiOverrides(root: HTMLElement): Record<string, string> {
  const out: Record<string, string> = {};
  root.querySelectorAll<HTMLElement>("[data-ui-var]").forEach((el) => {
    const key = el.getAttribute("data-ui-var");
    if (!key || key in out) return;
    if (el.classList.contains("calcpad-ui-datagrid")) {
      out[key] = serializeDatagrid(el);
      return;
    }
    if (el instanceof HTMLSelectElement) {
      out[key] = el.value;
      return;
    }
    if (el instanceof HTMLInputElement) {
      out[key] = el.type === "checkbox" ? (el.checked ? "1" : "0") : el.value;
      return;
    }
    const radio = el.querySelector<HTMLInputElement>("input[type='radio']:checked");
    if (radio) out[key] = radio.value;
  });
  return out;
}

export function isPaperControl(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      "input, select, textarea, label, button, [data-ui-var], .calcpad-ui-datagrid, .calcpad-ui-radio",
    ),
  );
}
