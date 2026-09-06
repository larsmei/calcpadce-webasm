/** Greek alphabet for the source editor palette (Calcpad symbol bar). */

export type GreekLetter = { ch: string; name: string };

export const GREEK_LOWER: GreekLetter[] = [
  { ch: "α", name: "alpha" },
  { ch: "β", name: "beta" },
  { ch: "γ", name: "gamma" },
  { ch: "δ", name: "delta" },
  { ch: "ε", name: "epsilon" },
  { ch: "ζ", name: "zeta" },
  { ch: "η", name: "eta" },
  { ch: "θ", name: "theta" },
  { ch: "ι", name: "iota" },
  { ch: "κ", name: "kappa" },
  { ch: "λ", name: "lambda" },
  { ch: "μ", name: "mu" },
  { ch: "ν", name: "nu" },
  { ch: "ξ", name: "xi" },
  { ch: "ο", name: "omicron" },
  { ch: "π", name: "pi" },
  { ch: "ρ", name: "rho" },
  { ch: "σ", name: "sigma" },
  { ch: "τ", name: "tau" },
  { ch: "υ", name: "upsilon" },
  { ch: "φ", name: "phi" },
  { ch: "χ", name: "chi" },
  { ch: "ψ", name: "psi" },
  { ch: "ω", name: "omega" },
];

export const GREEK_UPPER: GreekLetter[] = [
  { ch: "Α", name: "Alpha" },
  { ch: "Β", name: "Beta" },
  { ch: "Γ", name: "Gamma" },
  { ch: "Δ", name: "Delta" },
  { ch: "Ε", name: "Epsilon" },
  { ch: "Ζ", name: "Zeta" },
  { ch: "Η", name: "Eta" },
  { ch: "Θ", name: "Theta" },
  { ch: "Ι", name: "Iota" },
  { ch: "Κ", name: "Kappa" },
  { ch: "Λ", name: "Lambda" },
  { ch: "Μ", name: "Mu" },
  { ch: "Ν", name: "Nu" },
  { ch: "Ξ", name: "Xi" },
  { ch: "Ο", name: "Omicron" },
  { ch: "Π", name: "Pi" },
  { ch: "Ρ", name: "Rho" },
  { ch: "Σ", name: "Sigma" },
  { ch: "Τ", name: "Tau" },
  { ch: "Υ", name: "Upsilon" },
  { ch: "Φ", name: "Phi" },
  { ch: "Χ", name: "Chi" },
  { ch: "Ψ", name: "Psi" },
  { ch: "Ω", name: "Omega" },
];

type InsertFn = (text: string) => void;

let insertHandler: InsertFn | null = null;
let queued = "";

export function setEditorInsertHandler(fn: InsertFn | null) {
  insertHandler = fn;
  if (fn && queued) {
    const text = queued;
    queued = "";
    fn(text);
  }
}

/** Insert at the source cursor. Queues if the editor is not mounted yet. */
export function insertEditorText(text: string) {
  if (!text) return;
  if (insertHandler) insertHandler(text);
  else queued += text;
}

export function peekEditorInsertQueue() {
  return queued;
}
