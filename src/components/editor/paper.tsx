import { useEffect, useRef } from "react";
import {
  collectPaperInputs,
  collectUiOverrides,
  formHtml,
  hydrateUiDatagrids,
  isPaperControl,
} from "@/lib/calcpad/inputs";
import { collapsePaperFolds, foldFromHeaderClick } from "@/lib/calcpad/paper-fold";
import { runEmbeddedScripts } from "@/lib/calcpad/run-scripts";
import type { ViewMode } from "@/lib/calcpad/types";
import { cn } from "@/lib/utils";

type Props = {
  html: string;
  emptyHint?: string;
  className?: string;
  booting?: boolean;
  viewMode?: ViewMode;
  onJumpLine?: (line: number) => void;
  onInputsChange?: (values: string[]) => void;
  onUiChange?: (overrides: Record<string, string>) => void;
};

export function Paper({
  html,
  emptyHint,
  className,
  booting,
  viewMode = "results",
  onJumpLine,
  onInputsChange,
  onUiChange,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const jumpRef = useRef(onJumpLine);
  const inputsRef = useRef(onInputsChange);
  const uiRef = useRef(onUiChange);
  const modeRef = useRef(viewMode);
  jumpRef.current = onJumpLine;
  inputsRef.current = onInputsChange;
  uiRef.current = onUiChange;
  modeRef.current = viewMode;

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const commitInputs = () => {
      inputsRef.current?.(collectPaperInputs(root));
    };
    const commitUi = () => {
      uiRef.current?.(collectUiOverrides(root));
    };

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const fold = foldFromHeaderClick(target);
      if (fold) {
        fold.classList.toggle("fold");
        fold.classList.toggle("unfold");
        return;
      }

      if (isPaperControl(target)) return;

      const underline = target.closest("u[class*='input-']") as HTMLElement | null;
      if (underline && inputsRef.current) {
        e.preventDefault();
        e.stopPropagation();
        const input = document.createElement("input");
        input.type = "text";
        input.name = "Var";
        input.className = underline.className;
        input.value = (underline.textContent ?? "").replace(/\u2009/g, "").trim();
        input.size = Math.max(4, input.value.length + 1);
        underline.replaceWith(input);
        input.focus();
        input.select();
        const finish = () => {
          input.removeEventListener("blur", finish);
          commitInputs();
        };
        input.addEventListener("blur", finish);
        input.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            input.blur();
          }
        });
        return;
      }

      if (modeRef.current === "form") return;

      const lineEl = target.closest<HTMLElement>("[data-source-line], [id^='line-']");
      if (lineEl && jumpRef.current) {
        const fromData = lineEl.getAttribute("data-source-line");
        const fromId = lineEl.id?.startsWith("line-") ? lineEl.id.slice(5) : "";
        const line = Number(fromData || fromId);
        if (Number.isFinite(line) && line > 0) jumpRef.current(line);
      }
    };

    const onChange = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-ui-var]")) {
        commitUi();
        return;
      }
      if (target.matches("input[name='Var'], input[class*='input-']")) {
        commitInputs();
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      if (e.target instanceof HTMLInputElement) e.target.blur();
    };

    hydrateUiDatagrids(root);
    collapsePaperFolds(root);

    root.addEventListener("click", onClick);
    root.addEventListener("change", onChange);
    root.addEventListener("keydown", onKey);
    root.querySelectorAll(".dvcs:has(.block) > :first-child").forEach((el) => {
      (el as HTMLElement).innerHTML = "&hairsp;";
    });
    const ac = new AbortController();
    void runEmbeddedScripts(html, ac.signal).catch((err) => {
      if (ac.signal.aborted) return;
      console.warn("[calcpad] embedded script failed", err);
    });
    return () => {
      ac.abort();
      root.removeEventListener("click", onClick);
      root.removeEventListener("change", onChange);
      root.removeEventListener("keydown", onKey);
    };
  }, [html, viewMode]);

  if (booting) {
    return (
      <div className={cn("flex h-full items-center justify-center px-8 text-center", className)}>
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--color-paper-ink)" }}>
            Loading Calcpad.Core
          </p>
          <p className="mt-1 text-xs" style={{ color: "color-mix(in oklab, var(--color-paper-ink) 55%, transparent)" }}>
            .NET calculation engine → WebAssembly
          </p>
        </div>
      </div>
    );
  }

  if (!html) {
    return (
      <div className={cn("flex h-full items-center justify-center px-8 text-center", className)}>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
          {emptyHint ?? "Run a worksheet to render equations, units, plots and reports on this page."}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={cn("calcpad-paper h-full min-h-0 overflow-auto px-6 py-6 md:px-10 md:py-8", className)}
      data-view={viewMode}
      dangerouslySetInnerHTML={{ __html: formHtml(html, viewMode) }}
    />
  );
}
