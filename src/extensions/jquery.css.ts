declare global {
  interface JQuery {
    pointer(): JQuery;
    underline(): JQuery;
    flex(): JQuery;
    flexWrap(value?: string): JQuery;
    inlineBlock(): JQuery;
    inlineFlex(): JQuery;
    cssImp(propertyName: string, value: string | number): JQuery;
    tryCss(propertyName: string, value?: string): JQuery;
    tryAddClass(className?: string | string[]): JQuery;
    padding(value: string | number): JQuery;
    color(value: string, important?: boolean): JQuery;
    color(): string;
    colorHex(toUpperCase: boolean, defaultValue?: string | true): string;
  }
}

$.fn.pointer = function () {
  return this.css("cursor", "pointer");
};

$.fn.underline = function () {
  return this.css("text-decoration", "underline");
};

$.fn.flex = function () {
  return this.css("display", 'flex');
};

$.fn.inlineFlex = function () {
  return this.css("display", 'inline-flex');
};

$.fn.flexWrap = function (value: string = 'wrap') {
  return this.css("flex-wrap", value);
};

$.fn.inlineBlock = function () {
  return this.css("display", 'inline-block');
};

$.fn.cssImp = function (propertyName: string, value: string | number) {
  return this.each((i, e) => e.style.setProperty(propertyName, value.toString(), 'important'));
};

$.fn.tryCss = function (propertyName: string, value?: string) {
  if (value) {
    this.css(propertyName, value);
  }
  return this;
};

$.fn.tryAddClass = function (className?: string | string[]) {
  if (className) {
    this.addClass(className);
  }
  return this;
};

$.fn.padding = function (value: string | number) {
  return this.css('padding', value);
};

function color(this: JQuery): string;
function color(this: JQuery, value: string, important?: boolean): JQuery;
function color(this: JQuery, value?: string, important?: boolean): JQuery | string {
  if (value == null) {
    return this.css('color');
  } else {
    if (important) {
      return this.cssImp('color', value);
    } else {
      return this.css('color', value);
    }
  }
}
$.fn.color = color;

const regRgba = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d\.]+)?\)/i;
$.fn.colorHex = function (toUpperCase: boolean, defaultValue?: string | true): string {
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
};