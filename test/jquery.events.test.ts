function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flushHandlers() {
  await new Promise<void>(resolve => setTimeout(resolve, 0));
}

function click(element: HTMLElement) {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  element.dispatchEvent(event);
  return event;
}

function keyDown(element: HTMLElement, key: string) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  element.dispatchEvent(event);
  return event;
}

afterEach(() => {
  $(document.body).empty();
});

describe('onClick', () => {
  test.each(['sync', 'async'] as const)('cancels the event synchronously for a %s handler', async mode => {
    const button = $('<button>').appendTo(document.body);
    const handler = mode === 'sync' ? () => {} : async () => {};
    button.onClick(handler);

    expect(click(button[0]).defaultPrevented).toBe(true);
    await flushHandlers();
  });

  test('stopPropagation preserves sibling listeners but blocks ancestors', async () => {
    const parent = $('<div><button></button></div>').appendTo(document.body);
    const button = parent.find('button');
    const parentHandler = vi.fn();
    const siblingHandler = vi.fn();
    parent.on('click', parentHandler);
    button.onClick(() => {}, { stopPropagation: true });
    button.on('click', siblingHandler);

    click(button[0]);
    expect(parentHandler).not.toHaveBeenCalled();
    expect(siblingHandler).toHaveBeenCalledOnce();
    await flushHandlers();
  });

  test('stopImmediatePropagation also blocks subsequent listeners on the element', async () => {
    const parent = $('<div><button></button></div>').appendTo(document.body);
    const button = parent.find('button');
    const subsequent = vi.fn();
    const ancestor = vi.fn();
    parent.on('click', ancestor);
    button.onClick(() => {}, { stopImmediatePropagation: true });
    button.on('click', subsequent);

    click(button[0]);
    expect(subsequent).not.toHaveBeenCalled();
    expect(ancestor).not.toHaveBeenCalled();
    await flushHandlers();
  });

  test('respects disabled cancellation options and retains the callback target', async () => {
    const parent = $('<div><button><span></span></button></div>').appendTo(document.body);
    const button = parent.find('button');
    const target = button.find('span')[0];
    const ancestor = vi.fn();
    const handler = vi.fn();
    parent.on('click', ancestor);
    expect(button.onClick(handler, { preventDefault: false })).toBe(button);

    const event = click(target);
    expect(event.defaultPrevented).toBe(false);
    expect(ancestor).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(target, event);
    await flushHandlers();
  });

  test('blocks native and jQuery retriggers on the same element while processing', async () => {
    const button = $('<button><span></span></button>').appendTo(document.body);
    const pending = deferred();
    const handler = vi.fn(() => pending.promise);
    button.onClick(handler);

    click(button.find('span')[0]);
    button[0].click();
    button.trigger('click');
    expect(handler).toHaveBeenCalledOnce();
    expect(click(button[0]).defaultPrevented).toBe(true);

    pending.resolve();
    await flushHandlers();
    click(button[0]);
    expect(handler).toHaveBeenCalledTimes(2);
    await flushHandlers();
  });

  test('blocks synchronous recursion from the handler', async () => {
    const button = $('<button>');
    let calls = 0;
    button.onClick(() => {
      calls++;
      if (calls === 1) {
        button.trigger('click');
      }
    });
    button.trigger('click');
    expect(calls).toBe(1);
    await flushHandlers();
  });

  test('only disables the current element in a collection', async () => {
    const buttons = $('<button></button><button></button>').appendTo(document.body);
    const first = deferred();
    const second = deferred();
    const handler = vi.fn(target => target === buttons[0] ? first.promise : second.promise);
    buttons.onClick(handler);

    click(buttons[0]);
    expect(buttons[0].style.pointerEvents).toBe('none');
    expect(buttons[1].style.pointerEvents).toBe('');
    click(buttons[1]);
    expect(handler).toHaveBeenCalledTimes(2);

    first.resolve();
    await flushHandlers();
    expect(buttons[0].style.pointerEvents).toBe('');
    expect(buttons[1].style.pointerEvents).toBe('none');
    second.resolve();
    await flushHandlers();
    expect(buttons[1].style.pointerEvents).toBe('');
  });

  test.each([
    ['', ''],
    ['auto', ''],
    ['auto', 'important'],
    ['none', 'important'],
  ])('restores pointer-events value %j and priority %j', async (value, priority) => {
    const button = $('<button>');
    button[0].style.setProperty('pointer-events', value, priority);
    button[0].style.color = 'red';
    const pending = deferred();
    button.onClick(() => pending.promise);
    button.trigger('click');
    expect(button[0].style.pointerEvents).toBe('none');

    pending.resolve();
    await flushHandlers();
    expect(button[0].style.getPropertyValue('pointer-events')).toBe(value);
    expect(button[0].style.getPropertyPriority('pointer-events')).toBe(priority);
    expect(button[0].style.color).toBe('red');
  });

  test('independent bindings share style ownership until both handlers finish', async () => {
    const button = $('<button style="pointer-events: auto">');
    const first = deferred();
    const second = deferred();
    const secondHandler = vi.fn(() => second.promise);
    button.onClick(() => first.promise);
    button.onClick(secondHandler);
    button.trigger('click');
    expect(secondHandler).toHaveBeenCalledOnce();

    first.resolve();
    await flushHandlers();
    expect(button[0].style.pointerEvents).toBe('none');
    second.resolve();
    await flushHandlers();
    expect(button[0].style.pointerEvents).toBe('auto');
  });

  test('allows overlapping calls without changing style when disabling is opted out', async () => {
    const button = $('<button style="pointer-events: auto">');
    const pending = deferred();
    const handler = vi.fn(() => pending.promise);
    button.onClick(handler, { disableWhileProcessing: false });
    button.trigger('click').trigger('click');
    expect(handler).toHaveBeenCalledTimes(2);
    expect(button[0].style.pointerEvents).toBe('auto');
    pending.resolve();
    await flushHandlers();
  });

  test('keeps synthetic event compatibility and ignores handler return values', async () => {
    const button = $('<button>');
    const handler = vi.fn(() => false);
    button.onClick(handler, { preventDefault: false });
    const event = $.Event('click');
    button.triggerHandler(event);
    expect(handler).toHaveBeenCalledWith(button[0], undefined);
    expect(event.isDefaultPrevented()).toBe(false);
    await flushHandlers();
  });
});

