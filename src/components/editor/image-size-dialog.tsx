import { useEffect, useId, useState } from "react";
import { Link2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { sizeFromHeight, sizeFromWidth } from "@/lib/calcpad/paste-image";

type Props = {
  open: boolean;
  title?: string;
  confirmLabel?: string;
  previewSrc?: string;
  naturalWidth: number;
  naturalHeight: number;
  width: number;
  height: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: (size: { width: number; height: number }) => void;
};

const fieldClass =
  "h-10 w-full rounded-[var(--radius-sm)] border border-border bg-background px-3 text-sm text-foreground";

export function ImageSizeDialog({
  open,
  title = "Image size",
  confirmLabel = "Insert",
  previewSrc,
  naturalWidth,
  naturalHeight,
  width,
  height,
  onOpenChange,
  onConfirm,
}: Props) {
  const widthId = useId();
  const heightId = useId();
  const [w, setW] = useState(width);
  const [h, setH] = useState(height);

  useEffect(() => {
    if (open) {
      setW(width);
      setH(height);
    }
  }, [open, width, height]);

  function commit() {
    const next = sizeFromWidth(w, naturalWidth, naturalHeight);
    onConfirm(next);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(92vw,24rem)]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Display size in the report. The image itself is not re-encoded — only the style attribute changes.
          </DialogDescription>
        </DialogHeader>
        {previewSrc ? (
          <div className="grid place-items-center rounded-[var(--radius-sm)] border border-border bg-muted p-3">
            <img
              src={previewSrc}
              alt=""
              className="max-h-32 max-w-full object-contain"
            />
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Actual size {naturalWidth} × {naturalHeight} px. Aspect ratio is kept.
        </p>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            commit();
          }}
        >
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <label className="flex flex-col gap-1.5 text-xs text-muted-foreground" htmlFor={widthId}>
            Width (px)
            <input
              id={widthId}
              type="number"
              min={1}
              max={8000}
              className={fieldClass}
              value={w}
              autoFocus
              onChange={(e) => {
                const next = sizeFromWidth(Number(e.target.value), naturalWidth, naturalHeight);
                setW(next.width);
                setH(next.height);
              }}
            />
          </label>
          <span className="grid size-10 place-items-center text-muted-foreground" title="Aspect ratio locked">
            <Link2 className="size-4" />
          </span>
          <label className="flex flex-col gap-1.5 text-xs text-muted-foreground" htmlFor={heightId}>
            Height (px)
            <input
              id={heightId}
              type="number"
              min={1}
              max={8000}
              className={fieldClass}
              value={h}
              onChange={(e) => {
                const next = sizeFromHeight(Number(e.target.value), naturalWidth, naturalHeight);
                setW(next.width);
                setH(next.height);
              }}
            />
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit">{confirmLabel}</Button>
        </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
