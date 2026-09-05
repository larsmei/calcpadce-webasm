import { StreamLanguage } from "@codemirror/language";
import type { StreamParser } from "@codemirror/language";

const KEYWORDS = new Set([
  "#if",
  "#else",
  "#hide",
  "#show",
  "#pre",
  "#post",
  "#val",
  "#equ",
  "#noc",
  "#nocache",
  "#include",
  "#def",
  "#md",
  "#read",
  "#write",
  "#append",
  "#rad",
  "#deg",
  "#gra",
  "#round",
  "#format",
  "#local",
  "#global",
  "#pause",
  "#input",
  "#repeat",
  "#for",
  "#while",
  "#loop",
  "#break",
  "#continue",
  "#const",
  "#split",
  "#wrap",
  "#phasor",
  "#complex",
  "#settings",
  "#ui",
  "#nosub",
  "#novar",
  "#varsub",
  "#projectpath",
  "#librarypath",
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
  "$while",
  "$inline",
]);

const FUNCTIONS = new Set(
  [
    "abs", "acos", "acosh", "acot", "acoth", "acsc", "acsch", "add", "adj", "and",
    "asec", "asech", "asin", "asinh", "atan", "atan2", "atanh", "augment", "average",
    "cbrt", "ceiling", "cholesky", "clrunits", "clsolve", "cmsolve", "cofactor", "col",
    "column", "column_hp", "cond", "cond_1", "cond_2", "cond_e", "cond_i", "conj",
    "copy", "cos", "cosh", "cot", "coth", "count", "cross", "csc", "csch", "det",
    "diag2vec", "diagonal", "diagonal_hp", "dot", "eigen", "eigenvals", "eigenvecs",
    "exp", "extract", "extract_cols", "extract_rows", "fact", "fft", "fill", "fill_col",
    "fill_row", "find", "find_eq", "find_ge", "find_gt", "find_le", "find_lt", "find_ne",
    "first", "floor", "fprod", "gcd", "getunits", "hlookup", "hlookup_eq", "hlookup_ge",
    "hlookup_gt", "hlookup_le", "hlookup_lt", "hlookup_ne", "hp", "hprod", "identity",
    "identity_hp", "if", "ift", "im", "inverse", "ishp", "join", "join_cols", "join_rows",
    "kprod", "last", "lcm", "len", "line", "ln", "log", "log_2", "lookup", "lookup_eq",
    "lookup_ge", "lookup_gt", "lookup_le", "lookup_lt", "lookup_ne", "lsolve", "ltriang",
    "ltriang_hp", "lu", "mandelbrot", "matrix", "matrix_hp", "max", "mcount", "mean",
    "mfill", "mfind", "mfind_eq", "mfind_ge", "mfind_gt", "mfind_le", "mfind_lt", "mfind_ne",
    "min", "mnorm", "mnorm_1", "mnorm_2", "mnorm_e", "mnorm_i", "mod", "mresize", "msearch",
    "msolve", "n_cols", "n_rows", "norm", "norm_1", "norm_2", "norm_e", "norm_i", "norm_p",
    "not", "or", "order", "order_cols", "order_rows", "phase", "product", "qr", "random",
    "range", "range_hp", "rank", "re", "resize", "reverse", "revorder", "revorder_cols",
    "revorder_rows", "root", "round", "row", "rsort", "rsort_cols", "rsort_rows", "search",
    "sec", "sech", "setunits", "sign", "sin", "sinh", "size", "slice", "slsolve", "smsolve",
    "sort", "sort_cols", "sort_rows", "spline", "sqr", "sqrt", "srss", "stack", "submatrix",
    "sum", "sumsq", "svd", "switch", "symmetric", "symmetric_hp", "take", "tan", "tanh",
    "timer", "trace", "transp", "trunc", "unit", "utriang", "utriang_hp", "vec2col",
    "vec2diag", "vec2row", "vector", "vector_hp", "vlookup", "vlookup_eq", "vlookup_ge",
    "vlookup_gt", "vlookup_le", "vlookup_lt", "vlookup_ne", "xor",
  ].map((s) => s.toLowerCase()),
);

const WORD_OPS = new Set(["and", "or", "xor", "not", "mod"]);

