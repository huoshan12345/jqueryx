import type { Nullishable, OneOrMany } from 'builtinx';

declare global {
  interface JQueryStatic {
    /** Returns an empty collection for null or undefined. */
    from(value: null | undefined): JQuery;
    /** Returns a collection from the shared jQuery instance unchanged, including its identity. */
    from<T extends Node>(collection: JQuery<T>): JQuery<T>;
    /** Wraps Nodes or flattens an array-like group of Nodes/collections using jQuery.add ordering and deduplication. */
    from<T extends Node = HTMLElement>(elements: Nullishable<OneOrMany<T | JQuery<T>>>): JQuery<T>;
    /** Resolves selectors/HTML with jQuery, flattening array-like groups. Unsupported inputs or members throw TypeError. */
    from<T extends Node = HTMLElement>(selector: Nullishable<OneOrMany<string | JQuery<T>>>): JQuery<T>;
    /** Recognizes collections from the shared jQuery instance; does not validate their contents. */
    isJQuery(value: unknown): value is JQuery<unknown>;
  }
}

$.isJQuery = function (value: unknown): value is JQuery<unknown> {
  return value instanceof $;
};

function from(value: null | undefined): JQuery;
function from<T extends Node>(collection: JQuery<T>): JQuery<T>;
function from<T extends Node>(elements: Nullishable<OneOrMany<T | JQuery<T>>>): JQuery<T>;
function from<T extends Node>(selector: Nullishable<OneOrMany<string | JQuery<T>>>): JQuery<T>;
function from<T extends Node>(items: Nullishable<OneOrMany<string | JQuery | T>>): JQuery<unknown> {
  if (items == null) {
    return $<T>();
  }

  if (typeof items === 'string') {
    return $(items);
  }

  if ($.isJQuery(items)) {
    return items;
  }

  if (BuiltinX.isNode(items)) {
    return $(items);
  }

  if (Array.isArrayLike(items) === false) {
    const type = BuiltinX.getType(items);
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
    } else if (BuiltinX.isNode(item)) {
      result = result.add($(item) as any);
    } else {
      const type = BuiltinX.getType(item);
      console.log(type, item);
      throw new TypeError("Not an acceptable item type: " + type);
    }
  }

  return result;
}

$.from = from;
