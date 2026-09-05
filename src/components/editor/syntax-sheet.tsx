import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

const ROWS: Array<[string, string]> = [
  ["Comment", "' text   or   \"text\""],
  ["Input", "r = ? {5} cm"],
  ["Convert units", "V|dm^3"],
  ["Function", "f(x) = x^2 - 3*x"],
  ["Plot", "$Plot{f(x) @ x = 0 : 2π}"],
  ["Integral", "$Integral{ln(x) @ x = 0 : 1}"],
  ["Vector", "v = [1; 2; 3]"],
  ["Matrix", "M = [1; 2|3; 4]"],
  ["If", "#if x > 0  …  #end if"],
  ["Loop", "#for i = 1 : 10  …  #loop"],
  ["Root", "$Root{f(x) = 0 @ x = a : b}"],
  ["Continue", "end a line with  _"],
];

export function SyntaxSheet({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(92vw,32rem)]">
        <DialogHeader>
          <DialogTitle>Calcpad syntax</DialogTitle>
          <DialogDescription>
            A short subset. The WASM engine implements the full CalcpadCE language from Calcpad.Core.
          </DialogDescription>
        </DialogHeader>
        <table className="w-full text-sm">
          <tbody>
            {ROWS.map(([k, v]) => (
              <tr key={k} className="border-b border-border/70">
                <th className="w-28 py-2 pr-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {k}
                </th>
                <td className="py-2 font-mono text-[13px] text-foreground">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DialogContent>
    </Dialog>
  );
}
