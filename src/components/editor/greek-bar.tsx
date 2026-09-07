import { GREEK_LOWER, GREEK_UPPER, type GreekLetter } from "@/lib/calcpad/greek";
import { cn } from "@/lib/utils";

type Props = {
  onInsert: (ch: string) => void;
};

const keyClass =
  "grid size-9 shrink-0 place-items-center rounded-[var(--radius-sm)] text-base text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:size-8";

function Row({
  label,
  letters,
  onInsert,
}: {
  label: string;
  letters: readonly GreekLetter[];
  onInsert: (ch: string) => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1">
      <span className="w-10 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="flex min-w-0 flex-1 gap-px overflow-x-auto">
        {letters.map((item) => (
          <button
            key={item.ch}
            type="button"
            className={keyClass}
            title={`${item.name} (${item.ch})`}
            aria-label={`${item.name} (${item.ch})`}
            onClick={() => onInsert(item.ch)}
          >
            {item.ch}
          </button>
        ))}
      </div>
    </div>
  );
}

export function GreekBar({ onInsert }: Props) {
  return (
    <div
      className={cn(
        "relative z-20 shrink-0 border-t border-border bg-background px-2 py-1.5 print:hidden md:px-3",
      )}
      onMouseDown={(e) => e.preventDefault()}
      role="toolbar"
      aria-label="Greek letters"
    >
      <Row label="lower" letters={GREEK_LOWER} onInsert={onInsert} />
      <Row label="upper" letters={GREEK_UPPER} onInsert={onInsert} />
    </div>
  );
}
