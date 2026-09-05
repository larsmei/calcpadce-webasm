import { StreamLanguage } from "@codemirror/language";
import type { StreamParser } from "@codemirror/language";

const KEYWORDS = new Set([
  "#if",
  "#else",
  "#else if",
  "#end if",
  "#repeat",
  "#loop",
  "#for",
  "#while",
  "#break",
  "#continue",
  "#hide",
  "#pre",
  "#post",
  "#val",
  "#equ",
  "#nocache",
  "#include",
  "#def",
  "#end def",
  "#md",
  "#read",
  "#write",
  "#append",
  "#rad",
  "#deg",
  "#gra",
  "#round",
  "#ifshow",
  "#local",
  "#global",
  "#pause",
  "#input",
]);

const COMMANDS = new Set([
  "$plot",
  "$map",
  "$integral",
  "$root",
  "$find",
  "$inf",
  "$sup",
  "$sum",
  "$product",
  "$area",
  "$slope",
  "$repeat",
  "$block",
]);

const parser: StreamParser<unknown> = {
  startState() {
    return {};
  },
  token(stream) {
    if (stream.sol()) {
      stream.eatSpace();
      if (stream.peek() === "'" || stream.peek() === '"') {
        stream.skipToEnd();
        return "comment";
      }
      if (stream.match(/^#else\s+if\b/i)) return "keyword";
      if (stream.match(/^#end\s+if\b/i) || stream.match(/^#end\s+def\b/i))
        return "keyword";
      if (stream.match(/^#[a-zA-Z_]+/)) {
        const word = stream.current().toLowerCase();
        if (KEYWORDS.has(word)) return "keyword";
        return "meta";
      }
      if (stream.match(/^\$(plot|map|integral|root|find|inf|sup|sum|product|area|slope|repeat|block)/i)) {
        return "atom";
      }
    }

    if (stream.match(/^'/) || stream.match(/^"/)) {
      stream.skipToEnd();
      return "comment";
    }

    if (stream.match(/^\$[A-Za-z]+/)) {
      const word = stream.current().toLowerCase();
      if (COMMANDS.has(word)) return "atom";
      return "atom";
    }

    if (stream.match(/^(π|°|∠|≡|≠|≤|≥|±|·|×|÷|√|∞|α|β|γ|δ|ε|ζ|η|θ|ι|κ|λ|μ|ν|ξ|ρ|σ|τ|φ|χ|ψ|ω)/)) {
      return "atom";
    }

    if (stream.match(/^[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/)) {
      return "number";
    }

    if (stream.match(/^(and|or|xor|not|mod|sin|cos|tan|asin|acos|atan|atan2|sinh|cosh|tanh|asinh|acosh|atanh|log|ln|log_2|exp|sqr|sqrt|cbrt|abs|sign|round|floor|ceiling|re|im|phase|conj|random|min|max|sum|average|switch|if|root|line|spline|take|map|len|size|sort|rsort|reverse|range|vector|matrix|identity|diagonal|n_rows|n_cols|det|inverse|lsolve|transp|norm|dot|cross|unit|fft|ift)\b/i)) {
      return "builtin";
    }

    if (stream.match(/^[A-Za-z_Α-ωπ][\wΑ-ω₀-₉⁺⁻ⁿ′″‴°]*/)) {
      return "variableName";
    }

    if (stream.match(/^(==|!=|<=|>=|&&|\|\||<-|→|←|<=|>=)/)) return "operator";
    if (stream.match(/^[+\-*/^=<>!|\\%&,;:@]/)) return "operator";

    if (stream.match(/^[()[\]{}]/)) return "bracket";

    stream.next();
    return null;
  },
  languageData: {
    commentTokens: { line: "'" },
  },
};

export const calcpadLanguage = StreamLanguage.define(parser);

export const CALCPAD_COMPLETIONS = [
  { label: "$Plot{f(x) @ x = 0 : 10}", type: "function", info: "Function plot" },
  { label: "$Map{f(x; y) @ x = 0:10 & y = 0:10}", type: "function", info: "Heat map" },
  { label: "$Integral{f(x) @ x = a : b}", type: "function", info: "Definite integral" },
  { label: "$Root{f(x) = 0 @ x = a : b}", type: "function", info: "Root finder" },
  { label: "$Sum{f(i) @ i = 1 : n}", type: "function", info: "Discrete sum" },
  { label: "#if ", type: "keyword" },
  { label: "#else", type: "keyword" },
  { label: "#end if", type: "keyword" },
  { label: "#repeat ", type: "keyword" },
  { label: "#for i = 1 : n", type: "keyword" },
  { label: "#while ", type: "keyword" },
  { label: "#loop", type: "keyword" },
  { label: "#def ", type: "keyword" },
  { label: "sin()", type: "function" },
  { label: "cos()", type: "function" },
  { label: "ln()", type: "function" },
  { label: "sqrt()", type: "function" },
  { label: "abs()", type: "function" },
  { label: "matrix(m; n)", type: "function" },
  { label: "identity(n)", type: "function" },
  { label: "range(a; b; s)", type: "function" },
];
