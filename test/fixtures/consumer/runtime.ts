import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import type { JQueryObservation } from 'jqueryx';

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

const observations: JQueryObservation[] = [];

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
  const { ClickOptions } = await import('jqueryx');
  const clickOptions = new ClickOptions({ preventDefault: false });
  assert.equal(clickOptions.preventDefault, false);
  assert.equal(clickOptions.disableWhileProcessing, true);
  assert.equal(new ClickOptions().preventDefault, true);

  assert.ok($ === hostJQuery, 'Global $ must use the host jQuery instance.');
  assert.ok(jQuery === hostJQuery, 'Global jQuery must use the host instance.');
  assert.equal(empty, true);
  assert.equal(button.title(), 'ready');
  assert.equal(button.consumerPlugin().attr('data-plugin'), 'shared');
  assert.equal(existing.isEmpty(), false);
  assert.equal($(existing[0]).data('owner'), 'host');
  assert.equal($.isJQuery(existing), true);
  assert.equal($.from(existing), existing);
  assert.equal($.isJQuery({ jquery: false }), false);
  assert.equal($.isJQuery({ jquery: $.fn.jquery }), false);
  assert.ok(BuiltinX === hostHelpers, 'The package must share the host BuiltinX helpers.');

  let callbacks = 0;
  observations.push(button.observe(() => { callbacks++; }));
  assert.equal(callbacks, 0, 'The DOM extension must read the host callOnStart default.');
  MutationObserverOptions.default = { callOnStart: true };
  observations.push(button.observe(() => { callbacks++; }));
  assert.equal(callbacks, 1, 'Changing host defaults must affect subsequent jqueryx observations.');

  const sequence = button.asEnumerable();
  const hostSequence = Enumerable.from([]);
  assert.ok(
    Object.getPrototypeOf(sequence) === Object.getPrototypeOf(hostSequence),
    'asEnumerable must create sequences from the host linqx module.',
  );
  assert.deepEqual(Enumerable.from(sequence).toArray(), [button[0]]);
  assert.deepEqual(Enumerable.from(sequence).toArray(), [button[0]]);
  assert.deepEqual(button.enumerate().select(node => node.title()).toArray(), ['ready']);
  for (const observation of observations) {
    observation.disconnect();
  }
  button.append('<span>');
  await Promise.resolve();
  assert.equal(callbacks, 1, 'Disconnecting the published subscriptions must stop all callbacks.');

  const waiting = button.waitForNodes<HTMLSpanElement>('span.ready', { timeoutMs: 1_000 });
  button.find('span').addClass('ready');
  assert.equal((await waiting)[0], button.find('span')[0]);

  const textRoots = $('<div>a<b>b</b></div><div>c</div>');
  const preservedChild = textRoots.find('b')[0];
  textRoots.textContent('updated');
  assert.deepEqual(textRoots.map((_, node) => node.innerHTML).get(), ['updated<b></b>', 'updated']);
  assert.equal(textRoots.find('b')[0], preservedChild);
  const excludedSelectors = Object.freeze(['button']);
  const traversalRoot = $('<div>a<a>b</a><button>c</button></div>');
  assert.deepEqual(traversalRoot.textNodes(undefined, excludedSelectors).toArray().map(node => node.data), ['a', 'b']);
  assert.deepEqual(excludedSelectors, ['button']);
  assert.deepEqual(traversalRoot.textNodes().toArray().map(node => node.data), ['a', 'b', 'c']);
  const styled = $('<button>').cssIfNotEmpty('color', 'rgba(171, 205, 239, 0.5)').addClassIfNotEmpty('ready');
  assert.equal(styled.colorHex(), '#abcdef80');
  assert.equal(styled.colorHex(true), '#ABCDEF80');
  assert.equal(styled.hasClass('ready'), true);
  assert.equal($().colorHex(), undefined);

  const imageRoot = $('<div><img src="/image.png"></div>');
  imageRoot.find('img').refineUrls([], new URL('https://example.com'), { addImageFallbackLinks: true });
  assert.equal(imageRoot.find('a').attr('href'), '/image.png');
  imageRoot.find('img').refineUrls([], new URL('https://example.com'));
  assert.equal(imageRoot.find('a').length, 0);

  button.cssImportant('padding', '20px');
  assert.equal(button[0].style.getPropertyValue('padding'), '20px');
  assert.equal(button[0].style.getPropertyPriority('padding'), 'important');
  const replacementRoot = $('<div><i>a</i><i>b</i></div>');
  const replacements = replacementRoot.find('i').replaceBy((node, index) => {
    assert.equal(node.length, 1);
    return $('<b>').text(`${index}:${node.text()}`);
  });
  assert.deepEqual(replacements.toArray(), replacementRoot.children().toArray());
  assert.equal(replacementRoot.html(), '<b>0:a</b><b>1:b</b>');
  assert.equal($().hasUrlHref(), false);

  const independentButton = document.implementation.createHTMLDocument().createElement('button');
  assert.ok($.isElement(independentButton));
  assert.equal($.from(independentButton)[0], independentButton);
  const frame = document.createElement('iframe');
  document.body.append(frame);
  try {
    const foreignButton = frame.contentDocument!.createElement('button');
    assert.ok($.isElement(foreignButton));
    assert.deepEqual($.from([foreignButton, independentButton]).toArray(), [foreignButton, independentButton]);
    foreignButton.innerHTML = 'a<b>b</b>c';
    assert.equal($(foreignButton).ownText(), 'ac');
    foreignButton.innerHTML = '<br><br>text<br><br>';
    $(foreignButton).trimLeadingBrs().collapseBrs();
    assert.equal(foreignButton.innerHTML, 'text<br>');
    assert.equal($(frame.contentDocument!.createTextNode('\n ')).isNewLineTextNode(), true);
  } finally {
    frame.remove();
  }
} finally {
  for (const observation of observations) {
    observation.disconnect();
  }
  dom.window.close();
}
