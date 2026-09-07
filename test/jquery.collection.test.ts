afterEach(() => document.body.replaceChildren());

test('isEmpty and isNotEmpty distinguish empty and populated collections', () => {
  expect($().isEmpty()).toBe(true);
  expect($().isNotEmpty()).toBe(false);
  const nodes = $('<div><span></span></div>');
  expect(nodes.isEmpty()).toBe(false);
  expect(nodes.isNotEmpty()).toBe(true);
});

test('isNot requires that no member matches, including for an empty collection', () => {
  const nodes = $('<div></div><span></span>');
  expect(nodes.isNot('span')).toBe(false);
  expect(nodes.isNot('button')).toBe(true);
  expect($().isNot('span')).toBe(true);
});

test('throwIfEmpty returns the populated collection and throws for an empty one', () => {
  const nodes = $('<div>');
  expect(nodes.throwIfEmpty()).toBe(nodes);
  expect(() => $().throwIfEmpty()).toThrow('The set is empty');
});

test('ifEmpty only evaluates its fallback for an empty collection', () => {
  const fallback = document.createElement('button');
  fallback.id = 'fallback';
  document.body.append(fallback);
  const nodes = $('<span>');
  expect(nodes.ifEmpty('[')).toBe(nodes);
  expect($().ifEmpty('#fallback').toArray()).toEqual([fallback]);
  expect($().ifEmpty('.missing')).toHaveLength(0);
  expect(() => $().ifEmpty('[')).toThrow();
});

test('ifEmpty infers fallback types while preserving the source type and identity', () => {
  const button = $(document.createElement('button')).appendTo(document.body);
  const input = $(document.createElement('input')).addClass('field').appendTo(document.body);
  const sameType = $<HTMLButtonElement>().ifEmpty('button');
  expectTypeOf(sameType).toEqualTypeOf<JQuery<HTMLButtonElement>>();
  expect(sameType[0]).toBe(button[0]);

  const differentType = button.ifEmpty('input');
  expectTypeOf(differentType).toEqualTypeOf<JQuery<HTMLButtonElement | HTMLInputElement>>();
  expect(differentType).toBe(button);
  const explicit = $<HTMLButtonElement>().ifEmpty<HTMLInputElement>('.field');
  expectTypeOf(explicit).toEqualTypeOf<JQuery<HTMLButtonElement | HTMLInputElement>>();
  expect(explicit[0]).toBe(input[0]);

  const text = $(document.createTextNode('text'));
  expectTypeOf(text.ifEmpty('circle')).toEqualTypeOf<JQuery<Text | SVGCircleElement>>();
  expectTypeOf(text.ifEmpty('.field')).toEqualTypeOf<JQuery<Text | HTMLElement>>();
  const circle = $(document.createElementNS('http://www.w3.org/2000/svg', 'circle')).appendTo(document.body);
  const svgFallback = $<Text>().ifEmpty('circle');
  expectTypeOf(svgFallback).toEqualTypeOf<JQuery<Text | SVGCircleElement>>();
  expect(svgFallback[0]).toBe(circle[0]);
});

test('where passes each node and original index and only accepts literal true', () => {
  const nodes = $('<i></i><b></b><em></em><span></span>');
  const decisions = [true, false, null, undefined];
  const predicate = vi.fn((_node: HTMLElement, index: number) => decisions[index]);
  expect(nodes.where(predicate).toArray()).toEqual([nodes[0]]);
  expect(predicate.mock.calls).toEqual(nodes.toArray().map((node, index) => [node, index]));
  const emptyPredicate = vi.fn();
  expect($().where(emptyPredicate)).toHaveLength(0);
  expect(emptyPredicate).not.toHaveBeenCalled();
});

test.each([false, true])('tap calls its action once on the entire collection, empty=%s', empty => {
  const nodes = empty ? $() : $('<i></i><b></b>');
  const action = vi.fn();
  expect(nodes.tap(action)).toBe(nodes);
  expect(action).toHaveBeenCalledExactlyOnceWith(nodes);
});

test.each([false, true])('tapIf evaluates its condition once and conditionally invokes its action: %s', matches => {
  const nodes = $('<i></i><b></b>');
  const condition = vi.fn(() => matches);
  const action = vi.fn();
  expect(nodes.tapIf(condition, action)).toBe(nodes);
  expect(condition).toHaveBeenCalledExactlyOnceWith(nodes);
  expect(action.mock.calls).toEqual(matches ? [[nodes]] : []);
});

test('tapIf still evaluates an empty collection and propagates callback failures', () => {
  const nodes = $();
  const action = vi.fn();
  expect(nodes.tapIf(value => value.isEmpty(), action)).toBe(nodes);
  expect(action).toHaveBeenCalledExactlyOnceWith(nodes);
  const error = new Error('callback failed');
  const fail = () => { throw error; };
  expect(() => nodes.tap(fail)).toThrow(error);
  expect(() => nodes.tapIf(fail, action)).toThrow(error);
  expect(() => nodes.tapIf(() => true, fail)).toThrow(error);
});

test('where preserves Text and SVG node identities', () => {
  const text = document.createTextNode('text');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const nodes = $.from<Node>([text, svg]);
  expect(nodes.where(node => node === text).toArray()).toEqual([text]);
  expect(nodes.where(node => node === svg).toArray()).toEqual([svg]);
});
