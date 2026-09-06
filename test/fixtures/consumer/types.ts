import 'jqueryx';
import type { Enumerable } from 'linqx';
import type { MutationObserverOptionsInit } from 'builtinx';
import type { WaitForNodesOptions, RefineUrlsOptions } from 'jqueryx';

const buttons: JQuery<HTMLButtonElement> = $('button');
const sameButtons: JQuery<HTMLButtonElement> = jQuery('button');
const empty: boolean = buttons.isEmpty();
const title: string | undefined = sameButtons.title();
buttons.title('ready').onClick(element => element.focus());
buttons.onClick(() => buttons.addClass('clicked'), {
  onError: error => String(error),
});
buttons.onKeyDown((target, key) => target.setAttribute('data-key', key), {
  onError: async error => String(error),
});
buttons.onEnterDown(target => target.focus(), {
  onError: error => String(error),
});

const sequence: Enumerable.IEnumerable<HTMLButtonElement> = buttons.asEnumerable();
const wrapped: Enumerable.IEnumerable<JQuery<HTMLButtonElement>> = buttons.enumerate();
const observerOptions: MutationObserverOptionsInit = { callOnStart: false, debounce: false };
buttons.observe(() => {}, observerOptions);

// The global factory must retain jQuery's base types, not just jqueryx's augmentation.
// @ts-expect-error A button is not an input element.
const inputs: JQuery<HTMLInputElement> = buttons;

void [empty, title, inputs, sequence, wrapped];

buttons.title('ready').href('/').targetBlank().voidHref().disable().enable()[0].disabled = true;
buttons.pointer().underline().flex().flexWrap().inlineBlock().inlineFlex()
  .cssImp('color', 'red').tryCss('color', 'red').tryAddClass('ready')
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
const replacement: JQuery<HTMLInputElement> = buttons.replaceBy(nodes => {
  nodes[0].disabled = true;
  return $(document.createElement('input'));
});
buttons.observe((records, observer, nodes) => nodes[0].disabled = true).disconnect();

const svg = $(document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
const svgNodes: SVGSVGElement[] = svg.asEnumerable().toArray();
svg.cssImp('fill', 'red').title('svg')[0].viewBox;
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
text.cssImp('color', 'red');
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
const optionalHex: string | undefined = $().colorHex(false, true);
// @ts-expect-error Falling back to the original color can return undefined.
const requiredHex: string = $().colorHex(false, true);
const fallbackHex: string = $().colorHex(false, '#000000');
const throwingHex: string = $().colorHex(false);
void [replacement, svgNodes, htmlNodes, withFallback, onlyText, optionalColor, requiredColor,
  optionalHex, requiredHex, fallbackHex, throwingHex];

const waitOptions: WaitForNodesOptions = { timeoutMs: 500, signal: new AbortController().signal, includeIframes: true };
const matchingButtons: Promise<JQuery<HTMLButtonElement>> = $(document).waitForNodes<HTMLButtonElement>('button', waitOptions);
const defaultMatches: Promise<JQuery<HTMLElement>> = buttons.waitForNodes('.child');
$(document.createDocumentFragment()).waitForNodes('button');
// @ts-expect-error Text is not a searchable root.
text.waitForNodes('button');
// @ts-expect-error Selector results must be Elements.
$(document).waitForNodes<Text>('button');
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
