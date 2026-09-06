import { Enumerable } from 'linqx';
import type { Nullishable } from 'builtinx';
import { Queue } from 'builtinx';

declare global {
  interface JQuery<TElement = HTMLElement> {
    isNot(selector: string): boolean;
    throwIfEmpty(): this;
    isEmpty(): boolean;
    isNotEmpty(): boolean;
    ancestor(
      this: this & JQuery<Element>,
      selector: string,
      outermost?: boolean,
      includeSelf?: boolean,
    ): JQuery<Element>;
    /**
     * Collects unique Text nodes in document order using subtree pruning.
     * Includes Text roots and template contents, but does not enter iframe documents.
     * To traverse an iframe document, supply that document as a root explicitly.
     * @param traverseSelector Only traverse matching elements, including roots;
     * non-matching elements prune their entire subtree. Omit to traverse all elements.
     * Text, Document and DocumentFragment roots are not matched against this selector.
     * @param excludeSelectors Excludes matching elements and their entire subtrees,
     * including roots. Accepts jQuery selectors; defaults to []. The array is never modified.
     */
    textNodes(
      this: this & JQuery<Node>,
      traverseSelector?: string,
      excludeSelectors?: readonly string[],
    ): JQuery<Text>;
    visible(this: this & JQuery<Element>): boolean;
    visible(this: this & JQuery<Element>, value: boolean): this;
    checked(): boolean;
    entries(): IterableIterator<[number, TElement]>;
    asEnumerable(): Enumerable.IEnumerable<TElement>;
    /**
     * Replaces each element separately, returning all replacements in callback order.
     * Return the current element to keep it, or an empty collection to delete it.
     * Reused replacement nodes are cloned with jQuery events and data.
     * Earlier replacements remain if a later callback fails.
     */
    replaceBy<TReplacement extends Element>(
      this: this & JQuery<Element>,
      replacement: (node: JQuery<TElement>, index: number) => JQuery<TReplacement>,
    ): JQuery<TReplacement>;
    ifEmpty(selector: string): JQuery<TElement | HTMLElement>;
    where(predicate: (e: TElement, index: number) => Nullishable<boolean>): JQuery<TElement>;
    search(this: this & JQuery<Node>, selector: string, checkIframesIfEmpty?: boolean): JQuery;
    enumerate(): Enumerable.IEnumerable<JQuery<TElement>>;
    ownText(this: this & JQuery<Node>): string;
    /**
     * Sets direct text on Element and DocumentFragment roots, preserving other children.
     * Updates Text roots directly and skips all other node types.
     */
    ownText(this: this & JQuery<Node>, value: string): this;
    tap(action: (node: this) => void): this;
    tapIf(condition: (node: this) => boolean, action: (node: this) => void): this;
    collapseBrs(this: this & JQuery<Element>): this;
    isNewLineTextNode(this: this & JQuery<Node>): boolean;
    trimLeadingBrs(this: this & JQuery<Element>): this;
  }
}

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

$.fn.isNot = function (selector: string): boolean {
  return this.is(selector) === false;
};

$.fn.textNodes = function (
  traverseSelector?: string,
  excludeSelectors: readonly string[] = [],
): JQuery<Text> {
  const queue = new Queue<Node>();
  for (const root of this) {
    queue.enqueue(root);
  }

  const visited = new Set<Node>();
  let result = $<Text>();
  while (queue.isNotEmpty()) {
    const node = queue.dequeue();
    if (visited.has(node)) {
      continue;
    }
    visited.add(node);

    if (node.nodeType === Node.TEXT_NODE) {
      result = result.add(node as Text);
      continue;
    }

    const wrappedNode = $(node);
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (traverseSelector && !wrappedNode.is(traverseSelector)) {
        continue;
      }
      if (excludeSelectors.some(selector => wrappedNode.is(selector))) {
        continue;
      }
    }

    for (const child of wrappedNode.contents()) {
      if (child.nodeType === Node.ELEMENT_NODE || child.nodeType === Node.TEXT_NODE) {
        queue.enqueue(child);
      }
    }
  }

  return result;
};

function visible(this: JQuery<Element>): boolean;
function visible<T extends JQuery<Element>>(this: T, value: boolean): T;
function visible<T extends JQuery<Element>>(this: T, value?: boolean): T | boolean {
  if (value == undefined) {
    return this.is(":visible");
  } else if (value) {
    return this.show();
  } else {
    return this.hide();
  }
}
$.fn.visible = visible;

$.fn.checked = function (): boolean {
  return this.is(":checked");
};

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

$.fn.asEnumerable = function <TElement = HTMLElement>(this: JQuery<TElement>): Enumerable.IEnumerable<TElement> {
  return Enumerable.from(() => enumerate(this));
};

$.fn.replaceBy = function <TElement extends Element, TReplacement extends Element>(
  this: JQuery<TElement>,
  replacement: (node: JQuery<TElement>, index: number) => JQuery<TReplacement>,
): JQuery<TReplacement> {
  const sources = this.toArray();
  const sourceSet = new Set<Element>(sources);
  const used = new Set<Element>();
  const results: TReplacement[] = [];

  for (const [index, source] of sources.entries()) {
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

$.fn.ifEmpty = function <TElement>(this: JQuery<TElement>, selector: string): JQuery<TElement | HTMLElement> {
  return this.isEmpty() ? $(selector) : this;
};

$.fn.where = function <TElement>(
  this: JQuery<TElement>,
  predicate: (e: TElement, index: number) => Nullishable<boolean>,
) {
  return this.filter((i, e) => predicate(e, i) === true);
};

$.fn.search = function (selector: string, checkIframesIfEmpty: boolean = true): JQuery {
  let result = this.find(selector);
  if (result.isEmpty() && checkIframesIfEmpty) {
    result = this.find('iframe').contents().find(selector);
  }
  return result;
};

$.fn.enumerate = function <TElement>(this: JQuery<TElement>) {
  // jQuery's factory has no overload for an unconstrained collection value.
  return this.asEnumerable().select(e => $(e as TElement & JQuery.PlainObject));
};

function ownText(this: JQuery<Node>): string;
function ownText<T extends JQuery<Node>>(this: T, value: string): T;
function ownText<T extends JQuery<Node>>(this: T, value?: string): T | string {
  if (value == undefined) {
    const texts: string[] = [];
    for (const element of this) {
      texts.push(BuiltinX.Node.ownText(element));
    }
    return texts.join('');
  }

  for (const element of this) {
    if (element.nodeType === Node.TEXT_NODE) {
      element.nodeValue = value;
      continue;
    }

    if (element.nodeType !== Node.ELEMENT_NODE && element.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
      continue;
    }

    const toRemove = [];
    let set = false;
    for (const child of element.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        if (set) {
          toRemove.push(child);
        } else {
          child.nodeValue = value;
          set = true;
        }
      }
    }

    for (const child of toRemove) {
      child.remove();
    }

    if (set === false) {
      const textNode = document.createTextNode(value);
      element.insertBefore(textNode, element.firstChild);
    }
  }
  return this;
}

$.fn.ownText = ownText;

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

$.fn.collapseBrs = function <T extends JQuery<Element>>(this: T) {
  this.each((i, e) => { BuiltinX.Element.collapseBrs(e); });
  return this;
};

$.fn.isNewLineTextNode = function <T extends Node>(this: JQuery<T>): boolean {
  return this.asEnumerable().all(m => BuiltinX.Node.isNewLineTextNode(m));
};

$.fn.trimLeadingBrs = function <T extends JQuery<Element>>(this: T) {
  this.each((i, e) => { BuiltinX.Element.trimLeadingBrs(e); });
  return this;
};
