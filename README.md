# builtinx [![NPM Version](https://img.shields.io/npm/v/builtinx)](https://www.npmjs.com/package/builtinx) [![LICENSE](https://img.shields.io/github/license/mashape/apistatus.svg)](LICENSE.TXT) [![Build](https://github.com/huoshan12345/builtinx/actions/workflows/build.yml/badge.svg)](https://github.com/huoshan12345/builtinx/actions/workflows/build.yml)


Extensions for JavaScript built-ins and web platform objects.

`builtinx` is a small TypeScript utility library that installs convenience methods on native prototypes and exposes a `BuiltinX` helper namespace on `globalThis`. It is designed for applications and scripts where concise, chainable operations are preferred over repeatedly writing the same small helpers.

## Installation

```sh
pnpm add builtinx
```

```sh
npm install builtinx
```

## Quick Start

Import the package once near your application entry point. The import has side effects: it augments native objects such as `Array`, `String`, `URL`, `Promise`, `Math`, `FormData`, `Blob`, `Response`, and `console`.

```ts
import "builtinx";

const names = ["Ada", "Grace", "Ada"];

names.distinct();              // ["Ada", "Grace"]
names.groupBy(x => x.length);  // Map<number, string[]>
"42px".parseInt();             // 42
Math.clamp(12, 0, 10);         // 10

const url = new URL("https://example.com/search");
url.setParam("q", "builtinx").setBool("debug", true);
```

DOM-specific extensions live in a separate entry so they can be loaded only in browser-like environments:

```ts
import "builtinx";
import "builtinx/dom";

document.body.hide().show();
document.body.observe((records, observer, node) => {
  console.log(records, node);
});
```

The helper namespace is also installed globally:

```ts
import "builtinx";

const hex = BuiltinX.Color.rgbToHex(255, 128, 0); // "#ff8000"
const data = await BuiltinX.Http.request("/api/items");
```

## Entry Points

| Entry | Purpose |
| --- | --- |
| `builtinx` | Core extensions, helper namespace, utility classes, and shared types. |
| `builtinx/dom` | DOM-only prototype extensions for `Element`, `HTMLElement`, `Node`, and `Storage`. |

## Prototype Extensions

`builtinx` defines methods only when the property is absent, using non-enumerable properties by default. Existing own properties are left untouched.

### Array

Static helpers:

- `Array.cast(value)` returns the original array or converts an iterable/array-like value with `Array.from`.
- `Array.isArrayLike(value)` checks for string, typed-array, array, or object values with a safe non-negative integer `length`.

Instance helpers:

- Indexing and mutation: `hasIndex`, `removeAt`, `remove`, `resize`, `replaceFrom`, `swap`, `append`, `insert`, `prepend`.
- Selection: `first(predicate?)`, `firstOrNull(predicate?)`, `last(predicate?)`, `lastOrNull(predicate?)`, `sample`, `throwIfEmpty`.
- Aggregation: `distinct`, `groupBy`, `countBy`, `count`.
- Pattern matching across selected strings: `anyContainsAny`, `anyContainsAll`, `allContainsAny`, `allContainsAll`.
- RegExp/extractor arrays: `rewrite`, `extract`, `matchesAny`, `containsAny`.

```ts
const items = [1, 2, 3, 4];

items.swap(0, -1);       // [4, 2, 3, 1]
items.count(x => x > 2); // 2

const byParity = items.groupBy(x => x % 2);
```

### String and RegExp

String helpers:

- Matching: `contains`, `matches`.
- Slicing: `skipUntil`, `takeUntil`.
- Parsing and conversion: `parseFloat`, `parseInt`, `toRegExp`, `unescapeHtml`.
- Formatting/comparison: `ifEmpty`, `parenthesize`, `equalsIgnoreAsciiCase`, `trimChars`.

RegExp helpers:

- `find(input)` returns the first match from the beginning of the input and restores `lastIndex` afterward. Sticky (`y`) patterns instead match at their current `lastIndex`.
- `findAll(input)` returns all matches from the beginning of the input, restores `lastIndex` afterward, and protects against zero-length-match loops. Sticky (`y`) patterns begin at their current `lastIndex` and retain sticky matching semantics.

```ts
"foo/bar/baz".skipUntil("/");       // "bar/baz"
"--hello--".trimChars("-");         // "hello"
/\d+/.find("id=42")?.[0];           // "42"
```

### Set Helpers

- `Set.some(predicate)` returns whether any value satisfies a predicate and stops after the first match.

### URL and URLSearchParams

URL helpers:

- Query management: `setParam`, `getParam`, `getNumberParam`, `hasParam`, `setParamsFrom`, `deleteParam`, `tryDeleteParam`, `getParams`, `setBool`.
- Navigation and mutation: `goto`, `setHost`, `setProtocol`, `resolve`.

`URLEx` helpers:

- `URLEx.create(url, base?)`
- `URLEx.goto(url, openInNewTab?, noReferrer?)`
- `URLEx.fromSegments(base, ...segments)`

URLSearchParams helpers:

- `getInt`, `getBool`, `setBool`, `any`, `distinct`, `setFrom`, `getEffectiveValue`, `hasEffectiveValue`, `trySet`, `add`.

```ts
const url = URLEx.fromSegments("https://example.com/app", "users", "42");

url
  .setParam("tab", "profile")
  .setBool("readonly", false); // removes the key by default
```

### Promise, Math, Error, Console, Fetch Helpers

