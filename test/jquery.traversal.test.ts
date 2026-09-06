import { foreignDocument } from './helpers/foreignDocument.js';

afterEach(() => document.body.replaceChildren());

test('search results from an iframe support ownText without foreign prototype extensions', () => {
  const owner = foreignDocument();
  owner.body.innerHTML = '<div class="foreign">a<b>b</b>c</div>';
  const nodes = $.search('.foreign');
  expect(nodes).toHaveLength(1);
  expect(nodes[0].ownText).toBeUndefined();
  expect(nodes.ownText()).toBe('ac');
  nodes.ownText('new');
  expect(nodes.ownText()).toBe('new');
  expect(nodes.find('b').text()).toBe('b');
});