const UNITS = new Set([
  "m", "km", "dm", "cm", "mm", "μm", "nm", "pm", "AU", "ly",
  "g", "kg", "mg", "t", "deg", "rad", "grad", "rev",
  "s", "ms", "μs", "ns", "min", "h", "d",
  "N", "kN", "MN", "GN", "Pa", "kPa", "MPa", "GPa", "bar", "mbar", "atm",
  "J", "kJ", "MJ", "W", "kW", "MW", "Hz", "kHz", "MHz",
  "A", "mA", "V", "kV", "mV", "C", "F", "μF", "Ω", "kΩ",
  "L", "mL", "K", "°C", "°F", "cd", "lm", "lx",
  "Nm", "kNm", "kgf", "lbf", "psi", "ksi", "psf",
  "in", "ft", "yd", "mi", "lb", "kip", "ton",
  "ha", "ac", "gal", "hp",
]);

type Mode = "code" | "unitish";

type State = { mode: Mode };

const IDENT = /^[A-Za-z_Α-ωπμ°∆ΔδνστωλφψΩ∞][\wΑ-ω₀-₉⁺⁻ⁿ′″‴μ°∆Δ]*/;

const parser: StreamParser<State> = {
  startState() {
    return { mode: "code" };
  },
  token(stream, state) {
    if (stream.eatSpace()) return null;

    const quote = stream.peek();
    if (quote === "'" || quote === '"') {
      stream.next();
      while (!stream.eol()) {
        if (stream.peek() === quote) {
          stream.next();
          break;
        }
        stream.next();
      }
      state.mode = "code";
      return "comment";
    }

    if (stream.match(/^#else\s+if\b/i) || stream.match(/^#end\s+\w+\b/i)) {
      state.mode = "code";
      return "keyword";
    }
    if (stream.match(/^#[A-Za-z]+/)) {
      const word = stream.current().toLowerCase();
      state.mode = "code";
      return KEYWORDS.has(word) ? "keyword" : "keyword";
    }

    if (stream.match(/^\$[A-Za-z]+/)) {
      const word = stream.current().toLowerCase();
      state.mode = "code";
      return COMMANDS.has(word) ? "keyword" : "variableName";
    }

    if (stream.match(/^[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/)) {
      state.mode = "unitish";
      return "number";
    }

    if (stream.match(IDENT)) {
      const word = stream.current();
      const lower = word.toLowerCase();
      const next = stream.peek();
      if (WORD_OPS.has(lower) || (FUNCTIONS.has(lower) && next === "(")) {
        state.mode = "code";
        return "keyword";
      }
      if (state.mode === "unitish" && (UNITS.has(word) || UNITS.has(lower))) {
        state.mode = "code";
        return "number";
      }
      state.mode = "code";
      return "variableName";
    }

    if (stream.eat("?") ) {
      state.mode = "code";
      return "literal";
    }

    if (stream.eat("|")) {
      state.mode = "unitish";
      return "operator";
    }

    if (stream.eat(/[*/·×÷]/)) {
      state.mode = "unitish";
      return "operator";
    }

    if (stream.eat(/[+\-^=<>!\\%&,;:@.≤≥≠±←→]/)) {
      state.mode = "code";
      return "operator";
    }

    if (stream.eat(/[()[\]{}]/)) {
      state.mode = "code";
      return "bracket";
    }

    stream.next();
    state.mode = "code";
    return null;
  },
  languageData: {
    commentTokens: { line: "'" },
    closeBrackets: { brackets: ["(", "[", "{"] },
  },
};

export const calcpadLanguage = StreamLanguage.define(parser);

export const CALCPAD_COMPLETIONS = [
  { label: "$Plot{f(x) @ x = 0 : 10}", type: "function", info: "Function plot" },
  { label: "$Map{f(x; y) @ x = 0:10 & y = 0:10}", type: "function", info: "Heat map" },
  { label: "$Integral{f(x) @ x = a : b}", type: "function", info: "Definite integral" },
  { label: "$Root{f(x) = 0 @ x = a : b}", type: "function", info: "Root finder" },
  { label: "$Sum{f(i) @ i = 1 : n}", type: "function", info: "Discrete sum" },
  { label: "$Area{f(x) @ x = a : b}", type: "function", info: "Definite integral (area)" },
  { label: "$Repeat{expr @ i = 1 : n}", type: "function", info: "Repeat expression" },
  { label: "#if ", type: "keyword" },
  { label: "#else", type: "keyword" },
  { label: "#end if", type: "keyword" },
  { label: "#hide", type: "keyword" },
  { label: "#show", type: "keyword" },
  { label: "#val", type: "keyword" },
  { label: "#equ", type: "keyword" },
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
  { label: "vector()", type: "function" },
  { label: "matrix(m; n)", type: "function" },
  { label: "identity(n)", type: "function" },
  { label: "clsolve(A; b)", type: "function" },
  { label: "symmetric(n)", type: "function" },
];
