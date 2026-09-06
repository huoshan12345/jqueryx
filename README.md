# jqueryx

Typed jQuery extensions for collections, DOM text, styles, events, observation and asynchronous node discovery.

## Installation and initialization

```sh
pnpm add jqueryx jquery builtinx linqx
```

The package requires jQuery `^4.0.0`, builtinx `^0.3.3` and linqx `^0.3.4` as shared peers. jQuery types ship as a dependency. Import jqueryx once before running application code that uses its extensions:

```ts
import 'jqueryx';

const button = $('<button>').title('Save').pointer();
button.onClick(async target => {
  if ($.isElement(target)) {
    target.setAttribute('data-clicked', 'true');
  }
});
```

The import installs the shared jQuery instance as global `$` and `jQuery`, registers the extensions and imports `builtinx/dom`. Other application files do not need `import $ from 'jquery'`. Initialization must run before those files use the globals. An explicit jQuery import, when used, shares the same instance.

This entry requires a browser DOM or an initialized DOM environment such as jsdom; it is not a DOM-free SSR entry. The package exports option types and `ClickOptions`. It has no default jQuery export or public feature subpaths.

## API conventions

- Instance methods use a collection, such as `nodes.ownText()`. Static methods use `$`, such as `$.waitForNodes()`.
- `this` below means the original collection is returned for chaining. Unless specified otherwise, setters affect every member and return an empty collection unchanged.
- Attribute and color getters read the first element. `checked()` and `visible()` test whether **any** member matches. Text getters combine content across roots.
- DOM methods retain their declared constraints: `onClick` accepts HTML elements, `textNodes` accepts Nodes, and `dispatchEvent` accepts EventTargets. Style methods require an inline `style` interface, including HTML and SVG elements.
- Selectors use jQuery syntax except `$.waitForNodes`, which uses native CSS selectors. Invalid selectors throw when evaluated; `waitForNodes` rejects its promise instead.
- Native nodes from accessible iframe documents are supported by conversion and guards. Each traversal method specifies whether it searches iframe documents.

## Collections — `jquery.collection.ts`

| Method | Return value and behavior |
| --- | --- |
| `isEmpty()` | `boolean`: the collection has zero members. |
| `isNotEmpty()` | `boolean`: the collection has at least one member. |
| `isNot(selector)` | `boolean`: no member matches the selector; `true` for an empty collection. |
| `throwIfEmpty()` | `this`; throws `Error('The set is empty')` when empty. |
| `ifEmpty(selector)` | The same nonempty collection, or `$(selector)` as fallback. The fallback is evaluated only when empty and may itself be empty. |
| `where(predicate)` | A filtered collection retaining only literal `true` results from `predicate(element, originalIndex)`. `false`, `null` and `undefined` exclude the member. Empty inputs invoke no callbacks. |
| `tap(action)` | Calls `action(collection)` once, including when empty; returns `this`. |
| `tapIf(condition, action)` | Evaluates `condition(collection)` once, calls `action(collection)` if true, and returns `this`. |

`where` uses element-first arguments, unlike jQuery `filter`. `tap` and `tapIf` operate on the whole collection, ignore return values and do not await asynchronous callbacks. Synchronous callback errors propagate.

```ts
const items = $('<i></i><b></b>');
items.where((_element, index) => index === 0)
  .throwIfEmpty().tap(nodes => nodes.addClass('selected'));
items.tapIf(nodes => nodes.isNot('.disabled'), nodes => nodes.addClass('ready'));
const fallback = $().ifEmpty('<span>Nothing found</span>');
console.log(items.isEmpty(), items.isNotEmpty(), fallback.length);
```

## Enumeration — `jquery.enumeration.ts`

| Method | Return value and behavior |
| --- | --- |
| `entries()` | A fresh `IterableIterator<[number, TElement]>` yielding zero-based indexes and raw members in collection order. Each iterator is consumed once. |
| `asEnumerable()` | A lazy, repeatable linqx `Enumerable.IEnumerable<TElement>`. Each enumeration creates an independent iterator. |
| `enumerate()` | A lazy, repeatable `Enumerable.IEnumerable<JQuery<TElement>>`, wrapping each member in its own collection on each enumeration. |

These methods read stored collection membership at enumeration time. They do not clone nodes or rerun the original selector. Use `.toArray()` to snapshot membership. Empty inputs yield empty sequences.

