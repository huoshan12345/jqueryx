const baseUrl = new URL('https://local.example');
const options = { addImageFallbackLinks: true };

function imageFixture(src = 'https://remote.example/image.png') {
  const root = $('<div><img></div>');
  const image = root.find<HTMLImageElement>('img').attr('src', src);
  return { root, image };
}

test('rewrites URLs without adding fallback links by default', () => {
  const { root, image } = imageFixture();
  expect(image.refineUrls(['remote.example'], baseUrl)).toBe(image);
  expect(image.attr('src')).toBe('https://local.example/image.png');
  expect(root.find('a')).toHaveLength(0);
});

test('does not add fallback links for unmatched URLs unless requested', () => {
  const { root, image } = imageFixture();
  image.refineUrls(['elsewhere.example'], baseUrl);
  expect(image.attr('src')).toBe('https://remote.example/image.png');
  expect(root.find('a')).toHaveLength(0);
  image.refineUrls(['elsewhere.example'], baseUrl, options);
  expect(root.find('a').attr('href')).toBe(image.attr('src'));
});

test('repeated calls reuse the link and listeners and refresh the final URL', () => {
  const { root, image } = imageFixture();
  const add = vi.spyOn(image[0], 'addEventListener');
  image.refineUrls(['remote.example'], baseUrl, options);
  const link = root.find('a')[0];
  image.refineUrls(['remote.example'], baseUrl, options);
  image.attr('src', 'https://remote.example/updated.png');
  image.refineUrls(['remote.example'], baseUrl, options);
  expect(root.find('a').toArray()).toEqual([link]);
  expect(link.getAttribute('href')).toBe('https://local.example/updated.png');
  expect(link.textContent).toBe('https://local.example/updated.png');
  expect(add.mock.calls.filter(([event]) => event === 'load')).toHaveLength(1);
  expect(add.mock.calls.filter(([event]) => event === 'error')).toHaveLength(1);
});

test('disabling fallback links removes only managed links and listeners', () => {
  const { root, image } = imageFixture();
  const existing = $('<a>user link</a>').appendTo(root)[0];
  const remove = vi.spyOn(image[0], 'removeEventListener');
  image.refineUrls([], baseUrl, options);
  image.refineUrls([], baseUrl, { addImageFallbackLinks: false });
  expect(root.find('a').toArray()).toEqual([existing]);
  expect(remove).toHaveBeenCalledWith('load', expect.any(Function));
  expect(remove).toHaveBeenCalledWith('error', expect.any(Function));
  image.refineUrls([], baseUrl, options);
  expect(root.find('a')).toHaveLength(2);
  image.refineUrls([], baseUrl);
  expect(root.find('a').toArray()).toEqual([existing]);
});

test('missing or empty src removes the managed fallback', () => {
  const { root, image } = imageFixture();
  image.refineUrls([], baseUrl, options);
  image.removeAttr('src').refineUrls([], baseUrl, options);
  expect(root.find('a')).toHaveLength(0);
  image.attr('src', '').refineUrls([], baseUrl, options);
  expect(root.find('a')).toHaveLength(0);
});

test('cached success hides the link, failures show it, and load can hide it again', () => {
  const { root, image } = imageFixture();
  vi.spyOn(image[0], 'complete', 'get').mockReturnValue(true);
  const height = vi.spyOn(image[0], 'naturalHeight', 'get').mockReturnValue(20);
  image.refineUrls([], baseUrl, options);
  const link = root.find('a')[0];
  expect(link.style.display).toBe('none');
  height.mockReturnValue(0);
  image[0].dispatchEvent(new Event('error'));
  expect(link.style.display).toBe('block');
  height.mockReturnValue(20);
  image[0].dispatchEvent(new Event('load'));
  expect(link.style.display).toBe('none');
});

test('pending images have a visible fallback with safe text and existing link attributes', () => {
  const { root, image } = imageFixture('/path?<b>text</b>');
  vi.spyOn(image[0], 'complete', 'get').mockReturnValue(false);
  image.refineUrls([], baseUrl, options);
  const link = root.find('a');
  expect(link[0].style.display).toBe('block');
  expect(link.text()).toBe('/path?<b>text</b>');
  expect(link.children()).toHaveLength(0);
  expect(link.attr('target')).toBe('_blank');
  expect(link.attr('rel')).toBe('noreferrer');
});

test('reuses a detached fallback when an image moves to another container', () => {
  const { root, image } = imageFixture();
  image.refineUrls([], baseUrl, options);
  const link = root.find('a')[0];
  const other = $('<div>');
  other.append(image);
  image.refineUrls([], baseUrl, options);
  expect(other.find('a').toArray()).toEqual([link]);
  expect(root.find('a')).toHaveLength(0);
});

test('keeps the legacy path callback and supports it in the options object', () => {
  const anchors = $('<a href="https://remote.example/a?q=1#hash">https://remote.example/a?q=1#hash</a>');
  anchors.refineUrls(['remote.example'], baseUrl, path => '/prefix' + path);
  expect(anchors.attr('href')).toBe('https://local.example/prefix/a?q=1#hash');
  expect(anchors.text()).toBe(anchors.attr('href'));
  const { root, image } = imageFixture();
  image.refineUrls(['remote.example'], baseUrl, {
    ...options,
    pathRewrite: path => '/prefix' + path,
  });
  expect(root.find('a').attr('href')).toBe('https://local.example/prefix/image.png');
});

