import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCalcpadStore } from "@/lib/calcpad/store";
import type { AngleMode } from "@/lib/calcpad/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExportHtml?: () => void;
  onPrint?: () => void;
};

const fieldClass =
  "h-10 w-full rounded-[var(--radius-sm)] border border-border bg-background px-3 text-sm text-foreground";

export function SettingsDialog({ open, onOpenChange, onExportHtml, onPrint }: Props) {
  const options = useCalcpadStore((s) => s.options);
  const autoRun = useCalcpadStore((s) => s.autoRun);
  const setOptions = useCalcpadStore((s) => s.setOptions);
  const setAutoRun = useCalcpadStore((s) => s.setAutoRun);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Worksheet settings</DialogTitle>
          <DialogDescription>
            These map to Calcpad.Core math and plot settings. Use Form / Results in the toolbar for input vs report.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            Decimal places
            <input
              type="number"
              min={0}
              max={15}
              className={fieldClass}
              value={options.decimals}
              onChange={(e) => setOptions({ decimals: Number(e.target.value) })}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            Angle mode
            <select
              className={fieldClass}
              value={options.degrees}
              onChange={(e) => setOptions({ degrees: Number(e.target.value) as AngleMode })}
            >
              <option value={0}>Degrees</option>
              <option value={1}>Radians</option>
              <option value={2}>Gradians</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            Default units
            <input
              className={fieldClass}
              value={options.units}
              onChange={(e) => setOptions({ units: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            Plot size
            <div className="flex gap-2">
              <input
                type="number"
                className={fieldClass}
                value={options.plotWidth}
                onChange={(e) => setOptions({ plotWidth: Number(e.target.value) })}
              />
              <input
                type="number"
                className={fieldClass}
                value={options.plotHeight}
                onChange={(e) => setOptions({ plotHeight: Number(e.target.value) })}
              />
            </div>
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground sm:col-span-2">
            <input
              type="checkbox"
              checked={options.complex}
              onChange={(e) => setOptions({ complex: e.target.checked })}
            />
            Complex numbers
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground sm:col-span-2">
            <input
              type="checkbox"
              checked={options.substitute}
              onChange={(e) => setOptions({ substitute: e.target.checked })}
            />
            Substitute values in equations
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground sm:col-span-2">
            <input
              type="checkbox"
              checked={options.isUs}
              onChange={(e) => setOptions({ isUs: e.target.checked })}
            />
            US customary unit names
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground sm:col-span-2">
            <input
              type="checkbox"
              checked={autoRun}
              onChange={(e) => setAutoRun(e.target.checked)}
            />
            Auto-run after edits
          </label>
        </div>
        <div className="flex justify-end gap-2">
          {onExportHtml ? (
            <Button variant="outline" onClick={onExportHtml}>
              Export HTML
            </Button>
          ) : null}
          {onPrint ? (
            <Button variant="outline" onClick={onPrint}>
              Print
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
