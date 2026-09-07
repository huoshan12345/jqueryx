import { ClickOptions, type EventHandlerOptions } from '../types/lib.js';
import type { Awaitable } from 'builtinx';

declare global {
  interface JQuery<TElement = HTMLElement> {
    /**
     * Cancels events synchronously according to options, then invokes the handler.
     * Receives the jQuery event: currentTarget is the bound element, while target
     * may be a descendant such as SVG. Processing is guarded per binding and bound element.
     * originalEvent is the native
     * MouseEvent, or undefined for a jQuery-triggered click.
     * Handler return values are ignored. Errors go to onError, or console.error if omitted.
     */
    onClick(
      this: this & JQuery<HTMLElement>,
      handler: (event: JQuery.ClickEvent<TElement, undefined, TElement, EventTarget>) => Awaitable<unknown>,
      options?: Partial<ClickOptions>,
    ): this;
    /**
     * Restores native anchor navigation by removing jQuery click handlers and inline onclick attributes,
     * and stopping click propagation during capture at each anchor. Non-anchors are skipped.
     * openNew=true sets target="_blank"; otherwise existing targets remain. Returns this.
     * Does not remove arbitrary native listeners or undo earlier capture-phase cancellation.
     */
    onClickGotoHref(this: this & JQuery<Element>, openNew?: boolean): this;
    /**
     * Stops propagation immediately, preserves default behavior, and reports handler errors.
     * target is event.target (possibly a descendant); key is the event's key value.
     */
    onKeyDown(
      this: this & JQuery<HTMLElement>,
      handler: (target: EventTarget, key: string) => Awaitable<unknown>,
      options?: EventHandlerOptions,
    ): this;
    /** Like onKeyDown, but only handles and stops propagation for Enter. */
    onEnterDown(
      this: this & JQuery<HTMLElement>,
      handler: (target: EventTarget) => Awaitable<unknown>,
      options?: EventHandlerOptions,
    ): this;
    /** Calls each element's native click(), including its default action, and returns this. Disabled controls obey native rules. */
    triggerClick(this: this & JQuery<HTMLElement>): this;
    /** Triggers a jQuery change event on every member, including jQuery bubbling, and returns this. */
    triggerChange(): this;
    /** Dispatches the same native Event sequentially to every target and returns this, ignoring cancellation return values. */
    dispatchEvent(this: this & JQuery<EventTarget>, event: Event): this;
  }
}

interface ClickProcessingState {
  count: number;
  pointerEvents: string;
  priority: string;
}

// Independent bindings may overlap; only the last one restores the original style.
const clickProcessingStates = new WeakMap<HTMLElement, ClickProcessingState>();

function disableClickPointerEvents(element: HTMLElement): void {
  const state = clickProcessingStates.get(element);
  if (state) {
    state.count++;
    return;
  }

  clickProcessingStates.set(element, {
    count: 1,
    pointerEvents: element.style.getPropertyValue('pointer-events'),
    priority: element.style.getPropertyPriority('pointer-events'),
  });
  element.style.setProperty('pointer-events', 'none', 'important');
}

function restoreClickPointerEvents(element: HTMLElement): void {
  const state = clickProcessingStates.get(element);
  if (!state) {
    return;
  }
  state.count--;
  if (state.count > 0) {
    return;
  }

  clickProcessingStates.delete(element);
  if (state.pointerEvents) {
    element.style.setProperty('pointer-events', state.pointerEvents, state.priority);
  } else {
    element.style.removeProperty('pointer-events');
  }
}

async function runEventHandler(
  handler: () => Awaitable<unknown>,
  options?: EventHandlerOptions,
): Promise<void> {
  try {
    await handler();
  } catch (error) {
    if (!options?.onError) {
      console.error(error);
      return;
    }

    try {
      await options.onError(error);
    } catch (errorHandlerError) {
      console.error(errorHandlerError);
    }
  }
}

$.fn.onClick = function <T extends JQuery<HTMLElement>>(
  this: T,
  handler: (event: JQuery.ClickEvent<T[number], undefined, T[number], EventTarget>) => Awaitable<unknown>,
  options?: Partial<ClickOptions>,
) {
  const settings = new ClickOptions(options);
  const processingElements = new WeakSet<HTMLElement>();

  return this.on('click', event => {
    if (settings.preventDefault) {
      event.preventDefault();
    }
    if (settings.stopPropagation) {
      event.stopPropagation();
    }
    if (settings.stopImmediatePropagation) {
      event.stopImmediatePropagation();
    }

    const boundElement = event.currentTarget;
    if (settings.disableWhileProcessing) {
      if (processingElements.has(boundElement)) {
        return;
      }
      processingElements.add(boundElement);
      disableClickPointerEvents(boundElement);
    }

    void runEventHandler(async () => {
      try {
        await handler(event);
      } finally {
        if (settings.disableWhileProcessing) {
          processingElements.delete(boundElement);
          restoreClickPointerEvents(boundElement);
        }
      }
    }, settings);
  });
};

$.fn.onClickGotoHref = function <T extends JQuery<Element>>(this: T, openNew?: boolean) {
  for (const item of this.enumerate()) {
    if (item.isNot('a')) {
      continue;
    }
    if (openNew) {
      item.targetBlank();
    }

    // add an event listener to the window capturing and canceling all events
    for (const element of item) {
      element.addEventListener('click', e => e.stopPropagation(), true);
    }

    item
      .off('click')
      .attr('onclick', null)
      .removeAttr('onclick');
  }

  return this;
};

function bindKeyDown<T extends JQuery<HTMLElement>>(
  nodes: T,
  handler: (target: EventTarget, key: string) => Awaitable<unknown>,
  options?: EventHandlerOptions,
  requiredKey?: string,
): T {
  return nodes.on('keydown', event => {
    if (requiredKey !== undefined && event.key !== requiredKey) {
      return;
    }
    event.stopImmediatePropagation();
    void runEventHandler(() => handler(event.target, event.key), options);
  });
}

$.fn.onKeyDown = function (
  handler: (target: EventTarget, key: string) => Awaitable<unknown>,
  options?: EventHandlerOptions,
) {
  return bindKeyDown(this, handler, options);
};

$.fn.onEnterDown = function (
  handler: (target: EventTarget) => Awaitable<unknown>,
  options?: EventHandlerOptions,
) {
  return bindKeyDown(this, target => handler(target), options, 'Enter');
};

$.fn.triggerClick = function () {
  return this.each((i, e) => e.click());
};

$.fn.triggerChange = function () {
  return this.trigger("change");
};

$.fn.dispatchEvent = function <T extends JQuery<EventTarget>>(this: T, event: Event) {
  return this.each((i, e) => { e.dispatchEvent(event); });
};
