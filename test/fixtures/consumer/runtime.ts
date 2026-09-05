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

const observers: MutationObserver[] = [];
Reflect.set(globalThis, 'MutationObserver', class extends dom.window.MutationObserver {
  constructor(callback: MutationCallback) {
    super(callback);
    observers.push(this);
  }
});

try {
  const application = process.argv[3] === 'package-first' ? await import('./entry.js') : undefined;
  const installedHelpers = application ? BuiltinX : undefined;
  const { MutationObserverOptions } = await import('builtinx');
  const hostHelpers = BuiltinX;
  const { Enumerable } = await import('linqx');
  MutationObserverOptions.default = { callOnStart: false, debounce: false };

  if (installedHelpers) {
    assert.ok(installedHelpers === hostHelpers, 'Importing builtinx must preserve the installed helper instance.');
  }

  const { default: hostJQuery } = await import('jquery');
  const existing = hostJQuery('<div>').data('owner', 'host');
  hostJQuery.fn.consumerPlugin = function () {
    return this.attr('data-plugin', 'shared');
  };

  const { button, empty } = application ?? await import('./entry.js');

  assert.ok($ === hostJQuery, 'Global $ must use the host jQuery instance.');
  assert.ok(jQuery === hostJQuery, 'Global jQuery must use the host instance.');
  assert.equal(empty, true);
  assert.equal(button.title(), 'ready');
  assert.equal(button.consumerPlugin().attr('data-plugin'), 'shared');
  assert.equal(existing.isEmpty(), false);
  assert.equal($(existing[0]).data('owner'), 'host');
  assert.ok(BuiltinX === hostHelpers, 'The package must share the host BuiltinX helpers.');

  let callbacks = 0;
  button.observe(() => { callbacks++; });
  assert.equal(callbacks, 0, 'The DOM extension must read the host callOnStart default.');
  MutationObserverOptions.default = { callOnStart: true };
  button.observe(() => { callbacks++; });
  assert.equal(callbacks, 1, 'Changing host defaults must affect subsequent jqueryx observations.');

  const sequence = button.asEnumerable();
  const hostSequence = Enumerable.from([]);
  assert.ok(
    Object.getPrototypeOf(sequence) === Object.getPrototypeOf(hostSequence),
    'asEnumerable must create sequences from the host linqx module.',
  );
  assert.deepEqual(Enumerable.from(sequence).toArray(), [button[0]]);
  assert.deepEqual(button.enumerate().select(node => node.title()).toArray(), ['ready']);
} finally {
  for (const observer of observers) {
    observer.disconnect();
  }
  dom.window.close();
}