describe('keyboard handlers', () => {
  test('onKeyDown blocks following listeners before invoking the handler', async () => {
    const parent = $('<div><input></div>').appendTo(document.body);
    const input = parent.find('input');
    const subsequent = vi.fn();
    const ancestor = vi.fn();
    const handler = vi.fn();
    input.onKeyDown(handler);
    input.on('keydown', subsequent);
    parent.on('keydown', ancestor);

    const event = keyDown(input[0], 'a');
    expect(handler).toHaveBeenCalledWith(input[0], 'a');
    expect(subsequent).not.toHaveBeenCalled();
    expect(ancestor).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    await flushHandlers();
  });

  test('onEnterDown only handles and intercepts Enter', async () => {
    const input = $('<input>');
    const handler = vi.fn();
    const subsequent = vi.fn();
    expect(input.onEnterDown(handler)).toBe(input);
    input.on('keydown', subsequent);

    keyDown(input[0], 'Escape');
    expect(handler).not.toHaveBeenCalled();
    expect(subsequent).toHaveBeenCalledOnce();
    keyDown(input[0], 'Enter');
    expect(handler).toHaveBeenCalledWith(input[0]);
    expect(subsequent).toHaveBeenCalledOnce();
    await flushHandlers();
  });
});

interface EventBinding {
  name: string;
  bind(nodes: JQuery, handler: () => Awaitable<unknown>, options?: EventHandlerOptions): JQuery;
  trigger(nodes: JQuery): void;
}

const bindings: EventBinding[] = [
  {
    name: 'onClick',
    bind: (nodes, handler, options) => nodes.onClick(handler, options),
    trigger: nodes => { click(nodes[0]); },
  },
  {
    name: 'onKeyDown',
    bind: (nodes, handler, options) => nodes.onKeyDown(handler, options),
    trigger: nodes => { keyDown(nodes[0], 'a'); },
  },
  {
    name: 'onEnterDown',
    bind: (nodes, handler, options) => nodes.onEnterDown(handler, options),
    trigger: nodes => { keyDown(nodes[0], 'Enter'); },
  },
];

for (const binding of bindings) {
  describe(`${binding.name} error handling`, () => {
    test.each(['throw', 'reject'] as const)('forwards a handler %s to onError', async mode => {
      const node = $('<button>');
      const error = new Error('handler failed');
      const onError = vi.fn();
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
      binding.bind(node, () => {
        if (mode === 'throw') {
          throw error;
        }
        return Promise.reject(error);
      }, { onError });

      binding.trigger(node);
      await flushHandlers();
      expect(onError).toHaveBeenCalledExactlyOnceWith(error);
      expect(logged).not.toHaveBeenCalled();
    });

    test.each(['throw', 'reject'] as const)('reports a handler %s when onError is omitted', async mode => {
      const node = $('<button>');
      const error = new Error('handler failed');
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
      binding.bind(node, () => {
        if (mode === 'throw') {
          throw error;
        }
        return Promise.reject(error);
      });

      binding.trigger(node);
      await flushHandlers();
      expect(logged).toHaveBeenCalledExactlyOnceWith(error);
    });

    test.each(['throw', 'reject'] as const)('also reports an onError %s', async mode => {
      const node = $('<button>');
      const error = new Error('error callback failed');
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
      binding.bind(node, () => Promise.reject('original failure'), {
        onError: () => {
          if (mode === 'throw') {
            throw error;
          }
          return Promise.reject(error);
        },
      });

      binding.trigger(node);
      await flushHandlers();
      expect(logged).toHaveBeenCalledExactlyOnceWith(error);
    });

    test('accepts non-Error rejection values and expression-bodied error callbacks', async () => {
      const node = $('<button>');
      const errors: unknown[] = [];
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
      binding.bind(node, () => Promise.reject(undefined), {
        onError: async error => errors.push(error),
      });

      binding.trigger(node);
      await flushHandlers();
      expect(errors).toEqual([undefined]);
      expect(logged).not.toHaveBeenCalled();
    });
  });
}

test.each(['throw', 'reject'] as const)('a click handler %s restores state before error recovery', async mode => {
  const button = $('<button style="pointer-events: auto !important">');
  const error = new Error('try again');
  const handler = vi.fn()
    .mockImplementationOnce(() => {
      if (mode === 'throw') {
        throw error;
      }
      return Promise.reject(error);
    })
    .mockReturnValue(undefined);
  let restoredStyle: string | undefined;
  let restoredPriority: string | undefined;
  const onError = vi.fn(() => {
    restoredStyle = button[0].style.pointerEvents;
    restoredPriority = button[0].style.getPropertyPriority('pointer-events');
    button.trigger('click');
  });
  button.onClick(handler, { onError });

  button.trigger('click');
  await flushHandlers();
  expect(onError).toHaveBeenCalledExactlyOnceWith(error);
  expect(handler).toHaveBeenCalledTimes(2);
  expect(restoredStyle).toBe('auto');
  expect(restoredPriority).toBe('important');
  expect(button[0].style.pointerEvents).toBe('auto');
});
import type { Awaitable } from 'builtinx';
import type { EventHandlerOptions } from '@/types/lib';
