import type { Nullishable } from 'builtinx';

declare global {
  interface JQuery<TElement = HTMLElement> {
    isNot(selector: string): boolean;
    throwIfEmpty(): this;
    isEmpty(): boolean;
    isNotEmpty(): boolean;
    ifEmpty(selector: string): JQuery<TElement | HTMLElement>;
    where(predicate: (e: TElement, index: number) => Nullishable<boolean>): JQuery<TElement>;
    tap(action: (node: this) => void): this;
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

$.fn.ifEmpty = function <TElement>(this: JQuery<TElement>, selector: string): JQuery<TElement | HTMLElement> {
  return this.isEmpty() ? $(selector) : this;
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
