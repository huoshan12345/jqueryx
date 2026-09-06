test.each([
  ['empty collection', $(), false],
  ['element without href', $('<div>'), false],
  ['anchor without href', $('<a>'), false],
  ['empty href', $('<a href="">'), false],
  ['javascript URL', $('<a href="javascript:;">'), false],
  ['https URL', $('<a href="https://example.com/">'), true],
  ['relative URL', $('<a href="/path">'), true],
  ['fragment URL', $('<a href="#part">'), true],
] as const)('hasUrlHref returns a boolean for %s', (_, nodes, expected) => {
  expect(nodes.hasUrlHref()).toBe(expected);
});

test('title reads the first attribute and writes every element, including empty text', () => {
  const nodes = $('<div title="first"></div><div title="second"></div>');
  expect(nodes.title()).toBe('first');
  expect(nodes.title('ready')).toBe(nodes);
  expect(nodes.toArray().map(node => node.title)).toEqual(['ready', 'ready']);
  expect(nodes.title('').title()).toBe('');
  expect($().title()).toBeUndefined();
  expect($('<div>').title()).toBeUndefined();
  expect($().title('ready')).toHaveLength(0);
});

test('requiredTitle returns the first nonempty title or throws without scanning later elements', () => {
  expect($('<div title="ready">').requiredTitle()).toBe('ready');
  expect($('<div title=" ">').requiredTitle()).toBe(' ');
  for (const nodes of [$(), $('<div>'), $('<div title=""></div><div title="later"></div>')]) {
    expect(() => nodes.requiredTitle()).toThrow('The element does not have title.');
  }
});

test.each([undefined, true, false])('targetBlank updates all targets with onlyUpdate=%s', onlyUpdate => {
  const nodes = $('<a></a><a target="frame"></a><a target="_blank"></a>');
  const alreadyBlank = vi.spyOn(nodes[2], 'setAttribute');
  expect(nodes.targetBlank(onlyUpdate)).toBe(nodes);
  expect(nodes.toArray().map(node => node.getAttribute('target'))).toEqual(['_blank', '_blank', '_blank']);
  expect(alreadyBlank.mock.calls).toEqual(onlyUpdate === false ? [['target', '_blank']] : []);
  expect($().targetBlank(onlyUpdate)).toHaveLength(0);
});

test('href reads raw first attributes and writes strings or URL objects to every element', () => {
  const nodes = $('<a href="/first"></a><a href="/second"></a>');
  expect(nodes.href()).toBe('/first');
  expect(nodes.href('/next')).toBe(nodes);
  expect(nodes.toArray().map(node => node.getAttribute('href'))).toEqual(['/next', '/next']);
  const url = new URL('https://example.com/path?q=1');
  expect(nodes.href(url).href()).toBe(url.href);
  expect(nodes.href('').href()).toBe('');
  expect($().href()).toBeUndefined();
  expect($('<a>').href()).toBeUndefined();
  expect($().href('/next')).toHaveLength(0);
});

test('requiredHref returns the first nonempty raw href and throws for missing or empty values', () => {
  expect($('<a href="/path">').requiredHref()).toBe('/path');
  for (const nodes of [$(), $('<a>'), $('<a href=""></a><a href="/later"></a>')]) {
    expect(() => nodes.requiredHref()).toThrow('The element does not have href.');
  }
});

test('voidHref sets every selected href and preserves the collection', () => {
  const nodes = $('<a href="/first"></a><a></a>');
  expect(nodes.voidHref()).toBe(nodes);
  expect(nodes.toArray().map(node => node.getAttribute('href'))).toEqual(['javascript:;', 'javascript:;']);
  expect(nodes.hasUrlHref()).toBe(false);
  expect($().voidHref()).toHaveLength(0);
});

test('disable and enable update live control properties on every selected element', () => {
  const nodes = $('<button></button><input disabled><select></select>');
  expect(nodes.disable()).toBe(nodes);
  expect(nodes.toArray().map(node => $(node).prop('disabled'))).toEqual([true, true, true]);
  expect(nodes.enable()).toBe(nodes);
  expect(nodes.toArray().map(node => $(node).prop('disabled'))).toEqual([false, false, false]);
  expect($().disable().enable()).toHaveLength(0);
});

test('checked uses current state and matches any checked or selected member', () => {
  const nodes = $('<input type="checkbox"><input type="checkbox" checked>');
  expect(nodes.checked()).toBe(true);
  nodes.eq(1).prop('checked', false);
  expect(nodes.checked()).toBe(false);
  expect($('<option selected>').checked()).toBe(true);
  expect($('<div>').checked()).toBe(false);
  expect($().checked()).toBe(false);
});

test.each([
  [null, false],
  ['', false],
  ['javascript:;', false],
  ['/path', true],
  ['https://example.com/', true],
] as const)('hasUrlHref reads an SVG anchor attribute %j without accessing its animated property', (href, expected) => {
  const anchor = document.createElementNS('http://www.w3.org/2000/svg', 'a');
  if (href !== null) {
    anchor.setAttribute('href', href);
  }
  // jsdom does not expose SVGAElement.href; model its non-string browser value.
  const getHref = vi.fn(() => ({ baseVal: href ?? '', animVal: href ?? '' }));
  Object.defineProperty(anchor, 'href', { get: getHref, configurable: true });

  expect($(anchor).hasUrlHref()).toBe(expected);
  expect(getHref).not.toHaveBeenCalled();
});
