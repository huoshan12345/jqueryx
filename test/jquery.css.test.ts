test('cssImportant sets explicit CSS lengths and priority', () => {
  const nodes = $('<div>').padding(12);
  expect(nodes.cssImportant('padding', '20px')).toBe(nodes);
  expect(nodes[0].style.padding).toBe('20px');
  expect(nodes[0].style.getPropertyPriority('padding')).toBe('important');
});

test('cssImportant supports unitless properties and custom properties', () => {
  const nodes = $('<div>');
  nodes.cssImportant('opacity', '0.5').cssImportant('--gap', '2rem');
  expect(nodes[0].style.opacity).toBe('0.5');
  expect(nodes[0].style.getPropertyValue('--gap')).toBe('2rem');
  expect(nodes[0].style.getPropertyPriority('--gap')).toBe('important');
});

test('cssImportant rejects numeric input without changing existing styles', () => {
  const nodes = $('<div>').padding(12);
  expect(() => nodes.cssImportant('padding', 20 as unknown as string)).toThrow(TypeError);
  expect(nodes[0].style.padding).toBe('12px');
});

test('cssImportant applies to all elements and permits clearing a property', () => {
  const nodes = $([document.createElement('div'), document.createElement('div')]);
  nodes.cssImportant('color', 'red');
  for (const node of nodes) {
    expect(node.style.getPropertyPriority('color')).toBe('important');
  }
  nodes.cssImportant('color', '');
  expect(nodes[0].style.color).toBe('');
  expect($().cssImportant('color', 'red')).toHaveLength(0);
});

test('color with important uses the renamed method and supports SVG', () => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  $(node).color('red', true).cssImportant('fill', 'blue');
  expect(node.style.getPropertyPriority('color')).toBe('important');
  expect(node.style.getPropertyPriority('fill')).toBe('important');
});
