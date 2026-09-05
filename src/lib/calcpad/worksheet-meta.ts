export function worksheetAttachName(fileName: string) {
  const base = fileName.replace(/\.(cpd|cpdz|txt|html|pdf)$/i, "").trim() || "worksheet";
  const ascii = base.replace(/[^\w.\-]+/g, "_").replace(/^_+|_+$/g, "") || "worksheet";
  return `${ascii}.cpd`;
}

export function withUiOverridesComment(
  source: string,
  uiOverrides: Record<string, string>,
) {
  const stripped = source.replace(/^'[ \t]*<!--\s*\{[\s\S]*?\}\s*-->[ \t]*\r?\n?/, "");
  if (!Object.keys(uiOverrides).length) return stripped === source ? source : stripped;
  return `'<!--${JSON.stringify({ uiOverrides })}-->\n${stripped}`;
}

export function readUiOverrides(source: string): Record<string, string> {
  const m = source.match(/^'[ \t]*<!--\s*(\{[\s\S]*?\})\s*-->/);
  if (!m) return {};
  try {
    const json = JSON.parse(m[1]) as { uiOverrides?: Record<string, unknown> };
    const raw = json.uiOverrides;
    if (!raw || typeof raw !== "object") return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}
