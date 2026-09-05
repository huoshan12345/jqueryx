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
