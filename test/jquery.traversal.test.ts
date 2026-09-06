import { foreignDocument } from './helpers/foreignDocument.js';

afterEach(() => document.body.replaceChildren());

test.each([
  [false, false, 'middle'], [true, false, 'outer'],
  [false, true, 'inner'], [true, true, 'outer'],
] as const)('ancestor selects the intended match with outermost=%s includeSelf=%s', (outermost, includeSelf, id) => {
  const root = $('<div id="outer" class="match"><div id="middle" class="match"><i id="inner" class="match"></i></div></div>');
  const inner = root.find('i');
  expect(inner.ancestor('.match', outermost, includeSelf)[0]).toBe(root.add(root.find('*')).filter('#' + id)[0]);
});

test('ancestor defaults to the nearest parent, deduplicates results and returns empty for missing matches', () => {
  const root = $('<div><i></i><b></b></div>');
  expect(root.children().ancestor('div').toArray()).toEqual([root[0]]);
  expect(root.children().ancestor('main')).toHaveLength(0);
  expect(root.ancestor('div')).toHaveLength(0);
  expect($().ancestor('div')).toHaveLength(0);
});

test.each(['static', 'instance'] as const)('%s search prefers local descendants and optionally falls back to iframe contents', mode => {
  const owner = foreignDocument();
  owner.body.innerHTML = '<b class="match"></b>';
  const foreign = owner.body.firstElementChild!;
  const search = (fallback?: boolean) => mode === 'static'
    ? $.search('.match', fallback)
    : $(document.body).search('.match', fallback);
  expect(search().toArray()).toEqual([foreign]);
  expect(search(false)).toHaveLength(0);
  const local = document.createElement('i');
  local.className = 'match';
  document.body.append(local);
  expect(search().toArray()).toEqual([local]);
  local.remove();
  owner.body.replaceChildren();
  expect(search()).toHaveLength(0);
});

test('instance search excludes roots and respects the selected subtree', () => {
  const roots = $('<div class="match"><b class="match"></b></div><div><i class="match"></i></div>');
  expect(roots.eq(0).search('.match').toArray()).toEqual([roots.find('b')[0]]);
  expect(roots.search('.match').toArray()).toEqual(roots.find('.match').toArray());
  expect($().search('.match')).toHaveLength(0);
  expect(() => roots.search('[')).toThrow();
  expect(() => $.search('[')).toThrow();
});

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
