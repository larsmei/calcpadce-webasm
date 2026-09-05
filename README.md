# CalcpadCE WebAssembly

The [CalcpadCE](https://github.com/imartincei/CalcpadCE) calculation engine running **entirely in the browser**.

`Calcpad.Core` (C# / .NET 10) is compiled to WebAssembly with Blazor. A React editor loads the runtime, parses `.cpd` worksheets, and renders the same HTML reports as the desktop app — units, plots, matrices, numerical methods, Markdown.

Upstream engine: [imartincei/CalcpadCE](https://github.com/imartincei/CalcpadCE) (MIT).

## What works in the browser

- Real/complex numbers, vectors, matrices
- SI / Imperial / USCS units and custom units
- `$Plot`, `$Map`, `$Integral`, `$Root`, `$Sum`, …
- `#if` / `#for` / `#while` / `#def` and `? {value}` input fields
- Syntax-highlighted editor, example worksheets, HTML export

Not ported (need a filesystem or extra native tooling): `#include` of arbitrary files, CSV/Excel I/O, Word/PDF export.

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
