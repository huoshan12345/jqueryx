test('chainable extensions return the same collection', () => {
  const nodes = $(document.createElement('button'));
  const result = nodes.title('ready').disable().enable().visible(true)
    .color('red').tap(buttons => buttons[0].disabled = true);
  expect(result).toBe(nodes);
  expect(nodes[0].disabled).toBe(true);
});

test('enumeration and filtering preserve Text and SVG node identities', () => {
  const text = document.createTextNode('text');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const nodes = $(text).add(svg);
  expect([...nodes.entries()]).toEqual([[0, text], [1, svg]]);
  expect(nodes.asEnumerable().toArray()).toEqual([text, svg]);
  expect(nodes.enumerate().select(node => node[0]).toArray()).toEqual([text, svg]);
  expect(nodes.where(node => node === text).toArray()).toEqual([text]);
});

test('color and colorHex return undefined for empty collections and permit caller fallbacks', () => {
  expect($().color()).toBeUndefined();
  expect($().colorHex()).toBeUndefined();
  expect($().colorHex() ?? '#000000').toBe('#000000');
});
