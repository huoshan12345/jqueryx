test.each([
  ['empty collection', $(), false],
  ['element without href', $('<div>'), false],
  ['anchor without href', $('<a>'), false],
  ['javascript URL', $('<a href="javascript:;">'), false],
  ['https URL', $('<a href="https://example.com/">'), true],
  ['relative URL', $('<a href="/path">'), true],
  ['fragment URL', $('<a href="#part">'), true],
] as const)('hasUrlHref returns a boolean for %s', (_, nodes, expected) => {
  expect(nodes.hasUrlHref()).toBe(expected);
});