test('rewriting visible URLs preserves child elements, jQuery data and event handlers', () => {
  const anchor = $('<a href="https://remote.example/path"><span>https://remote.example/path</span><img src="icon.png"></a>');
  const label = anchor.find('span');
  const image = anchor.find('img');
  const children = anchor.children().toArray();
  const labelClick = vi.fn();
  const imageClick = vi.fn();
  const data = { keep: true };
  label.data('state', data).on('click', labelClick);
  image.data('state', data).on('click', imageClick);

  expect(anchor.refineUrls(['remote.example'], baseUrl)).toBe(anchor);
  expect(anchor.attr('href')).toBe('https://local.example/path');
  expect(label.text()).toBe('https://local.example/path');
  expect(anchor.children().toArray()).toEqual(children);
  expect(label.data('state')).toBe(data);
  expect(image.data('state')).toBe(data);
  label.triggerHandler('click');
  image.triggerHandler('click');
  expect(labelClick).toHaveBeenCalledOnce();
  expect(imageClick).toHaveBeenCalledOnce();
});

test('rewriting a visible URL preserves text placement and surrounding formatting', () => {
  const anchor = $('<a href="https://remote.example/path">Visit <strong>https://remote.example/path</strong><em> now</em><!--keep--><img src="icon.png"></a>');
  const children = [...anchor[0].childNodes];
  const textNodes = anchor.textNodes().toArray();
  const label = anchor.find('strong');
  const suffix = anchor.find('em');
  const labelClick = vi.fn();
  const state = { keep: true };
  label.data('state', state).on('click', labelClick);

  anchor.refineUrls(['remote.example'], baseUrl);

  expect(anchor.attr('href')).toBe('https://local.example/path');
  expect(anchor[0].firstChild?.nodeValue).toBe('Visit ');
  expect(label.text()).toBe('https://local.example/path');
  expect(suffix.text()).toBe(' now');
  expect([...anchor[0].childNodes]).toEqual(children);
  expect(anchor.textNodes().toArray()).toEqual(textNodes);
  expect(label.data('state')).toBe(state);
  label.triggerHandler('click');
  expect(labelClick).toHaveBeenCalledOnce();
});

test('rewrites complete URLs in separate text nodes without merging them', () => {
  const anchor = $('<a href="https://remote.example/path">First: https://remote.example/path <span>Second: https://remote.example/path!</span><em>keep</em></a>');
  const textNodes = anchor.textNodes().toArray();

  anchor.refineUrls(['remote.example'], baseUrl);

  expect(textNodes.map(node => node.nodeValue)).toEqual([
    'First: https://local.example/path ',
    'Second: https://local.example/path!',
    'keep',
  ]);
  expect(anchor.textNodes().toArray()).toEqual(textNodes);
});

test('preserves text split across elements when no individual text node contains the URL', () => {
  const anchor = $('<a href="https://remote.example/path">https://remote.<strong>example/path</strong></a>');
  const contents = anchor.html();
  const textNodes = anchor.textNodes().toArray();

  anchor.refineUrls(['remote.example'], baseUrl);

  expect(anchor.attr('href')).toBe('https://local.example/path');
  expect(anchor.html()).toBe(contents);
  expect(anchor.textNodes().toArray()).toEqual(textNodes);
});

test.each(['', ' / '])('rewrites every repeated URL in one text node with separator %j', separator => {
  const source = 'https://remote.example/path?q=1#section';
  const target = 'https://local.example/path?q=1#section';
  const anchor = $('<a><strong></strong><em>keep</em></a>').attr('href', source);
  const label = anchor.find('strong');
  label.text(`Before ${[source, source, source].join(separator)} after`);
  const textNode = label[0].firstChild;
  const children = anchor.children().toArray();

  anchor.refineUrls(['remote.example'], baseUrl);

  expect(anchor.attr('href')).toBe(target);
  expect(label.text()).toBe(`Before ${[target, target, target].join(separator)} after`);
  expect(label[0].firstChild).toBe(textNode);
  expect(anchor.children().toArray()).toEqual(children);
  expect(anchor.find('em').text()).toBe('keep');
});

test.each(['$&', '$$', "$'"])(
  'treats %s in the replacement URL as literal text',
  pattern => {
    const source = 'https://remote.example/path';
    const target = `https://local.example/${pattern}`;
    const anchor = $('<a><strong></strong><em>keep</em></a>').attr('href', source);
    const label = anchor.find('strong');
    label.text(`Before ${source} / ${source} after`);
    const textNode = label[0].firstChild;

    anchor.refineUrls(['remote.example'], baseUrl, () => `/${pattern}`);

    expect(anchor.attr('href')).toBe(target);
    expect(label.text()).toBe(`Before ${target} / ${target} after`);
    expect(label[0].firstChild).toBe(textNode);
    expect(anchor.find('em').text()).toBe('keep');
  },
);

test('handles selected images independently, including duplicate collection entries', () => {
  const first = imageFixture('/first.png');
  const second = imageFixture('/second.png');
  $([first.image[0], second.image[0], first.image[0]]).refineUrls([], baseUrl, options);
  expect(first.root.find('a')).toHaveLength(1);
  expect(second.root.find('a')).toHaveLength(1);
  expect(first.root.find('a').attr('href')).toBe('/first.png');
  expect(second.root.find('a').attr('href')).toBe('/second.png');
});

test('creates fallback links in an iframe image owner document', () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  try {
    const image = frame.contentDocument!.createElement('img');
    image.src = '/image.png';
    frame.contentDocument!.body.append(image);
    $(image).refineUrls([], baseUrl, options);
    const link = image.nextElementSibling!;
    expect(link.ownerDocument).toBe(image.ownerDocument);
    $(image).refineUrls([], baseUrl);
    expect(image.nextElementSibling).toBeNull();
  } finally {
    frame.remove();
  }
});
