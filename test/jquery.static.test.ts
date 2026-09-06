import { createRequire } from 'node:module';

afterEach(() => {
  document.body.replaceChildren();
});

function frameDocument(): Document {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  return frame.contentDocument!;
}

test.each([
  ['current document', () => document],
  ['independent HTML document', () => document.implementation.createHTMLDocument()],
  ['iframe document', frameDocument],
  ['independent iframe document', () => frameDocument().implementation.createHTMLDocument()],
] as const)('recognizes single elements and collections from %s', (_, createDocument) => {
  const owner = createDocument();
  const root = owner.createElement('div');
  const first = owner.createElement('button');
  const second = owner.createElementNS('http://www.w3.org/2000/svg', 'svg');
  root.append(first, second);
  expect($.isElement(first)).toBe(true);
  expect($.isElement(second)).toBe(true);
  expect($.from(first).toArray()).toEqual([first]);
  expect($.from([first, second]).toArray()).toEqual([first, second]);
  expect($.from(root.children).toArray()).toEqual([first, second]);
  expect($.from(root.querySelectorAll('*')).toArray()).toEqual([first, second]);
});

test('recognizes XML elements without a window', () => {
  const owner = document.implementation.createDocument('urn:example', 'root');
  const element = owner.documentElement;
  expect(owner.defaultView).toBeNull();
  expect($.isElement(element)).toBe(true);
  expect($.from(element)[0]).toBe(element);
  expect($.from([element])[0]).toBe(element);
});

test('recognizes adopted elements whose prototype belongs to another realm', () => {
  const owner = frameDocument();
  const foreign = owner.createElement('button');
  document.adoptNode(foreign);
  expect(foreign.ownerDocument).toBe(document);
  expect(foreign instanceof Element).toBe(false);
  expect($.isElement(foreign)).toBe(true);
  expect($.from([foreign])[0]).toBe(foreign);

  const local = document.createElement('input');
  owner.adoptNode(local);
  expect($.isElement(local)).toBe(true);
  expect($.from(local)[0]).toBe(local);
});

test('recognizes elements after their iframe has been removed', () => {
  const element = frameDocument().createElement('button');
  document.querySelector('iframe')!.remove();
  expect($.isElement(element)).toBe(true);
  expect($.from([element])[0]).toBe(element);
});

test('accepts mixed-realm collections without cloning their elements', () => {
  const local = document.createElement('button');
  const foreign = frameDocument().createElement('input');
  const independent = document.implementation.createHTMLDocument().createElement('div');
  const result = $.from([local, foreign, independent]);
  expect(result.toArray()).toEqual([local, foreign, independent]);
});

test.each([
  ['null', null],
  ['undefined', undefined],
  ['string', '<div>'],
  ['number', 1],
  ['document', document],
  ['text', document.createTextNode('text')],
  ['comment', document.createComment('comment')],
  ['fragment', document.createDocumentFragment()],
  ['plain object', {}],
  ['element-shaped object', { nodeType: 1, tagName: 'DIV', ownerDocument: document }],
  ['inherited prototype', Object.create(Element.prototype)],
] as const)('isElement rejects %s', (_, value) => {
  expect($.isElement(value)).toBe(false);
});

test('isElement does not need to read an untrusted ownerDocument property', () => {
  const value = Object.defineProperty({}, 'ownerDocument', {
    get() { throw new Error('unexpected access'); },
  });
  expect($.isElement(value)).toBe(false);
});

test('from still rejects non-node collection members', () => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  // Invalid inputs intentionally bypass the public type contract.
  const fromUnknown = $.from as (value: unknown) => JQuery;
  expect(() => fromUnknown([42])).toThrow(TypeError);
  expect(() => fromUnknown([{ nodeType: 1, tagName: 'DIV', ownerDocument: document }])).toThrow(TypeError);
});

