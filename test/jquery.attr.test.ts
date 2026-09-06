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
