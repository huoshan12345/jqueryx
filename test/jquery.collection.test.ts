test('where preserves Text and SVG node identities', () => {
  const text = document.createTextNode('text');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const nodes = $.from<Node>([text, svg]);
  expect(nodes.where(node => node === text).toArray()).toEqual([text]);
  expect(nodes.where(node => node === svg).toArray()).toEqual([svg]);
});
