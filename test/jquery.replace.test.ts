test('replaceBy invokes its callback once per element and returns every replacement', () => {
  const root = $('<div><i>a</i><i>b</i></div>');
  const targets = root.find('i');
  const callback = vi.fn((node: JQuery<HTMLElement>, index: number) => {
    expect(node).toHaveLength(1);
    return $('<b>').text(`${index}:${node.text()}`);
  });
  const result = targets.replaceBy(callback).addClass('replaced');
  expect(callback).toHaveBeenCalledTimes(2);
  expect(result.toArray()).toEqual(root.find('b').toArray());
  expect(result.map((_, node) => node.textContent).get()).toEqual(['0:a', '1:b']);
  expect(root.find('b.replaced')).toHaveLength(2);
  expect(root.find('i')).toHaveLength(0);
});

test('replaceBy preserves replacement order when each callback returns multiple nodes', () => {
  const root = $('<div><i></i><i></i></div>');
  const result = root.find('i').replaceBy((_, index) => $(`<b>${index}</b><em>${index}</em>`));
  expect(result.toArray()).toEqual(root.children().toArray());
  expect(root[0].innerHTML).toBe('<b>0</b><em>0</em><b>1</b><em>1</em>');
});

test('replaceBy clones reused replacement nodes so earlier replacements remain', () => {
  const root = $('<div><i></i><i></i></div>');
  const clicked = vi.fn();
  const shared = $('<button>').data('value', 42).on('click', clicked);
  const result = root.find('i').replaceBy(() => shared);
  expect(result).toHaveLength(2);
  expect(result[0]).not.toBe(result[1]);
  expect(result.toArray()).toEqual(root.children().toArray());
  expect(result.eq(1).data('value')).toBe(42);
  result.trigger('click');
  expect(clicked).toHaveBeenCalledTimes(2);
});

test('returning the current element preserves its identity and event data', () => {
  const root = $('<div><button>keep</button></div>');
  const target = root.find('button').data('value', 42);
  const result = target.replaceBy(node => $(node[0]));
  expect(result[0]).toBe(target[0]);
  expect(root.children()[0]).toBe(target[0]);
  expect(result.data('value')).toBe(42);
});

test('returning an empty collection deletes that element and yields no replacement', () => {
  const root = $('<div><i>a</i><i>b</i></div>');
  const result = root.find('i').replaceBy((node, index) => index === 0 ? $() : node);
  expect(root.text()).toBe('b');
  expect(result.toArray()).toEqual(root.children().toArray());
});

test('an empty input does not invoke the callback', () => {
  const callback = vi.fn(() => $('<b>'));
  expect($().replaceBy(callback)).toHaveLength(0);
  expect(callback).not.toHaveBeenCalled();
});

test('replacement can retain the source alongside new siblings', () => {
  const root = $('<div><i>keep</i></div>');
  const source = root.find('i');
  const result = source.replaceBy(node => node.add($('<b>new</b>')));
  expect(result.toArray()).toEqual(root.children().toArray());
  expect(root[0].innerHTML).toBe('<i>keep</i><b>new</b>');
});

test('replacing a parent with its child preserves the child data', () => {
  const root = $('<div><i><button>keep</button></i></div>');
  const child = root.find('button').data('value', 42);
  const result = root.find('i').replaceBy(node => node.find('button'));
  expect(result[0]).toBe(child[0]);
  expect(root.children()[0]).toBe(child[0]);
  expect(result.data('value')).toBe(42);
});

test('detached sources return their replacement nodes', () => {
  const source = $('<i>');
  const replacement = $('<b>');
  expect(source.replaceBy(() => replacement)[0]).toBe(replacement[0]);
});

test('returning another source clones it without moving it before its callback', () => {
  const root = $('<div><i>a</i><i>b</i></div>');
  const sources = root.find('i');
  const result = sources.replaceBy((node, index) => {
    if (index === 0) {
      return sources.eq(1);
    }
    expect(node[0]).toBe(sources[1]);
    expect(node[0].parentNode).toBe(root[0]);
    return node;
  });
  expect(result[0]).not.toBe(sources[1]);
  expect(result[1]).toBe(sources[1]);
  expect(result.toArray()).toEqual(root.children().toArray());
  expect(root[0].innerHTML).toBe('<i>b</i><i>b</i>');
});

test('callback failure propagates without removing the failing source or leaving markers', () => {
  const root = $('<div><i>a</i><i>b</i></div>');
  expect(() => root.find('i').replaceBy((_, index) => {
    if (index === 1) {
      throw new Error('failed');
    }
    return $('<b>done</b>');
  })).toThrow('failed');
  expect(root[0].innerHTML).toBe('<b>done</b><i>b</i>');
});
