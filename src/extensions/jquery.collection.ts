import type { Nullishable } from 'builtinx';

declare global {
  interface JQuery<TElement = HTMLElement> {
    /** Returns true when no member matches the jQuery selector; true for an empty collection. */
    isNot(selector: string): boolean;
    /** Returns this collection, or throws Error when it has no members. */
    throwIfEmpty(): this;
    /** Returns whether the collection has zero members. */
    isEmpty(): boolean;
    /** Returns whether the collection has at least one member. */
    isNotEmpty(): boolean;
    /** Returns this nonempty collection; otherwise evaluates $(selector) as the fallback. */
    ifEmpty<K extends keyof HTMLElementTagNameMap>(selector: K): JQuery<TElement | HTMLElementTagNameMap[K]>;
    /** Returns this nonempty collection, or the SVG elements matching the fallback tag name. */
    ifEmpty<K extends keyof SVGElementTagNameMap>(selector: K): JQuery<TElement | SVGElementTagNameMap[K]>;
    /** Returns this nonempty collection, or selector matches; an explicit TFallback must describe those matches. */
    ifEmpty<TFallback extends Element = HTMLElement>(selector: string): JQuery<TElement | TFallback>;
    /** Filters by (element, originalIndex), retaining only literal true results. Nullish results are false. */
    where(predicate: (e: TElement, index: number) => Nullishable<boolean>): JQuery<TElement>;
    /** Calls action once with the entire collection, even when empty, and returns this. Errors propagate. */
    tap(action: (node: this) => void): this;
    /** Evaluates condition once with this collection, calls action if true, and returns this. Errors propagate. */
    tapIf(condition: (node: this) => boolean, action: (node: this) => void): this;
  }
}

$.fn.isNot = function (selector: string): boolean {
  return this.is(selector) === false;
};

$.fn.throwIfEmpty = function () {
  if (this.isEmpty()) {
    Error.throw('The set is empty');
  }
  return this;
};

$.fn.isEmpty = function (): boolean {
  return this.length === 0;
};

$.fn.isNotEmpty = function (): boolean {
  return this.length !== 0;
};

$.fn.ifEmpty = function <TElement, TFallback extends Element = HTMLElement>(
  this: JQuery<TElement>,
  selector: string,
): JQuery<TElement | TFallback> {
  return this.isEmpty() ? $<TFallback>(selector) : this;
};

$.fn.where = function <TElement>(
  this: JQuery<TElement>,
  predicate: (e: TElement, index: number) => Nullishable<boolean>,
) {
  return this.filter((i, e) => predicate(e, i) === true);
};

$.fn.tap = function (action) {
  action(this);
  return this;
};

$.fn.tapIf = function (condition, action) {
  if (condition(this)) {
    action(this);
  }
  return this;
};
