import type { Awaitable, HTMLNode, Nullishable } from 'builtinx';

export type JQueryNode = JQuery<HTMLNode>;
export type JQueryMutationCallback = (mutations: MutationRecord[], observer: MutationObserver, jQuery: JQuery) => void;

export interface EventHandlerOptions {
  /**
   * Handles synchronous throws and asynchronous rejections. Defaults to console.error.
   * If this callback throws or rejects, its error is also reported to console.error.
   */
  onError?: (error: unknown) => Awaitable<unknown>;
}

export class ClickOptions implements EventHandlerOptions {
  preventDefault: boolean = true;
  stopPropagation: boolean = false;
  stopImmediatePropagation: boolean = false;
  /** Skips reentrant calls per binding and element until the handler settles. */
  disableWhileProcessing: boolean = true;
  onError?: EventHandlerOptions['onError'];

  public constructor(init?: Partial<ClickOptions>) {
    Object.assign(this, init);
  }
};

export interface JQueryTextInfo {
  text: string | number;
  color?: string;
  classNames?: string[];
  action?: (e: JQuery) => void;
}
