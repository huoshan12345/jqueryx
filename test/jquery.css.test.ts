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

test('cssIfNotEmpty preserves styles for empty values and applies nonempty values to every element', () => {
  const nodes = $('<div></div><div></div>').css('color', 'red');
  expect(nodes.cssIfNotEmpty('color')).toBe(nodes);
  nodes.cssIfNotEmpty('color', '');
  expect(nodes[0].style.color).toBe('red');
  expect(nodes.cssIfNotEmpty('color', 'blue')).toBe(nodes);
  expect(nodes.toArray().map(node => node.style.color)).toEqual(['blue', 'blue']);
  nodes.cssIfNotEmpty('opacity', '0');
  expect(nodes[0].style.opacity).toBe('0');
  expect($().cssIfNotEmpty('color', 'red')).toHaveLength(0);
});

test('addClassIfNotEmpty skips empty inputs and preserves chainability for strings and arrays', () => {
  const nodes = $('<div></div><div></div>').addClass('existing');
  expect(nodes.addClassIfNotEmpty()).toBe(nodes);
  nodes.addClassIfNotEmpty('').addClassIfNotEmpty([]);
  expect(nodes[0].className).toBe('existing');
  expect(nodes.addClassIfNotEmpty('first second').addClassIfNotEmpty(['third'])).toBe(nodes);
  expect(nodes.toArray().map(node => node.className)).toEqual([
    'existing first second third', 'existing first second third',
  ]);
  expect($().addClassIfNotEmpty('ready')).toHaveLength(0);
});

test.each([
  ['rgb(0, 0, 0)', '#000000'],
  ['rgb(255, 255, 255)', '#ffffff'],
  ['rgb(1, 2, 15)', '#01020f'],
  ['rgba(171, 205, 239, 0.5)', '#abcdef80'],
  ['rgba(171, 205, 239, 0)', '#abcdef00'],
  ['rgba(171, 205, 239, 1)', '#abcdef'],
  ['#abc', '#aabbcc'],
  ['#abcd', '#aabbccdd'],
  ['transparent', '#00000000'],
  ['red', '#ff0000'],
] as const)('colorHex converts the computed color of %s to %s', (value, expected) => {
  const node = $('<div>').color(value);
  expect(node.colorHex()).toBe(expected);
  expect(node.colorHex(false)).toBe(expected);
  expect(node.colorHex(true)).toBe(expected.toUpperCase());
});

test.each([
  [undefined, undefined],
  ['color(display-p3 1 0 0)', undefined],
  ['lab(50% 0 0)', undefined],
  ['prefix rgb(1, 2, 3)', undefined],
  ['rgb(256, 2, 3)', undefined],
  ['rgba(1, 2, 3, 2)', undefined],
  ['rgba(1, 2, 3, -0.1)', undefined],
  ['rgb(1.4, 2.6, 3.5)', '#010304'],
  ['rgba(1, 2, 3, .1)', '#0102031a'],
] as const)('colorHex handles computed serialization %s', (value, expected) => {
  const nodes = $('<div>');
  vi.spyOn(nodes, 'color').mockReturnValue(value as never);
  expect(nodes.colorHex()).toBe(expected);
});

test('colorHex reads only the first element and also supports SVG and foreign elements', () => {
  const nodes = $('<div></div><div></div>');
  nodes.eq(0).color('red');
  nodes.eq(1).color('blue');
  expect(nodes.colorHex()).toBe('#ff0000');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  expect($(svg).color('rgba(0, 0, 255, 0.5)').colorHex()).toBe('#0000ff80');
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  try {
    const foreign = iframe.contentDocument!.createElement('div');
    expect($(foreign).color('rgba(255, 0, 0, 0.5)').colorHex()).toBe('#ff000080');
  } finally {
    iframe.remove();
  }
});
