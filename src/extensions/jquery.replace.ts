declare global {
  interface JQuery<TElement = HTMLElement> {
    /**
     * Replaces each distinct outermost selected element, returning replacements in callback order.
     * Selection is fixed before callbacks: selected descendants are skipped even if their ancestor is kept.
     * Callbacks follow the original collection order and receive the first original index of each root.
     * Return the current element to keep it, or an empty collection to delete it.
     * Reused replacement nodes are cloned with jQuery events and data.
     * Earlier replacements remain if a later callback fails.
     */
    replaceBy<TReplacement extends Element>(
      this: this & JQuery<Element>,
      replacement: (node: JQuery<TElement>, index: number) => JQuery<TReplacement>,
    ): JQuery<TReplacement>;
  }
}

$.fn.replaceBy = function <TElement extends Element, TReplacement extends Element>(
  this: JQuery<TElement>,
  replacement: (node: JQuery<TElement>, index: number) => JQuery<TReplacement>,
): JQuery<TReplacement> {
  const sources = this.toArray();
  const selected = new Set<Element>(sources);
  const seen = new Set<Element>();
  // Resolve overlapping selections before callbacks can change the DOM.
  const roots = [...sources.entries()].filter(([, source]) => {
    if (seen.has(source)) {
      return false;
    }
    seen.add(source);
    for (let ancestor = source.parentElement; ancestor; ancestor = ancestor.parentElement) {
      if (selected.has(ancestor)) {
        return false;
      }
    }
    return true;
  });
  const sourceSet = new Set<Element>(roots.map(([, source]) => source));
  const used = new Set<Element>();
  const results: TReplacement[] = [];

  for (const [index, source] of roots) {
    const replacements: TReplacement[] = [];
    for (const candidate of replacement($(source), index)) {
      // Do not move a previous replacement or another source still awaiting its callback.
      const node = used.has(candidate) || (!Object.is(candidate, source) && sourceSet.has(candidate))
        ? $(candidate).clone(true, true)[0]
        : candidate;
      replacements.push(node);
      used.add(node);
    }

    const parent = source.parentNode;
    if (parent) {
      // A stable insertion position also permits returning the source among new siblings.
      const marker = source.ownerDocument.createComment('');
      parent.insertBefore(marker, source);
      try {
        for (const node of replacements) {
          parent.insertBefore(node, marker);
        }
        if (!replacements.some(node => Object.is(node, source))) {
          $(source).remove();
        }
      } finally {
        marker.remove();
      }
    }
    results.push(...replacements);
  }
  return $(results);
};
