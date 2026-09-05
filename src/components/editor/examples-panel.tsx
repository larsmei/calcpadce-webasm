import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { ExampleMeta } from "@/lib/calcpad/types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (title: string, source: string, file: string) => void;
};

export function ExamplesPanel({ open, onOpenChange, onPick }: Props) {
  const [items, setItems] = useState<ExampleMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || items.length) return;
    let cancelled = false;
    setLoading(true);
    fetch("/examples/catalog.json")
      .then((r) => r.json())
      .then((data: ExampleMeta[]) => {
        if (!cancelled) setItems(data);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load examples.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, items.length]);

  async function pick(item: ExampleMeta) {
    const res = await fetch(`/examples/${item.file}`);
    const text = await res.text();
    onPick(item.title, text, item.file);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(92vw,36rem)]">
        <DialogHeader>
          <DialogTitle>Example worksheets</DialogTitle>
          <DialogDescription>
            From the CalcpadCE repository. They run on the same .NET engine, in WebAssembly.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[min(60vh,28rem)] pr-2">
          {loading && <p className="text-sm text-muted-foreground">Loading catalog…</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li key={item.file}>
                <button
                  type="button"
                  onClick={() => void pick(item)}
                  className={cn(
                    "w-full rounded-[var(--radius-md)] border border-border bg-background px-3.5 py-3 text-left transition-colors hover:border-primary/40 hover:bg-muted",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{item.title}</span>
                    <Badge variant="muted">{item.file.replace(".cpd", "")}</Badge>
                  </div>
                  {item.preview && (
                    <pre className="mt-2 max-h-16 overflow-hidden font-mono text-[11px] leading-relaxed text-muted-foreground">
                      {item.preview}
                    </pre>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
