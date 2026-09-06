test('enumeration preserves Text and SVG node identities', () => {
  const text = document.createTextNode('text');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const nodes = $.from<Node>([text, svg]);
  expect([...nodes.entries()]).toEqual([[0, text], [1, svg]]);
  expect(nodes.asEnumerable().toArray()).toEqual([text, svg]);
  expect(nodes.enumerate().select(node => node[0]).toArray()).toEqual([text, svg]);
});

test('asEnumerable can be counted and enumerated repeatedly', () => {
  const nodes = $([document.createElement('button'), document.createElement('input')]);
  const sequence = nodes.asEnumerable();
  expect(sequence.count()).toBe(2);
  expect(sequence.toArray()).toEqual(nodes.toArray());
  expect(sequence.toArray()).toEqual(nodes.toArray());
});

test('asEnumerable iterators advance independently', () => {
  const nodes = $([document.createElement('button'), document.createElement('input')]);
  const sequence = nodes.asEnumerable();
  const first = sequence[Symbol.iterator]();
  const second = sequence[Symbol.iterator]();
  expect(first.next().value).toBe(nodes[0]);
  expect(second.next().value).toBe(nodes[0]);
  expect(first.next().value).toBe(nodes[1]);
  expect(second.next().value).toBe(nodes[1]);
});

test('partial enumeration does not consume later enumerations', () => {
  const nodes = $([document.createElement('button'), document.createElement('input')]);
  const sequence = nodes.asEnumerable();
  for (const node of sequence) {
    expect(node).toBe(nodes[0]);
    break;
  }
  expect(sequence.toArray()).toEqual(nodes.toArray());
});

test('enumerate keeps its wrapped nodes repeatable through derived sequences', () => {
  const nodes = $([document.createTextNode('text'), document.createTextNode('more')]);
  const sequence = nodes.enumerate().select(node => node[0]);
  expect(sequence.toArray()).toEqual(nodes.toArray());
  expect(sequence.toArray()).toEqual(nodes.toArray());
});

test('empty sequences can be enumerated repeatedly', () => {
  const sequence = $().asEnumerable();
  expect(sequence.count()).toBe(0);
  expect(sequence.toArray()).toEqual([]);
  expect(sequence.toArray()).toEqual([]);
});
