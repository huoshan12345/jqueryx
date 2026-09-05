import type { JQueryObservation } from '@/types/lib';
import { MutationObserverOptions } from 'builtinx';

const subscriptions: JQueryObservation[] = [];

afterEach(() => {
  for (const subscription of subscriptions.splice(0)) {
    subscription.disconnect();
  }
  vi.useRealTimers();
});

test('disconnects the entire collection before its first mutation', async () => {
  const nodes = $([document.createElement('div'), document.createElement('div')]);
  const callback = vi.fn();
  const subscription = nodes.observe(callback, { callOnStart: false, debounce: false });
  subscriptions.push(subscription);
  expect(callback).not.toHaveBeenCalled();
  subscription.disconnect();
  subscription.disconnect();
  nodes.append('<span>');
  await Promise.resolve();
  expect(callback).not.toHaveBeenCalled();
});

test('delivers each node mutation with the original collection and stops afterwards', async () => {
  const nodes = $([document.createElement('div'), document.createElement('div')]);
  const callback = vi.fn();
  const subscription = nodes.observe(callback, { callOnStart: false, debounce: false });
  subscriptions.push(subscription);
  nodes.append('<span>');
  await Promise.resolve();
  expect(callback).toHaveBeenCalledTimes(2);
  expect(callback.mock.calls.map(([records]) => records[0].target)).toEqual(nodes.toArray());
  for (const [, observer, collection] of callback.mock.calls) {
    expect(observer).toBeInstanceOf(MutationObserver);
    expect(collection).toBe(nodes);
  }
  subscription.disconnect();
  nodes.append('<span>');
  await Promise.resolve();
  expect(callback).toHaveBeenCalledTimes(2);
});

test('keeps independent subscriptions independent', async () => {
  const nodes = $('<div>');
  const first = vi.fn();
  const second = vi.fn();
  const options = { callOnStart: false, debounce: false } as const;
  const subscription = nodes.observe(first, options);
  subscriptions.push(subscription, nodes.observe(second, options));
  subscription.disconnect();
  nodes.append('<span>');
  await Promise.resolve();
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledOnce();
});

test('suppresses pending debounce callbacks and lifecycle hooks after disconnect', async () => {
  vi.useFakeTimers();
  const nodes = $('<div>');
  const callback = vi.fn();
  const beforeCallback = vi.fn();
  const afterCallback = vi.fn();
  const subscription = nodes.observe(callback, {
    callOnStart: false,
    debounce: { leading: false, trailing: true, debounceMs: 50 },
    beforeCallback,
    afterCallback,
  });
  subscriptions.push(subscription);
  nodes.append('<span>');
  await Promise.resolve();
  expect(vi.getTimerCount()).toBeGreaterThan(0);
  subscription.disconnect();
  await vi.runAllTimersAsync();
  expect(callback).not.toHaveBeenCalled();
  expect(beforeCallback).not.toHaveBeenCalled();
  expect(afterCallback).not.toHaveBeenCalled();
});

test('preserves synchronous startup callbacks and their hook ordering', () => {
  const nodes = $('<div>');
  const order: string[] = [];
  subscriptions.push(nodes.observe(() => order.push('callback'), {
    callOnStart: true,
    debounce: false,
    beforeCallback: () => order.push('before'),
    afterCallback: () => order.push('after'),
  }));
  expect(order).toEqual(['before', 'callback', 'after']);
});

test('uses host lifecycle defaults and lets explicit undefined disable a hook', () => {
  const previous = { ...MutationObserverOptions.default };
  const beforeCallback = vi.fn();
  const afterCallback = vi.fn();
  try {
    MutationObserverOptions.default = { beforeCallback, afterCallback };
    subscriptions.push($('<div>').observe(() => {}, {
      callOnStart: true,
      beforeCallback: undefined,
    }));
    expect(beforeCallback).not.toHaveBeenCalled();
    expect(afterCallback).toHaveBeenCalledOnce();
  } finally {
    MutationObserverOptions.default = { beforeCallback: undefined, afterCallback: undefined, ...previous };
  }
});

test('disconnecting inside a lifecycle hook suppresses the remaining callbacks', async () => {
  const nodes = $('<div>');
  const callback = vi.fn();
  const afterCallback = vi.fn();
  const subscription = nodes.observe(callback, {
    callOnStart: false,
    debounce: false,
    beforeCallback: () => subscription.disconnect(),
    afterCallback,
  });
  subscriptions.push(subscription);
  nodes.append('<span>');
  await Promise.resolve();
  expect(callback).not.toHaveBeenCalled();
  expect(afterCallback).not.toHaveBeenCalled();
});

test('preserves exclusions and the skipped hook', async () => {
  const nodes = $('<div>');
  const callback = vi.fn();
  const onSkipped = vi.fn();
  subscriptions.push(nodes.observe(callback, {
    callOnStart: false,
    debounce: false,
    exclusions: [record => record.type === 'childList'],
    onSkipped,
  }));
  nodes.append('<span>');
  await Promise.resolve();
  expect(callback).not.toHaveBeenCalled();
  expect(onSkipped).toHaveBeenCalledOnce();
});

test.each(['callback', 'beforeCallback', 'afterCallback'] as const)(
  'cleans up a partially registered collection when startup %s throws', async hook => {
    const nodes = $([document.createElement('div'), document.createElement('div')]);
    const error = new Error('startup failed');
    let calls = 0;
    const throwOnSecond = vi.fn(() => {
      if (++calls === 2) {
        throw error;
      }
    });
    const callback = hook === 'callback' ? throwOnSecond : vi.fn();
    const options = {
      callOnStart: true,
      debounce: false,
      ...(hook === 'callback' ? {} : { [hook]: throwOnSecond }),
    } as const;
    expect(() => nodes.observe(callback, options)).toThrow(error);
    const previousCalls = callback.mock.calls.length;
    nodes.append('<span>');
    await Promise.resolve();
    expect(callback).toHaveBeenCalledTimes(previousCalls);
  },
);

test('returns a disposable subscription for an empty collection', () => {
  const callback = vi.fn();
  const subscription = $().observe(callback);
  subscriptions.push(subscription);
  expect(() => subscription.disconnect()).not.toThrow();
  expect(callback).not.toHaveBeenCalled();
});

test('observes nodes in a same-origin iframe', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  try {
    const node = frame.contentDocument!.createElement('div');
    const callback = vi.fn();
    subscriptions.push($(node).observe(callback, { callOnStart: false, debounce: false }));
    node.appendChild(frame.contentDocument!.createElement('span'));
    await Promise.resolve();
    expect(callback).toHaveBeenCalledOnce();
  } finally {
    frame.remove();
  }
});
