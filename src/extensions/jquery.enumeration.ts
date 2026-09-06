import { Enumerable } from 'linqx';

declare global {
  interface JQuery<TElement = HTMLElement> {
    entries(): IterableIterator<[number, TElement]>;
    asEnumerable(): Enumerable.IEnumerable<TElement>;
    enumerate(): Enumerable.IEnumerable<JQuery<TElement>>;
  }
}

$.fn.entries = function* () {
  let index = 0;
  for (const value of this) {
    yield [index, value];
    index++;
  }
};

function* enumerate<T>(j: JQuery<T>) {
  for (const value of j) {
    yield value;
  }
}

$.fn.asEnumerable = function <TElement>(this: JQuery<TElement>): Enumerable.IEnumerable<TElement> {
  return Enumerable.from(() => enumerate(this));
};

$.fn.enumerate = function <TElement>(this: JQuery<TElement>): Enumerable.IEnumerable<JQuery<TElement>> {
  // jQuery's factory has no overload for an unconstrained collection value.
  return this.asEnumerable().select(e => $(e as TElement & JQuery.PlainObject));
};
