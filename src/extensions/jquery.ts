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
    textNodes(
      this: this & JQuery<Node>,
      selector?: string,
      skipTags?: string[],
      skipAnchor?: boolean,
    ): JQuery<Text>;
    visible(this: this & JQuery<Element>): boolean;
    visible(this: this & JQuery<Element>, value: boolean): this;
    checked(): boolean;
    entries(): IterableIterator<[number, TElement]>;
    asEnumerable(): Enumerable.IEnumerable<TElement>;
    replaceBy<TReplacement extends Element>(
      this: this & JQuery<Element>,
      replacement: (node: this) => JQuery<TReplacement>,
    ): JQuery<TReplacement>;
    ifEmpty(selector: string): JQuery<TElement | HTMLElement>;
    where(predicate: (e: TElement, index: number) => Nullishable<boolean>): JQuery<TElement>;
    search(this: this & JQuery<Node>, selector: string, checkIframesIfEmpty?: boolean): JQuery;
    enumerate(): Enumerable.IEnumerable<JQuery<TElement>>;
    ownText(this: this & JQuery<Node>): string;
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

$.fn.textNodes = function (selector?: string, skipTags?: string[], skipAnchor: boolean = true): JQuery<Text> {
  skipTags ??= [
    'a',
    'button',
    'input',
    'iframe',
  ];

  if (skipAnchor === false) {
    skipTags.remove('a');
  }

  const queue = new Queue<Node>();
  for (const element of this) {
    queue.enqueue(element);
  }

  let result = $() as JQuery<Text>;
  while (queue.isNotEmpty()) {
    const node = queue.dequeue();
    const jquery = $(node);

    if (selector && jquery.isNot(selector)) {
      continue;
    }

    if (skipTags.some(m => jquery.is(m))) {
      continue;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      result = result.add(node as Text);
    }

    for (const node of jquery.contents()) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        queue.enqueue(node);
      } else if (node.nodeType === Node.TEXT_NODE) {
        result = result.add(node as Text);
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
  const e = enumerate(this);
  return Enumerable.from(e);
};

$.fn.replaceBy = function <T extends JQuery<Element>, TReplacement extends Element>(
  this: T,
  replacement: (node: T) => JQuery<TReplacement>,
) {
  let newNodes = replacement(this);
  if (Object.is(newNodes, this)) {
    newNodes = newNodes.clone();

    for (let i = 0; i < this.length; i++) {
      const newNode = newNodes[i];
      const oldNode = this[i];
      oldNode.after(newNode);
    }

  } else {
    this.after(newNodes);
  }
  this.remove();
  return newNodes;
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
      texts.push(element.ownText());
    }
    return texts.join('');
  }

  for (const element of this) {
    if (element.nodeType === Node.TEXT_NODE) {
      element.nodeValue = value;
      continue;
    }

    let set = false;
    for (const child of element.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        if (set) {
          child.remove();
        } else {
          child.nodeValue = value;
          set = true;
        }
      }
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
  this.each((i, e) => { e.collapseBrs(); });
  return this;
};

$.fn.isNewLineTextNode = function <T extends Node>(this: JQuery<T>): boolean {
  return this.asEnumerable().all(m => m.isNewLineTextNode());
};

$.fn.trimLeadingBrs = function <T extends JQuery<Element>>(this: T) {
  this.each((i, e) => { e.trimLeadingBrs(); });
  return this;
};