```ts
const nodes = $('<i></i><b></b>');
for (const [index, element] of nodes.entries()) {
  element.setAttribute('data-index', String(index));
}
const sequence = nodes.asEnumerable();
console.log(sequence.count(), sequence.count()); // 2, 2
const wrapped = nodes.enumerate().select(node => node.title('item')).toArray();
```

## Conversion and guards — `jquery.factory.ts`

| Method | Return value and behavior |
| --- | --- |
| `$.from(null)` / `$.from(undefined)` | An empty collection. |
| `$.from(node)` | Wraps a native Node, including Element, Text, Comment, Document, DocumentFragment and other native node types. |
| `$.from(collection)` | Returns a collection from the shared jQuery instance unchanged. Another instance's collection is converted as array-like input. |
| `$.from(selectorOrHtml)` | Evaluates the string through jQuery. |
| `$.from(arrayLike)` | Flattens one level of strings, Nodes and jQuery collections through jQuery `add`, including its ordering and deduplication rules for connected nodes. |
| `$.isJQuery(value)` | Type guard for collections from the shared jQuery instance; does not validate members. |
| `$.isElement(value)` | Native Element type guard across realms, including documents without a window. |
| `$.isNode(value)` | Native Node type guard across realms, including non-Element nodes. |

`$.from<T extends Node>()` preserves typed Node collections. Arrays and NodeLists are accepted; convert arbitrary iterables such as Sets/generators to arrays first. Unsupported inputs/group members are logged and throw TypeError. Shared jQuery collections are returned as-is without validating contents. Nested arrays are not recursively flattened. Invalid selectors propagate jQuery errors.

```ts
const text = document.createTextNode('hello');
const fragment = document.createDocumentFragment();
fragment.append(text);
const nodes = $.from<Node>([text, fragment]);
console.log($.isNode(text), $.isElement(text)); // true, false
console.log($.isJQuery(nodes), $.from(nodes) === nodes); // true, true
```

## Search and ancestors — `jquery.traversal.ts`

| Method | Return value and behavior |
| --- | --- |
| `ancestor(selector, outermost = false, includeSelf = false)` | Finds one matching ancestor per selected element. Defaults to the nearest matching parent; `outermost` selects the farthest match and `includeSelf` considers the selected element first. Results use jQuery `add` ordering/deduplication. |
| `search(selector, checkIframesIfEmpty = true)` | Finds descendants of the roots, excluding the roots themselves. Only when the combined result is empty does it search documents of descendant iframes. |
| `$.search(selector, checkIframesIfEmpty = true)` | Starts with `$(selector)` in the current document; only when empty searches documents of iframes in that document. |

Missing matches return an empty collection. The iframe fallback uses jQuery `contents()` and is one level deep. It does not recursively discover nested frames or wait for new content. Pass `false` to disable it; use `$.waitForNodes` for repeated discovery.

```ts
const root = $('<section><div class="group"><button></button></div></section>');
const button = root.search('button', false);
const group = button.ancestor('.group');
const outer = button.ancestor('section, .group', true);
const existing = $.search('.loaded', false);
```

## Text traversal — `jquery.text-nodes.ts`

### `textNodes(traverseSelector?, excludeSelectors = [])`

Returns `JQuery<Text>` containing unique Text nodes. Traversal is depth-first, starting from roots in collection order; the final collection uses `$.from`/jQuery `add` ordering, so nodes in the same tree are sorted in document order even for reversed or overlapping roots. Disconnected trees follow jQuery ordering rules. Text, Document and DocumentFragment roots are supported, and HTML template contents are traversed. Iframe elements and shadow hosts do not implicitly enter their documents/shadow trees; supply those roots explicitly.

- `traverseSelector`: every visited Element, including an Element root, must match. Nonmatching elements prune their **whole subtree**; traversal does not search through them for later matches.
- `excludeSelectors`: readonly jQuery selector array, default `[]`. A match prunes that element and its entire subtree. The array is never mutated.
- Text, Document and DocumentFragment roots are not tested as Elements. An explicitly selected descendant root can still be visited after its ancestor was pruned.
- Empty inputs return an empty collection. Invalid selectors throw when evaluated on Elements.

```ts
const root = $('<div>a<span>b</span><button>skip</button></div>');
const texts = root.textNodes(undefined, ['button']);
console.log(texts.asEnumerable().select(node => node.data).toArray()); // ['a', 'b']
```

