# CalcpadCE WebAssembly

[CalcpadCE](https://github.com/imartincei/CalcpadCE) in the browser: the `Calcpad.Core` engine (.NET 10) compiled to WebAssembly, with a React editor that parses `.cpd` worksheets and renders the same HTML reports as the desktop app.

No server is required. Host the static zip on Apache, nginx, or any file server.

Latest release: [v0.3.17](https://github.com/larsmei/calcpadce-webasm/releases/tag/v0.3.17)

Upstream engine: [imartincei/CalcpadCE](https://github.com/imartincei/CalcpadCE) (MIT).

## Features

- Real and complex numbers, vectors, matrices
- SI / Imperial / USCS units and custom units
- `$Plot`, `$Map` (SVG, no Skia), `$Integral`, `$Root`, `$Sum`, …
- Plotly / embedded scripts in worksheet HTML
- `#if` / `#for` / `#while` / `#def`
- Calcpad syntax highlighting (including unclosed quotes)
- Paste screenshots into the source at the cursor
- Greek letters from a hideable palette in the status bar
- Complete, searchable Calcpad cheatsheet (overlay)
- Example catalog and HTML report export
- Fast engine path: native WebAssembly AOT plus RPN evaluation (no `Expression.Compile` in the browser). First load is heavier (~25 MB engine); plots, integrals and `$Repeat` are much quicker after that.

### Form / Results (F4 / F5)

| | Form | Results |
|---|---|---|
| Engine | `calculate=false`, `EnableUi=true`, `ForPrint=false` | `calculate=true`, `EnableUi=false`, `ForPrint=true` |
| `? {value}` | native input boxes | calculated values |
| `#UI` | widgets (entry, dropdown, radio, checkbox, datagrid) | report text |
| `#pre` | visible | hidden |
| `#post` | hidden | visible |

**Calculate** in Form switches to Results (F5). `#UI` documents open in Form. Widget values are kept in `uiOverrides` and applied on Results.

Classic input:

```
r = ? {5} cm
h = ? {12} cm
#post
V = π * r^2 * h
V|dm^3
V|gal
#end post
```

CalcpadCE widgets:

```
#pre
#UI 'Span - 'L = 5m
#UI {"type":"dropdown","keys":["Pinned qL²/8","Fixed qL²/12"],"values":["8","12"]} k_M = 8
#end pre
#post
M_max = q*L^2/k_M
#end post
```

### Screenshots

Paste (**Ctrl/⌘ V**) or drop a PNG/JPEG into the **source editor**. A dialog asks for the **display size** (pre-filled with the real pixel size, aspect ratio locked). Only the `style` attribute changes — the image bytes are not re-encoded. The picture is inserted **at the cursor** as a Calcpad HTML comment with an inline data URI. In the editor the data URI is **folded** into a compact card; use the size icon on the card to change width/height later. The toolbar pencil next to the file name renames the worksheet (`.cpd` is added if missing).

```
'<img src="data:image/png;base64,…" alt="screenshot">
```

Long data URIs are wrapped with Calcpad ` _` line continuation. The report renders the picture; PDF export paints it on the page **and** keeps it inside the attached `.cpd`, so Open → PDF restores the images.

### Foldable sections (`div.fold`)

Wrap a block in `'<div class="fold">` … `'</div>`. The **first child** is the heading (any size: `h1`…`h4` or a quoted line); everything after it stays hidden until you click the heading. Official Calcpad used a fixed `2.4em` clip — large headings were cut off. Here the heading is shown in full.

Sections start **collapsed** when the report opens. **PDF export** writes them collapsed (heading only). Click the heading in the report to expand.

```
'<div class="fold">
'<h1>Allgemeine Hydraulikberechnungen</h1>
'Kennwert einer gegebenen Hydraulikpumpe:
'Pumpengröße' V_Geo = ? {2.0} cm^3
'</div>
```

### Greek letters

**αβ** in the status bar opens a two-row palette (lowercase / uppercase). Click a letter to insert it at the source cursor. The palette stays closed until you need it.

### Cheatsheet

The CPU icon in the toolbar opens a **full language reference** (keywords, `$` commands, units, Form/Results, HTML/SVG). On a phone it is a full-screen overlay that scrolls. Search filters the list; tap a line to insert it at the source cursor.

### Embedded SVG

HTML comments that start with `'<svg` are rendered as drawings. Numbers interpolated with nested quotes (`viewbox="'-10' '-10' '20' '20'"`) become values, so the SVG stays valid even without wrapping `#val` … `#equ` (still the desktop-compatible form).

```
'<svg viewbox="'-10' '-10' '20' '20'" xmlns="http://www.w3.org/2000/svg" style="width:'80'pt; height:'80'pt">
'<circle cx="'0'" cy="'0'" r="'5'" fill="orangeRed" />
'</svg>
```

### PDF

- A4 (210 × 297 mm)
- Margins: left 3 cm, right 2 cm, top/bottom 3 cm
- Page breaks between whole lines, equations and plots — plots are not split
- Export always writes the **calculated report** (Results), not the Form
- The active `.cpd` is stored as a **PDF file attachment** (including `#UI` values and pasted images)
- **Open** accepts `.cpd`, `.txt`, `.cpdz` and **`.pdf`**. A PDF is scanned for a `.cpd` attachment and loaded when one is present. A PDF without that attachment is left alone; a hint appears in the status bar.

Acrobat shows the worksheet under the paperclip / Attachments panel.

## Host on Apache / nginx / any static server

The Blazor `_framework` folder is **only the calculation engine**. Hosting that zip alone shows a blank page.

Download **`calcpadce-static-v0.3.17.zip`** from [Releases](https://github.com/larsmei/calcpadce-webasm/releases) and unpack it **into the document root** (replace existing files):

```
index.html
assets/
calcpad-wasm/_framework/   ← engine, keep this nested path
examples/
.htaccess
```

Apache already serving `.wasm` as `application/wasm` is enough. The included `.htaccess` sets MIME types, gzip for `.wasm`, and a SPA fallback.

The site must be at the domain root (e.g. `https://rechner.example.de/`), not in a subfolder, unless you set Vite `base`. After replacing files, hard-reload the browser.

### Default worksheet (`examples/start.cpd`)

On **first visit** the app fetches `examples/start.cpd`.

- If the file is missing, empty, or Apache falls back to `index.html`, the built-in cylinder sample is used.
- Replace `examples/start.cpd` on the server to change the landing worksheet **without rebuilding**.
- **Reset** in the toolbar reloads `start.cpd` the same way.
- Saved / edited worksheets in the browser are not overwritten.

## Build

```bash
npm install
npm run build:static
# output: dist-web/
```

`npm run typecheck` and `npm run test` are available. The static build has no backend.

## Rebuild the engine

Needs the [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0) and the `wasm-tools` workload (`dotnet workload install wasm-tools`).

```bash
dotnet publish wasm/Calcpad.Wasm.csproj -c Release -p:CalcpadNoOpenXml=true
# copy wasm/publish/wwwroot/calcpad-wasm → public/calcpad-wasm
```

Publish runs AOT (`RunAOTCompilation`). The JS side boots `blazor.webassembly.js` and calls `Calcpad.Wasm.ParseRaw` (JSExport: metadata JSON + raw HTML). `Parse` remains as a JSON-envelope fallback.

## Layout

```
src/                  React worksheet editor
public/calcpad-wasm/  Published Blazor WASM runtime (prebuilt)
public/examples/      Sample .cpd worksheets + start.cpd
wasm/                 Blazor WebAssembly bridge (Calcpad.Wasm)
vendor/CalcpadCE/     Calcpad.Core + OpenXml sources used to compile the engine
```

## Not ported

These need a filesystem or extra native tooling:

- `#include` of arbitrary files
- CSV / Excel I/O
- Word export

## License

MIT. This project redistributes CalcpadCE under the same license.  
See [LICENSE](LICENSE) and [vendor/CalcpadCE/LICENSE](vendor/CalcpadCE/LICENSE).
