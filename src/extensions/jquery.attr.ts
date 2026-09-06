import type { URLLike } from 'builtinx';

declare global {
  interface JQuery<TElement = HTMLElement> {
    title(this: this & JQuery<Element>): string | undefined;
    title(this: this & JQuery<Element>, value: string): this;
    requiredTitle(this: this & JQuery<Element>): string;
    targetBlank(this: this & JQuery<Element>, onlyUpdate?: boolean): this;
    requiredHref(this: this & JQuery<Element>): string;
    href(this: this & JQuery<Element>): string | undefined;
    href(this: this & JQuery<Element>, value: URLLike): this;
    voidHref(this: this & JQuery<Element>): this;
    hasUrlHref(this: this & JQuery<Element>): boolean;
    disable(this: this & JQuery<Element>): this;
    enable(this: this & JQuery<Element>): this;
    checked(): boolean;
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

$.fn.hasUrlHref = function (): boolean {
  const href = this.attr('href');
  return !!href && !href.startsWith('javascript:');
};

$.fn.disable = function <T extends JQuery<Element>>(this: T) {
  return this.prop("disabled", true);
};

$.fn.enable = function <T extends JQuery<Element>>(this: T) {
  return this.prop("disabled", false);
};

$.fn.checked = function (): boolean {
  return this.is(":checked");
};
