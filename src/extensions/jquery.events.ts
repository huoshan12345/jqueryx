import { ClickOptions, type EventHandlerOptions } from '@/types/lib';
import type { Awaitable } from 'builtinx';

declare global {
  interface JQuery<TElement = HTMLElement> {
    /**
     * Cancels events synchronously according to options, then invokes the handler.
     * Processing is guarded per binding and bound element; target remains the clicked node.
     * Handler return values are ignored. Errors go to onError, or console.error if omitted.
     */
    onClick(
      this: this & JQuery<HTMLElement>,
      handler: (target: HTMLElement, originalEvent?: MouseEvent) => Awaitable<unknown>,
      options?: Partial<ClickOptions>,
    ): this;
    onClickGotoHref(this: this & JQuery<Element>, openNew?: boolean): this;
    /** Stops propagation immediately, preserves default behavior, and reports handler errors. */
    onKeyDown(
      this: this & JQuery<HTMLElement>,
      handler: (target: HTMLElement, key: string) => Awaitable<unknown>,
      options?: EventHandlerOptions,
    ): this;
    /** Like onKeyDown, but only handles and stops propagation for Enter. */
    onEnterDown(
      this: this & JQuery<HTMLElement>,
      handler: (target: HTMLElement) => Awaitable<unknown>,
      options?: EventHandlerOptions,
    ): this;
    triggerClick(this: this & JQuery<HTMLElement>): this;
    triggerChange(): this;
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

$.fn.onClick = function (
  handler: (target: HTMLElement, originalEvent?: MouseEvent) => Awaitable<unknown>,
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

    const element = event.currentTarget;
    if (settings.disableWhileProcessing) {
      if (processingElements.has(element)) {
        return;
      }
      processingElements.add(element);
      disableClickPointerEvents(element);
    }

    void runEventHandler(async () => {
      try {
        await handler(event.target, event.originalEvent);
      } finally {
        if (settings.disableWhileProcessing) {
          processingElements.delete(element);
          restoreClickPointerEvents(element);
        }
      }
    }, settings);
  });
};

$.fn.onClickGotoHref = function <T extends JQuery<Element>>(this: T, openNew?: boolean) {
  if (this.isNot('a')) {
    return this;
  }
  if (openNew) {
    this.targetBlank();
  }

  // add an event listener to the window capturing and canceling all events
  for (const element of this) {
    element.addEventListener('click', e => e.stopPropagation(), true);
  }

  return this
    .off('click')
    .attr('onclick', null)
    .removeAttr('onclick');
};

function bindKeyDown<T extends JQuery<HTMLElement>>(
  nodes: T,
  handler: (target: HTMLElement, key: string) => Awaitable<unknown>,
  options?: EventHandlerOptions,
  key?: string,
): T {
  return nodes.on('keydown', event => {
    if (key !== undefined && event.key !== key) {
      return;
    }
    event.stopImmediatePropagation();
    void runEventHandler(() => handler(event.target, event.key), options);
  });
}

$.fn.onKeyDown = function (
  handler: (target: HTMLElement, key: string) => Awaitable<unknown>,
  options?: EventHandlerOptions,
) {
  return bindKeyDown(this, handler, options);
};

$.fn.onEnterDown = function (
  handler: (target: HTMLElement) => Awaitable<unknown>,
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
