import type { EngineOptions, ParseError, ParseResult, ViewMode } from "./types";
import { assetUrl } from "./asset-url";
import { detachInlineImages, reattachInlineImages } from "./paste-image";

type ParseRawFn = (source: string, optionsJson: string) => string;
type PingFn = () => string;

type WasmExports = {
  Calcpad?: {
    Wasm?: {
      CalcpadBridge?: {
        ParseRaw?: ParseRawFn;
        Ping?: PingFn;
      };
    };
  };
};

declare global {
  interface Window {
    Blazor?: {
      start: (opts?: Record<string, unknown>) => Promise<void>;
      runtime?: {
        getAssemblyExports: (assembly: string) => Promise<WasmExports>;
      };
    };
    DotNet?: {
      invokeMethod: <T>(assembly: string, method: string, ...args: unknown[]) => T;
      invokeMethodAsync: <T>(
        assembly: string,
        method: string,
        ...args: unknown[]
      ) => Promise<T>;
    };
  }
}

const ASSEMBLY = "Calcpad.Wasm";

function frameworkUrl(name = ""): string {
  return assetUrl(`calcpad-wasm/_framework/${name}`);
}

let bootPromise: Promise<void> | null = null;
let assembliesReady = false;
let parseRawFn: ParseRawFn | null = null;
let pingFn: PingFn | null = null;

function loadClassicScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-calcpad-wasm="1"]`,
    );
    if (existing) {
      if (window.Blazor) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load CalcpadCE WebAssembly runtime.")),
      );
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.calcpadWasm = "1";
    script.setAttribute("autostart", "false");
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Failed to load CalcpadCE WebAssembly runtime."));
    document.body.appendChild(script);
  });
}

function loadBootResource(
  _type: string,
  name: string,
  defaultUri: string,
): string {
  if (defaultUri.startsWith("http://") || defaultUri.startsWith("https://")) {
    return defaultUri;
  }
  if (defaultUri.startsWith("_framework/")) {
    return frameworkUrl(defaultUri.slice("_framework/".length));
  }
  if (defaultUri.startsWith("/")) {
    return defaultUri;
  }
  return frameworkUrl(name);
}

function pingDotNet(): boolean {
  if (pingFn) {
    try {
      return pingFn() === "ok";
    } catch {
      return false;
    }
  }
  if (!window.DotNet?.invokeMethod) return false;
  try {
    return window.DotNet.invokeMethod<string>(ASSEMBLY, "Ping") === "ok";
  } catch {
    try {
      window.DotNet.invokeMethod<string>(ASSEMBLY, "Parse", "0", "{}");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return !message.toLowerCase().includes("no loaded assembly");
    }
  }
}

export function isEngineReady(): boolean {
  return assembliesReady && pingDotNet();
}

export async function bootEngine(): Promise<void> {
  if (assembliesReady && pingDotNet()) return;
  if (bootPromise) return bootPromise;

  bootPromise = (async () => {
    await loadClassicScript(frameworkUrl("blazor.webassembly.js"));
    if (!window.Blazor) {
      throw new Error("Blazor runtime did not initialize.");
    }
    try {
      await window.Blazor.start({ loadBootResource });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.toLowerCase().includes("already started")) {
        throw err;
      }
    }
    try {
      const exported = await window.Blazor.runtime?.getAssemblyExports(ASSEMBLY);
      const bridge = exported?.Calcpad?.Wasm?.CalcpadBridge;
      if (bridge?.ParseRaw) parseRawFn = bridge.ParseRaw.bind(bridge);
      if (bridge?.Ping) pingFn = bridge.Ping.bind(bridge);
    } catch {
      parseRawFn = null;
      pingFn = null;
    }
    const deadline = Date.now() + 45_000;
    while (!pingDotNet()) {
      if (Date.now() > deadline) {
        throw new Error("WebAssembly runtime started but Calcpad.Core is not ready.");
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    assembliesReady = true;
  })();

  try {
    await bootPromise;
  } catch (err) {
    bootPromise = null;
    assembliesReady = false;
    parseRawFn = null;
    pingFn = null;
    throw err;
  }
}

export function optionsForView(
  options: EngineOptions,
  viewMode: ViewMode,
  uiOverrides: Record<string, string>,
  fileName: string,
): EngineOptions {
  return {
    ...options,
    fileName,
    calculate: viewMode === "results",
    enableUi: viewMode === "form",
    forPrint: viewMode === "results",
    uiOverrides,
  };
}

function decodeParsePayload(raw: string): ParseResult {
  const nl = raw.indexOf("\n");
  if (nl > 0 && raw.startsWith("{")) {
    const head = raw.slice(0, nl);
    if (head.includes('"errors"') && !head.includes('"html"')) {
      const meta = JSON.parse(head) as { errors?: ParseError[]; ok?: boolean };
      return {
        html: raw.slice(nl + 1),
        errors: meta.errors ?? [],
        ok: Boolean(meta.ok),
      };
    }
  }
  const parsed = JSON.parse(raw) as ParseResult;
  return {
    html: parsed.html ?? "",
    errors: parsed.errors ?? [],
    ok: Boolean(parsed.ok),
  };
}

export function parseWorksheet(source: string, options: EngineOptions): ParseResult {
  const detached = detachInlineImages(source);
  const opts = JSON.stringify(options);
  let payload: string;
  if (parseRawFn) {
    payload = parseRawFn(detached.source, opts);
  } else if (window.DotNet) {
    payload = window.DotNet.invokeMethod<string>(ASSEMBLY, "Parse", detached.source, opts);
  } else {
    throw new Error("Engine is not ready.");
  }
  const result = decodeParsePayload(payload);
  if (detached.images.length) {
    result.html = reattachInlineImages(result.html, detached.images);
  }
  return result;
}

export async function parseWorksheetAsync(
  source: string,
  options: EngineOptions,
): Promise<ParseResult> {
  await bootEngine();
  return parseWorksheet(source, options);
}

export function worksheetParseKey(
  source: string,
  options: EngineOptions,
  viewMode: ViewMode,
  uiOverrides: Record<string, string>,
  fileName: string,
) {
  return `${viewMode}\0${fileName}\0${options.decimals}\0${options.degrees}\0${Number(options.complex)}\0${Number(options.substitute)}\0${options.units}\0${Number(options.isUs)}\0${options.plotWidth}\0${options.plotHeight}\0${JSON.stringify(uiOverrides)}\0${source}`;
}
