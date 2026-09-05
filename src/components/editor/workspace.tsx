import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Download,
  FileText,
  FileUp,
  Play,
  Printer,
  RotateCcw,
  Settings2,
  SquareAsterisk,
  Cpu,
} from "lucide-react";
import { Group, Panel, Separator as ResizeSeparator } from "react-resizable-panels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CodeEditor } from "@/components/editor/code-editor";
import { Paper } from "@/components/editor/paper";
import { SettingsDialog } from "@/components/editor/settings-dialog";
import { ExamplesPanel } from "@/components/editor/examples-panel";
import { SyntaxSheet } from "@/components/editor/syntax-sheet";
import { bootEngine, optionsForView, parseWorksheet } from "@/lib/calcpad/engine";
import { applyInputValues } from "@/lib/calcpad/inputs";
import { useCalcpadStore } from "@/lib/calcpad/store";
import { hasUiDirective, type ViewMode } from "@/lib/calcpad/types";
import {
  START_FILE_NAME,
  fetchStartWorksheet,
  isEmbeddedDefault,
  waitForStoreHydration,
} from "@/lib/calcpad/start-file";
import { cn } from "@/lib/utils";
import { assetUrl } from "@/lib/calcpad/asset-url";
import { exportPdfReport } from "@/lib/calcpad/export-pdf";

