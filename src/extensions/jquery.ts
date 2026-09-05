import type { JQueryMutationCallback } from '@/types/lib';
import { Enumerable } from 'linqx';
import type { HTMLNode, MatchPattern, MutationObserverOptionsInit, Nullishable } from 'builtinx';
import { Queue } from 'builtinx';

declare global {
  interface JQuery {
    isNot(selector: string): boolean;
    throwIfEmpty(): JQuery;
    isEmpty(): boolean;
    isNotEmpty(): boolean;
    ancestor(selector: string, outermost?: boolean, includeSelf?: boolean): JQuery;
    textNodes(selector?: string, skipTags?: string[], skipAnchor?: boolean): JQuery<HTMLNode>;
    visible(): boolean;
    visible(value: boolean): JQuery;
    checked(): boolean;
    entries(): IterableIterator<[number, HTMLElement]>;
    onNodeExists(selector: string, func: (node: JQuery) => void, maxCount?: number): void;
    observe(callback: JQueryMutationCallback, options?: Partial<MutationObserverOptionsInit>): JQuery;
    asEnumerable(): Enumerable.IEnumerable<HTMLElement>;
    replaceBy(replacement: (node: JQuery) => JQuery): JQuery;
    ifEmpty(selector: string): JQuery;
    where(predicate: (e: HTMLElement, index: number) => Nullishable<boolean>): JQuery;
    search(selector: string, checkIframesIfEmpty?: boolean): JQuery;
    enumerate(): Enumerable.IEnumerable<JQuery>;
    ownText(): string;
    ownText(value: string): JQuery;
    tap(action: (node: JQuery) => void): JQuery;
    tapIf(condition: (node: JQuery) => boolean, action: (node: JQuery) => void): JQuery;
    collapseBrs(): JQuery;
    refineUrls(hosts: MatchPattern[], baseUrl: URL, pathRewrite?: (path: string) => string): JQuery;
    isNewLineTextNode<T extends Node>(this: JQuery<T>): boolean;
    trimLeadingBrs(): JQuery;
  }
}

$.fn.throwIfEmpty = function (): JQuery {
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

$.fn.ancestor = function (selector: string, outermost = false, includeSelf = false): JQuery {
  let result = $();
  this.each((i, e) => {
    const p = findAncestor(e, outermost, includeSelf);
    result = result.add(p);
  });
  return result;

  function findAncestor(e: HTMLElement, outermost: boolean, includeSelf: boolean) {
    const node = $(e);
    let p = includeSelf
      ? node
      : node.parent();

    let result = $();
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

$.fn.textNodes = function (selector?: string, skipTags?: string[], skipAnchor: boolean = true): JQuery<HTMLNode> {
  skipTags ??= [
    'a',
    'button',
    'input',
    'iframe',
  ];

  if (skipAnchor === false) {
    skipTags.remove('a');
  }

  const queue = new Queue<HTMLElement>();
  for (const element of this) {
    queue.enqueue(element);
  }

  let result = $() as JQuery<HTMLNode>;
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
      result = result.add(node);
    }

    for (const node of jquery.contents()) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        queue.enqueue(node as HTMLElement);
      } else if (node.nodeType === Node.TEXT_NODE) {
        result = result.add(node);
      }
    }
  }

  return result;
};

