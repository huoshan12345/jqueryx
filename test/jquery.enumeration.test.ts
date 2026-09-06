test('entries creates independent one-shot iterators with zero-based indexes', () => {
  const nodes = $('<i></i><b></b>');
  const first = nodes.entries();
  const second = nodes.entries();
  expect(first.next().value).toEqual([0, nodes[0]]);
  expect([...first]).toEqual([[1, nodes[1]]]);
  expect([...first]).toEqual([]);
  expect([...second]).toEqual([[0, nodes[0]], [1, nodes[1]]]);
  expect([...$().entries()]).toEqual([]);
});

test('asEnumerable and enumerate read collection membership at enumeration time', () => {
  const nodes = $('<i>');
  const raw = nodes.asEnumerable();
  const wrapped = nodes.enumerate();
  const replacement = document.createElement('b');
  nodes[0] = replacement;
  expect(raw.toArray()).toEqual([replacement]);
  expect(wrapped.select(node => node[0]).toArray()).toEqual([replacement]);
  expect($().enumerate().toArray()).toEqual([]);
});

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