## Text and line breaks — `jquery.text.ts`

| Method | Return value and behavior |
| --- | --- |
| `textContent()` | Concatenates the Text nodes returned by `textNodes()`, including descendants and template contents. Empty returns `''`. |
| `textContent(value)` | For each root, puts the string into the first descendant Text node and removes remaining Text nodes. Preserves non-text nodes and the first Text node's position. If no Text exists, inserts at the start of an Element/DocumentFragment; HTML templates insert into `template.content`. Returns `this`. |
| `ownText()` | Concatenates direct child Text content across roots; a Text root contributes its own value. Empty returns `''`. |
| `ownText(value)` | For each Element/DocumentFragment root, updates its first direct Text and removes later direct Text nodes, or inserts at the beginning if absent. Updates Text roots directly and skips other root types. Preserves descendant text in child elements; returns `this`. |
| `collapseBrs()` | Finds descendant `br` elements in each root and removes following sibling `br` elements and newline-only Text nodes until another kind of sibling is reached. Returns `this`. |
| `isNewLineTextNode()` | Whether the collection is **nonempty** and every root is Text containing only whitespace and at least one `\r` or `\n`. Spaces alone do not match. Empty returns `false`. |
| `trimLeadingBrs()` | Removes each root's leading `br` elements and newline-only Text nodes. Stops at other children, including comments and spaces without newlines. Returns `this`. |

Both text setters accept `''` and preserve non-text node identities, event handlers and data. They do not behave like jQuery `.text(value)`, which replaces element children. `textContent(value)` can change descendant text in a Document but inserts nothing if a non-Element/non-fragment root has no Text. Neither getter includes Comment/CDATA contents as Text. `ownText` does not automatically enter `template.content`. Line-break helpers do not automatically enter templates, shadow trees or iframe documents.

```ts
const root = $('<div>a<b>b</b>c</div>');
console.log(root.textContent(), root.ownText()); // 'abc', 'ac'
root.ownText('direct'); // <div>direct<b>b</b></div>
root.textContent('all'); // <div>all<b></b></div>
const lines = $('<div>\n<br>a<br>\n<br>b</div>');
lines.trimLeadingBrs().collapseBrs(); // <div>a<br>b</div>
console.log($(document.createTextNode('\n')).isNewLineTextNode()); // true
```

## Replacement — `jquery.replace.ts`

### `replaceBy(replacement)`

Calls `replacement(wrappedElement, originalIndex)` once per distinct **outermost** selected Element, returning all replacement Elements in callback order. The callback must return a jQuery collection.

- Parent/child overlap is resolved before callbacks. Selected descendants are skipped even if their selected parent is kept. Duplicate roots use their first original index.
- Return the current element to keep it, an empty collection to delete it, or several elements to insert several replacements. Detached sources still contribute their returned replacements.
- Reusing a replacement, or returning another source whose callback has not run yet, clones it with jQuery events/data rather than moving the earlier result/source.
- Empty inputs invoke no callbacks and return an empty collection. Callback errors propagate; earlier completed replacements remain. The operation is not transactional.

```ts
const root = $('<div><i>a</i><i>b</i></div>');
const replacements = root.find('i').replaceBy((node, index) =>
  $('<b>').textContent(`${index}: ${node.textContent()}`),
);
console.log(replacements.textContent()); // '0: a1: b'
```

## Attributes and control state — `jquery.attr.ts`

| Method | Return value and behavior |
| --- | --- |
| `title()` | First raw title attribute; undefined when missing or collection empty. An empty attribute remains `''`. |
| `title(value)` | Sets every title attribute, including `''`; returns `this`. |
| `requiredTitle()` | First title; throws Error when missing/empty. Whitespace is not trimmed. |
| `href()` | First raw href attribute, including relative strings; undefined when missing or collection empty. |
| `href(value)` | Sets every href to `value.toString()`; accepts string or URL, including an empty string; returns `this`. |
| `requiredHref()` | First raw href; throws Error when missing/empty, without searching later members. |
| `voidHref()` | Sets every href to `javascript:;`; returns `this`. |
| `hasUrlHref()` | Tests the first raw href for a nonempty string not starting with exact lowercase `javascript:`. Empty returns false. Does not trim, parse or validate URLs; not a security filter. |
| `targetBlank(onlyUpdate = true)` | Sets every target to `_blank`; default skips attribute writes for already-matching targets. `false` writes those too. Returns the original collection. |
| `disable()` / `enable()` | Sets every live `disabled` property to true / false; returns `this`. |
| `checked()` | Whether any member matches jQuery `:checked`, including selected options. Uses current state; empty returns false. |

