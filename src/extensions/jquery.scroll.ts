declare global {
  interface JQueryStatic {
    /** Scrolls the first match into view using its native scrolling containers. Empty matches do nothing. */
    scrollToNode(element: string | Element | JQuery<Element>, options?: ScrollIntoViewOptions): void;
  }
}

$.scrollToNode = function (element: string | Element | JQuery<Element>, options?: ScrollIntoViewOptions) {
  let node: Element | undefined;
  if ($.isElement(element)) {
    node = element;
  } else if (typeof element === "string") {
    node = $(element).get(0);
  } else if (element instanceof jQuery) {
    node = element.get(0);
  } else {
    throw new TypeError('Expected an element, selector, or JQuery collection.');
  }
  if (!node) {
    return;
  }
  node.scrollIntoView({ block: 'start', inline: 'nearest', ...options });
};
