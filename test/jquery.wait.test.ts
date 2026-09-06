import type { WaitForNodesOptions } from '@/types/lib.js';

const controllers: AbortController[] = [];
const pending: Promise<unknown>[] = [];

function wait(
  roots: JQuery<Node & ParentNode>,
  selector: string,
  options: WaitForNodesOptions = {},
) {
  const controller = new AbortController();
  controllers.push(controller);
  const result = roots.waitForNodes(selector, { signal: controller.signal, ...options });
  pending.push(result);
  void result.catch(() => {});
  return result;
}

afterEach(async () => {
  for (const controller of controllers.splice(0)) {
    controller.abort();
  }
  await Promise.allSettled(pending.splice(0));
  document.body.replaceChildren();
  vi.useRealTimers();
});

test('returns existing descendants from multiple roots, without duplicates or root matches', async () => {
  const root = $('<section class="match"><div><button class="match"></button></div><i class="match"></i></section>');
  const roots = root.add(root.find('div'));
  const result = await wait(roots, '.match');
  expect(result.toArray()).toEqual(root.find('.match').toArray());
});

test('waits for asynchronous insertion and resolves only once', async () => {
  vi.useFakeTimers();
  const root = $('<div>');
  const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
  const result = wait(root, '.ready');
  const completed = vi.fn();
  void result.then(completed);
  root.append('<button class="ready"></button><span class="ready"></span>');
  expect(await result).toHaveLength(2);
  expect(disconnect).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
  root.append('<p class="ready"></p>');
  await Promise.resolve();
  expect(completed).toHaveBeenCalledOnce();
});

test('detects attribute changes on existing nodes', async () => {
  const root = $('<div><button></button></div>');
  const result = wait(root, 'button.ready');
  root.find('button').addClass('ready');
  expect((await result)[0]).toBe(root.find('button')[0]);
});

test('complex selectors cannot trigger an observer loop through jQuery context IDs', async () => {
  const parent = $('<section><div></div></section>');
  const root = parent.find('div');
  const nativeSetAttribute = root[0].setAttribute;
  let calls = 0;
  vi.spyOn(root[0], 'setAttribute').mockImplementation(function (this: HTMLElement, name, value) {
    // Bound a regression so an observer feedback loop cannot hang the test worker.
    if (++calls > 5) {
      throw new Error('Selector created an observer loop');
    }
    nativeSetAttribute.call(this, name, value);
  });
  const result = wait(root, '.left + .right');
  root.append('<span></span>');
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(calls).toBeLessThanOrEqual(2);
  root.append('<i class="left"></i><b class="right"></b>');
  expect((await result)[0].tagName).toBe('B');
});

test('rechecks selectors when character data changes', async () => {
  const root = $('<div><span>waiting</span></div>');
  const query = vi.spyOn(root[0], 'querySelectorAll');
  const result = wait(root, 'button');
  root.find('span')[0].firstChild!.nodeValue = '';
  await Promise.resolve();
  expect(query).toHaveBeenCalledTimes(2);
  root.append('<button></button>');
  expect(await result).toHaveLength(1);
});

test('supports detached fragments', async () => {
  const fragment = document.createDocumentFragment();
  const result = wait($(fragment), 'button');
  const button = document.createElement('button');
  fragment.append(button);
  expect((await result)[0]).toBe(button);
});

