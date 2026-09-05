# CalcpadCE WebAssembly

[CalcpadCE](https://github.com/imartincei/CalcpadCE) in the browser: the `Calcpad.Core` engine (.NET 10) compiled to WebAssembly, with a React editor that parses `.cpd` worksheets and renders the same HTML reports as the desktop app.

No server is required. Host the static zip on Apache, nginx, or any file server.

Latest release: [v0.3.7](https://github.com/larsmei/calcpadce-webasm/releases/tag/v0.3.7)

Upstream engine: [imartincei/CalcpadCE](https://github.com/imartincei/CalcpadCE) (MIT).

## Features

- Real and complex numbers, vectors, matrices
- SI / Imperial / USCS units and custom units
- `$Plot`, `$Map` (SVG, no Skia), `$Integral`, `$Root`, `$Sum`, …
- Plotly / embedded scripts in worksheet HTML
- `#if` / `#for` / `#while` / `#def`
- Calcpad syntax highlighting (including unclosed quotes)
- Example catalog and HTML report export

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

### PDF

- A4 (210 × 297 mm)
- Margins: left 3 cm, right 2 cm, top/bottom 3 cm
- Page breaks between whole lines, equations and plots — plots are not split
- Export always writes the **calculated report** (Results), not the Form
- The active `.cpd` is stored as a **PDF file attachment** (including `#UI` values)
- **Open** accepts `.cpd`, `.txt`, `.cpdz` and **`.pdf`**. A PDF is scanned for a `.cpd` attachment and loaded when one is present. A PDF without that attachment is left alone; a hint appears in the status bar.

Acrobat shows the worksheet under the paperclip / Attachments panel.

## Host on Apache / nginx / any static server

The Blazor `_framework` folder is **only the calculation engine**. Hosting that zip alone shows a blank page.

Download **`calcpadce-static-v0.3.7.zip`** from [Releases](https://github.com/larsmei/calcpadce-webasm/releases) and unpack it **into the document root** (replace existing files):

```
index.html
assets/
calcpad-wasm/_framework/   ← engine, keep this nested path
examples/
.htaccess
```

Apache already serving `.wasm` as `application/wasm` is enough. The included `.htaccess` sets MIME types and a SPA fallback.

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

Needs the [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0).

```bash
dotnet publish wasm/Calcpad.Wasm.csproj -c Release
# copy wasm/publish/wwwroot/calcpad-wasm → public/calcpad-wasm
```

The JS side boots `blazor.webassembly.js` and calls `Calcpad.Wasm.Parse` via `DotNet.invokeMethod`.

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
