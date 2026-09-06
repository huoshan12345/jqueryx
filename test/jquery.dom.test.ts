function foreignDocument(): Document {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  return frame.contentDocument!;
}

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

test('iframe Text nodes support newline checks without foreign prototype extensions', () => {
  const owner = foreignDocument();
  const newline = owner.createTextNode(' \n ');
  expect(newline.isNewLineTextNode).toBeUndefined();
  expect($(newline).isNewLineTextNode()).toBe(true);
  expect($(owner.createTextNode('text')).isNewLineTextNode()).toBe(false);
});

test('iframe elements support collapseBrs, including nested dependency calls', () => {
  const owner = foreignDocument();
  const node = owner.createElement('div');
  node.innerHTML = 'a<br>\n<br><br>b';
  expect(node.collapseBrs).toBeUndefined();
  const nodes = $(node);
  expect(nodes.collapseBrs()).toBe(nodes);
  expect(node.querySelectorAll('br')).toHaveLength(1);
});

test('iframe elements support trimLeadingBrs, including newline text nodes', () => {
  const owner = foreignDocument();
  const node = owner.createElement('div');
  node.innerHTML = '\n<br>\n<br><b>keep</b><br>';
  const child = node.querySelector('b');
  expect(node.trimLeadingBrs).toBeUndefined();
  const nodes = $(node);
  expect(nodes.trimLeadingBrs()).toBe(nodes);
  expect(node.firstChild).toBe(child);
  expect(node.querySelectorAll('br')).toHaveLength(1);
});
