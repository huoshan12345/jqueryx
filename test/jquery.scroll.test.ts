function scrollable(element: Element) {
  const scrollIntoView = vi.fn();
  Object.defineProperty(element, 'scrollIntoView', { configurable: true, value: scrollIntoView });
  return scrollIntoView;
}

afterEach(() => document.body.replaceChildren());

test('scrollToNode delegates to the element without calculating document coordinates', () => {
  const element = document.createElement('div');
  const scrollIntoView = scrollable(element);
  const rect = vi.spyOn(element, 'getBoundingClientRect');
  const scroll = vi.spyOn(window, 'scroll').mockImplementation(() => {});
  $.scrollToNode(element);
  expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', inline: 'nearest' });
  expect(rect).not.toHaveBeenCalled();
  expect(scroll).not.toHaveBeenCalled();
});

test('scrollToNode uses the first matched element and accepts native options', () => {
  document.body.innerHTML = '<button></button><button></button>';
  const nodes = $('button');
  const first = scrollable(nodes[0]);
  const second = scrollable(nodes[1]);
  $.scrollToNode('button', { behavior: 'smooth', block: 'center' });
  $.scrollToNode(nodes);
  expect(first).toHaveBeenNthCalledWith(1, { behavior: 'smooth', block: 'center', inline: 'nearest' });
  expect(first).toHaveBeenCalledTimes(2);
  expect(second).not.toHaveBeenCalled();
});

test('scrollToNode works with iframe elements and their own scrolling implementation', () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const element = frame.contentDocument!.createElement('div');
  const scrollIntoView = scrollable(element);
  $.scrollToNode(element);
  expect(scrollIntoView).toHaveBeenCalledOnce();
});

test('scrollToNode accepts elements in independent documents', () => {
  const element = document.implementation.createHTMLDocument().createElement('div');
  const scrollIntoView = scrollable(element);
  $.scrollToNode(element);
  expect(scrollIntoView).toHaveBeenCalledOnce();
});

test('scrollToNode does nothing for an empty match', () => {
  expect(() => $.scrollToNode($())).not.toThrow();
  expect(() => $.scrollToNode('.does-not-exist')).not.toThrow();
});