test.each([
  ['current document', () => document],
  ['independent document', () => document.implementation.createHTMLDocument()],
  ['iframe document', frameDocument],
] as const)('from accepts all supported Node kinds from %s', (_, createDocument) => {
  const owner = createDocument();
  const nodes: Node[] = [
    owner,
    owner.createTextNode('text'),
    owner.createComment('comment'),
    owner.createDocumentFragment(),
    owner.implementation.createDocumentType('html', '', ''),
    owner.createAttribute('title'),
    owner.createProcessingInstruction('target', 'value'),
    owner.createElement('div').attachShadow({ mode: 'open' }),
  ];
  for (const node of nodes) {
    expect($.isNode(node), node.nodeName).toBe(true);
    expect($.from(node).toArray()).toEqual([node]);
    expect($.from([node]).toArray()).toEqual([node]);
    const wrapped = $(node);
    expect($.from(wrapped)).toBe(wrapped);
    expect($.from([wrapped]).toArray()).toEqual([node]);
  }
});

test('from supports XML CDATA nodes without a window', () => {
  const owner = document.implementation.createDocument(null, 'root');
  const cdata = owner.createCDATASection('text');
  expect($.isNode(cdata)).toBe(true);
  expect($.from(cdata)[0]).toBe(cdata);
  expect($.from([cdata])[0]).toBe(cdata);
});

test('from snapshots childNodes and custom array-like mixed Node inputs', () => {
  const root = document.createElement('div');
  const text = document.createTextNode('text');
  const comment = document.createComment('comment');
  const child = document.createElement('b');
  root.append(text, comment, child);
  const snapshot = $.from(root.childNodes);
  const arrayLike = $.from<Node>({ 0: text, 1: comment, 2: child, length: 3 });
  expect(snapshot.toArray()).toEqual([text, comment, child]);
  expect(arrayLike.toArray()).toEqual(snapshot.toArray());
  root.append('later');
  expect(snapshot).toHaveLength(3);
});

test('from preserves typed Text collections and flattens groups mixed with raw Text nodes', () => {
  const first = $(document.createTextNode('a'));
  const second = $(document.createTextNode('b'));
  const same: JQuery<Text> = $.from(first);
  const grouped: JQuery<Text> = $.from([first, second]);
  const mixed: JQuery<Text> = $.from([first, second[0]]);
  expect(same).toBe(first);
  expect(grouped.toArray()).toEqual([first[0], second[0]]);
  expect(mixed.toArray()).toEqual(grouped.toArray());
});

test('from flattens mixed Node collections and deduplicates connected nodes in document order', () => {
  const root = document.createElement('div');
  const text = document.createTextNode('text');
  const comment = document.createComment('comment');
  const element = document.createElement('span');
  root.append(text, comment, element);
  const result = $.from<Node>([$(element), text, $(comment), text]);
  expect(result.toArray()).toEqual([text, comment, element]);
});

test('from recognizes adopted Text nodes and nodes retained after removing their iframe', () => {
  const owner = frameDocument();
  const text = owner.createTextNode('foreign');
  const comment = owner.createComment('foreign');
  document.adoptNode(text);
  document.querySelector('iframe')!.remove();
  expect(text instanceof Text).toBe(false);
  expect($.isNode(text)).toBe(true);
  expect($.isNode(comment)).toBe(true);
  expect($.from([text])[0]).toBe(text);
  expect($.from(comment)[0]).toBe(comment);
});

test.each([
  ['null', null],
  ['undefined', undefined],
  ['number', 1],
  ['string', 'text'],
  ['window', window],
  ['plain object', {}],
  ['node-shaped object', { nodeType: 3, nodeName: '#text', ownerDocument: document }],
  ['inherited Node prototype', Object.create(Node.prototype)],
] as const)('isNode rejects %s', (_, value) => {
  expect($.isNode(value)).toBe(false);
});

test('isNode does not access untrusted nodeType or ownerDocument getters', () => {
  const getProperty = vi.fn(() => { throw new Error('unexpected access'); });
  const value = Object.defineProperties({}, {
    nodeType: { get: getProperty },
    ownerDocument: { get: getProperty },
  });
  expect($.isNode(value)).toBe(false);
  expect(getProperty).not.toHaveBeenCalled();
});

