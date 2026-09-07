/** Complete Calcpad syntax reference shown in the overlay cheatsheet. */

export type CheatRow = {
  name: string;
  syntax: string;
  note?: string;
  /** Text inserted at the cursor. Defaults to `syntax`. */
  insert?: string;
};

export type CheatSection = {
  id: string;
  title: string;
  blurb?: string;
  rows: CheatRow[];
};

export const CHEATSHEET: CheatSection[] = [
  {
    id: "basics",
    title: "Basics",
    blurb: "A worksheet is plain text. Lines are expressions, comments, or directives.",
    rows: [
      { name: "Comment", syntax: "' text", note: "Single quote. Not calculated." },
      { name: "Quoted text", syntax: '"text in the report"', note: "Double quotes also start a comment." },
      { name: "HTML in comments", syntax: "'<p>formatted <b>text</b></p>" },
      { name: "Continue line", syntax: "end a line with  _", note: "Joins the next line into one expression." },
      { name: "Variable", syntax: "a = 2" },
      { name: "Expression", syntax: "a*b + 3" },
      { name: "Function", syntax: "f(x; y) = x^2 + y", note: "Parameters are separated by semicolons." },
      { name: "Operators", syntax: "+  -  *  /  ^  ≡  ≠  <  >  ≤  ≥", note: "∧ ∨ ⊕ for logic. Comparison returns 1 or 0." },
      { name: "Constants", syntax: "π   e   i   g", note: "Insert π from the αβ bar, or type pi." },
      { name: "Complex", syntax: "z = 3 + 4i", note: "#phasor / #complex switch the report form." },
    ],
  },
  {
    id: "units",
    title: "Units",
    blurb: "Attach a unit to a value. Calcpad checks dimensional consistency.",
    rows: [
      { name: "Attach unit", syntax: "L = 5m" },
      { name: "Convert", syntax: "V|dm^3", note: "Pipe converts the result to that unit." },
      { name: "Compound", syntax: "q = 15kN/m" },
      { name: "Custom unit", syntax: "kN_cm = 1kN/cm^2" },
      { name: "Degrees", syntax: "#deg", note: "Trig arguments in degrees (default)." },
      { name: "Radians", syntax: "#rad" },
      { name: "Gradians", syntax: "#gra" },
      {
        name: "SI length",
        syntax: "km  m  dm  cm  mm  μm  nm",
      },
      {
        name: "Force / stress",
        syntax: "N  kN  MN   Pa  kPa  MPa  GPa  bar",
      },
      {
        name: "US / Imperial",
        syntax: "in  ft  yd  mi   lbf  kip   psi  ksi  gal",
      },
    ],
  },
  {
    id: "form",
    title: "Form / Results",
    blurb: "Form (F4) shows input boxes. Results (F5) shows the calculated report. Calculate in Form switches to Results.",
    rows: [
      { name: "Classic input", syntax: "r = ? {5} cm", note: "Box in Form, value in Results." },
      {
        name: "HTML dropdown",
        syntax:
          "'<select name=\"pt\">\n'<option value=\"11;12\">A</option>\n'<option value=\"21;22\">B</option>\n'</select>\n'<p id=\"pt\">'x = ? {11}', 'y = ? {12}'</p>",
        note: "Option value is copied into the ? boxes (semicolon-separated). Then Calculate.",
      },
      { name: "UI field", syntax: "#UI 'Span - 'L = 5m" },
      {
        name: "Dropdown",
        syntax: '#UI {"type":"dropdown","keys":["A","B"],"values":["1","2"]} n = 1',
      },
      {
        name: "Radio",
        syntax: '#UI {"type":"radio","keys":["Steel","Concrete"],"values":["200GPa","25GPa"]} E = 200GPa',
      },
      { name: "Checkbox", syntax: '#UI {"type":"checkbox"} b = 1', note: "Toggles 1 / 0." },
      {
        name: "Datagrid",
        syntax: '#UI {"type":"datagrid","rows":2,"columns":3} M = [1; 2; 3|4; 5; 6]',
      },
      { name: "Form only", syntax: "#pre\n…\n#end pre", note: "Visible in Form, hidden in Results and PDF." },
      { name: "Report only", syntax: "#post\n…\n#end post", note: "Hidden in Form, visible in Results and PDF." },
    ],
  },
  {
    id: "output",
    title: "Output",
    blurb: "Directives apply from that line onward, or until a matching #end. Most accept an optional condition.",
    rows: [
      { name: "Hide", syntax: "#hide", note: "Hide output. #end hide restores." },
      { name: "Show", syntax: "#show", note: "Show output (default)." },
      { name: "Values only", syntax: "#val", note: "Result without the equation. Needed for SVG attributes on desktop." },
      { name: "Equations", syntax: "#equ", note: "Equation and result (default)." },
      { name: "No calculation", syntax: "#noc", note: "Equation only, no result." },
      { name: "Names and values", syntax: "#varsub", note: "Default substitution." },
      { name: "Names only", syntax: "#nosub" },
      { name: "Values only (sub)", syntax: "#novar" },
      { name: "Split at =", syntax: "#split", note: "Long equations break after =. Switch back with #wrap." },
      { name: "Wrap lines", syntax: "#wrap" },
      { name: "Round", syntax: "#round 4", note: "#round default restores settings." },
      { name: "Format", syntax: "#format 0.00E+00" },
      { name: "Markdown on", syntax: "#md on", note: "#md off disables it." },
      { name: "Phasor form", syntax: "#phasor", note: "Complex as magnitude ∠ angle." },
      { name: "Algebraic form", syntax: "#complex", note: "Complex as a + ib." },
    ],
  },
  {
    id: "flow",
    title: "Program flow",
    rows: [
      {
        name: "If",
        syntax: "#if x > 0\n  y = x\n#else if x ≡ 0\n  y = 0\n#else\n  y = -x\n#end if",
      },
      { name: "For", syntax: "#for i = 1 : n\n  s += i\n#loop" },
      { name: "While", syntax: "#while err > 1%\n  …\n#loop" },
      { name: "Repeat", syntax: "#repeat n\n  …\n#loop" },
      { name: "Break", syntax: "#break", note: "Leave the current loop." },
      { name: "Continue", syntax: "#continue", note: "Next iteration." },
      { name: "Constant", syntax: "#const g = 9.80665m/s^2", note: "Readonly variable or function." },
    ],
  },
  {
    id: "macros",
    title: "Macros and modules",
    rows: [
      { name: "String variable", syntax: "#def title$ = Beam check" },
      {
        name: "Multiline string",
        syntax: "#def note$\n'line 1\n'line 2\n#end def",
      },
      {
        name: "Inline macro",
        syntax: "#def b$(x$) = '<strong>'x$'</strong>",
      },
      {
        name: "Multiline macro",
        syntax: "#def check$(x$; max$)\n#if x$ ≤ max$\n  'OK\n#else\n  'Fail\n#end if\n#end def",
      },
      { name: "Include", syntax: "#include library.cpd", note: "Relative path. Browser has no disk files." },
      { name: "Local", syntax: "#local", note: "Not included when this file is imported." },
      { name: "Global", syntax: "#global", note: "Included when this file is imported." },
    ],
  },
  {
    id: "commands",
    title: "Commands ($)",
    blurb: "Must be first on the line (spaces allowed). Arguments go in { curly braces }.",
    rows: [
      { name: "Plot", syntax: "$Plot{f(x) @ x = 0 : 2π}" },
      { name: "Several plots", syntax: "$Plot{f(x) & g(x) @ x = a : b}" },
      { name: "Parametric", syntax: "$Plot{x(t)|y(t) @ t = 0 : 2π}" },
      { name: "Map", syntax: "$Map{f(x; y) @ x = a : b & y = c : d}" },
      { name: "Root", syntax: "$Root{f(x) = 0 @ x = a : b}" },
      { name: "Find", syntax: "$Find{f(x) @ x = a : b}", note: "Approximate root; less strict than $Root." },
      { name: "Maximum", syntax: "$Sup{f(x) @ x = a : b}" },
      { name: "Minimum", syntax: "$Inf{f(x) @ x = a : b}" },
      { name: "Integral (Tanh-Sinh)", syntax: "$Integral{f(x) @ x = a : b}" },
      { name: "Area (Gauss-Lobatto)", syntax: "$Area{f(x) @ x = a : b}" },
      { name: "Slope", syntax: "$Slope{f(x) @ x = a}" },
      { name: "Sum", syntax: "$Sum{f(k) @ k = 1 : n}" },
      { name: "Product", syntax: "$Product{f(k) @ k = 1 : n}" },
      { name: "Repeat expr", syntax: "$Repeat{expr @ i = 1 : n}" },
    ],
  },
  {
    id: "linear",
    title: "Vectors and matrices",
    rows: [
      { name: "Vector", syntax: "v = [1; 2; 3]" },
      { name: "Matrix", syntax: "M = [1; 2|3; 4]", note: "Semicolon = next column, pipe = next row." },
      { name: "Empty vector", syntax: "vector(n)" },
      { name: "Empty matrix", syntax: "matrix(m; n)" },
      { name: "Identity", syntax: "identity(n)" },
      { name: "Range", syntax: "range(1; 10; 0.5)" },
      { name: "Linear solve", syntax: "clsolve(A; b)", note: "Also lsolve, slsolve, msolve." },
      { name: "Inverse / det", syntax: "inverse(A)   det(A)   transp(A)" },
      { name: "Norm / rank", syntax: "norm(A)   rank(A)   trace(A)" },
      { name: "Element", syntax: "v.1    M.2.3", note: "1-based indices." },
      { name: "Length / size", syntax: "len(v)   n_rows(M)   n_cols(M)" },
      { name: "Slice", syntax: "slice(v; i; j)   submatrix(M; r1; r2; c1; c2)" },
      { name: "Sort / search", syntax: "sort(v)   search(v; x)   lookup(M; x; col)" },
      { name: "Stats", syntax: "min(v)  max(v)  sum(v)  average(v)  srss(v)" },
    ],
  },
  {
    id: "functions",
    title: "Functions",
    blurb: "Call with parentheses. Multiple arguments use semicolons: atan2(y; x).",
    rows: [
      { name: "Trigonometry", syntax: "sin(x)  cos(x)  tan(x)  cot(x)  sec(x)  csc(x)" },
      { name: "Inverse trig", syntax: "asin(x)  acos(x)  atan(x)  atan2(y; x)" },
      { name: "Hyperbolic", syntax: "sinh(x)  cosh(x)  tanh(x)  asinh(x)  acosh(x)  atanh(x)" },
      { name: "Logs / powers", syntax: "ln(x)  log(x)  log_2(x)  exp(x)  sqrt(x)  cbrt(x)  sqr(x)" },
      { name: "Rounding", syntax: "abs(x)  sign(x)  round(x)  floor(x)  ceiling(x)  trunc(x)" },
      { name: "Integer", syntax: "mod(a; b)  gcd(a; b)  lcm(a; b)  fact(n)" },
      { name: "Conditional", syntax: "if(cond; a; b)", note: "switch(c1; v1; c2; v2; …; default)" },
      { name: "Logic", syntax: "not(x)  and(x; y)  or(x; y)  xor(x; y)" },
      { name: "Complex", syntax: "re(z)  im(z)  abs(z)  phase(z)  conj(z)" },
      { name: "Interpolation", syntax: "take(x; y)  line(x; y)  spline(x; y)" },
      { name: "Random / timer", syntax: "random(n)  timer()" },
    ],
  },
  {
    id: "html",
    title: "HTML, SVG, images",
    blurb: "A line that starts with a quote is emitted as HTML in the report.",
    rows: [
      { name: "Heading", syntax: "'<h1>Title</h1>" },
      { name: "Fold section", syntax: "'<div class=\"fold\">\n'<h2>Heading</h2>\n'body\n'</div>", note: "Starts collapsed. Click the heading to expand. PDF stays collapsed." },
      {
        name: "SVG",
        syntax: "'<svg viewbox=\"'x' 'y' 'w' 'h'\" style=\"width:'80'pt; height:'80'pt\">\n'<circle cx=\"'0'\" cy=\"'0'\" r=\"'5'\" />\n'</svg>",
        note: "Quoted numbers become values. Wrap in #val … #equ on desktop.",
      },
      { name: "Image paste", syntax: "Ctrl/⌘ V in the source", note: "Size dialog, then a folded data-URI at the cursor." },
      { name: "Greek letters", syntax: "αβ in the status bar", note: "Inserts at the source cursor." },
      { name: "Markdown", syntax: "#md on", note: "Then write Markdown in comments." },
    ],
  },
  {
    id: "settings",
    title: "Settings",
    rows: [
      { name: "Plot size", syntax: "PlotWidth = 800\nPlotHeight = 400" },
      { name: "Plot SVG", syntax: "PlotSVG = 1", note: "1 = SVG, 0 = PNG." },
      { name: "Adaptive mesh", syntax: "PlotAdaptive = 1" },
      { name: "Map palette", syntax: "PlotPalette = 0", note: "0–9 for $Map." },
      { name: "Precision", syntax: "Precision = 1e-12", note: "Relative precision of numerical methods." },
      { name: "Engine JSON", syntax: '#settings {"decimals": 4, "units": "cm"}' },
    ],
  },
];

export function filterCheatsheet(query: string, sections: CheatSection[] = CHEATSHEET): CheatSection[] {
  const q = query.trim().toLowerCase();
  if (!q) return sections;
  return sections
    .map((section) => {
      const titleHit =
        section.title.toLowerCase().includes(q) || (section.blurb?.toLowerCase().includes(q) ?? false);
      if (titleHit) return section;
      return {
        ...section,
        rows: section.rows.filter(
          (row) =>
            row.name.toLowerCase().includes(q) ||
            row.syntax.toLowerCase().includes(q) ||
            (row.note?.toLowerCase().includes(q) ?? false),
        ),
      };
    })
    .filter((section) => section.rows.length > 0);
}

export function cheatsheetInsertText(row: CheatRow): string {
  return row.insert ?? row.syntax;
}
