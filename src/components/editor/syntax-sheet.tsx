import { useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CHEATSHEET, cheatsheetInsertText, filterCheatsheet } from "@/lib/calcpad/cheatsheet";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert?: (text: string) => void;
};

export function SyntaxSheet({ open, onOpenChange, onInsert }: Props) {
  const [query, setQuery] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);
  const sections = useMemo(() => filterCheatsheet(query), [query]);

  function jump(id: string) {
    const root = bodyRef.current;
    const target = root?.querySelector<HTMLElement>(`#cheat-${id}`);
    if (!root || !target) return;
    root.scrollTo({ top: target.offsetTop - 8, behavior: "smooth" });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setQuery("");
        onOpenChange(next);
      }}
    >
      <DialogContent
        className={cn(
          "flex left-0 top-0 right-0 bottom-0 h-full max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 [&>button]:top-[max(0.75rem,env(safe-area-inset-top))]",
          "sm:bottom-auto sm:right-auto sm:left-1/2 sm:top-1/2 sm:h-[min(92svh,52rem)] sm:max-h-[min(92svh,52rem)] sm:w-[min(96vw,56rem)] sm:max-w-[56rem] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[var(--radius-lg)]",
        )}
      >
        <DialogHeader className="shrink-0 gap-2 border-b border-border px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] pr-12">
          <DialogTitle>Calcpad cheatsheet</DialogTitle>
          <DialogDescription>
            Complete language reference. Tap a line to insert it at the source cursor.
          </DialogDescription>
          <label className="sr-only" htmlFor="cheat-search">
            Search cheatsheet
          </label>
          <input
            id="cheat-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search syntax, keywords, commands…"
            className="h-10 w-full rounded-[var(--radius-sm)] border border-border bg-background px-3 text-sm text-foreground"
          />
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pt-1">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                className="h-8 shrink-0 rounded-full border border-border bg-muted px-3 text-xs font-medium text-foreground"
                onClick={() => jump(section.id)}
              >
                {section.title}
              </button>
            ))}
          </div>
        </DialogHeader>
        <div
          ref={bodyRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3"
        >
          {sections.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No matching syntax.</p>
          ) : (
            sections.map((section) => (
              <section key={section.id} id={`cheat-${section.id}`} className="mb-6 scroll-mt-2">
                <h3 className="text-sm font-medium tracking-tight text-foreground">{section.title}</h3>
                {section.blurb ? (
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{section.blurb}</p>
                ) : null}
                <ul className="mt-2 divide-y divide-border border-y border-border">
                  {section.rows.map((row) => (
                    <li key={`${section.id}-${row.name}`}>
                      <button
                        type="button"
                        className="grid w-full grid-cols-1 gap-1 py-2.5 text-left sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-3"
                        onClick={() => onInsert?.(cheatsheetInsertText(row))}
                      >
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {row.name}
                        </span>
                        <span className="min-w-0">
                          <code className="block whitespace-pre-wrap break-all font-mono text-sm text-foreground">
                            {row.syntax}
                          </code>
                          {row.note ? (
                            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{row.note}</span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
