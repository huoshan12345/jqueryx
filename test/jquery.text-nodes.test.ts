test('textNodes accepts immutable options and exclusion selectors', () => {
  const excluded = Object.freeze(['button']);
  const root = $('<div>plain<a>link</a><button>button</button></div>');
  const nodes = root.textNodes(Object.freeze({ excludeSelectors: excluded }));
  expect(nodes.toArray().map(node => node.data)).toEqual(['plain', 'link']);
  expect(excluded).toEqual(['button']);
});

function textValues(nodes: JQuery<Text>): string[] {
  return nodes.toArray().map(node => node.data);
}

test('default exclusions prune whole subtrees including excluded roots', () => {
  const root = $('<div>a<a><b>link</b></a><button>button</button><span>b</span>c</div>');
  expect(textValues(root.textNodes())).toEqual(['a', 'b', 'c']);
  expect(root.find('a').textNodes()).toHaveLength(0);
});

test('an empty exclusion list includes anchors and controls', () => {
  const root = $('<div><a>link</a><button>button</button></div>');
  expect(textValues(root.textNodes({ excludeSelectors: [] }))).toEqual(['link', 'button']);
});

test('traverseSelector prunes nonmatching roots and descendants without searching through them', () => {
  const root = $('<div class="visit">a<span class="visit">b</span><section>hidden<b class="visit">hidden too</b></section>c</div>');
  expect(textValues(root.textNodes({ traverseSelector: '.visit' }))).toEqual(['a', 'b', 'c']);
  root.removeClass('visit');
  expect(root.textNodes({ traverseSelector: '.visit' })).toHaveLength(0);
});

test('exclusions accept compound selectors and take precedence over traversal matches', () => {
  const root = $('<div class="visit">a<span class="visit" data-ignore>b<b>c</b></span><i class="visit">d</i></div>');
  expect(textValues(root.textNodes({
    traverseSelector: '.visit',
    excludeSelectors: ['span[data-ignore]'],
  }))).toEqual(['a', 'd']);
});

test('results retain document order and identity across overlapping and reversed roots', () => {
  const root = $('<div>a<b>b<i>c</i></b>d</div>');
  const nodes = $([root.find('b')[0], root[0], root[0]]).textNodes();
  expect(textValues(nodes)).toEqual(['a', 'b', 'c', 'd']);
  expect(nodes[0]).toBe(root[0].firstChild);
  expect(nodes[2]).toBe(root.find('i')[0].firstChild);
});

test('Text and fragment roots are not matched as elements', () => {
  const fragment = document.createDocumentFragment();
  const element = document.createElement('span');
  element.textContent = 'nested';
  fragment.append('direct', element, document.createComment('ignored'));
  expect(textValues($(fragment).textNodes({ traverseSelector: 'span' }))).toEqual(['direct', 'nested']);
  expect(textValues($(fragment.firstChild!).textNodes({ traverseSelector: '.missing' }))).toEqual(['direct']);
  expect($(document.createComment('ignored')).textNodes()).toHaveLength(0);
  expect($().textNodes()).toHaveLength(0);
});

test('document roots support element pruning and explicit iframe document traversal', () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  try {
    const owner = frame.contentDocument!;
    owner.body.innerHTML = '<span>foreign</span><a>link</a>';
    expect(textValues($(owner).textNodes({ traverseSelector: 'html, body, span' }))).toEqual(['foreign']);
    expect($(frame).textNodes({ excludeSelectors: [] })).toHaveLength(0);
  } finally {
    frame.remove();
  }
});

test('template contents are included without duplicating overlapping roots', () => {
  const template = document.createElement('template');
  template.innerHTML = 'a<span>b</span>';
  expect(textValues($(template).add(template.content).textNodes())).toEqual(['a', 'b']);
});

test('an explicitly supplied descendant root is independent of pruning an ancestor', () => {
  const root = $('<div><a><b>text</b></a></div>');
  expect(textValues($([root[0], root.find('b')[0]]).textNodes())).toEqual(['text']);
});