test('from preserves existing selector, JQuery and empty-input behavior', () => {
  const nodes = $('<button>');
  expect($.from(nodes)).toBe(nodes);
  expect($.from('<input>')[0].tagName).toBe('INPUT');
  expect($.from(null)).toHaveLength(0);
  expect($.from(undefined)).toHaveLength(0);
  expect($.from([])).toHaveLength(0);
});

test('from preserves typed element collections and flattens their groups', () => {
  const first = $(document.createElement('input'));
  const second = $(document.createElement('input'));
  const same: JQuery<HTMLInputElement> = $.from(first);
  const grouped: JQuery<HTMLInputElement> = $.from([first, second]);
  const mixed: JQuery<HTMLInputElement> = $.from([first, second[0]]);
  expect(same).toBe(first);
  expect(grouped.toArray()).toEqual([first[0], second[0]]);
  expect(mixed.toArray()).toEqual(grouped.toArray());
  const svg = $(document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
  const svgGroup: JQuery<SVGSVGElement> = $.from([svg]);
  expect(svgGroup[0]).toBe(svg[0]);
});

test.each([
  ['empty collection', () => $()],
  ['elements', () => $('<button>')],
  ['derived collection', () => $('<div><button></button></div>').find('button')],
  ['iframe element', () => $(frameDocument().createElement('button'))],
  ['text node', () => $(document.createTextNode('text'))],
  ['document', () => $(document)],
  ['plain object', () => $({ value: 1 })],
] as const)('isJQuery recognizes a shared-instance %s', (_, createCollection) => {
  expect($.isJQuery(createCollection())).toBe(true);
});

test.each([
  ['null', null],
  ['undefined', undefined],
  ['string', 'jquery'],
  ['number', 1],
  ['element', document.createElement('div')],
  ['plain object', {}],
  ['false marker', { jquery: false }],
  ['version marker', { jquery: $.fn.jquery }],
  ['inherited marker', Object.create({ jquery: $.fn.jquery })],
  ['array-like with marker', { jquery: $.fn.jquery, length: 0 }],
] as const)('isJQuery rejects %s', (_, value) => {
  expect($.isJQuery(value)).toBe(false);
});

test('from rejects marker-only objects directly and inside collections', () => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const fromUnknown = $.from as (value: unknown) => JQuery;
  for (const value of [{ jquery: false }, { jquery: $.fn.jquery }]) {
    expect(() => fromUnknown(value)).toThrow(TypeError);
    expect(() => fromUnknown([value])).toThrow(TypeError);
  }
});

test('from wraps valid array-like inputs even when they have a jquery property', () => {
  const element = document.createElement('button');
  const input = { 0: element, length: 1, jquery: $.fn.jquery };
  const result = $.from(input);
  expect(result).not.toBe(input);
  expect($.isJQuery(result)).toBe(true);
  expect(result.toArray()).toEqual([element]);
});

test('from rewraps another jQuery instance using the shared instance', () => {
  const { jQueryFactory } = createRequire(import.meta.url)('jquery/factory') as {
    jQueryFactory: (window: Window) => JQueryStatic;
  };
  const owner = frameDocument();
  const otherJQuery = jQueryFactory(owner.defaultView!);
  const foreign = otherJQuery(owner.createElement('button'));
  expect($.isJQuery(foreign)).toBe(false);
  expect(foreign.isEmpty).toBeUndefined();
  const result = $.from(foreign);
  expect(result).not.toBe(foreign);
  expect($.isJQuery(result)).toBe(true);
  expect(result.isEmpty()).toBe(false);
  expect(result[0]).toBe(foreign[0]);
  expect($.from(otherJQuery<HTMLElement>()).isEmpty()).toBe(true);
  const foreignText = otherJQuery(owner.createTextNode('foreign text'));
  const textResult: JQuery<Text> = $.from(foreignText);
  expect(textResult).not.toBe(foreignText);
  expect($.isJQuery(textResult)).toBe(true);
  expect(textResult.toArray()).toEqual([foreignText[0]]);
});

test('from accepts selector groups mixed with Node collections', () => {
  const button = $('<button id="from-node-target">').appendTo(document.body)[0];
  const text = document.createTextNode('text');
  expect($.from<Node>(['#from-node-target', $(text)]).toArray()).toEqual([button, text]);
});
