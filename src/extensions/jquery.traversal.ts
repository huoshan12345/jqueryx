declare global {
  interface JQuery<TElement = HTMLElement> {
    ancestor(
      this: this & JQuery<Element>,
      selector: string,
      outermost?: boolean,
      includeSelf?: boolean,
    ): JQuery<Element>;
    search(this: this & JQuery<Node>, selector: string, checkIframesIfEmpty?: boolean): JQuery;
  }

  interface JQueryStatic {
    search(selector: string, checkIframesIfEmpty?: boolean): JQuery;
  }
}

$.fn.ancestor = function (selector: string, outermost = false, includeSelf = false): JQuery<Element> {
  let result = $<Element>();
  this.each((i, e) => {
    const p = findAncestor(e, outermost, includeSelf);
    result = result.add(p.toArray());
  });
  return result;

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

$.fn.search = function (selector: string, checkIframesIfEmpty: boolean = true): JQuery {
  let result = this.find(selector);
  if (result.isEmpty() && checkIframesIfEmpty) {
    result = this.find('iframe').contents().find(selector);
  }
  return result;
};

$.search = function (selector: string, checkIframesIfEmpty: boolean = true): JQuery {
  let result = $(selector);
  if (result.isEmpty() && checkIframesIfEmpty) {
    result = $('iframe').contents().find(selector);
  }
  return result;
};
