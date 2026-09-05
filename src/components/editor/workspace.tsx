import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Download,
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
import { bootEngine, parseWorksheet } from "@/lib/calcpad/engine";
import { applyInputValues } from "@/lib/calcpad/inputs";
import { useCalcpadStore } from "@/lib/calcpad/store";
import { cn } from "@/lib/utils";

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
    css = await fetch("/calcpad-output.css").then((r) => r.text());
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
  const setSource = useCalcpadStore((s) => s.setSource);
  const setOptions = useCalcpadStore((s) => s.setOptions);
  const setResult = useCalcpadStore((s) => s.setResult);
  const setStatus = useCalcpadStore((s) => s.setStatus);
  const setFileName = useCalcpadStore((s) => s.setFileName);
  const resetWorksheet = useCalcpadStore((s) => s.resetWorksheet);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [syntaxOpen, setSyntaxOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"code" | "paper">("paper");
  const [mounted, setMounted] = useState(false);
  const [focusLine, setFocusLine] = useState<{ line: number; key: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | null>(null);
  const sourceRef = useRef(source);
  sourceRef.current = source;

  useEffect(() => {
    setMounted(true);
  }, []);

  const run = useCallback(() => {
    try {
      setStatus("running");
      const t0 = performance.now();
      const result = parseWorksheet(sourceRef.current, {
        ...useCalcpadStore.getState().options,
        fileName: useCalcpadStore.getState().fileName,
      });
      setResult(result.html, result.errors, Math.round(performance.now() - t0));
      setMobileTab("paper");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus("error", message);
    }
  }, [setResult, setStatus]);

  useEffect(() => {
    let cancelled = false;
    setStatus("booting");
    bootEngine()
      .then(() => {
        if (cancelled) return;
        setStatus("ready");
        run();
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus("error", err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [run, setStatus]);

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

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-dvh min-h-0 flex-col bg-background text-foreground">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3 print:hidden md:px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-[var(--radius-sm)] bg-primary text-primary-foreground">
              <SquareAsterisk className="size-4" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-sm font-medium tracking-tight">CalcpadCE</h1>
                <Badge variant="default">WebAssembly</Badge>
              </div>
              <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
                {fileName} · Calcpad.Core in the browser
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  onClick={run}
                  disabled={status === "booting" || status === "running"}
                >
                  <Play className="size-3.5" />
                  Run
                </Button>
              </TooltipTrigger>
              <TooltipContent>Run worksheet (Ctrl/⌘ Enter)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant={options.calculate ? "secondary" : "outline"}
                  className="hidden sm:inline-flex"
                  onClick={() => setOptions({ calculate: !options.calculate })}
                >
                  {options.calculate ? "Results" : "Form"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {options.calculate
                  ? "Show calculated results. Switch to Form to edit ? inputs."
                  : "Show input form. Switch back to calculate."}
              </TooltipContent>
            </Tooltip>
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
                <Button size="icon-sm" variant="ghost" onClick={() => setSyntaxOpen(true)}>
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
                >
                  <Printer className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export HTML report</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon-sm" variant="ghost" onClick={resetWorksheet}>
                  <RotateCcw className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reset sample</TooltipContent>
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
            Output
          </button>
        </div>

        <div className="min-h-0 flex-1">
          <Group orientation="horizontal" className="hidden h-full md:flex">
            <Panel defaultSize={46} minSize={28} className="min-h-0 print:hidden">
              <CodeEditor value={source} onChange={setSource} onRun={run} focusLine={focusLine} />
            </Panel>
            <ResizeSeparator className="w-px bg-border hover:bg-primary/60 data-[separator=active]:bg-primary print:hidden" />
            <Panel defaultSize={54} minSize={30} className="min-h-0 bg-paper">
              <Paper
                html={html}
                booting={status === "booting"}
                onJumpLine={jumpToLine}
                onInputsChange={handleInputs}
              />
            </Panel>
          </Group>
          <div className="flex h-full min-h-0 flex-col md:hidden print:hidden">
            {mobileTab === "code" ? (
              <CodeEditor value={source} onChange={setSource} onRun={run} focusLine={focusLine} />
            ) : (
              <div className="min-h-0 flex-1 bg-paper">
                <Paper
                  html={html}
                  booting={status === "booting"}
                  onJumpLine={jumpToLine}
                  onInputsChange={handleInputs}
                />
              </div>
            )}
          </div>
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
            setSource(await file.text());
            setFileName(file.name);
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
        onPick={(title, text, file) => {
          setSource(text);
          setFileName(file);
          void title;
        }}
      />
      <SyntaxSheet open={syntaxOpen} onOpenChange={setSyntaxOpen} />
    </TooltipProvider>
  );
}
