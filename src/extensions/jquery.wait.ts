import type { WaitForNodesOptions } from '@/types/lib';

type SearchRoot = Node & ParentNode;

declare global {
  interface JQuery<TElement = HTMLElement> {
    /**
     * Waits once for descendants matching a standard CSS selector. Returns the matches found
     * at completion, not future matches. Only DOM-driven selector changes are observed.
     * Rejects on invalid input, timeout, or cancellation and always releases resources.
     */
    waitForNodes<TMatch extends Element = HTMLElement>(
      this: this & JQuery<SearchRoot>,
      selector: string,
      options?: WaitForNodesOptions,
    ): Promise<JQuery<TMatch>>;
  }
}

$.fn.waitForNodes = function <TMatch extends Element = HTMLElement>(
  this: JQuery<SearchRoot>,
  selector: string,
  options: WaitForNodesOptions = {},
): Promise<JQuery<TMatch>> {
  const roots = this.toArray();
  return new Promise((resolve, reject) => {
    const { signal, timeoutMs = 30_000, includeIframes = false } = options;
    const observers = new Map<SearchRoot, MutationObserver>();
    const frames = new Set<HTMLIFrameElement>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;

    function cleanup(): void {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      signal?.removeEventListener('abort', abort);
      for (const observer of observers.values()) {
        observer.disconnect();
      }
      observers.clear();
      for (const frame of frames) {
        frame.removeEventListener('load', inspect);
      }
      frames.clear();
    }

    function fail(error: unknown): void {
      if (!settled) {
        settled = true;
        cleanup();
        reject(error);
      }
    }

    function abort(): void {
      fail(signal!.reason);
    }

    function timeout(): void {
      fail(new DOMException(`No nodes matched '${selector}' within ${timeoutMs} ms.`, 'TimeoutError'));
    }

    function inspect(): void {
      if (settled) {
        return;
      }
      try {
        const scopes = new Set<SearchRoot>(roots);
        const currentFrames = new Set<HTMLIFrameElement>();
        const matches = new Set<TMatch>();
        // Set iteration includes documents added while discovering nested frames.
        for (const root of scopes) {
          for (const node of root.querySelectorAll<TMatch>(selector)) {
            matches.add(node);
          }
          if (!includeIframes) {
            continue;
          }
          const descendants = [...root.querySelectorAll<HTMLIFrameElement>('iframe')];
          if (root.nodeType === Node.ELEMENT_NODE && (root as Element).localName === 'iframe') {
            descendants.push(root as HTMLIFrameElement);
          }
          for (const frame of descendants) {
            currentFrames.add(frame);
            const document = accessibleDocument(frame);
            if (document) {
              scopes.add(document);
            }
          }
        }

        if (settled) {
          return;
        }

        if (matches.size > 0) {
          settled = true;
          cleanup();
          resolve($<TMatch>([...matches]));
          return;
        }
        if (timeoutMs === 0) {
          timeout();
          return;
        }

        for (const [root, observer] of observers) {
          if (!scopes.has(root)) {
            observer.disconnect();
            observers.delete(root);
          }
        }
        for (const root of scopes) {
          if (!observers.has(root)) {
            const observer = new MutationObserver(inspect);
            observers.set(root, observer);
            observer.observe(root, {
              subtree: true,
              childList: true,
              attributes: true,
              characterData: true,
            });
          }
        }
        for (const frame of frames) {
          if (!currentFrames.has(frame)) {
            frame.removeEventListener('load', inspect);
            frames.delete(frame);
          }
        }
        for (const frame of currentFrames) {
          if (!frames.has(frame)) {
            frame.addEventListener('load', inspect);
            frames.add(frame);
          }
        }
      } catch (error) {
        fail(error);
      }
    }

    try {
      if (signal?.aborted) {
        abort();
        return;
      }
      if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
        throw new RangeError('timeoutMs must be a finite non-negative number.');
      }
      if (roots.length === 0) {
        throw new Error('waitForNodes requires at least one existing root.');
      }
      if (typeof selector !== 'string' || selector.trim() === '') {
        throw new TypeError('selector must be a non-empty selector string.');
      }
      for (const root of roots) {
        if (root.nodeType !== Node.ELEMENT_NODE
          && root.nodeType !== Node.DOCUMENT_NODE
          && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
          throw new TypeError('waitForNodes roots must be elements, documents, or document fragments.');
        }
      }
      signal?.addEventListener('abort', abort, { once: true });
      inspect();
      if (!settled) {
        const start = Date.now();
        // Split long waits so the native timer's signed 32-bit limit cannot overflow.
        function schedule(): void {
          const remaining = timeoutMs - (Date.now() - start);
          if (remaining <= 0) {
            timeout();
          } else {
            timer = setTimeout(schedule, Math.min(remaining, 2_147_483_647));
          }
        }
        schedule();
      }
    } catch (error) {
      fail(error);
    }
  });
};

function accessibleDocument(frame: HTMLIFrameElement): Document | null {
  try {
    return frame.contentDocument;
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'SecurityError') {
      return null;
    }
    throw error;
  }
}
