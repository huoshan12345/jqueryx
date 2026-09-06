import type { Nullishable, OneOrMany } from 'builtinx';

declare global {
  interface JQueryStatic {
    search(selector: string, checkIframesIfEmpty?: boolean): JQuery;
    /** Scrolls the first match into view using its native scrolling containers. Empty matches do nothing. */
    scrollToNode(element: string | Element | JQuery<Element>, options?: ScrollIntoViewOptions): void;
    from(selector: Nullishable<OneOrMany<string | JQuery>>): JQuery;
    from<T extends Element>(element: Nullishable<OneOrMany<T>>): JQuery<T>;
    /** Recognizes collections from the shared jQuery instance; does not validate their contents. */
    isJQuery(value: unknown): value is JQuery<unknown>;
    /** Recognizes native Elements across realms, including documents without a window. */
    isElement(value: unknown): value is Element;
  }
}

$.isJQuery = function (value: unknown): value is JQuery<unknown> {
  return value instanceof $;
};

const getElementTagName = Object.getOwnPropertyDescriptor(Element.prototype, 'tagName')!.get!;

$.isElement = function (value: unknown): value is Element {
  if (value == null || typeof value !== "object") {
    return false;
  }

  try {
    // The native getter validates the Element receiver without relying on its realm
    // or ownerDocument, which may have no window or may change after adoption.
    getElementTagName.call(value);
    return true;
  } catch {
    return false;
  }
};

$.search = function (selector: string, checkIframesIfEmpty: boolean = true): JQuery {
  let result = $(selector);
  if (result.isEmpty() && checkIframesIfEmpty) {
    result = $('iframe').contents().find(selector);
  }
  return result;
};

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

function from<T extends Element>(element: Nullishable<OneOrMany<T>>): JQuery<T>;
function from(selector: Nullishable<OneOrMany<string | JQuery>>): JQuery;
function from<T extends Element>(items: Nullishable<OneOrMany<string | JQuery | T>>): JQuery<unknown> {
  if (items == null) {
    return $<T>();
  }

  if (typeof items === 'string') {
    return $(items);
  }

  if ($.isJQuery(items)) {
    return items;
  }

  if ($.isElement(items)) {
    return $(items);
  }

  if (Array.isArrayLike(items) === false) {
    const type = BuiltinX.Type.get(items);
    console.log(type, items);
    throw new TypeError("Not an array-like object: " + type);
  }

  // ArrayLike<string | JQuery>
  let result = $<T>();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (typeof item === 'string') {
      result = result.add($(item) as any);
    } else if ($.isJQuery(item)) {
      result = result.add(item as any);
    } else if ($.isElement(item)) {
      result = result.add($(item) as any);
    } else {
      const type = BuiltinX.Type.get(item);
      console.log(type, item);
      throw new TypeError("Not an acceptable item type: " + type);
    }
  }

  return result;
}

$.from = from;
