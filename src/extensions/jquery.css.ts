type StyledElement = Element & ElementCSSInlineStyle;

declare global {
  interface JQuery<TElement = HTMLElement> {
    pointer(this: this & JQuery<StyledElement>): this;
    underline(this: this & JQuery<StyledElement>): this;
    flex(this: this & JQuery<StyledElement>): this;
    flexWrap(this: this & JQuery<StyledElement>, value?: string): this;
    inlineBlock(this: this & JQuery<StyledElement>): this;
    inlineFlex(this: this & JQuery<StyledElement>): this;
    /** Sets a CSS property with !important. Use a CSS property name and an explicit CSS value, including units. */
    cssImportant(this: this & JQuery<StyledElement>, propertyName: string, value: string): this;
    /** Sets CSS unless value is undefined or an empty string. Does not catch errors. */
    cssIfNotEmpty(this: this & JQuery<StyledElement>, propertyName: string, value?: string): this;
    /** Adds classes unless the input is undefined or empty. Does not catch errors. */
    addClassIfNotEmpty(this: this & JQuery<Element>, classNames?: string | string[]): this;
    padding(this: this & JQuery<StyledElement>, value: string | number): this;
    color(this: this & JQuery<StyledElement>, value: string, important?: boolean): this;
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
  value: string,
) {
  if (typeof value !== 'string') {
    throw new TypeError('cssImportant requires a CSS string value with explicit units where needed.');
  }
  return this.each((i, e) => e.style.setProperty(propertyName, value, 'important'));
};

$.fn.cssIfNotEmpty = function <T extends JQuery<StyledElement>>(this: T, propertyName: string, value?: string) {
  if (value) {
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