```ts
const link = $('<a>').title('Details').href('/details').targetBlank();
console.log(link.requiredTitle(), link.requiredHref(), link.hasUrlHref());
link.voidHref();
const control = $('<input type="checkbox" checked>').disable().enable();
console.log(control.checked()); // true
```

## Styles — `jquery.css.ts`

All style setters affect every selected element and return `this`.

| Method | Behavior |
| --- | --- |
| `pointer()` | Sets `cursor: pointer`. |
| `underline()` | Sets `text-decoration: underline`. |
| `flex()` | Sets `display: flex`. |
| `inlineFlex()` | Sets `display: inline-flex`. |
| `inlineBlock()` | Sets `display: inline-block`. |
| `flexWrap(value = 'wrap')` | Sets flex-wrap without changing display. |
| `padding(value)` | Sets padding via jQuery css; accepts a CSS string or a number in pixels. |
| `cssImportant(propertyName, value)` | Sets a CSS property (such as `background-color` or `--gap`) to a string with `!important`. Include units where needed. `''` removes it; non-string values throw TypeError. |
| `cssIfNotEmpty(propertyName, value?)` | Calls jQuery css for nonempty strings. Skips undefined/`''`; applies `'0'`. Does not catch errors. |
| `addClassIfNotEmpty(classNames?)` | Calls jQuery addClass for a nonempty string or string array. Skips undefined, `''`, `[]`; does not catch errors. |
| `color()` | First computed color string, or undefined for an empty collection. |
| `color(value, important = false)` | Sets color via jQuery css, or cssImportant when requested. `''` clears inline color. |
| `colorHex(uppercase = false)` | Converts first computed comma-separated rgb()/rgba() to `#rrggbb` or `#rrggbbaa` when alpha is below 1, rounding components to bytes. Empty/unsupported formats (such as `color(display-p3 ...)`) return undefined. |
| `visible()` | Whether any member matches jQuery `:visible` (has a layout box). Empty returns false. Does not test opacity or viewport intersection. |
| `visible(value)` | Uses jQuery show/hide, restoring previous display where supported. Does not force hidden ancestors to become visible. |

```ts
const panel = $('<div>').flex().flexWrap().padding(12).visible(true);
panel.cssImportant('--gap', '1rem').cssIfNotEmpty('opacity', '0.8');
panel.addClassIfNotEmpty(['panel', 'ready']).color('rgba(255, 0, 0, 0.5)');
console.log(panel.colorHex(true)); // '#FF000080'
const label = $('<span>').inlineBlock().underline().pointer();
const badge = $('<span>').inlineFlex();
```

## Scrolling — `jquery.scroll.ts`

### `$.scrollToNode(element, options?)`

Accepts an Element, selector string or jQuery Element collection. Calls the **first** matched element's native `scrollIntoView` with `{ block: 'start', inline: 'nearest', ...options }`. Native `ScrollIntoViewOptions` override alignment and can set behavior. Returns void. Empty matches do nothing; unsupported inputs throw TypeError, and native errors propagate. Uses the element's own scrolling implementation, including iframe elements, without calculating page coordinates.

```ts
$.scrollToNode('#results', { behavior: 'smooth', block: 'center' });
```

## Events — `jquery.events.ts`

### `onClick(handler, options?)`

Binds clicks to selected HTML elements and returns `this`. The callback receives `(target: EventTarget, originalEvent?: MouseEvent)` and may return a value or promise. Target is the event origin, possibly a descendant such as SVG; narrow it before accessing element-specific members. `originalEvent` is absent for jQuery-triggered clicks.

Cancellation happens synchronously before the callback, even for async handlers. Return values, including false, are ignored. Options accept `Partial<ClickOptions>`:

| Option | Default | Behavior |
| --- | --- | --- |
| `preventDefault` | true | Cancels the default browser click action. |
| `stopPropagation` | false | Stops propagation to ancestors. |
| `stopImmediatePropagation` | false | Also stops subsequent listeners on the same element. |
| `disableWhileProcessing` | true | Skips reentrant clicks per binding and bound element until the handler settles; temporarily sets `pointer-events: none !important`. |
| `onError` | undefined | Receives synchronous errors and promise rejections; defaults to console.error. Errors/rejections from onError itself are reported to console.error. |