test('times out after the default 30 seconds and releases resources', async () => {
  vi.useFakeTimers();
  const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
  const result = wait($('<div>'), '.missing');
  const assertion = expect(result).rejects.toMatchObject({ name: 'TimeoutError' });
  await vi.advanceTimersByTimeAsync(29_999);
  expect(disconnect).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  await assertion;
  expect(disconnect).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

test('zero timeout checks once without creating observers or timers', async () => {
  vi.useFakeTimers();
  const observe = vi.spyOn(MutationObserver.prototype, 'observe');
  expect(await wait($('<div><button></button></div>'), 'button', { timeoutMs: 0 })).toHaveLength(1);
  await expect(wait($('<div>'), 'button', { timeoutMs: 0 })).rejects.toMatchObject({ name: 'TimeoutError' });
  expect(observe).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

test.each([-1, NaN, Infinity, -Infinity])('rejects invalid timeout %s', async timeoutMs => {
  await expect(wait($('<div>'), 'button', { timeoutMs })).rejects.toBeInstanceOf(RangeError);
});

test('large finite timeouts do not overflow the native timer', async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  const result = wait($('<div>'), '.missing', { timeoutMs: 2_147_483_648, signal: controller.signal });
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
  const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
  const remove = vi.spyOn(controller.signal, 'removeEventListener');
  const reason = { cancelled: true };
  const result = wait($('<div>'), 'button', { signal: controller.signal });
  controller.abort(reason);
  await expect(result).rejects.toBe(reason);
  expect(disconnect).toHaveBeenCalledOnce();
  expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  expect(vi.getTimerCount()).toBe(0);
});

test('an already aborted signal takes precedence over existing matches', async () => {
  const controller = new AbortController();
  controller.abort('already cancelled');
  const observe = vi.spyOn(MutationObserver.prototype, 'observe');
  await expect(wait($('<div><button></button></div>'), 'button', {
    signal: controller.signal,
  })).rejects.toBe('already cancelled');
  expect(observe).not.toHaveBeenCalled();
});

test.each(['', ' ', '['])('rejects invalid CSS selector %j without leaving timers', async selector => {
  vi.useFakeTimers();
  await expect(wait($('<div>'), selector)).rejects.toHaveProperty('name', selector.trim() ? 'SyntaxError' : 'TypeError');
  expect(vi.getTimerCount()).toBe(0);
});

test('concurrent waits on the same root finish independently without mutating root IDs', async () => {
  const parent = $('<section><div></div></section>');
  const root = parent.find('div');
  const setAttribute = vi.spyOn(root[0], 'setAttribute');
  const first = wait(root, '.left + .right');
  const second = wait(root, '.left ~ .last');
  root.append('<i class="left"></i><b class="right"></b>');
  expect(await first).toHaveLength(1);
  root.append('<b class="last"></b>');
  expect(await second).toHaveLength(1);
  expect(setAttribute).not.toHaveBeenCalled();
});

test('rejects an empty root collection', async () => {
  await expect(wait($(), '.ready')).rejects.toThrow('existing root');
});

test('cleans up earlier observers if registration fails midway', async () => {
  const nativeObserve = MutationObserver.prototype.observe;
  const second = document.createElement('div');
  const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
  vi.spyOn(MutationObserver.prototype, 'observe').mockImplementation(function (this: MutationObserver, target, options) {
    if (target === second) {
      throw new Error('registration failed');
    }
    nativeObserve.call(this, target, options);
  });
  await expect(wait($([document.createElement('div'), second]), '.ready')).rejects.toThrow('registration failed');
  expect(disconnect).toHaveBeenCalledTimes(2);
});

function appendFrame(): HTMLIFrameElement {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  return frame;
}

test('iframe documents are excluded by default', async () => {
  appendFrame().contentDocument!.body.innerHTML = '<button></button>';
  await expect(wait($(document), 'button', { timeoutMs: 0 })).rejects.toMatchObject({ name: 'TimeoutError' });
});

test('includes existing same-origin iframe matches when enabled', async () => {
  const frame = appendFrame();
  frame.contentDocument!.body.innerHTML = '<button></button>';
  const result = await wait($(document), 'button', { includeIframes: true });
  expect(result[0]).toBe(frame.contentDocument!.querySelector('button'));
});

test('waits inside a frame root and removes its load listener after success', async () => {
  const frame = appendFrame();
  const remove = vi.spyOn(frame, 'removeEventListener');
  const result = wait($(frame), 'button', { includeIframes: true });
  frame.contentDocument!.body.innerHTML = '<button></button>';
  expect(await result).toHaveLength(1);
  expect(remove).toHaveBeenCalledWith('load', expect.any(Function));
});

test('discovers newly inserted and nested iframe documents', async () => {
  const result = wait($(document), 'button', { includeIframes: true });
  const frame = appendFrame();
  const nested = frame.contentDocument!.createElement('iframe');
  frame.contentDocument!.body.append(nested);
  nested.contentDocument!.body.innerHTML = '<button></button>';
  expect((await result)[0]).toBe(nested.contentDocument!.querySelector('button'));
});

test('replaces frame observers on load and stops observing the old document', async () => {
  const frame = appendFrame();
  const oldDocument = frame.contentDocument!;
  const observe = vi.spyOn(MutationObserver.prototype, 'observe');
  const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
  const result = wait($(document), 'button', { includeIframes: true });
  const replacement = document.implementation.createHTMLDocument();
  vi.spyOn(frame, 'contentDocument', 'get').mockReturnValue(replacement);
  frame.dispatchEvent(new Event('load'));
  expect(disconnect).toHaveBeenCalledOnce();
  expect(observe).toHaveBeenCalledWith(replacement, expect.any(Object));
  oldDocument.body.innerHTML = '<button id="old"></button>';
  replacement.body.innerHTML = '<button id="new"></button>';
  expect((await result)[0].id).toBe('new');
});

test('removing a frame releases its observer and load listener while waiting', async () => {
  const frame = appendFrame();
  const remove = vi.spyOn(frame, 'removeEventListener');
  const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
  const result = wait($(document), 'button', { includeIframes: true });
  frame.remove();
  await Promise.resolve();
  expect(remove).toHaveBeenCalledWith('load', expect.any(Function));
  expect(disconnect).toHaveBeenCalledOnce();
  document.body.append(document.createElement('button'));
  expect(await result).toHaveLength(1);
});

test('skips inaccessible frame documents and continues waiting in accessible roots', async () => {
  const frame = appendFrame();
  vi.spyOn(frame, 'contentDocument', 'get').mockImplementation(() => {
    throw new DOMException('Access denied', 'SecurityError');
  });
  const result = wait($(document), 'button', { includeIframes: true });
  document.body.append(document.createElement('button'));
  expect(await result).toHaveLength(1);
});

test('errors during a later frame load reject and release all resources', async () => {
  vi.useFakeTimers();
  const frame = appendFrame();
  const remove = vi.spyOn(frame, 'removeEventListener');
  const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
  const result = wait($(document), 'button', { includeIframes: true });
  const error = new Error('document access failed');
  vi.spyOn(frame, 'contentDocument', 'get').mockImplementation(() => { throw error; });
  frame.dispatchEvent(new Event('load'));
  await expect(result).rejects.toBe(error);
  expect(disconnect).toHaveBeenCalledTimes(2);
  expect(remove).toHaveBeenCalledWith('load', expect.any(Function));
  expect(vi.getTimerCount()).toBe(0);
});
