import type { URLLike } from 'builtinx';

declare global {
  interface JQuery {
    title(): string | undefined;
    title(value: string): JQuery;
    requiredTitle(): string;
    targetBlank(onlyUpdate?: boolean): JQuery;
    textContent(): string;
    textContent(value: string): JQuery;
    requiredHref(): string;
    href(): string | undefined;
    href(value: URLLike): JQuery;
    voidHref(): JQuery;
    hasUrlHref(): boolean;
    disable(): JQuery;
    enable(): JQuery;
  }
}

function title(this: JQuery): string | undefined;
function title(this: JQuery, value: string): JQuery;
function title(this: JQuery, value?: string): JQuery | string | undefined {
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

$.fn.targetBlank = function (onlyUpdate: boolean = true) {
  const node = onlyUpdate
    ? this.filter((i, e) => e.getAttribute('target') != '_blank')
    : this;
  node.attr('target', '_blank');
  return this;
};

function textContent(this: JQuery): string;
function textContent(this: JQuery, value: string): JQuery;
function textContent(this: JQuery, value?: string): JQuery | string {
  const nodes = this
    .contents()
    .addBack() // 有可能自身是文本节点
    .filter((i, e) => e.nodeType === Node.TEXT_NODE);

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

function href(this: JQuery): string | undefined;
function href(this: JQuery, value: URLLike): JQuery;
function href(this: JQuery, value?: URLLike): JQuery | string | undefined {
  if (value == undefined) {
    return this.attr('href');
  } else {
    return this.attr('href', value.toString());
  }
}
$.fn.href = href;

$.fn.requiredHref = function (this: JQuery): string {
  return this.attr('href') || Error.throw("The element does not have href.");
};

$.fn.voidHref = function (): JQuery {
  return this.href("javascript:;");
};

$.fn.hasUrlHref = function () {
  const href = this.prop('href');
  return href && !href.startsWith('javascript:');
};

$.fn.disable = function () {
  return this.prop("disabled", true);
};

$.fn.enable = function () {
  return this.prop("disabled", false);
};
