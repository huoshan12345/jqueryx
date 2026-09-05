import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

declare global {
  interface JQuery {
    consumerPlugin(): JQuery;
  }
}

const { JSDOM } = createRequire(process.argv[2])('jsdom') as {
  JSDOM: new (html: string) => { window: Window & typeof globalThis };
};
const dom = new JSDOM('<!doctype html><html><body></body></html>');

const globals = ['window', 'document', 'Node', 'Element', 'HTMLElement', 'Storage', 'MutationObserver'] as const;
for (const name of globals) {
  Reflect.set(globalThis, name, dom.window[name]);
}

try {
  const { default: hostJQuery } = await import('jquery');
  const existing = hostJQuery('<div>').data('owner', 'host');
  hostJQuery.fn.consumerPlugin = function () {
    return this.attr('data-plugin', 'shared');
  };

  const { button, empty } = await import('./entry.js');

  assert.ok($ === hostJQuery, 'Global $ must use the host jQuery instance.');
  assert.ok(jQuery === hostJQuery, 'Global jQuery must use the host instance.');
  assert.equal(empty, true);
  assert.equal(button.title(), 'ready');
  assert.equal(button.consumerPlugin().attr('data-plugin'), 'shared');
  assert.equal(existing.isEmpty(), false);
  assert.equal($(existing[0]).data('owner'), 'host');
} finally {
  dom.window.close();
}
