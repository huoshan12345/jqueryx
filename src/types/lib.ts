import type { Awaitable, HTMLNode } from 'builtinx';

/** Convenience alias for a jQuery collection of builtinx HTMLNode values. */
export type JQueryNode = JQuery<HTMLNode>;
/** Receives one observer delivery and the original collection passed to observe. */
export type JQueryMutationCallback<TElement = HTMLElement> = (
  mutations: MutationRecord[],
  observer: MutationObserver,
  jQuery: JQuery<TElement>,
) => void;

/** Owns all observers created by one JQuery.observe call. */
export interface JQueryObservation {
  /** Stops all observers and suppresses pending callbacks. Safe to call repeatedly. */
  disconnect(): void;
}

/** Polling, timeout, cancellation and iframe options for $.waitForNodes. */
export interface WaitForNodesOptions {
  /** Finite non-negative milliseconds. Defaults to 30,000; zero checks only once. */
  timeoutMs?: number;
  /** Finite positive milliseconds between queries. Defaults to 100. */
  pollIntervalMs?: number;
  /** Cancels the wait with signal.reason, including if already aborted. */
  signal?: AbortSignal;
  /** Discovers accessible iframe documents on every query. Defaults to false. */
  includeIframes?: boolean;
}

/** URL path transformation and image fallback behavior for refineUrls. */
export interface RefineUrlsOptions {
  /** Transforms the pathname of each matching external URL before changing its origin. */
  pathRewrite?: (path: string) => string;
  /**
   * Adds/reuses a fallback link for every selected image with a src, even if its URL
   * is not rewritten. Defaults to false, which removes links previously managed here.
   */
  addImageFallbackLinks?: boolean;
}

/** Error reporting shared by async click and keyboard handlers. */
export interface EventHandlerOptions {
  /**
   * Handles synchronous throws and asynchronous rejections. Defaults to console.error.
   * If this callback throws or rejects, its error is also reported to console.error.
   */
  onError?: (error: unknown) => Awaitable<unknown>;
}

/** Resolved onClick settings. Every construction creates independent defaults. */
export class ClickOptions implements EventHandlerOptions {
  /** Cancels the default action before invoking the handler; defaults to true. */
  preventDefault: boolean = true;
  /** Stops bubbling to ancestors; defaults to false. */
  stopPropagation: boolean = false;
  /** Also stops subsequent listeners on the same element; defaults to false. */
  stopImmediatePropagation: boolean = false;
  /** Skips reentrant calls per binding and element until the handler settles. */
  disableWhileProcessing: boolean = true;
  onError?: EventHandlerOptions['onError'];

  /** Copies supplied overrides onto the defaults without mutating init. */
  public constructor(init?: Partial<ClickOptions>) {
    Object.assign(this, init);
  }
};

/** Text presentation data for consumers; jqueryx does not render or apply this interface itself. */
export interface JQueryTextInfo {
  /** Text or number to present. */
  text: string | number;
  /** Optional CSS color. */
  color?: string;
  /** Optional class names. */
  classNames?: string[];
  /** Optional consumer-invoked action on a collection. */
  action?: (e: JQuery) => void;
}
