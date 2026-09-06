import type { URLLike } from 'builtinx';

declare global {
  interface JQuery<TElement = HTMLElement> {
    /** Reads the first element's title attribute; undefined for a missing attribute or empty collection. */
    title(this: this & JQuery<Element>): string | undefined;
    /** Sets every title attribute, including empty strings, and returns this. */
    title(this: this & JQuery<Element>, value: string): this;
    /** Reads the first title attribute; throws Error if missing or empty. Does not trim whitespace. */
    requiredTitle(this: this & JQuery<Element>): string;
    /** Sets target="_blank" on every element; onlyUpdate defaults to true and skips already matching attributes. */
    targetBlank(this: this & JQuery<Element>, onlyUpdate?: boolean): this;
    /** Reads the first raw href attribute; throws Error if missing or empty. */
    requiredHref(this: this & JQuery<Element>): string;
    /** Reads the first raw href attribute without resolving relative URLs; undefined when missing or empty collection. */
    href(this: this & JQuery<Element>): string | undefined;
    /** Sets every href attribute to value.toString() and returns this. An empty string is retained. */
    href(this: this & JQuery<Element>, value: URLLike): this;
    /** Sets every href to "javascript:;" and returns this. */
    voidHref(this: this & JQuery<Element>): this;
    /** Tests the first raw href for a nonempty value not starting with lowercase "javascript:"; not URL validation. */
    hasUrlHref(this: this & JQuery<Element>): boolean;
    /** Sets the live disabled property to true for every selected element and returns this. */
    disable(this: this & JQuery<Element>): this;
    /** Sets the live disabled property to false for every selected element and returns this. */
    enable(this: this & JQuery<Element>): this;
    /** Returns whether any member matches jQuery :checked, including selected options; false when empty. */
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
