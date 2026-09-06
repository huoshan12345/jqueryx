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

test('from still rejects non-element collection members', () => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  // Invalid inputs intentionally bypass the public type contract.
  const fromUnknown = $.from as (value: unknown) => JQuery;
  expect(() => fromUnknown([document.createTextNode('text')])).toThrow(TypeError);
  expect(() => fromUnknown([{ nodeType: 1, tagName: 'DIV', ownerDocument: document }])).toThrow(TypeError);
});

test('from preserves existing selector, JQuery and empty-input behavior', () => {
  const nodes = $('<button>');
  expect($.from(nodes)).toBe(nodes);
  expect($.from('<input>')[0].tagName).toBe('INPUT');
  expect($.from(null)).toHaveLength(0);
  expect($.from(undefined)).toHaveLength(0);
  expect($.from([])).toHaveLength(0);
});
