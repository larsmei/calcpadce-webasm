/** Normalize a worksheet name so Save / PDF / the toolbar stay in sync. */
export function ensureCpdFileName(name: string): string {
  const trimmed = name.trim().replace(/[/\\?%*:|"<>]/g, "-") || "worksheet";
  if (/\.cpdz$/i.test(trimmed)) return `${trimmed.slice(0, -5)}.cpdz`;
  if (/\.cpd$/i.test(trimmed)) return `${trimmed.slice(0, -4)}.cpd`;
  return `${trimmed.replace(/\.(txt|pdf)$/i, "")}.cpd`;
}