Different selected elements can run concurrently. Overlapping bindings share pointer-style ownership until all finish; previous value/priority are restored even on failure. This does not set a control's disabled property. Setting disableWhileProcessing to false permits overlap and leaves pointer styles alone.

```ts
import { ClickOptions } from 'jqueryx';

const options = new ClickOptions({ stopPropagation: true, onError: error => console.error(error) });
$('button.save').onClick(async target => {
  if ($.isElement(target)) {
    target.setAttribute('data-saved', 'true');
  }
}, options);
```

`new ClickOptions(init?)` creates independent defaults and copies supplied overrides without changing the input object.

### Keyboard and dispatch helpers

| Method | Return value and behavior |
| --- | --- |
| `onKeyDown(handler, options?)` | Binds `(target: EventTarget, key: string) => value or Promise`. Stops immediate propagation before the handler, preserves default behavior and uses EventHandlerOptions.onError as above. Returns `this`. |
| `onEnterDown(handler, options?)` | Like onKeyDown, but receives only target and runs only for `key === 'Enter'`. Other keys are not intercepted. Returns `this`. |
| `onClickGotoHref(openNew?)` | For anchors, removes jQuery click handlers/inline onclick attributes and stops propagation during capture at each anchor so native href navigation can proceed. `true` sets target=_blank; otherwise preserves targets. Returns `this`. |
| `triggerClick()` | Calls native click() for every HTML element, including normal default actions. Disabled controls obey native rules. Returns `this`. |
| `triggerChange()` | Triggers jQuery change on every member, including jQuery bubbling. Does not edit the control value. Returns `this`. |
| `dispatchEvent(event)` | Dispatches the same native Event sequentially to every EventTarget. Its bubbling/cancelable options apply; cancellation does not stop iteration. Returns `this`. |

`onClickGotoHref` skips non-anchors. It does not remove arbitrary native listeners, undo earlier capture-phase cancellation or set href. Keyboard bindings have no processing lock. Empty collections invoke no handlers. `triggerChange` uses jQuery dispatch; do not rely on it to invoke native addEventListener('change', ...) listeners.

```ts
const input = $('<input>').onKeyDown((_target, key) => console.log(key));
const searchInput = $('<input>').onEnterDown(target => console.log(target));
input.triggerChange();
searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
const checkbox = $('<input type="checkbox">').triggerClick();
const link = $('<a href="#details">').onClickGotoHref(true);
```

## Observation — `jquery.observe.ts`

### `observe(callback, options?)` and `subscription.disconnect()`

Creates one MutationObserver per selected Node and returns a `JQueryObservation` subscription instead of a chainable collection. The callback receives `(mutations, observer, originalCollection)` for each delivery. The third argument is the entire original collection, not only the changed node.

Options are builtinx `MutationObserverOptionsInit`: native observer settings, `callOnStart`, `debounce`, `exclusions`, `beforeCallback`, `afterCallback`, `onSkipped`. With the installed builtinx defaults, childList/subtree are enabled, attributes/characterData disabled, a startup callback runs synchronously per node, and debounce uses 1000 ms with leading/trailing callbacks and a 1000 ms maximum wait. Host changes to `MutationObserverOptions.default` apply. Use `callOnStart: false, debounce: false` for native deliveries without startup/debounce scheduling.

`subscription.disconnect()` returns void, disconnects the group and suppresses pending callbacks/hooks. Repeated calls are safe, including for empty subscriptions. Independent subscriptions remain independent. If registration or a startup callback fails, the call disconnects observers already created and rethrows. This wrapper does not provide event handlers' async error routing.

```ts
const root = $('<div>');
const subscription = root.observe((records, _observer, nodes) => {
  console.log(records.length, nodes.length);
}, { childList: true, subtree: true, callOnStart: false, debounce: false });
root.append('<span>new</span>');
await Promise.resolve(); // allow native observer delivery
subscription.disconnect();
```

## Waiting for asynchronously loaded nodes — `jquery.wait.ts`

### `$.waitForNodes<TMatch extends Element = HTMLElement>(selector, options?)`

Returns `Promise<JQuery<TMatch>>`. Queries the current document immediately with native CSS selectors, then polls until at least one match exists. Resolves with all matches from that query. Requires no pre-existing collection and installs no MutationObserver. The generic specifies the expected element type without validating it at runtime.

