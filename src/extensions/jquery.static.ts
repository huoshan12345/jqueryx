import type { Nullishable, OneOrMany } from 'builtinx';

declare global {
  interface JQueryStatic {
    search(selector: string, checkIframesIfEmpty?: boolean): JQuery;
    scrollToNode(element: string | Element | JQuery<Element>): void;
    from(selector: Nullishable<OneOrMany<string | JQuery>>): JQuery;
    from<T extends Element>(element: Nullishable<OneOrMany<T>>): JQuery<T>;
    isJQuery<T extends Element = HTMLElement>(value: unknown): value is JQuery<T>;
    /** Recognizes native Elements across realms, including documents without a window. */
    isElement(value: unknown): value is Element;
  }
}

$.isJQuery = function <T extends Element = HTMLElement>(value: unknown): value is JQuery<T> {
  return !!value && typeof value === 'object' && 'jquery' in value;
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

$.scrollToNode = function (element: string | Element | JQuery<Element>) {
  if (!element)
    return;

  let e: JQuery<Element>;
  if (element instanceof Element) {
    e = $(element);
  } else if (typeof element === "string") {
    e = $(element);
  } else if (element instanceof jQuery) {
    e = element;
  } else {
    throw "Not an element";
  }

  const node = e.get(0);
  if (!node) {
    console.log(e + '不存在');
    return;
  }

  // const rect = node.getOffset();
  const rect = node.getBoundingClientRect();
  console.log(rect);
  scroll(0, rect.top);
  // node.scrollIntoView(true);
};

function from<T extends Element>(element: Nullishable<OneOrMany<T>>): JQuery<T>;
function from(selector: Nullishable<OneOrMany<string | JQuery>>): JQuery;
function from<T extends Element>(items: Nullishable<OneOrMany<string | JQuery | T>>): JQuery | JQuery<T> {
  if (items == null) {
    return $<T>();
  }

  if (typeof items === 'string') {
    return $(items);
  }

  if ($.isJQuery<T>(items)) {
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
    } else if ($.isJQuery<T>(item)) {
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
