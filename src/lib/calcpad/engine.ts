import type { EngineOptions, ParseResult } from "./types";

declare global {
  interface Window {
    Blazor?: {
      start: (opts?: Record<string, unknown>) => Promise<void>;
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

const SCRIPT_SRC = "/calcpad-wasm/_framework/blazor.webassembly.js";
const ASSEMBLY = "Calcpad.Wasm";
const FRAMEWORK = "/calcpad-wasm/_framework/";

let bootPromise: Promise<void> | null = null;
let assembliesReady = false;

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
    return `/calcpad-wasm/${defaultUri}`;
  }
  if (defaultUri.startsWith("/")) {
    return defaultUri;
  }
  return `${FRAMEWORK}${name}`;
}

function assemblyAvailable(): boolean {
  if (!window.DotNet?.invokeMethod) return false;
  try {
    window.DotNet.invokeMethod<string>(ASSEMBLY, "Parse", "0", "{}");
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return !message.toLowerCase().includes("no loaded assembly");
  }
}

export function isEngineReady(): boolean {
  return assembliesReady && assemblyAvailable();
}

export async function bootEngine(): Promise<void> {
  if (assembliesReady && assemblyAvailable()) return;
  if (bootPromise) return bootPromise;

  bootPromise = (async () => {
    await loadClassicScript(SCRIPT_SRC);
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
    const deadline = Date.now() + 45_000;
    while (!assemblyAvailable()) {
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
    throw err;
  }
}

export function parseWorksheet(source: string, options: EngineOptions): ParseResult {
  if (!window.DotNet) {
    throw new Error("Engine is not ready.");
  }
  const raw = window.DotNet.invokeMethod<string>(
    ASSEMBLY,
    "Parse",
    source,
    JSON.stringify(options),
  );
  const parsed = JSON.parse(raw) as ParseResult;
  return {
    html: parsed.html ?? "",
    errors: parsed.errors ?? [],
    ok: Boolean(parsed.ok),
  };
}

export async function parseWorksheetAsync(
  source: string,
  options: EngineOptions,
): Promise<ParseResult> {
  await bootEngine();
  return parseWorksheet(source, options);
}
