declare global {
  interface JQuery<TElement = HTMLElement> {
    /** Reads descendant Text nodes, including template contents. */
    textContent(this: this & JQuery<Node>): string;
    /**
     * Merges each root's descendant text into its first Text node, preserving non-text nodes.
     * Inserts text at the start of an element or fragment that has no Text nodes.
     * HTML template roots store the inserted text in their content fragment.
     */
    textContent(this: this & JQuery<Node>, value: string): this;
    /** Concatenates direct child Text content across roots; Text roots contribute their own value. Empty returns "". */
    ownText(this: this & JQuery<Node>): string;
    /**
     * Sets direct text on Element and DocumentFragment roots, preserving other children.
     * Updates Text roots directly and skips all other node types.
     */
    ownText(this: this & JQuery<Node>, value: string): this;
    /** Removes sibling BRs and newline-only Text nodes immediately following descendant BRs; returns this. */
    collapseBrs(this: this & JQuery<Element>): this;
    /** True when nonempty and every root is Text containing only whitespace and at least one newline. */
    isNewLineTextNode(this: this & JQuery<Node>): boolean;
    /** Removes each root's leading BRs and newline-only Text nodes, stopping at any other child; returns this. */
    trimLeadingBrs(this: this & JQuery<Element>): this;
  }
}

function textContent(this: JQuery<Node>): string;
function textContent<T extends JQuery<Node>>(this: T, value: string): T;
function textContent<T extends JQuery<Node>>(this: T, value?: string): T | string {
  if (value == undefined) {
    const texts = this.textNodes();
    return texts
      .asEnumerable()
      .select(t => t.nodeValue ?? '')
      .joinWith('');
  }

  for (const item of this.enumerate()) {
    const texts = item.textNodes();
    if (texts.isEmpty()) {
      const root = item[0];
      const target = $.isElement(root)
        && root.namespaceURI === 'http://www.w3.org/1999/xhtml'
        && root.localName === 'template'
        ? (root as HTMLTemplateElement).content
        : root;
      if (target.nodeType === Node.ELEMENT_NODE || target.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
        const text = target.ownerDocument!.createTextNode(value);
        target.insertBefore(text, target.firstChild);
      }
      continue;
    }
    for (const { item: node, isFirst } of texts.asEnumerable().position()) {
      if (isFirst) {
        node.nodeValue = value;
      } else {
        node.remove();
      }
    }
  }
  return this;
}

$.fn.textContent = textContent;

function ownText(this: JQuery<Node>): string;
function ownText<T extends JQuery<Node>>(this: T, value: string): T;
function ownText<T extends JQuery<Node>>(this: T, value?: string): T | string {
  if (value == undefined) {
    const texts: string[] = [];
    for (const element of this) {
      texts.push(BuiltinX.Node.ownText(element));
    }
    return texts.join('');
  }

  for (const element of this) {
    if (element.nodeType === Node.TEXT_NODE) {
      element.nodeValue = value;
      continue;
    }

    if (element.nodeType !== Node.ELEMENT_NODE && element.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
      continue;
    }

    const toRemove = [];
    let set = false;
    for (const child of element.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        if (set) {
          toRemove.push(child);
        } else {
          child.nodeValue = value;
          set = true;
        }
      }
    }

    for (const child of toRemove) {
      child.remove();
    }

    if (set === false) {
      const textNode = document.createTextNode(value);
      element.insertBefore(textNode, element.firstChild);
    }
  }
  return this;
}

$.fn.ownText = ownText;

$.fn.collapseBrs = function <T extends JQuery<Element>>(this: T) {
  this.each((i, e) => { BuiltinX.Element.collapseBrs(e); });
  return this;
};

$.fn.isNewLineTextNode = function <T extends Node>(this: JQuery<T>): boolean {
  return this.isNotEmpty()
    && this.asEnumerable().all(m => BuiltinX.Node.isNewLineTextNode(m));
};

$.fn.trimLeadingBrs = function <T extends JQuery<Element>>(this: T) {
  this.each((i, e) => { BuiltinX.Element.trimLeadingBrs(e); });
  return this;
};