function downloadText(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportHtmlReport(fileName: string, html: string) {
  let css = "";
  try {
    css = await fetch(assetUrl("calcpad-output.css")).then((r) => r.text());
  } catch {
    css = "";
  }
  const title = fileName.replace(/\.(cpd|txt)$/i, "");
  const doc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${title} — CalcpadCE</title>
<style>${css}</style>
</head>
<body>
${html}
</body>
</html>`;
  downloadText(`${title}.html`, doc, "text/html");
}

export function Workspace() {
  const source = useCalcpadStore((s) => s.source);
  const options = useCalcpadStore((s) => s.options);
  const html = useCalcpadStore((s) => s.html);
  const errors = useCalcpadStore((s) => s.errors);
  const status = useCalcpadStore((s) => s.status);
  const bootError = useCalcpadStore((s) => s.bootError);
  const lastRunMs = useCalcpadStore((s) => s.lastRunMs);
  const fileName = useCalcpadStore((s) => s.fileName);
  const autoRun = useCalcpadStore((s) => s.autoRun);
  const viewMode = useCalcpadStore((s) => s.viewMode);
  const uiOverrides = useCalcpadStore((s) => s.uiOverrides);
  const setSource = useCalcpadStore((s) => s.setSource);
  const setOptions = useCalcpadStore((s) => s.setOptions);
  const setResult = useCalcpadStore((s) => s.setResult);
  const setStatus = useCalcpadStore((s) => s.setStatus);
  const setFileName = useCalcpadStore((s) => s.setFileName);
  const setViewMode = useCalcpadStore((s) => s.setViewMode);
  const setUiOverrides = useCalcpadStore((s) => s.setUiOverrides);
  const resetWorksheet = useCalcpadStore((s) => s.resetWorksheet);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [syntaxOpen, setSyntaxOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"code" | "paper">("paper");
  const [mounted, setMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [focusLine, setFocusLine] = useState<{ line: number; key: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | null>(null);
  const sourceRef = useRef(source);
  sourceRef.current = source;

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const run = useCallback(() => {
    try {
      setStatus("running");
      const t0 = performance.now();
      const state = useCalcpadStore.getState();
      const result = parseWorksheet(
        sourceRef.current,
        optionsForView(state.options, state.viewMode, state.uiOverrides, state.fileName),
      );
      setResult(result.html, result.errors, Math.round(performance.now() - t0));
      setMobileTab("paper");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus("error", message);
    }
  }, [setResult, setStatus]);

  const handleRun = useCallback(() => {
    if (useCalcpadStore.getState().viewMode === "form") {
      setViewMode("results");
      return;
    }
    run();
  }, [run, setViewMode]);

  const loadWorksheet = useCallback(
    (text: string, name: string) => {
      sourceRef.current = text;
      setSource(text);
      setFileName(name);
      setUiOverrides({});
      if (hasUiDirective(text)) setViewMode("form");
    },
    [setSource, setFileName, setUiOverrides, setViewMode],
  );

  const handleReset = useCallback(async () => {
    const start = await fetchStartWorksheet();
    if (start) {
      loadWorksheet(start, START_FILE_NAME);
      return;
    }
    resetWorksheet();
  }, [loadWorksheet, resetWorksheet]);

  useEffect(() => {
    let cancelled = false;
    setStatus("booting");
    (async () => {
      try {
        await waitForStoreHydration(useCalcpadStore.persist);
        if (cancelled) return;
        const state = useCalcpadStore.getState();
        const seedStart = isEmbeddedDefault(state.source, state.fileName);
        const [start] = await Promise.all([
          seedStart ? fetchStartWorksheet() : Promise.resolve(null),
          bootEngine(),
        ]);
        if (cancelled) return;
        if (start) loadWorksheet(start, START_FILE_NAME);
        else sourceRef.current = useCalcpadStore.getState().source;
        setStatus("ready");
        run();
      } catch (err: unknown) {
        if (cancelled) return;
        setStatus("error", err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [run, setStatus, loadWorksheet]);

  useEffect(() => {
    if (!autoRun) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      const current = useCalcpadStore.getState().status;
      if (current === "idle" || current === "booting") return;
      run();
    }, 480);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [source, options, autoRun, run]);

  useEffect(() => {
    const current = useCalcpadStore.getState().status;
    if (current === "idle" || current === "booting") return;
    run();
  }, [viewMode, uiOverrides, run]);

  const engineLabel =
    status === "running"
      ? "Computing"
      : status === "error"
        ? "Engine error"
        : status === "ready"
          ? "WASM ready"
          : "Loading WASM";

  function jumpToLine(line: number) {
    setFocusLine({ line, key: Date.now() });
    setMobileTab("code");
  }

  function handleInputs(values: string[]) {
    const next = applyInputValues(sourceRef.current, values);
    if (next !== sourceRef.current) setSource(next);
  }

  function handleUiChange(next: Record<string, string>) {
    const prev = useCalcpadStore.getState().uiOverrides;
    const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
    let changed = false;
    const merged = { ...prev };
    for (const key of keys) {
      if ((next[key] ?? "") !== (prev[key] ?? "")) {
        merged[key] = next[key] ?? prev[key];
        changed = true;
      }
    }
    if (changed) setUiOverrides(merged);
  }

  function switchView(next: ViewMode) {
    setViewMode(next);
    setMobileTab("paper");
  }

  const paper = (
    <Paper
      html={html}
      booting={status === "booting"}
      viewMode={viewMode}
      onJumpLine={jumpToLine}
      onInputsChange={handleInputs}
      onUiChange={handleUiChange}
      emptyHint={
        viewMode === "form"
          ? "Form compiles ? and #UI into input boxes. Run or Results calculates the report."
          : undefined
      }
    />
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-dvh min-h-0 flex-col bg-background text-foreground">
        <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-1.5 print:hidden md:px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-[var(--radius-sm)] bg-primary text-primary-foreground">
              <SquareAsterisk className="size-4" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-sm font-medium tracking-tight">CalcpadCE</h1>
                <Badge variant="default" className="hidden sm:inline-flex">
                  WebAssembly
                </Badge>
              </div>
              <p className="hidden truncate text-[11px] text-muted-foreground md:block">
                {fileName} · Calcpad.Core in the browser
              </p>
            </div>
          </div>
          <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  onClick={handleRun}
                  disabled={status === "booting" || status === "running"}
                >
                  <Play className="size-3.5" />
                  <span className="hidden sm:inline">{viewMode === "form" ? "Calculate" : "Run"}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {viewMode === "form"
                  ? "Calculate and open Results (F5)"
                  : "Run worksheet (Ctrl/⌘ Enter)"}
              </TooltipContent>
            </Tooltip>
            <div
              className="inline-flex rounded-[var(--radius-sm)] border border-border bg-muted p-0.5"
              role="group"
              aria-label="Form or Results"
              title="Form = input boxes (F4). Results = calculated report (F5)."
            >
              <Button
                size="sm"
                variant={viewMode === "form" ? "default" : "ghost"}
                className="h-8 px-2.5 sm:min-w-[4.25rem] sm:px-3"
                onClick={() => switchView("form")}
              >
                Form
              </Button>
              <Button
                size="sm"
                variant={viewMode === "results" ? "default" : "ghost"}
                className="h-8 px-2.5 sm:min-w-[4.25rem] sm:px-3"
                onClick={() => switchView("results")}
              >
                Results
              </Button>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon-sm" variant="ghost" onClick={() => setExamplesOpen(true)}>
                  <BookOpen className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Examples</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon-sm" variant="ghost" className="hidden sm:inline-flex" onClick={() => setSyntaxOpen(true)}>
                  <Cpu className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Syntax</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon-sm" variant="ghost" onClick={() => fileRef.current?.click()}>
                  <FileUp className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open .cpd</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="hidden sm:inline-flex"
                  onClick={() => downloadText(fileName, source, "text/plain")}
                >
                  <Download className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Save worksheet</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="hidden md:inline-flex"
                  onClick={() => void exportHtmlReport(fileName, html)}
                  disabled={!html}
                >
                  <Printer className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export HTML report</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Export PDF"
                  disabled={!html || exportingPdf}
                  onClick={async () => {
                    setExportingPdf(true);
                    try {
                      const state = useCalcpadStore.getState();
                      const report =
                        state.viewMode === "results"
                          ? { html }
                          : parseWorksheet(
                              sourceRef.current,
                              optionsForView(
                                state.options,
                                "results",
                                state.uiOverrides,
                                state.fileName,
                              ),
                            );
                      const paperEl =
                        state.viewMode === "results"
                          ? document.querySelector<HTMLElement>(".calcpad-paper")
                          : null;
                      await exportPdfReport(fileName, report.html, paperEl);
                    } catch (err) {
                      console.warn("[calcpad] pdf export failed", err);
                    } finally {
                      setExportingPdf(false);
                    }
                  }}
                >
                  <FileText className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{exportingPdf ? "Writing PDF…" : "Export PDF"}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon-sm" variant="ghost" className="hidden sm:inline-flex" onClick={() => void handleReset()}>
                  <RotateCcw className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reset to examples/{START_FILE_NAME}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon-sm" variant="ghost" onClick={() => setSettingsOpen(true)}>
                  <Settings2 className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Settings</TooltipContent>
            </Tooltip>
          </div>
        </header>

        <div className="flex gap-1 border-b border-border px-3 py-1 print:hidden md:hidden">
          <button
            type="button"
            className={cn(
              "h-11 flex-1 rounded-[var(--radius-sm)] text-sm",
              mobileTab === "code" ? "bg-muted text-foreground" : "text-muted-foreground",
            )}
            onClick={() => setMobileTab("code")}
          >
            Source
          </button>
          <button
            type="button"
            className={cn(
              "h-11 flex-1 rounded-[var(--radius-sm)] text-sm",
              mobileTab === "paper" ? "bg-muted text-foreground" : "text-muted-foreground",
            )}
            onClick={() => setMobileTab("paper")}
          >
            {viewMode === "form" ? "Form" : "Results"}
          </button>
        </div>

        <div className="min-h-0 flex-1">
          {isDesktop ? (
          <Group orientation="horizontal" className="h-full">
            <Panel defaultSize={46} minSize={28} className="min-h-0 print:hidden">
              <CodeEditor value={source} onChange={setSource} onRun={handleRun} focusLine={focusLine} />
            </Panel>
            <ResizeSeparator className="w-px bg-border hover:bg-primary/60 data-[separator=active]:bg-primary print:hidden" />
            <Panel defaultSize={54} minSize={30} className="min-h-0 bg-paper">
              {paper}
            </Panel>
          </Group>
          ) : (
          <div className="flex h-full min-h-0 flex-col print:hidden">
            {mobileTab === "code" ? (
              <CodeEditor value={source} onChange={setSource} onRun={handleRun} focusLine={focusLine} />
            ) : (
              <div className="min-h-0 flex-1 bg-paper">{paper}</div>
            )}
          </div>
          )}
        </div>

        <footer className="flex h-9 shrink-0 items-center gap-3 border-t border-border px-3 text-[11px] text-muted-foreground print:hidden">
          <span
            className={cn(
              "inline-flex items-center gap-1.5",
              status === "error" && "text-destructive",
              status === "ready" && "text-primary",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                status === "ready" && "bg-primary",
                status === "booting" && "bg-amber-400",
                status === "running" && "bg-primary animate-pulse",
                status === "error" && "bg-destructive",
                status === "idle" && "bg-muted-foreground",
              )}
            />
            {engineLabel}
          </span>
          {lastRunMs != null && status !== "booting" && <span>{lastRunMs} ms</span>}
          <span className="hidden sm:inline">{viewMode === "form" ? "Input form" : "Report"}</span>
          {errors.length > 0 && (
            <span className="truncate text-destructive">
              {errors.length} issue{errors.length === 1 ? "" : "s"}
              {errors[0] ? ` · L${errors[0].line} ${errors[0].message}` : ""}
            </span>
          )}
          {bootError && <span className="truncate text-destructive">{bootError}</span>}
          <span className="ml-auto hidden sm:inline">
            {options.degrees === 0 ? "DEG" : options.degrees === 1 ? "RAD" : "GRA"} · {options.decimals} dp
          </span>
        </footer>
      </div>

      {mounted ? (
        <input
          ref={fileRef}
          type="file"
          accept=".cpd,.txt,.cpdz"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            loadWorksheet(await file.text(), file.name);
            e.target.value = "";
          }}
        />
      ) : null}
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onExportHtml={() => void exportHtmlReport(fileName, html)}
        onPrint={() => window.print()}
      />
      <ExamplesPanel
        open={examplesOpen}
        onOpenChange={setExamplesOpen}
        onPick={(_title, text, file) => loadWorksheet(text, file)}
      />
      <SyntaxSheet open={syntaxOpen} onOpenChange={setSyntaxOpen} />
    </TooltipProvider>
  );
}
