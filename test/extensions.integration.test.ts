test('chainable extensions return the same collection', () => {
  const nodes = $(document.createElement('button'));
  const result = nodes.title('ready').disable().enable().visible(true)
    .color('red').tap(buttons => buttons[0].disabled = true);
  expect(result).toBe(nodes);
  expect(nodes[0].disabled).toBe(true);
});
