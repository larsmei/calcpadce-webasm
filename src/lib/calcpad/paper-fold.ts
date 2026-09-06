/** Calcpad `'<div class="fold">` sections: collapsed on open and in PDF. */

export function collapsePaperFolds(root: ParentNode, options?: { prune?: boolean }) {
  root.querySelectorAll(".unfold").forEach((el) => {
    el.classList.remove("unfold");
    el.classList.add("fold");
  });
  if (!options?.prune) return;
  root.querySelectorAll(".fold").forEach((el) => {
    const keep = el.firstElementChild;
    if (!keep) return;
    for (const child of [...el.childNodes]) {
      if (child !== keep) child.remove();
    }
  });
}

/** Toggle only when the click is on the fold heading (first child). */
export function foldFromHeaderClick(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const fold = target.closest(".fold, .unfold");
  if (!(fold instanceof HTMLElement)) return null;
  const header = fold.firstElementChild;
  if (!header || !header.contains(target)) return null;
  return fold;
}
