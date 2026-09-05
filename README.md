# CalcpadCE WebAssembly

The [CalcpadCE](https://github.com/imartincei/CalcpadCE) calculation engine running **entirely in the browser**.

`Calcpad.Core` (C# / .NET 10) is compiled to WebAssembly with Blazor. A React editor loads the runtime, parses `.cpd` worksheets, and renders the same HTML reports as the desktop app — units, plots, matrices, numerical methods, Markdown.

Upstream engine: [imartincei/CalcpadCE](https://github.com/imartincei/CalcpadCE) (MIT).

## What works in the browser

- Real/complex numbers, vectors, matrices
- SI / Imperial / USCS units and custom units
- `$Plot`, `$Map`, `$Integral`, `$Root`, `$Sum`, …
- `#if` / `#for` / `#while` / `#def`, `? {value}` input fields, and `#UI` widgets
- **Form / Results** (Calcpad F4/F5): Form compiles `?` and `#UI` into a fill-in form (`#pre` shown, `#post` hidden). Results calculates the report.
- Syntax-highlighted editor, example worksheets, HTML export, A4 PDF export of the rendered report

Not ported (need a filesystem or extra native tooling): `#include` of arbitrary files, CSV/Excel I/O, Word export.

## Host on Apache / nginx / any static server

The Blazor `_framework` folder is **only the calculation engine**. Hosting that zip alone shows a blank page — there is no UI.

Download **`calcpadce-static-*.zip`** from [Releases](https://github.com/larsmei/calcpadce-webasm/releases) and unpack it **into the document root** (replace existing files):

```
index.html
assets/
calcpad-wasm/_framework/   ← engine, keep this nested path
examples/
.htaccess
```

Apache already serving `.wasm` as `application/wasm` is enough. The included `.htaccess` sets MIME types and a SPA fallback.

Build the static site yourself:

```bash
npm install
npm run build:static
# output: dist-web/
```

The site must be at the domain root (e.g. `https://rechner.example.de/`), not in a subfolder, unless you set Vite `base`.

## Layout

```
src/                  React worksheet editor
public/calcpad-wasm/  Published Blazor WASM runtime (prebuilt)
public/examples/      Sample .cpd worksheets
wasm/                 Blazor WebAssembly bridge (Calcpad.Wasm)
vendor/CalcpadCE/     Calcpad.Core + OpenXml sources used to compile the engine
```

The JS side boots `blazor.webassembly.js` and calls `Calcpad.Wasm.Parse` via `DotNet.invokeMethod`.

## Rebuild the engine

Needs the [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0).

```bash
dotnet publish wasm/Calcpad.Wasm.csproj -c Release
# copy wasm/publish/wwwroot/calcpad-wasm → public/calcpad-wasm
```

## License

MIT. This project redistributes CalcpadCE under the same license.
See [LICENSE](LICENSE) and [vendor/CalcpadCE/LICENSE](vendor/CalcpadCE/LICENSE).