function visible(this: JQuery): boolean;
function visible(this: JQuery, value: boolean): JQuery;
function visible(this: JQuery, value?: boolean): JQuery | boolean {
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

function onNodeExists(jq: JQuery, selector: string, func: (node: JQuery) => void, maxCount: number, count: number) {
  // console.log(`selector: ${selector}, maxCount: ${maxCount}, count: ${count}`);

  if (count >= maxCount)
    return;

  let node = jq.find(selector);
  let iframes = jq.find('iframe');
  node = node.add(iframes.contents().find(selector));

  if (node.isNotEmpty()) {
    func(node);
  } else {
    setTimeout(() => onNodeExists(jq, selector, func, maxCount, count + 1), 500);
  }
};

$.fn.onNodeExists = function (selector: string, func: (node: JQuery) => void, maxCount: number) {
  return onNodeExists(this, selector, func, maxCount, 0);
};

$.fn.observe = function (callback: JQueryMutationCallback, options?: Partial<MutationObserverOptionsInit>) {
  const jQuery = this;
  // 对于iframe里面的元素Node有自己的prototype, 所以这里用apply的方式调用
  this.each((i, e) => { Node.prototype.observe.apply(e, [(m, n, _) => callback(m, n, jQuery), options]); });
  return jQuery;
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

$.fn.replaceBy = function (replacement: (node: JQuery) => JQuery) {
  let newNodes = replacement(this);
  if (newNodes === this) {
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

$.fn.ifEmpty = function (selector: string) {
  return this.isEmpty() ? $(selector) : this;
};

$.fn.where = function (predicate: (e: HTMLElement, index: number) => Nullishable<boolean>) {
  return this.filter((i, e) => predicate(e, i) === true);
};

$.fn.search = function (selector: string, checkIframesIfEmpty: boolean = true): JQuery {
  let result = this.find(selector);
  if (result.isEmpty() && checkIframesIfEmpty) {
    result = this.find('iframe').contents().find(selector);
  }
  return result;
};

$.fn.enumerate = function () {
  return this.asEnumerable().select(e => $(e));
};

function ownText(this: JQuery): string;
function ownText(this: JQuery, value: string): JQuery;
function ownText(this: JQuery, value?: string): JQuery | string {
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

$.fn.tap = function (action: (node: JQuery) => void) {
  action(this);
  return this;
};

$.fn.tapIf = function (condition: (node: JQuery) => boolean, action: (node: JQuery) => void) {
  if (condition(this)) {
    action(this);
  }
  return this;
};

$.fn.collapseBrs = function () {
  this.each((i, e) => { e.collapseBrs(); });
  return this;
};

$.fn.refineUrls = function (hosts: MatchPattern[], baseUrl: URL, pathRewrite?: (path: string) => string) {
  const nodes = this;

  const images: JQuery[] = [];
  for (const e of nodes) {
    const node = $(e);

    let attrName: string;
    switch (e.tagName) {
      case 'A':
        attrName = 'href';
        break;
      case 'IMG':
        attrName = 'src';
        images.push(node);
        break;
      default:
        console.styled('unsupported tag: ', { text: e.tagName, color: 'blue' });
        continue;
    }

    const src = node.attr(attrName);

    if (!src)
      continue;

    if (!src.startsWith("http")) // 本站链接
      continue;

    let u: URL;
    try {
      u = new URL(src);
    } catch (e) {
      console.log('invalid url: ', src);
      continue;
    }

    if (u.host === baseUrl.host) // 本站链接
      continue;

    if (hosts.matchesAny(u.host) === false)
      continue;

    if (pathRewrite) {
      u.pathname = pathRewrite(u.pathname);
    }

    // 同站链接
    u.protocol = baseUrl.protocol;
    u.hostname = baseUrl.hostname;
    u.port = baseUrl.port;

    const newSrc = u.toString();
    node.attr(attrName, newSrc);

    const text = node.text();
    if (!text)
      continue;

    const newText = text.replace(src, newSrc);
    if (text === newText)
      continue;

    node.text(newText);
  }

  for (const node of images) {
    const src = node.attr('src');
    if (!src)
      continue;

    const link = $('<a>')
      .css("display", "block")
      .attr('rel', 'noreferrer')
      .attr('href', src)
      .attr('target', '_blank')
      .text(src)
      .insertAfter(node);

    const image = node[0] as HTMLImageElement;
    // img.complete can be true even if the image url is “broken".
    // So need check that ".naturalHeight attribute is greater than 0"
    if (image.complete && image.naturalHeight > 0) {
      link.hide();
    } else {
      // onload doesn't fire if the image is being loaded from cache.
      node.on('load', () => link.hide());
    }
  }

  return this;
};

$.fn.isNewLineTextNode = function <T extends Node>(this: JQuery<T>): boolean {
  return this.asEnumerable().all(m => m.isNewLineTextNode());
};

$.fn.trimLeadingBrs = function () {
  this.each((i, e) => { e.trimLeadingBrs(); });
  return this;
};
