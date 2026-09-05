import type { URLLike } from 'builtinx';

declare global {
  interface JQuery<TElement = HTMLElement> {
    title(this: this & JQuery<Element>): string | undefined;
    title(this: this & JQuery<Element>, value: string): this;
    requiredTitle(this: this & JQuery<Element>): string;
    targetBlank(this: this & JQuery<Element>, onlyUpdate?: boolean): this;
    textContent(this: this & JQuery<Node>): string;
    textContent(this: this & JQuery<Node>, value: string): this;
    requiredHref(this: this & JQuery<Element>): string;
    href(this: this & JQuery<Element>): string | undefined;
    href(this: this & JQuery<Element>, value: URLLike): this;
    voidHref(this: this & JQuery<Element>): this;
    hasUrlHref(this: this & JQuery<Element>): boolean;
    disable(this: this & JQuery<Element>): this;
    enable(this: this & JQuery<Element>): this;
  }
}

function title(this: JQuery<Element>): string | undefined;
function title<T extends JQuery<Element>>(this: T, value: string): T;
function title<T extends JQuery<Element>>(this: T, value?: string): T | string | undefined {
  if (value == null) {
    return this.attr('title');
  } else {
    return this.attr('title', value);
  }
}
$.fn.title = title;

$.fn.requiredTitle = function (): string {
  return this.attr('title') || Error.throw("The element does not have title.");
};

$.fn.targetBlank = function <T extends JQuery<Element>>(this: T, onlyUpdate: boolean = true) {
  const node = onlyUpdate
    ? this.filter((i, e) => e.getAttribute('target') != '_blank')
    : this;
  node.attr('target', '_blank');
  return this;
};

function textContent(this: JQuery<Node>): string;
function textContent<T extends JQuery<Node>>(this: T, value: string): T;
function textContent<T extends JQuery<Node>>(this: T, value?: string): T | string {
  const nodes = this.textNodes(undefined, [], false)

  if (value == undefined) {
    return nodes.text();
  }

  if (nodes.isEmpty()) {
    return this.text(value);
  }

  for (const { item, isFirst } of nodes.asEnumerable().position()) {
    if (isFirst) {
      item.textContent = value;
    } else {
      item.remove();
    }
  }
  return this;
}

$.fn.textContent = textContent;

function href(this: JQuery<Element>): string | undefined;
function href<T extends JQuery<Element>>(this: T, value: URLLike): T;
function href<T extends JQuery<Element>>(this: T, value?: URLLike): T | string | undefined {
  if (value == undefined) {
    return this.attr('href');
  } else {
    return this.attr('href', value.toString());
  }
}
$.fn.href = href;

$.fn.requiredHref = function (): string {
  return this.attr('href') || Error.throw("The element does not have href.");
};

$.fn.voidHref = function <T extends JQuery<Element>>(this: T) {
  return this.href("javascript:;");
};

$.fn.hasUrlHref = function () {
  const href = this.prop('href');
  return href && !href.startsWith('javascript:');
};

$.fn.disable = function <T extends JQuery<Element>>(this: T) {
  return this.prop("disabled", true);
};

$.fn.enable = function <T extends JQuery<Element>>(this: T) {
  return this.prop("disabled", false);
};
