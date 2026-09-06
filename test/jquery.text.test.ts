test('textContent reads nested text in document order', () => {
  const nodes = $('<div>a<b>b<i>c</i></b>d</div><div>e</div>');
  expect(nodes.textContent()).toBe('abcde');
});

test('textContent sets each root independently and preserves non-text descendants', () => {
  const nodes = $('<div>a<b>b</b></div><div>c<i>d</i></div>');
  const children = nodes.children().toArray();
  expect(nodes.textContent('new')).toBe(nodes);
  expect(nodes.map((_, node) => node.textContent).get()).toEqual(['new', 'new']);
  expect(nodes.map((_, node) => node.innerHTML).get()).toEqual(['new<b></b>', 'new<i></i>']);
  expect(nodes.children().toArray()).toEqual(children);
});

test('textContent treats empty descendants and existing text consistently', () => {
  const nodes = $('<div><button></button></div><div>old</div>');
  const button = nodes.find('button')[0];
  nodes.textContent('new');
  expect(nodes.map((_, node) => node.innerHTML).get()).toEqual(['new<button></button>', 'new']);
  expect(nodes.find('button')[0]).toBe(button);
});

test('textContent supports Text nodes and empty collections', () => {
  const text = $(document.createTextNode('old'));
  expect(text.textContent()).toBe('old');
  expect(text.textContent('new')).toBe(text);
  expect(text[0].data).toBe('new');
  expect($().textContent()).toBe('');
  expect($().textContent('new')).toHaveLength(0);
});

test('textContent accepts empty text while preserving elements and the ownText range', () => {
  const nodes = $('<div>a<b>b</b>c</div>');
  const child = nodes.find('b')[0];
  expect(nodes.textContent()).toBe('abc');
  expect(nodes.ownText()).toBe('ac');
  nodes.textContent('');
  expect(nodes.textContent()).toBe('');
  expect(nodes.find('b')[0]).toBe(child);
});

test('textContent works on fragments and same-origin iframe nodes', () => {
  const fragment = document.createDocumentFragment();
  const span = document.createElement('span');
  fragment.append(span);
  $(fragment).textContent('fragment');
  expect(fragment.textContent).toBe('fragment');
  expect(fragment.firstChild?.nodeType).toBe(Node.TEXT_NODE);
  expect(fragment.lastChild).toBe(span);
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  try {
    const root = iframe.contentDocument!.createElement('div');
    root.innerHTML = 'a<b>b</b>';
    expect($(root).textContent()).toBe('ab');
    $(root).textContent('new');
    expect(root.innerHTML).toBe('new<b></b>');
  } finally {
    iframe.remove();
  }
});

test('textContent updates a nested first Text node without moving its containing element', () => {
  const nodes = $('<div><section><b>first</b></section>last</div>');
  const first = nodes.find('b')[0].firstChild;
  nodes.textContent('new');
  expect(nodes.textContent()).toBe('new');
  expect(nodes.find('b')[0].firstChild).toBe(first);
  expect(nodes[0].innerHTML).toBe('<section><b>new</b></section>');
});

test('textContent preserves nested element identity, handlers, data and comments', () => {
  const nodes = $('<div>a<section>b<strong>c</strong></section><!--keep-->d</div>');
  const children = nodes.find('*').toArray();
  const comment = [...nodes[0].childNodes].find(node => node.nodeType === Node.COMMENT_NODE);
  const clicked = vi.fn();
  nodes.find('strong').data('value', 42).on('click', clicked);
  nodes.textContent('new');
  expect(nodes.textContent()).toBe('new');
  expect(nodes.find('*').toArray()).toEqual(children);
  expect(comment?.parentNode).toBe(nodes[0]);
  expect(nodes.find('strong').data('value')).toBe(42);
  nodes.find('strong').trigger('click');
  expect(clicked).toHaveBeenCalledOnce();
});

test('textContent covers anchor and button text just like its getter', () => {
  const nodes = $('<div>a<a href="/">b</a><button>c</button>d</div>');
  const children = nodes.children().toArray();
  nodes.textContent('new');
  expect(nodes.textContent()).toBe('new');
  expect(nodes.children().toArray()).toEqual(children);
});

test('textContent can set an anchor or button root', () => {
  const nodes = $('<a>a</a><button>b</button>');
  nodes.textContent('new');
  expect(nodes.map((_, node) => node.textContent).get()).toEqual(['new', 'new']);
});

test('textContent merges adjacent Text nodes without deleting non-text siblings', () => {
  const root = document.createElement('div');
  const comment = document.createComment('keep');
  root.append('a', 'b', comment, 'c', 'd');
  $(root).textContent('new');
  expect(root.textContent).toBe('new');
  expect(comment.parentNode).toBe(root);
  expect([...root.childNodes].filter(node => node.nodeType === Node.TEXT_NODE)).toHaveLength(1);
});

test('ownText removes all adjacent direct Text nodes after the first', () => {
  const root = document.createElement('div');
  root.append('a', 'b', 'c', 'd');
  const first = root.firstChild;
  expect($(root).ownText('new')[0]).toBe(root);
  expect(root.textContent).toBe('new');
  expect([...root.childNodes]).toEqual([first]);
});

test('ownText preserves non-text nodes and descendant text between direct Text nodes', () => {
  const root = document.createElement('div');
  const child = document.createElement('b');
  child.textContent = 'nested';
  const comment = document.createComment('keep');
  root.append('a', 'b', child, 'c', 'd', comment, 'e');
  const first = root.firstChild;
  $(root).ownText('new');
  expect($(root).ownText()).toBe('new');
  expect(child.textContent).toBe('nested');
  expect([...root.childNodes]).toEqual([first, child, comment]);
});

test('ownText sets multiple roots independently and supports an empty string', () => {
  const first = document.createElement('div');
  const second = document.createElement('div');
  first.append('a', 'b', 'c');
  second.append('d', 'e', 'f');
  const nodes = $([first, second]);
  nodes.ownText('');
  expect(nodes.map((_, node) => node.textContent).get()).toEqual(['', '']);
  expect(first.childNodes).toHaveLength(1);
  expect(second.childNodes).toHaveLength(1);
});
