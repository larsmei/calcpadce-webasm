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

const FIELD_SELECTOR = "input[name='Var'], input[class*='input-'], u[class*='input-']";

export function collectPaperInputs(root: HTMLElement): string[] {
  const nodes = root.querySelectorAll(FIELD_SELECTOR);
  return Array.from(nodes, fieldValue);
}

function fieldValue(node: Element): string {
  return node instanceof HTMLInputElement
    ? node.value
    : (node.textContent ?? "").replace(/\u2009/g, "").trim();
}

function setFieldValue(node: Element, value: string) {
  if (node instanceof HTMLInputElement) {
    node.value = value;
    return;
  }
  node.textContent = value;
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

function readControlValue(el: HTMLElement): string | null {
  if (el.classList.contains("calcpad-ui-datagrid")) return serializeDatagrid(el);
  if (el instanceof HTMLSelectElement) return el.value;
  if (el instanceof HTMLInputElement) {
    return el.type === "checkbox" ? (el.checked ? "1" : "0") : el.value;
  }
  const select = el.querySelector("select");
  if (select) return select.value;
  const radio = el.querySelector<HTMLInputElement>("input[type='radio']:checked");
  if (radio) return radio.value;
  const checkbox = el.querySelector<HTMLInputElement>("input[type='checkbox']");
  if (checkbox) return checkbox.checked ? "1" : "0";
  const input = el.querySelector<HTMLInputElement>("input:not([type='radio']):not([type='checkbox'])");
  if (input) return input.value;
  return null;
}

export function collectUiOverrides(root: HTMLElement): Record<string, string> {
  const out: Record<string, string> = {};
  root.querySelectorAll<HTMLElement>("[data-ui-var]").forEach((el) => {
    const key = el.getAttribute("data-ui-var");
    if (!key || key in out) return;
    const value = readControlValue(el);
    if (value != null) out[key] = value;
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

/** Calcpad HTML widgets copy `value` into `?` fields inside `#id` matching `name` / `data-target`. */
export function splitWidgetValue(value: string): string[] {
  return value.split(";").map((part) => part.trim());
}

export function widgetTargetName(el: Element | null): string | null {
  if (el == null) return null;
  if (typeof HTMLElement === "undefined" || !(el instanceof HTMLElement)) return null;
  if (el.getAttribute("data-ui-var")) return null;
  if (el.closest("[data-ui-var]")) return null;
  const dataTarget = el.getAttribute("data-target")?.trim();
  if (dataTarget) return dataTarget;
  const name = el.getAttribute("name")?.trim();
  if (!name || name === "Var") return null;
  if (el.id && el.id === name) return null;
  return name;
}

function findTarget(root: HTMLElement, name: string): HTMLElement | null {
  try {
    const match = root.querySelector<HTMLElement>(`#${CSS.escape(name)}`);
    if (match) return match;
  } catch {
    /* invalid CSS identifier */
  }
  return null;
}

function fillTarget(target: HTMLElement, value: string): boolean {
  const parts = splitWidgetValue(value);
  const fields = [...target.querySelectorAll(FIELD_SELECTOR)];
  if (!fields.length) return false;
  let changed = false;
  fields.forEach((field, i) => {
    const next = parts[i] ?? "";
    if (fieldValue(field) === next) return;
    setFieldValue(field, next);
    changed = true;
  });
  return changed;
}

export function applyMappedWidgets(root: HTMLElement): boolean {
  let changed = false;
  const apply = (name: string, value: string) => {
    const target = findTarget(root, name);
    if (target && fillTarget(target, value)) changed = true;
  };

  root.querySelectorAll("select").forEach((el) => {
    const name = widgetTargetName(el);
    if (name) apply(name, el.value);
  });

  const radioNames = new Set<string>();
  root.querySelectorAll<HTMLInputElement>("input[type='radio'][name]").forEach((el) => {
    const name = widgetTargetName(el);
    if (name) radioNames.add(name);
  });
  for (const name of radioNames) {
    const checked = root.querySelector<HTMLInputElement>(
      `input[type='radio'][name="${CSS.escape(name)}"]:checked`,
    );
    if (checked) apply(name, checked.value);
  }

  root.querySelectorAll<HTMLInputElement>("input[type='checkbox'][name]").forEach((el) => {
    const name = widgetTargetName(el);
    if (!name) return;
    apply(name, el.checked ? el.value : "");
  });

  return changed;
}

/** After Form re-renders, point selects/radios at the option that matches the `?` boxes. */
export function syncMappedWidgets(root: HTMLElement) {
  root.querySelectorAll("select").forEach((el) => {
    const name = widgetTargetName(el);
    if (!name) return;
    const target = findTarget(root, name);
    if (!target) return;
    const current = [...target.querySelectorAll(FIELD_SELECTOR)].map(fieldValue).join(";");
    const match = [...el.options].find((option) => {
      const joined = splitWidgetValue(option.value).join(";");
      return joined === current || option.value === current;
    });
    if (match) el.value = match.value;
  });

  const radioNames = new Set<string>();
  root.querySelectorAll<HTMLInputElement>("input[type='radio'][name]").forEach((el) => {
    const name = widgetTargetName(el);
    if (name) radioNames.add(name);
  });
  for (const name of radioNames) {
    const target = findTarget(root, name);
    if (!target) continue;
    const current = fieldValue(target.querySelector(FIELD_SELECTOR) ?? target);
    const radio = root.querySelector<HTMLInputElement>(
      `input[type='radio'][name="${CSS.escape(name)}"][value="${CSS.escape(current)}"]`,
    );
    if (radio) radio.checked = true;
  }

  root.querySelectorAll<HTMLInputElement>("input[type='checkbox'][name]").forEach((el) => {
    const name = widgetTargetName(el);
    if (!name) return;
    const target = findTarget(root, name);
    if (!target) return;
    const current = fieldValue(target.querySelector(FIELD_SELECTOR) ?? target);
    el.checked = current === el.value;
  });
}

export function isMappedWidget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const el =
    target.closest("select, input[type='radio'], input[type='checkbox']") ??
    (target instanceof HTMLElement ? target : null);
  return Boolean(widgetTargetName(el));
}

export function readUnitsSelect(root: HTMLElement): string | null {
  const el = root.querySelector<HTMLSelectElement>("select#Units");
  const value = el?.value?.trim();
  return value || null;
}

export function flushPaperControls(root: HTMLElement): {
  inputs: string[];
  uiOverrides: Record<string, string>;
  units: string | null;
} {
  applyMappedWidgets(root);
  return {
    inputs: collectPaperInputs(root),
    uiOverrides: collectUiOverrides(root),
    units: readUnitsSelect(root),
  };
}
