import { Stack } from 'builtinx';

declare global {
  interface JQuery<TElement = HTMLElement> {
    /**
     * Collects unique Text nodes in document order using subtree pruning.
     * Includes Text roots and template contents, but does not enter iframe documents.
     * To traverse an iframe document, supply that document as a root explicitly.
     * @param traverseSelector Only traverse matching elements, including roots;
     * non-matching elements prune their entire subtree. Omit to traverse all elements.
     * Text, Document and DocumentFragment roots are not matched against this selector.
     * @param excludeSelectors Excludes matching elements and their entire subtrees,
     * including roots. Accepts jQuery selectors; defaults to []. The array is never modified.
     */
    textNodes(
      this: this & JQuery<Node>,
      traverseSelector?: string,
      excludeSelectors?: readonly string[],
    ): JQuery<Text>;
  }
}

$.fn.textNodes = function (
  traverseSelector?: string,
  excludeSelectors: readonly string[] = [],
): JQuery<Text> {
  const stack = new Stack<Node>();
  for (const root of this.asEnumerable().reverse()) {
    stack.push(root);
  }

  const visited = new Set<Node>();
  let nodes: Text[] = [];
  while (stack.isNotEmpty()) {
    const node = stack.pop();
    if (visited.has(node)) {
      continue;
    }
    visited.add(node);

    if (node.nodeType === Node.TEXT_NODE) {
      nodes.push(node as Text);
      continue;
    }

    const wrappedNode = $(node);
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (traverseSelector && !wrappedNode.is(traverseSelector)) {
        continue;
      }
      if (excludeSelectors.some(selector => wrappedNode.is(selector))) {
        continue;
      }
    }

    for (const child of wrappedNode.contents().asEnumerable().reverse()) {
      if (child.nodeType === Node.ELEMENT_NODE || child.nodeType === Node.TEXT_NODE) {
        stack.push(child);
      }
    }
  }

  return $.from(nodes);
};
