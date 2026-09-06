import type { EventHandlerOptions } from '@/types/lib.js';
import type { Awaitable } from 'builtinx';
import { ClickOptions } from '@/index.js';

test('ClickOptions supplies independent defaults and accepts explicit overrides', () => {
  const defaults = new ClickOptions();
  expect(defaults.preventDefault).toBe(true);
  expect(defaults.stopPropagation).toBe(false);
  expect(defaults.stopImmediatePropagation).toBe(false);
  expect(defaults.disableWhileProcessing).toBe(true);
  expect(defaults.onError).toBeUndefined();
  const onError = vi.fn();
  const input = {
    preventDefault: false,
    stopPropagation: true,
    stopImmediatePropagation: true,
    disableWhileProcessing: false,
    onError,
  };
  const custom = new ClickOptions(input);
  expect(custom).toMatchObject(input);
  custom.preventDefault = true;
  expect(input.preventDefault).toBe(false);
  expect(new ClickOptions()).toEqual(defaults);
});

test('triggerClick performs a native click on every enabled control and is chainable', () => {
  const nodes = $('<input type="checkbox"><input type="checkbox"><input type="checkbox" disabled>');
  const events: Event[] = [];
  for (const node of nodes) {
    node.addEventListener('click', event => events.push(event));
  }
  expect(nodes.triggerClick()).toBe(nodes);
  expect(nodes.toArray().map(node => $(node).prop('checked'))).toEqual([true, true, false]);
  expect(events.map(event => event.target)).toEqual([nodes[0], nodes[1]]);
  expect($().triggerClick()).toHaveLength(0);
});

test('triggerChange invokes jQuery handlers on every element and bubbles', () => {
  const root = $('<div><input><input></div>');
  const nodes = root.find('input');
  const own = vi.fn();
  const parent = vi.fn();
  nodes.on('change', own);
  root.on('change', parent);
  expect(nodes.triggerChange()).toBe(nodes);
  expect(own.mock.calls.map(([event]) => event.target)).toEqual(nodes.toArray());
  expect(parent).toHaveBeenCalledTimes(2);
  expect($().triggerChange()).toHaveLength(0);
});

test('dispatchEvent delivers the supplied native event to every target including plain EventTargets', () => {
  const targets = [new EventTarget(), new EventTarget()];
  const nodes = $<EventTarget>();
  $.merge(nodes, targets);
  const seen: Event[] = [];
  const origins: EventTarget[] = [];
  for (const target of targets) {
    target.addEventListener('custom', event => {
      seen.push(event);
      origins.push(event.target!);
      event.preventDefault();
    });
  }
  const event = new Event('custom', { cancelable: true });
  expect(nodes.dispatchEvent(event)).toBe(nodes);
  expect(seen).toEqual([event, event]);
  expect(origins).toEqual(targets);
  expect(event.defaultPrevented).toBe(true);
  expect($().dispatchEvent(new Event('custom'))).toHaveLength(0);
});

test('dispatchEvent honors native bubbling for DOM targets', () => {
  const root = $('<div><button></button></div>');
  const parent = vi.fn();
  root[0].addEventListener('custom', parent);
  root.find('button').dispatchEvent(new Event('custom', { bubbles: false }));
  expect(parent).not.toHaveBeenCalled();
  root.find('button').dispatchEvent(new Event('custom', { bubbles: true }));
  expect(parent).toHaveBeenCalledOnce();
});

test('event bindings on empty collections return the same collection without invoking handlers', () => {
  const nodes = $();
  const handler = vi.fn();
  expect(nodes.onClick(handler).onKeyDown(handler).onEnterDown(handler).onClickGotoHref()).toBe(nodes);
  nodes.triggerClick().triggerChange();
  expect(handler).not.toHaveBeenCalled();
});

test('onClickGotoHref preserves the default action while suppressing ancestor bubbling', () => {
  const root = $('<div><a href="#target">link</a></div>');
  const anchor = root.find('a');
  const parent = vi.fn();
  root[0].addEventListener('click', parent);
  anchor.onClickGotoHref();
  // A non-MouseEvent avoids jsdom navigation, while still testing click propagation.
  const event = new Event('click', { bubbles: true, cancelable: true });
  expect(anchor[0].dispatchEvent(event)).toBe(true);
  expect(event.defaultPrevented).toBe(false);
  expect(parent).not.toHaveBeenCalled();
});

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

test.each(['click', 'keydown', 'enter'] as const)(
  '%s retains the actual SVG event origin and permits safe narrowing', async kind => {
    const button = $('<button><svg tabindex="0"><path></path></svg></button>').appendTo(document.body);
    const target = button.find('svg')[0];
    let received: EventTarget | undefined;
    const onError = vi.fn();
    const handler = (origin: EventTarget) => {
      received = origin;
      if ($.isElement(origin)) {
        origin.setAttribute('data-handled', 'yes');
      }
    };
    if (kind === 'click') {
      button.onClick(handler, { onError });
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    } else {
      if (kind === 'keydown') {
        button.onKeyDown(handler, { onError });
      } else {
        button.onEnterDown(handler, { onError });
      }
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    }
    await flushHandlers();
    expect(received).toBe(target);
    expect(target.getAttribute('data-handled')).toBe('yes');
    expect(onError).not.toHaveBeenCalled();
  },
);

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
test.each([undefined, false, true])('onClickGotoHref only changes anchors in a mixed collection with openNew=%s', openNew => {
  const root = $('<div><a href="#first" target="frame">first</a><button onclick="return false" target="keep">button</button><a href="#second">second</a></div>');
  const nodes = root.children();
  const anchors = root.find('a');
  const button = root.find('button');
  const anchorClick = vi.fn();
  const buttonClick = vi.fn();
  const nativeButtonClick = vi.fn();
  const parentClick = vi.fn();
  anchors.on('click', anchorClick).attr('onclick', 'return false');
  button.on('click', buttonClick);
  button[0].addEventListener('click', nativeButtonClick);
  root.on('click', parentClick);
  const addButtonListener = vi.spyOn(button[0], 'addEventListener');

  expect(nodes.onClickGotoHref(openNew)).toBe(nodes);
  expect(addButtonListener).not.toHaveBeenCalled();
  expect(button.attr('onclick')).toBe('return false');
  expect(button.attr('target')).toBe('keep');
  expect(anchors.eq(0).attr('target')).toBe(openNew ? '_blank' : 'frame');
  expect(anchors.eq(1).attr('target')).toBe(openNew ? '_blank' : undefined);
  expect(anchors.eq(0).attr('href')).toBe('#first');
  expect(anchors.eq(1).attr('href')).toBe('#second');
  for (const anchor of anchors) {
    expect(anchor.hasAttribute('onclick')).toBe(false);
    $(anchor).triggerHandler('click');
  }
  expect(anchorClick).not.toHaveBeenCalled();

  button[0].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  expect(buttonClick).toHaveBeenCalledOnce();
  expect(nativeButtonClick).toHaveBeenCalledOnce();
  expect(parentClick).toHaveBeenCalledOnce();
});
