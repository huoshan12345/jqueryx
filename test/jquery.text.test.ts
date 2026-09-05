test('textContent reads nested text in document order', () => {
  const nodes = $('<div>a<b>b<i>c</i></b>d</div><div>e</div>');
  expect(nodes.textContent()).toBe('abcde');
});

test('textContent sets each root independently and replaces descendants', () => {
  const nodes = $('<div>a<b>b</b></div><div>c<i>d</i></div>');
  expect(nodes.textContent('new')).toBe(nodes);
  expect(nodes.map((_, node) => node.textContent).get()).toEqual(['new', 'new']);
  expect(nodes.children()).toHaveLength(0);
});

test('textContent treats empty descendants and existing text consistently', () => {
  const nodes = $('<div><button></button></div><div>old</div>');
  nodes.textContent('new');
  expect(nodes.map((_, node) => node.innerHTML).get()).toEqual(['new', 'new']);
});

test('textContent supports Text nodes and empty collections', () => {
  const text = $(document.createTextNode('old'));
  expect(text.textContent()).toBe('old');
  expect(text.textContent('new')).toBe(text);
  expect(text[0].data).toBe('new');
  expect($().textContent()).toBe('');
  expect($().textContent('new')).toHaveLength(0);
});

test('textContent accepts empty text and keeps ownText limited to direct text', () => {
  const nodes = $('<div>a<b>b</b>c</div>');
  expect(nodes.textContent()).toBe('abc');
  expect(nodes.ownText()).toBe('ac');
  nodes.textContent('');
  expect(nodes[0].childNodes).toHaveLength(0);
});

test('textContent works on fragments and same-origin iframe nodes', () => {
  const fragment = document.createDocumentFragment();
  fragment.append(document.createElement('span'));
  $(fragment).textContent('fragment');
  expect(fragment.textContent).toBe('fragment');
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  try {
    const root = iframe.contentDocument!.createElement('div');
    root.innerHTML = 'a<b>b</b>';
    expect($(root).textContent()).toBe('ab');
    $(root).textContent('new');
    expect(root.innerHTML).toBe('new');
  } finally {
    iframe.remove();
  }
});
