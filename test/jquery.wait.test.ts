import type { WaitForNodesOptions } from '@/types/lib.js';

const controllers: AbortController[] = [];
const pending: Promise<unknown>[] = [];

test('detects external ancestor conditions on the next poll', async () => {
  vi.useFakeTimers();
  const parent = $('<main><section><i></i></section></main>').appendTo(document.body);
  const root = parent.find('section');
  const completed = vi.fn();
  const result = wait('.ready i');
  void result.then(completed, () => {});
  parent.addClass('ready');
  await vi.advanceTimersByTimeAsync(100);
  expect(completed).toHaveBeenCalledOnce();
  expect((await result)[0]).toBe(root.find('i')[0]);
});

test('detects checked property changes without an attribute mutation', async () => {
  vi.useFakeTimers();
  const root = $('<div><input type="checkbox"></div>').appendTo(document.body);
  const input = root.find('input')[0];
  const completed = vi.fn();
  const result = wait(':checked');
  void result.then(completed, () => {});
  input.checked = true;
  expect(input.hasAttribute('checked')).toBe(false);
  await vi.advanceTimersByTimeAsync(100);
  expect(completed).toHaveBeenCalledOnce();
  expect((await result)[0]).toBe(input);
});

function wait(
  selector: string,
  options: WaitForNodesOptions = {},
) {
  const controller = new AbortController();
  controllers.push(controller);
  const result = $.waitForNodes(selector, { signal: controller.signal, ...options });
  pending.push(result);
  void result.catch(() => {});
  return result;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(async () => {
  for (const controller of controllers.splice(0)) {
    controller.abort();
  }
  await Promise.allSettled(pending.splice(0));
  document.body.replaceChildren();
  vi.useRealTimers();
});

test('returns all existing document matches in document order', async () => {
  const root = $('<section class="match"><div><button class="match"></button></div><i class="match"></i></section>').appendTo(document.body);
  const result = await wait('.match');
  expect(result.toArray()).toEqual([root[0], ...root.find('.match').toArray()]);
  expect(vi.getTimerCount()).toBe(0);
});

test('waits for asynchronous insertion and resolves only once', async () => {
  vi.useFakeTimers();
  const root = $('<div>').appendTo(document.body);
  const observe = vi.spyOn(MutationObserver.prototype, 'observe');
  const controller = new AbortController();
  const remove = vi.spyOn(controller.signal, 'removeEventListener');
  const result = wait('.ready', { signal: controller.signal });
  const completed = vi.fn();
  void result.then(completed, () => {});
  root.append('<button class="ready"></button><span class="ready"></span>');
  await vi.advanceTimersByTimeAsync(99);
  expect(completed).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(await result).toHaveLength(2);
  expect(observe).not.toHaveBeenCalled();
  expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  expect(vi.getTimerCount()).toBe(0);
  root.append('<p class="ready"></p>');
  await vi.advanceTimersByTimeAsync(500);
  expect(completed).toHaveBeenCalledOnce();
});

test('detects attribute changes on existing nodes', async () => {
  const root = $('<div><button></button></div>').appendTo(document.body);
  const result = wait('button.ready');
  root.find('button').addClass('ready');
  await vi.advanceTimersByTimeAsync(100);
  expect((await result)[0]).toBe(root.find('button')[0]);
});

test('polling complex selectors does not mutate root IDs', async () => {
  const parent = $('<section><div></div></section>').appendTo(document.body);
  const root = parent.find('div');
  const setAttribute = vi.spyOn(root[0], 'setAttribute');
  const result = wait('.left + .right');
  root.append('<span></span>');
  await vi.advanceTimersByTimeAsync(100);
  expect(setAttribute).not.toHaveBeenCalled();
  root.append('<i class="left"></i><b class="right"></b>');
  await vi.advanceTimersByTimeAsync(100);
  expect((await result)[0].tagName).toBe('B');
});

test('rechecks selectors when character data changes', async () => {
  const root = $('<div><span>waiting</span></div>').appendTo(document.body);
  const query = vi.spyOn(document, 'querySelectorAll');
  const result = wait('button');
  root.find('span')[0].firstChild!.nodeValue = '';
  await vi.advanceTimersByTimeAsync(100);
  expect(query).toHaveBeenCalledTimes(2);
  root.append('<button></button>');
  await vi.advanceTimersByTimeAsync(100);
  expect(await result).toHaveLength(1);
});

test('waits until detached fragment contents are inserted into the document', async () => {
  const fragment = document.createDocumentFragment();
  const button = document.createElement('button');
  fragment.append(button);
  const completed = vi.fn();
  const result = wait('button');
  void result.then(completed, () => {});
  await vi.advanceTimersByTimeAsync(100);
  expect(completed).not.toHaveBeenCalled();
  document.body.append(fragment);
  await vi.advanceTimersByTimeAsync(100);
  expect((await result)[0]).toBe(button);
});

test('times out after the default 30 seconds and releases resources', async () => {
  vi.useFakeTimers();
  const result = wait('.missing');
  const assertion = expect(result).rejects.toMatchObject({ name: 'TimeoutError' });
  await vi.advanceTimersByTimeAsync(29_999);
  expect(vi.getTimerCount()).toBe(1);
  await vi.advanceTimersByTimeAsync(1);
  await assertion;
  expect(vi.getTimerCount()).toBe(0);
});

test('zero timeout checks once without creating observers or timers', async () => {
  vi.useFakeTimers();
  const observe = vi.spyOn(MutationObserver.prototype, 'observe');
  const button = $('<button>').appendTo(document.body);
  expect(await wait('button', { timeoutMs: 0 })).toHaveLength(1);
  button.remove();
  await expect(wait('button', { timeoutMs: 0 })).rejects.toMatchObject({ name: 'TimeoutError' });
  expect(observe).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

test.each([-1, NaN, Infinity, -Infinity])('rejects invalid timeout %s', async timeoutMs => {
  await expect(wait('button', { timeoutMs })).rejects.toBeInstanceOf(RangeError);
});

test.each([0, -1, NaN, Infinity, -Infinity])('rejects invalid poll interval %s', async pollIntervalMs => {
  await expect(wait('button', { pollIntervalMs })).rejects.toBeInstanceOf(RangeError);
  expect(vi.getTimerCount()).toBe(0);
});

test('the static function queries the document element without a receiver', async () => {
  const waitForNodes = $.waitForNodes;
  const result = await waitForNodes<HTMLHtmlElement>('html', { timeoutMs: 0 });
  expect(result.toArray()).toEqual([document.documentElement]);
  expect(vi.getTimerCount()).toBe(0);
});

test.each([25, 250])('uses a configured poll interval of %s ms', async pollIntervalMs => {
  const root = $('<div>').appendTo(document.body);
  const query = vi.spyOn(document, 'querySelectorAll');
  const result = wait('button', { pollIntervalMs });
  expect(query).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(pollIntervalMs);
  expect(query).toHaveBeenCalledTimes(2);
  root.append('<button></button>');
  await vi.advanceTimersByTimeAsync(pollIntervalMs - 1);
  expect(query).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(1);
  expect(await result).toHaveLength(1);
  expect(query).toHaveBeenCalledTimes(3);
  expect(vi.getTimerCount()).toBe(0);
});

test.each([25, 150, 200])('honors timeout %s ms even between polls or at a poll deadline', async timeoutMs => {
  const root = $('<div>').appendTo(document.body);
  const query = vi.spyOn(document, 'querySelectorAll');
  const result = wait('button', { timeoutMs, pollIntervalMs: 100 });
  const assertion = expect(result).rejects.toMatchObject({ name: 'TimeoutError' });
  await vi.advanceTimersByTimeAsync(timeoutMs - 1);
  const calls = query.mock.calls.length;
  expect(vi.getTimerCount()).toBe(1);
  root.append('<button></button>');
  await vi.advanceTimersByTimeAsync(1);
  await assertion;
  expect(query).toHaveBeenCalledTimes(calls);
  expect(vi.getTimerCount()).toBe(0);
});

test('splits large poll delays without querying early or overflowing the native timer', async () => {
  const root = $('<div>').appendTo(document.body);
  const query = vi.spyOn(document, 'querySelectorAll');
  const result = wait('button', { pollIntervalMs: 2_147_483_648, timeoutMs: 2_147_483_658 });
  await vi.advanceTimersByTimeAsync(2_147_483_647);
  expect(query).toHaveBeenCalledOnce();
  root.append('<button></button>');
  await vi.advanceTimersByTimeAsync(1);
  expect(await result).toHaveLength(1);
  expect(query).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(0);
});

test('large finite timeouts do not overflow the native timer', async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  const result = wait('.missing', { timeoutMs: 2_147_483_648, signal: controller.signal });
  const reason = new Error('cancelled');
  const assertion = expect(result).rejects.toBe(reason);
  await vi.advanceTimersByTimeAsync(1);
  expect(vi.getTimerCount()).toBe(1);
  controller.abort(reason);
  await assertion;
  expect(vi.getTimerCount()).toBe(0);
});

test('cancels pending waits with the exact signal reason', async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  const remove = vi.spyOn(controller.signal, 'removeEventListener');
  const reason = { cancelled: true };
  const root = $('<div>').appendTo(document.body);
  const query = vi.spyOn(document, 'querySelectorAll');
  const result = wait('button', { signal: controller.signal });
  controller.abort(reason);
  await expect(result).rejects.toBe(reason);
  expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  expect(vi.getTimerCount()).toBe(0);
  await vi.advanceTimersByTimeAsync(500);
  expect(query).toHaveBeenCalledOnce();
});

test('cancellation during a query takes precedence over its matches and does not reschedule', async () => {
  const controller = new AbortController();
  const root = $('<div>').appendTo(document.body);
  const result = wait('button', { signal: controller.signal });
  const reason = new Error('cancel during query');
  const assertion = expect(result).rejects.toBe(reason);
  const query = document.querySelectorAll.bind(document);
  root.append('<button></button>');
  vi.spyOn(document, 'querySelectorAll').mockImplementation(selector => {
    controller.abort(reason);
    return query(selector);
  });
  await vi.advanceTimersByTimeAsync(100);
  await assertion;
  expect(vi.getTimerCount()).toBe(0);
});

test('an already aborted signal takes precedence over existing matches', async () => {
  const controller = new AbortController();
  controller.abort('already cancelled');
  const observe = vi.spyOn(MutationObserver.prototype, 'observe');
  $('<button>').appendTo(document.body);
  await expect(wait('button', {
    signal: controller.signal,
  })).rejects.toBe('already cancelled');
  expect(observe).not.toHaveBeenCalled();
});

test.each(['', ' ', '['])('rejects invalid CSS selector %j without leaving timers', async selector => {
  vi.useFakeTimers();
  await expect(wait(selector)).rejects.toHaveProperty('name', selector.trim() ? 'SyntaxError' : 'TypeError');
  expect(vi.getTimerCount()).toBe(0);
});

test('concurrent document waits finish independently without mutating element IDs', async () => {
  const parent = $('<section><div></div></section>').appendTo(document.body);
  const root = parent.find('div');
  const setAttribute = vi.spyOn(root[0], 'setAttribute');
  const first = wait('.left + .right');
  const second = wait('.left ~ .last');
  root.append('<i class="left"></i><b class="right"></b>');
  await vi.advanceTimersByTimeAsync(100);
  expect(await first).toHaveLength(1);
  root.append('<b class="last"></b>');
  await vi.advanceTimersByTimeAsync(100);
  expect(await second).toHaveLength(1);
  expect(setAttribute).not.toHaveBeenCalled();
});

test('waitForNodes is available only on the static API and requires no existing target', async () => {
  expect($.waitForNodes).toBeTypeOf('function');
  expect('waitForNodes' in $.fn).toBe(false);
  expect($('.ready')).toHaveLength(0);
  const result = wait('.ready');
  const node = $('<button class="ready">').appendTo(document.body)[0];
  await vi.advanceTimersByTimeAsync(100);
  expect((await result)[0]).toBe(node);
});

test('query failures reject and release the timer and abort listener', async () => {
  const controller = new AbortController();
  const remove = vi.spyOn(controller.signal, 'removeEventListener');
  const result = wait('.ready', { signal: controller.signal });
  const error = new Error('query failed');
  vi.spyOn(document, 'querySelectorAll').mockImplementation(() => { throw error; });
  const assertion = expect(result).rejects.toBe(error);
  await vi.advanceTimersByTimeAsync(100);
  await assertion;
  expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  expect(vi.getTimerCount()).toBe(0);
});

function appendFrame(): HTMLIFrameElement {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  return frame;
}

test('iframe documents are excluded by default', async () => {
  appendFrame().contentDocument!.body.innerHTML = '<button></button>';
  await expect(wait('button', { timeoutMs: 0 })).rejects.toMatchObject({ name: 'TimeoutError' });
});

test('includes existing same-origin iframe matches when enabled', async () => {
  const frame = appendFrame();
  frame.contentDocument!.body.innerHTML = '<button></button>';
  const result = await wait('button', { includeIframes: true });
  expect(result[0]).toBe(frame.contentDocument!.querySelector('button'));
});

test('collects current document and iframe matches while deduplicating iframe documents', async () => {
  const button = $('<button>').appendTo(document.body)[0];
  const first = appendFrame();
  const frameDocument = first.contentDocument!;
  frameDocument.body.innerHTML = '<button></button>';
  const second = appendFrame();
  vi.spyOn(second, 'contentDocument', 'get').mockReturnValue(frameDocument);

  const result = await wait('button', { includeIframes: true });

  expect(result.toArray()).toEqual([button, frameDocument.querySelector('button')]);
  expect(vi.getTimerCount()).toBe(0);
});

test('waits inside an iframe without installing a load listener', async () => {
  const frame = appendFrame();
  const add = vi.spyOn(frame, 'addEventListener');
  const result = wait('button', { includeIframes: true });
  frame.contentDocument!.body.innerHTML = '<button></button>';
  await vi.advanceTimersByTimeAsync(100);
  expect(await result).toHaveLength(1);
  expect(add.mock.calls.filter(([type]) => type === 'load')).toHaveLength(0);
  expect(vi.getTimerCount()).toBe(0);
});

test('discovers newly inserted and nested iframe documents', async () => {
  const result = wait('button', { includeIframes: true });
  const frame = appendFrame();
  const nested = frame.contentDocument!.createElement('iframe');
  frame.contentDocument!.body.append(nested);
  nested.contentDocument!.body.innerHTML = '<button></button>';
  await vi.advanceTimersByTimeAsync(100);
  expect((await result)[0]).toBe(nested.contentDocument!.querySelector('button'));
});

test('rediscovers a replaced iframe document without a load event', async () => {
  const frame = appendFrame();
  const oldDocument = frame.contentDocument!;
  const oldQuery = vi.spyOn(oldDocument, 'querySelectorAll');
  const result = wait('button', { includeIframes: true });
  const replacement = document.implementation.createHTMLDocument();
  vi.spyOn(frame, 'contentDocument', 'get').mockReturnValue(replacement);
  oldQuery.mockClear();
  oldDocument.body.innerHTML = '<button id="old"></button>';
  replacement.body.innerHTML = '<button id="new"></button>';
  await vi.advanceTimersByTimeAsync(100);
  expect((await result)[0].id).toBe('new');
  expect(oldQuery).not.toHaveBeenCalled();
});

test('stops querying a removed iframe while continuing to poll the document', async () => {
  const frame = appendFrame();
  const oldQuery = vi.spyOn(frame.contentDocument!, 'querySelectorAll');
  const result = wait('button', { includeIframes: true });
  frame.remove();
  oldQuery.mockClear();
  await vi.advanceTimersByTimeAsync(100);
  expect(oldQuery).not.toHaveBeenCalled();
  document.body.append(document.createElement('button'));
  await vi.advanceTimersByTimeAsync(100);
  expect(await result).toHaveLength(1);
});

test('skips inaccessible frame documents and continues waiting in the current document', async () => {
  const frame = appendFrame();
  vi.spyOn(frame, 'contentDocument', 'get').mockImplementation(() => {
    throw new DOMException('Access denied', 'SecurityError');
  });
  const result = wait('button', { includeIframes: true });
  document.body.append(document.createElement('button'));
  await vi.advanceTimersByTimeAsync(100);
  expect(await result).toHaveLength(1);
});

test('discovers an iframe document that becomes accessible on a later poll', async () => {
  const frame = appendFrame();
  const frameDocument = frame.contentDocument!;
  const getDocument = vi.spyOn(frame, 'contentDocument', 'get').mockReturnValue(null);
  const result = wait('button', { includeIframes: true });
  await vi.advanceTimersByTimeAsync(100);
  frameDocument.body.innerHTML = '<button></button>';
  getDocument.mockReturnValue(frameDocument);
  await vi.advanceTimersByTimeAsync(100);
  expect((await result)[0]).toBe(frameDocument.querySelector('button'));
  expect(vi.getTimerCount()).toBe(0);
});

test('errors accessing an iframe during a later poll reject and release all resources', async () => {
  vi.useFakeTimers();
  const frame = appendFrame();
  const result = wait('button', { includeIframes: true });
  const error = new Error('document access failed');
  vi.spyOn(frame, 'contentDocument', 'get').mockImplementation(() => { throw error; });
  const assertion = expect(result).rejects.toBe(error);
  await vi.advanceTimersByTimeAsync(100);
  await assertion;
  expect(vi.getTimerCount()).toBe(0);
});
