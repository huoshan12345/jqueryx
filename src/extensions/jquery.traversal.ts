declare global {
  interface JQuery<TElement = HTMLElement> {
    /**
     * Finds a matching ancestor for each element and combines results with jQuery.add.
     * @param selector A jQuery selector to match against ancestors.
     * @param outermost Selects the farthest match instead of the nearest; defaults to false.
     * @param includeSelf Considers each selected element before its parents; defaults to false.
     * @returns Matching ancestors, deduplicated and sorted by jQuery; empty when none match.
     */
    ancestor<K extends keyof HTMLElementTagNameMap>(
      this: this & JQuery<Element>,
      selector: K,
      outermost?: boolean,
      includeSelf?: boolean,
    ): JQuery<HTMLElementTagNameMap[K]>;
    /** Finds matching SVG ancestors, inferring their type from the tag name. */
    ancestor<K extends keyof SVGElementTagNameMap>(
      this: this & JQuery<Element>,
      selector: K,
      outermost?: boolean,
      includeSelf?: boolean,
    ): JQuery<SVGElementTagNameMap[K]>;
    /** Finds matching ancestors; an explicit TMatch must describe the selector's results. */
    ancestor<TMatch extends Element = HTMLElement>(
      this: this & JQuery<Element>,
      selector: string,
      outermost?: boolean,
      includeSelf?: boolean,
    ): JQuery<TMatch>;
    /** Finds descendants; if empty and checkIframesIfEmpty (default true), searches direct iframe documents in this subtree. */
    search<K extends keyof HTMLElementTagNameMap>(
      this: this & JQuery<Node>,
      selector: K,
      checkIframesIfEmpty?: boolean,
    ): JQuery<HTMLElementTagNameMap[K]>;
    /** Finds SVG descendants, falling back to direct iframe documents by default. */
    search<K extends keyof SVGElementTagNameMap>(
      this: this & JQuery<Node>,
      selector: K,
      checkIframesIfEmpty?: boolean,
    ): JQuery<SVGElementTagNameMap[K]>;
    /** Finds descendants with iframe fallback; an explicit TMatch must describe the selector's results. */
    search<TMatch extends Element = HTMLElement>(
      this: this & JQuery<Node>,
      selector: string,
      checkIframesIfEmpty?: boolean,
    ): JQuery<TMatch>;
  }

  interface JQueryStatic {
    /** Queries $(selector); if empty and checkIframesIfEmpty (default true), searches direct iframe documents. Not recursive. */
    search<K extends keyof HTMLElementTagNameMap>(
      selector: K,
      checkIframesIfEmpty?: boolean,
    ): JQuery<HTMLElementTagNameMap[K]>;
    /** Queries SVG elements, falling back to direct iframe documents by default. */
    search<K extends keyof SVGElementTagNameMap>(
      selector: K,
      checkIframesIfEmpty?: boolean,
    ): JQuery<SVGElementTagNameMap[K]>;
    /** Queries with iframe fallback; an explicit TMatch must describe the selector's results. */
    search<TMatch extends Element = HTMLElement>(
      selector: string,
      checkIframesIfEmpty?: boolean,
    ): JQuery<TMatch>;
  }
}

$.fn.ancestor = function <TMatch extends Element = HTMLElement>(
  this: JQuery<Element>,
  selector: string,
  outermost = false,
  includeSelf = false,
): JQuery<TMatch> {
  let result = $<Element>();
  this.each((i, e) => {
    const p = findAncestor(e, outermost, includeSelf);
    result = result.add(p.toArray());
  });
  return result as JQuery<TMatch>;

  function findAncestor(e: Element, outermost: boolean, includeSelf: boolean) {
    const node = $(e);
    let p = includeSelf
      ? node
      : node.parent();

    let result = $<Element>();
    while (p.isNotEmpty()) {
      if (p.is(selector)) {
        result = p;
        if (outermost === false) {
          break;
        }
      }
      p = p.parent();
    }
    return result;
  }
};

$.fn.search = function <TMatch extends Element = HTMLElement>(
  this: JQuery<Node>,
  selector: string,
  checkIframesIfEmpty: boolean = true,
): JQuery<TMatch> {
  let result = this.find<TMatch>(selector);
  if (result.isEmpty() && checkIframesIfEmpty) {
    result = this.find('iframe').contents().find<TMatch>(selector);
  }
  return result;
};

$.search = function <TMatch extends Element = HTMLElement>(
  selector: string,
  checkIframesIfEmpty: boolean = true,
): JQuery<TMatch> {
  let result = $<TMatch>(selector);
  if (result.isEmpty() && checkIframesIfEmpty) {
    result = $('iframe').contents().find<TMatch>(selector);
  }
  return result;
};
