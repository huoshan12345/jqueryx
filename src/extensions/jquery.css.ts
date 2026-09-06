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
    tryCss(this: this & JQuery<StyledElement>, propertyName: string, value?: string): this;
    tryAddClass(this: this & JQuery<Element>, className?: string | string[]): this;
    padding(this: this & JQuery<StyledElement>, value: string | number): this;
    color(this: this & JQuery<StyledElement>, value: string, important?: boolean): this;
    color(this: this & JQuery<StyledElement>): string | undefined;
    colorHex(
      this: this & JQuery<StyledElement>,
      toUpperCase: boolean,
      defaultValue?: string,
    ): string;
    colorHex(
      this: this & JQuery<StyledElement>,
      toUpperCase: boolean,
      defaultValue: string | true | undefined,
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

$.fn.tryCss = function <T extends JQuery<StyledElement>>(this: T, propertyName: string, value?: string) {
  if (value) {
    this.css(propertyName, value);
  }
  return this;
};

$.fn.tryAddClass = function <T extends JQuery<Element>>(this: T, className?: string | string[]) {
  if (className) {
    this.addClass(className);
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

const regRgba = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d\.]+)?\)/i;
function colorHex(this: JQuery<StyledElement>, toUpperCase: boolean, defaultValue?: string): string;
function colorHex(
  this: JQuery<StyledElement>,
  toUpperCase: boolean,
  defaultValue?: string | true,
): string | undefined;
function colorHex(
  this: JQuery<StyledElement>,
  toUpperCase: boolean,
  defaultValue?: string | true,
): string | undefined {
  const color = this.color();
  const match = color?.match(regRgba);
  if (!match) {
    if (defaultValue === true) {
      return color;
    }
    return defaultValue ?? Error.throw(`Cannot convert color '${color}' to hex.`);
  }

  const r = parseInt(match[1], 10);
  const g = parseInt(match[2], 10);
  const b = parseInt(match[3], 10);
  return BuiltinX.Color.rgbToHex(r, g, b, toUpperCase);
}
$.fn.colorHex = colorHex;
