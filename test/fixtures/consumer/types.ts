import 'jqueryx';
import { ClickOptions } from 'jqueryx';
import type { Enumerable } from 'linqx';
import 'linqx/extensions';
import type { MutationObserverOptionsInit } from 'builtinx';
import type { WaitForNodesOptions, RefineUrlsOptions } from 'jqueryx';

const buttons: JQuery<HTMLButtonElement> = $('button');
const sameButtons: JQuery<HTMLButtonElement> = jQuery('button');
const empty: boolean = buttons.isEmpty();
const title: string | undefined = sameButtons.title();
buttons.title('ready').onClick(target => {
  // @ts-expect-error The event origin may be an SVG node, not an HTMLElement.
  target.click();
  if (target instanceof HTMLElement) {
    target.focus();
  }
});
buttons.onClick((target, originalEvent) => {
  const origin: EventTarget = target;
  // @ts-expect-error A click handler must not assume an HTML event origin.
  const htmlOrigin: HTMLElement = target;
  const nativeEvent: MouseEvent | undefined = originalEvent;
  void [origin, htmlOrigin, nativeEvent];
}, new ClickOptions({ preventDefault: false }));
const collectedTexts: JQuery<Text> = buttons.textNodes('button, span', ['.ignore'] as const);
buttons.textNodes(undefined, ['a']);
// @ts-expect-error Text traversal only accepts DOM nodes.
$({ value: 1 }).textNodes();
// @ts-expect-error The redundant skipAnchor argument has been removed.
buttons.textNodes('button', [], false);
// @ts-expect-error Traversal arguments are passed directly.
buttons.textNodes({ traverseSelector: 'button' });
void collectedTexts;
buttons.onClick(() => buttons.addClass('clicked'), {
  onError: error => String(error),
});
buttons.onKeyDown((target, key) => {
  // @ts-expect-error The event origin need not implement HTMLElement.click().
  target.click();
  if ($.isElement(target)) {
    target.setAttribute('data-key', key);
  }
}, {
  onError: async error => String(error),
});
buttons.onEnterDown(target => {
  // @ts-expect-error The event origin need not implement HTMLElement.focus().
  target.focus();
}, {
  onError: error => String(error),
});

const sequence: Enumerable.IEnumerable<HTMLButtonElement> = buttons.asEnumerable();
const arraySequence: Enumerable.IEnumerable<number> = [1, 2].asEnumerable();
const mapSequence: Enumerable.IEnumerable<[string, number]> = new Map<string, number>().asEnumerable();
const nodeSequence: Enumerable.IEnumerable<Node> = document.body.childNodes.asEnumerable();
// @ts-expect-error Published linqx extensions must preserve their element types.
const invalidSequence: Enumerable.IEnumerable<string> = [1, 2].asEnumerable();
void [arraySequence, mapSequence, nodeSequence, invalidSequence];
const wrapped: Enumerable.IEnumerable<JQuery<HTMLButtonElement>> = buttons.enumerate();
const observerOptions: MutationObserverOptionsInit = { callOnStart: false, debounce: false };
buttons.observe(() => {}, observerOptions);

// The global factory must retain jQuery's base types, not just jqueryx's augmentation.
// @ts-expect-error A button is not an input element.
const inputs: JQuery<HTMLInputElement> = buttons;

void [empty, title, inputs, sequence, wrapped];

buttons.title('ready').href('/').targetBlank().voidHref().disable().enable()[0].disabled = true;
buttons.pointer().underline().flex().flexWrap().inlineBlock().inlineFlex()
  .cssImportant('color', 'red').cssIfNotEmpty('color', 'red').addClassIfNotEmpty('ready')
  .padding(1).color('red').visible(true)[0].disabled = true;
buttons.textContent('ready').ownText('ready').throwIfEmpty()
  .collapseBrs().trimLeadingBrs().refineUrls([], new URL('https://example.com'))[0].disabled = true;
