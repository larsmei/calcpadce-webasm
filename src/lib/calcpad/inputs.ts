/** Replace Calcpad `?` / `? {value}` placeholders in source order. */
export function applyInputValues(source: string, values: string[]): string {
  let i = 0;
  return source.replace(/\?(?:\s*\{[^}]*\})?/g, (match) => {
    if (i >= values.length) return match;
    const raw = values[i++]?.trim() ?? "";
    if (!raw) return "?";
    return `? {${raw}}`;
  });
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
