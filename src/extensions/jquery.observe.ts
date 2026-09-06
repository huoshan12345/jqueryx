import type { JQueryMutationCallback, JQueryObservation } from '../types/lib.js';
import { MutationObserverOptions, type MutationObserverOptionsInit, type NodeMutationCallback } from 'builtinx';

declare global {
  interface JQuery<TElement = HTMLElement> {
    /**
     * Observes every node, returning a subscription that disconnects the entire group.
     * Startup callbacks follow builtinx options and can run before this method returns.
     * If registration fails, all observers created by this call are disconnected.
     */
    observe(
      this: this & JQuery<Node>,
      callback: JQueryMutationCallback<TElement>,
      options?: MutationObserverOptionsInit,
    ): JQueryObservation;
  }
}

$.fn.observe = function <TElement extends Node>(
  this: JQuery<TElement>,
  callback: JQueryMutationCallback<TElement>,
  options?: MutationObserverOptionsInit,
): JQueryObservation {
  const nodes = this;
  const observers = new Set<MutationObserver>();
  let disconnected = false;

  const subscription: JQueryObservation = {
    disconnect() {
      disconnected = true;
      for (const observer of observers) {
        observer.disconnect();
      }
      observers.clear();
    },
  };

  function guard(handler?: NodeMutationCallback): NodeMutationCallback {
    return (records, observer, node) => {
      if (disconnected) {
        return;
      }
      // Startup hooks run before Node.observe returns its handle.
      observers.add(observer);
      handler?.(records, observer, node);
    };
  }

  try {
    for (const node of nodes) {
      const settings = { ...MutationObserverOptions.default, ...options };
      const observer = Node.prototype.observe.call(node, guard((records, observer) => {
        callback(records, observer, nodes);
      }), {
        ...options,
        beforeCallback: guard(settings.beforeCallback),
        afterCallback: guard(settings.afterCallback),
        onSkipped: guard(settings.onSkipped),
      });
      observers.add(observer);
    }
  } catch (error) {
    subscription.disconnect();
    throw error;
  }

  return subscription;
};
