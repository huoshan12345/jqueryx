import type { WaitForNodesOptions } from '../types/lib.js';

declare global {
  interface JQueryStatic {
    /**
     * Queries the current document immediately, then polls for a standard CSS selector.
     * Returns the matches found at completion. Transient matches between polls may be missed.
     * Rejects on invalid input, timeout, or cancellation and always releases resources.
     */
    waitForNodes<TMatch extends Element = HTMLElement>(
      selector: string,
      options?: WaitForNodesOptions,
    ): Promise<JQuery<TMatch>>;
  }
}

$.waitForNodes = function <TMatch extends Element = HTMLElement>(
  selector: string,
  options: WaitForNodesOptions = {},
): Promise<JQuery<TMatch>> {
  return new Promise((resolve, reject) => {
    const { signal, timeoutMs = 30_000, pollIntervalMs = 100, includeIframes = false } = options;
    const start = performance.now();
    let nextPollAt = start;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;

    function cleanup(): void {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      signal?.removeEventListener('abort', abort);
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
        const documents = new Set<Document>([document]);
        const matches = new Set<TMatch>();
        // Set iteration includes documents added while discovering nested frames.
        for (const currentDocument of documents) {
          for (const node of currentDocument.querySelectorAll<TMatch>(selector)) {
            matches.add(node);
          }
          if (!includeIframes) {
            continue;
          }
          for (const frame of currentDocument.querySelectorAll('iframe')) {
            const frameDocument = accessibleDocument(frame);
            if (frameDocument) {
              documents.add(frameDocument);
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
      } catch (error) {
        fail(error);
      }
    }

    function schedule(): void {
      if (settled) {
        return;
      }
      const now = performance.now();
      const remaining = timeoutMs - (now - start);
      if (remaining <= 0) {
        timeout();
        return;
      }
      // Wake for the next query or timeout; split delays beyond the native timer limit.
      const delay = Math.min(Math.max(0, nextPollAt - now), remaining, 2_147_483_647);
      timer = setTimeout(() => {
        timer = undefined;
        if (performance.now() - start >= timeoutMs) {
          timeout();
          return;
        }
        if (performance.now() >= nextPollAt) {
          inspect();
          nextPollAt = performance.now() + pollIntervalMs;
        }
        schedule();
      }, delay);
    }

    try {
      if (signal?.aborted) {
        abort();
        return;
      }
      if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
        throw new RangeError('timeoutMs must be a finite non-negative number.');
      }
      if (!Number.isFinite(pollIntervalMs) || pollIntervalMs <= 0) {
        throw new RangeError('pollIntervalMs must be a finite positive number.');
      }
      if (typeof selector !== 'string' || selector.trim() === '') {
        throw new TypeError('selector must be a non-empty selector string.');
      }
      signal?.addEventListener('abort', abort, { once: true });
      inspect();
      nextPollAt = performance.now() + pollIntervalMs;
      schedule();
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
