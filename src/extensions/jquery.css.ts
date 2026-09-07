type StyledElement = Element & ElementCSSInlineStyle;
type CssValue<TElement> =
  | string
  | number
  | ((this: TElement, index: number, value: string) => string | number | void | undefined);

declare global {
  interface JQuery<TElement = HTMLElement> {
    /** Sets cursor: pointer on every element and returns this. */
    pointer(this: this & JQuery<StyledElement>): this;
    /** Sets text-decoration: underline on every element and returns this. */
    underline(this: this & JQuery<StyledElement>): this;
    /** Sets display: flex on every element and returns this. */
    flex(this: this & JQuery<StyledElement>): this;
    /** Sets flex-wrap on every element (default "wrap") and returns this. */
    flexWrap(this: this & JQuery<StyledElement>, value?: string): this;
    /** Sets display: inline-block on every element and returns this. */
    inlineBlock(this: this & JQuery<StyledElement>): this;
    /** Sets display: inline-flex on every element and returns this. */
    inlineFlex(this: this & JQuery<StyledElement>): this;
    /** Sets a CSS property with !important. Accepts numeric zero or a CSS string with units where needed. */
    cssImportant(this: this & JQuery<StyledElement>, propertyName: string, value: string | 0): this;
    /** Skips undefined and empty strings; otherwise forwards the value or callback to jQuery.css. */
    cssIfNotEmpty(this: this & JQuery<StyledElement>, propertyName: string, value?: CssValue<TElement>): this;
    /** Adds classes unless the input is undefined or empty. Does not catch errors. */
    addClassIfNotEmpty(this: this & JQuery<Element>, classNames?: string | string[]): this;
    /** Sets padding on every element via jQuery.css; numeric values use px. Returns this. */
    padding(this: this & JQuery<StyledElement>, value: string | number): this;
    /** Sets every color; important defaults to false. An empty string removes the inline color. Returns this. */
    color(this: this & JQuery<StyledElement>, value: string, important?: boolean): this;
    /** Reads the first computed color via jQuery.css; undefined for an empty collection. */
    color(this: this & JQuery<StyledElement>): string | undefined;
    /**
     * Converts the first element's computed rgb()/rgba() color to #rrggbb or
     * #rrggbbaa for non-opaque colors, rounding each component to one byte.
     * Empty collections and unsupported color formats return undefined.
     * @param uppercase Uses uppercase hex digits. Defaults to false.
     */
    colorHex(
      this: this & JQuery<StyledElement>,
      uppercase?: boolean,
    ): string | undefined;
    /** Returns whether any element matches jQuery :visible (has a layout box); false for an empty collection. */
    visible(this: this & JQuery<Element>): boolean;
    /** Shows or hides every element via jQuery.show/hide and returns this; does not override hidden ancestors. */
    visible(this: this & JQuery<Element>, value: boolean): this;
  }
}

$.fn.pointer = function <T extends JQuery<StyledElement>>(this: T) {
  return this.css("cursor", "pointer");
};

$.fn.underline = function <T extends JQuery<StyledElement>>(this: T) {
  return this.css("text-decoration", "underline");
};

$.fn.flex = function <T extends JQuery<StyledElement>>(this: T) {
  return this.css("display", 'flex');
};

$.fn.inlineFlex = function <T extends JQuery<StyledElement>>(this: T) {
  return this.css("display", 'inline-flex');
};

$.fn.flexWrap = function <T extends JQuery<StyledElement>>(this: T, value: string = 'wrap') {
  return this.css("flex-wrap", value);
};

$.fn.inlineBlock = function <T extends JQuery<StyledElement>>(this: T) {
  return this.css("display", 'inline-block');
};

$.fn.cssImportant = function <T extends JQuery<StyledElement>>(
  this: T,
  propertyName: string,
  value: string | 0,
) {
  return this.each((i, e) => e.style.setProperty(propertyName, String(value), 'important'));
};

$.fn.cssIfNotEmpty = function <T extends JQuery<StyledElement>>(
  this: T,
  propertyName: string,
  value?: CssValue<T[number]>,
) {
  if (value !== undefined && value !== '') {
    this.css(propertyName, value);
  }
  return this;
};

$.fn.addClassIfNotEmpty = function <T extends JQuery<Element>>(this: T, classNames?: string | string[]) {
  if (classNames?.length) {
    this.addClass(classNames);
  }
  return this;
};

$.fn.padding = function <T extends JQuery<StyledElement>>(this: T, value: string | number) {
  return this.css('padding', value);
};

function color(this: JQuery<StyledElement>): string | undefined;
function color<T extends JQuery<StyledElement>>(this: T, value: string, important?: boolean): T;
function color<T extends JQuery<StyledElement>>(
  this: T,
  value?: string,
  important?: boolean,
): T | string | undefined {
  if (value == null) {
    return this.css('color');
  } else {
    if (important) {
      return this.cssImportant('color', value);
    } else {
      return this.css('color', value);
    }
  }
}
$.fn.color = color;

// Computed sRGB colors use comma-separated rgb()/rgba() serialization.
const computedRgbPattern = /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*(?:,\s*(\d*\.?\d+)\s*)?\)$/i;

function colorHex(
  this: JQuery<StyledElement>,
  uppercase: boolean = false,
): string | undefined {
  const match = this.color()?.trim().match(computedRgbPattern);
  if (!match) {
    return undefined;
  }

  const channels = match.slice(1, 4).map(Number);
  const alpha = match[4] === undefined ? 1 : Number(match[4]);
  if (channels.some(channel => channel > 255) || alpha > 1) {
    return undefined;
  }
  if (alpha < 1) {
    channels.push(alpha * 255);
  }
  const hex = '#' + channels.map(channel => Math.round(channel).toString(16).padStart(2, '0')).join('');
  return uppercase ? hex.toUpperCase() : hex;
}
$.fn.colorHex = colorHex;

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
