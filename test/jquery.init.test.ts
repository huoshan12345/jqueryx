import jquery from 'jquery';

test('the package entry exposes the shared jQuery instance through both globals', () => {
  expect(Reflect.get(globalThis, '$')).toBe(jquery);
  expect(Reflect.get(globalThis, 'jQuery')).toBe(jquery);
  const node = document.createElement('div');
  expect($(node)).toBeInstanceOf(jquery);
  expect(jQuery(node)).toBeInstanceOf(jquery);
});