- `Promise.delay(ms)`, `promise.delay(ms)`, `promise.ignore(onError?)`, `Promise.retry(factory, times, delayMs?)`.
- `Math.randomInt(max)`, `Math.randomInt(min, max)`, `Math.clamp(value, min, max)`, `Math.lerp(start, end, t)`.
- `Error.throw(message)` for expression-friendly throwing.
- `console.styled(...)`, `console.color(text, color)`, `console.red(text)`.
- `Response.throwIfNotOk()` and `Response.download(filename)`.
- `Blob.toBase64()` and `Blob.download(filename, revokeDelay?)`.
- `FormData.add(key, value)` and `FormData.toParams()`.

```ts
const result = await Promise.retry(
  () => BuiltinX.Http.request("/api/data"),
  3,
  250
);

await Promise.resolve(result).delay(100);
```

## DOM Extensions

Load these with `import "builtinx/dom"` after the core entry.

### Element and HTMLElement

- `Element.hide()`, `Element.show()`.
- `Element.collapseBrs()`, `Element.trimLeadingBrs()`.
- `Element.getDocumentRect()`.
- `HTMLElement.isVisible()`, `HTMLElement.setVisible(value)`.

### Node and MutationObserver

- `Node.ownText()` returns direct child text only.
- `Node.isTextNode()` and `Node.isNewLineTextNode()`.
- `Node.observe(callback, options?)` wraps `MutationObserver` with optional debouncing, exclusion predicates, lifecycle callbacks, and the observed node as a callback argument. Set `debounce` to `false` to invoke each mutation callback directly.

```ts
const observer = document.body.observe(
  (records, observer, node) => {
    console.log(records.length, node.ownText());
  },
  {
    debounce: {
      debounceMs: 250,
      maxWaitMs: 1000,
    },
    callOnStart: false,
    exclusions: [record => record.type === "attributes"],
  }
);
```

### Storage Cache Helpers

- `Storage.setCache(key, value, expiration)`.
- `Storage.getCache(key)`.
- `Storage.takeCache(key)`.
- `Storage.getJsonValue(key)`.
- `Storage.getOrCreateCacheAsync(key, factory, expiration)`.
- `Storage.cleanupExpired()`.
- `Storage.keys()`.

```ts
import { TimeSpan } from "builtinx";

localStorage.setCache("profile", { name: "Ada" }, TimeSpan.fromMinutes(10));
const profile = localStorage.takeCache<{ name: string }>("profile");
const settings = localStorage.getJsonValue<{ theme: string }>("settings");
```

## Helper Namespace

Importing `builtinx` creates `globalThis.BuiltinX`.

Available helpers include:

- `BuiltinX.Color`: `rgbToHex`, `hexToRgb`.
- `BuiltinX.Clipboard`: `copy`.
- `BuiltinX.Element`: HTML tag name list.
- `BuiltinX.FileInfo`: filename splitting, extension handling, illegal-character replacement, compression-extension detection.
- `BuiltinX.Http`: `downloadText`, `download`, `request`. `downloadText` returns a promise and defaults to `text/plain`.
- `BuiltinX.Node`: debounced mutation callback helper.
- `BuiltinX.Type`: precise runtime type names and common type guards.
- `BuiltinX.debounce`: general debouncing utility.

```ts
BuiltinX.FileInfo.splitName("archive.tar"); // ["archive", ".tar"]
BuiltinX.Type.get(new Map());               // "Map"
BuiltinX.Type.is.str("hello");              // true
```

## Utility Classes

The main entry exports these utility classes and types:

- `Queue<T>`: FIFO queue with `enqueue`, `dequeue`, `peek`, `clear`, `length`, and iteration.
- `Stack<T>`: LIFO stack with `push`, `pop`, `peek`, `clear`, `size`, and iteration.
- `Lazy<T>`: lazy value wrapper with `value`, `isValueCreated`, and `reset`. A `null` or `undefined` factory result still counts as created and remains cached until reset.
- `StringBuilder`: chainable string accumulation.
- `TimeSpan`: integer-millisecond duration factory and arithmetic helpers. Its public constructor rejects non-finite, fractional, and unsafe millisecond values; single-unit factories round fractional inputs. `parse` accepts `hours:minutes:seconds` and `days.hours:minutes:seconds`.
- `Timer.every(timeSpanOrMs, signal?)`: async generator that yields at an interval until it is closed or the optional `AbortSignal` aborts.
- `HttpError`: error type used by `BuiltinX.Http.request`.

```ts
import { Queue, TimeSpan, Timer } from "builtinx";

const queue = new Queue("first", "second");
queue.dequeue(); // "first"

for await (const _ of Timer.every(TimeSpan.fromSeconds(1))) {
  console.log("tick");
}
```

## TypeScript

The package ships TypeScript declarations through `dist/index.d.ts`. Because many features are global prototype augmentations, import the package in any application entry or test setup that relies on the augmented methods:

```ts
import "builtinx";
import "builtinx/dom"; // browser/jsdom only
```

## Development

This repository uses pnpm, Vite, TypeScript, and Vitest.

```sh
pnpm install
pnpm test
pnpm run type-check
pnpm build
```

Project scripts:

- `pnpm dev`: start Vite in development mode.
- `pnpm test`: run the Vitest suite.
- `pnpm test:watch`: run Vitest in watch mode.
- `pnpm run type-check`: run `tsc --noEmit`.
- `pnpm build`: clean `dist`, build JavaScript, and emit declarations.

## Notes

Prototype extension libraries are best imported intentionally and early. `builtinx` avoids overwriting existing own properties, but it still changes global objects for the current runtime. For libraries consumed by unknown hosts, consider documenting the side effects for your users and importing only in controlled application entry points.
