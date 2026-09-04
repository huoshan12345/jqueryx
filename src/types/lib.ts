import type { HTMLNode, Nullishable } from 'builtinx';

export type JQueryNode = JQuery<HTMLNode>;
export type JQueryMutationCallback = (mutations: MutationRecord[], observer: MutationObserver, jQuery: JQuery) => void;

export class ClickOptions {
  preventDefault: boolean = true;
  stopPropagation: boolean = false;
  stopImmediatePropagation: boolean = false;
  disableWhileProcessing: boolean = true;

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