buttons.onClick(() => {}).onKeyDown(() => {}).onEnterDown(() => {})
  .onClickGotoHref().triggerClick().triggerChange().dispatchEvent(new Event('change'))[0].disabled = true;
buttons.tap(nodes => nodes[0].disabled = true)
  .tapIf(nodes => nodes[0].disabled, nodes => nodes[0].disabled = false)[0].disabled = true;
buttons.where(button => button.disabled)[0].disabled = false;
for (const [, button] of buttons.entries()) {
  button.disabled = true;
}
const replacement: JQuery<HTMLInputElement> = buttons.replaceBy((nodes, index) => {
  const position: number = index;
  nodes[0].disabled = true;
  void position;
  return $(document.createElement('input'));
});
buttons.cssImportant('padding', '20px');
// @ts-expect-error CSS values must include their units explicitly where needed.
buttons.cssImportant('padding', 20);
// @ts-expect-error The abbreviated method was renamed.
buttons.cssImp('color', 'red');
$.scrollToNode(buttons, { behavior: 'smooth', block: 'center' });
$.scrollToNode(document.createElement('button'));
$.scrollToNode('button');
buttons.observe((records, observer, nodes) => nodes[0].disabled = true).disconnect();

const svg = $(document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
const svgNodes: SVGSVGElement[] = svg.asEnumerable().toArray();
svg.cssImportant('fill', 'red').title('svg')[0].viewBox;
// @ts-expect-error SVG elements are not HTML elements.
const htmlNodes: HTMLElement[] = svg.asEnumerable().toArray();
// @ts-expect-error SVG elements do not have HTMLElement.click().
svg.triggerClick();

const text = $(document.createTextNode('text'));
for (const [, node] of text.entries()) {
  const textNode: Text = node;
  // @ts-expect-error Text nodes are not HTML elements.
  const element: HTMLElement = node;
  void [textNode, element];
}
text.ownText('updated').textContent('updated')[0].splitText(1);
text.enumerate().select(node => node[0].splitText(1));
text.where(node => node.data.length > 0);
text.observe(() => {}, { characterData: true }).disconnect();
$(document).observe(() => {}).disconnect();
// @ts-expect-error Text nodes have no style.
text.cssImportant('color', 'red');
// @ts-expect-error Text nodes have no attributes.
text.targetBlank();
// @ts-expect-error Text nodes have no element-specific extensions.
text.collapseBrs();
// @ts-expect-error Plain objects are not observable DOM nodes.
$({ value: 1 }).observe(() => {});
const withFallback: JQuery<Text | HTMLElement> = text.ifEmpty('div');
// @ts-expect-error A fallback selector can produce a non-Text node.
const onlyText: JQuery<Text> = text.ifEmpty('div');

const optionalColor: string | undefined = $().color();
// @ts-expect-error An empty collection has no color.
const requiredColor: string = $().color();
const optionalHex: string | undefined = $().colorHex(true);
// @ts-expect-error Conversion can return undefined.
const requiredHex: string = $().colorHex();
const fallbackHex: string = $().colorHex() ?? '#000000';
// @ts-expect-error The fallback argument has been removed.
$().colorHex(false, true);
// @ts-expect-error The uppercase argument is passed directly.
$().colorHex({ uppercase: true });
// @ts-expect-error The old conditional CSS name was removed.
buttons.tryCss('color', 'red');
// @ts-expect-error The old conditional class name was removed.
buttons.tryAddClass('ready');
// @ts-expect-error Text nodes do not have a CSS color.
text.colorHex();
svg.cssIfNotEmpty('fill', 'red').addClassIfNotEmpty(['ready'])[0].viewBox;
void [replacement, svgNodes, htmlNodes, withFallback, onlyText, optionalColor, requiredColor,
  optionalHex, requiredHex, fallbackHex];

const waitOptions: WaitForNodesOptions = {
  timeoutMs: 500,
  pollIntervalMs: 50,
  signal: new AbortController().signal,
  includeIframes: true,
};
// @ts-expect-error The polling interval must be numeric.
$.waitForNodes('.child', { pollIntervalMs: '50' });
const matchingButtons: Promise<JQuery<HTMLButtonElement>> = $.waitForNodes<HTMLButtonElement>('button', waitOptions);
const defaultMatches: Promise<JQuery<HTMLElement>> = $.waitForNodes('.child');
// @ts-expect-error Waiting is a static API, not a collection method.
buttons.waitForNodes('button');
// @ts-expect-error Query roots are not part of the static API.
$.waitForNodes('button', { root: document });
// @ts-expect-error Selector results must be Elements.
$.waitForNodes<Text>('button');
// @ts-expect-error The old uncancellable callback API was replaced.
buttons.onNodeExists('button', () => {});
const urlOptions: RefineUrlsOptions = { addImageFallbackLinks: true, pathRewrite: path => path + '/updated' };
buttons.refineUrls([], new URL('https://example.com'), urlOptions)[0].disabled = true;
buttons.refineUrls([], new URL('https://example.com'), path => path)[0].disabled = true;
// @ts-expect-error The fallback flag must be boolean.
buttons.refineUrls([], new URL('https://example.com'), { addImageFallbackLinks: 'yes' });
void [matchingButtons, defaultMatches];

// Native dialog methods must remain compatible with builtinx's Element augmentation.
const dialog = document.createElement('dialog');
const shown: void = dialog.show();
const visibleDialog: HTMLDialogElement = dialog.setVisible(true);
const visibleSvg: SVGSVGElement = svg[0].setVisible(false);
void [shown, visibleDialog, visibleSvg];

const detachedButton = document.implementation.createHTMLDocument().createElement('button');
const fromButton: JQuery<HTMLButtonElement> = $.from(detachedButton);
const fromButtons: JQuery<HTMLButtonElement> = $.from([detachedButton]);
const fromSvg: JQuery<SVGSVGElement> = $.from(svg[0]);
const unknownElement: unknown = detachedButton;
if ($.isElement(unknownElement)) {
  const element: Element = unknownElement;
  void element;
}
// @ts-expect-error Element input must retain its actual subtype.
const fromInput: JQuery<HTMLInputElement> = $.from(detachedButton);
void [fromButton, fromButtons, fromSvg, fromInput];

const typedInputs = $(document.createElement('input'));
const sameInputs: JQuery<HTMLInputElement> = $.from(typedInputs);
const inputGroups: JQuery<HTMLInputElement> = $.from([typedInputs, typedInputs]);
const mixedInputs: JQuery<HTMLInputElement> = $.from([typedInputs, typedInputs[0]]);
const sameSvg: JQuery<SVGSVGElement> = $.from(svg);
const svgGroups: JQuery<SVGSVGElement> = $.from([svg]);
const sameButtonsFrom: JQuery<HTMLButtonElement> = $.from(buttons);
const emptyFrom: JQuery<HTMLElement> = $.from(null);
const emptyArrayFrom: JQuery<HTMLElement> = $.from([]);
// @ts-expect-error Existing input collection types must not turn into button types.
const invalidButtonGroup: JQuery<HTMLButtonElement> = $.from(typedInputs);
void [sameInputs, inputGroups, mixedInputs, sameSvg, svgGroups, sameButtonsFrom, emptyFrom,
  emptyArrayFrom, invalidButtonGroup];

const unknownCollection: unknown = buttons;
if ($.isJQuery(unknownCollection)) {
  const collection: JQuery<unknown> = unknownCollection;
  const item: unknown = collection[0];
  collection.toArray();
  // @ts-expect-error Recognizing jQuery does not establish the element type.
  const buttonElement: HTMLButtonElement = collection[0];
  void [item, buttonElement];
}
// @ts-expect-error A caller cannot claim an unchecked element type.
$.isJQuery<HTMLButtonElement>(unknownCollection);