| WaitForNodesOptions | Default | Behavior |
| --- | --- | --- |
| `timeoutMs` | 30000 | Finite non-negative milliseconds. Zero checks once. Rejects with a DOMException named TimeoutError if no match appears before the deadline. |
| `pollIntervalMs` | 100 | Finite positive milliseconds between queries. Timeout is enforced even between polls; long native timer delays are split. |
| `signal` | absent | Cancels with exact signal.reason, including when already aborted. An already-aborted signal takes precedence over existing matches. |
| `includeIframes` | false | Rediscovers accessible iframe documents recursively every query, including newly added/navigated frames; skips inaccessible documents. |

Empty/non-string selectors reject with TypeError; invalid CSS rejects with the native selector error. Invalid numeric options reject with RangeError. All timers/abort listeners are removed on success, timeout, cancellation or errors. Matches appearing/disappearing between polls can be missed. Shadow trees are not searched automatically.

```ts
const controller = new AbortController();
try {
  const nodes = await $.waitForNodes<HTMLButtonElement>('.ajax-content button', {
    timeoutMs: 5000,
    pollIntervalMs: 100,
    includeIframes: true,
    signal: controller.signal,
  });
  nodes.enable();
} catch (error) {
  console.error(error);
}
```

## URL rewriting — `jquery.urls.ts`

### `refineUrls(hosts, baseUrl, options?)`

Rewrites selected HTML anchors' href and images' src attributes without selecting descendants automatically. Returns `this`; unsupported tags are logged/skipped. `hosts` is an array of builtinx `MatchPattern` (`string` or `RegExp`) values matched against URL host, including port. `baseUrl` supplies replacement protocol, hostname and port.

Only explicit HTTP(S) and protocol-relative strings are candidates, with trimming for parsing and case-insensitive protocol matching. Protocol-relative strings resolve against the element's base URI. Ordinary relative URLs, non-HTTP URLs, local URLs already matching baseUrl.host, unmatched hosts and missing attributes remain unchanged. Malformed candidates are logged/skipped. The base pathname is not prepended; query/fragment components are preserved.

| RefineUrlsOptions | Default | Behavior |
| --- | --- | --- |
| `pathRewrite` | absent | Receives a matching URL's pathname and returns a new pathname before its origin changes. Errors propagate; earlier changes remain. |
| `addImageFallbackLinks` | false | Adds/reuses a _blank, noreferrer link after every selected image with src, including unmatched URLs. Omitting/disabling removes links/listeners previously managed here. |

The third argument also accepts the legacy `(path: string) => string` callback. Complete occurrences of the old URL inside each Text node are replaced literally and repeatedly. URLs split across Text nodes are not joined/replaced as visible text. Child elements, events and data remain intact.

Fallback links use the final src, remain visible for pending/failed images, and hide when `complete && naturalHeight > 0`. Load/error events update visibility. Repeated calls reuse links/listeners; disabling preserves unrelated links.

```ts
const nodes = $('<a href="https://old.example/files/a?q=1#top">download</a><img src="https://old.example/pic.png">');
nodes.refineUrls(['old.example', /^cdn\./], new URL('https://new.example:8443/'), {
  pathRewrite: path => path.replace('/files/', '/archive/'),
  addImageFallbackLinks: true,
});
console.log(nodes.eq(0).href()); // 'https://new.example:8443/archive/a?q=1#top'
```

## Development and tests

```sh
pnpm install
pnpm test
pnpm run type-check
pnpm build
```

`pnpm dev` watches type checking; `pnpm test:watch` watches tests. Full build cleans output, checks types, builds JavaScript and generates declarations.

Each `src/extensions/jquery.<feature>.ts` has a matching `test/jquery.<feature>.test.ts`: init, collection, enumeration, factory, traversal, text-nodes, text, replace, attr, css, scroll, events, observe, wait and urls. Shared fixtures are in `test/helpers`.

`extensions.integration.test.ts` verifies cross-feature chains. `package.test.ts` checks shared peer initialization/published declarations and compiles every TypeScript example in this README against the built package in Bundler and NodeNext modes. `build-workflow.test.ts` checks workflow triggers. DOM tests use jsdom; focused layout/scroll tests supply metrics or native scrolling stubs where jsdom has no implementation.
