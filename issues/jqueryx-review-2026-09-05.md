# jqueryx 全量代码审查 — 2026-09-05

已先阅读根目录 AGENT.md，按整体设计、职责与生命周期、公开 API 和签名、具体实现的顺序审查。覆盖所有受版本控制的源码、声明构建配置、测试配置、脚本、工作流及 README；依赖仅检查与本项目行为相关的已安装版本。初次审查未修改生产代码；后续修复状态记录在对应条目中，其余内容保留初次审查时的证据。

本次共记录 22 项问题。P1 表示应优先解决的核心行为或交付阻塞；P2 表示应修复的设计、契约或实现问题。编号用于后续逐项跟踪，不表示严重程度排序。

用户已澄清：`refineUrls` 应增加 option 控制图片备用链接；`textContent` 和 `ownText` 的用途都是获取／设置文本。下述建议已采用这些信息。

## 设计、职责与 API

### 1. [已修复 2026-09-05] [P2] 打包内置 jQuery 可能使全局实例与应用／插件实例分离

位置：[jquery.init.ts:1](../src/extensions/jquery.init.ts#L1)、[vite.config.ts:13](../vite.config.ts#L13)、[package.json:50](../package.json#L50)。

用户进一步明确：本包的目标是在应用入口执行一次 `import 'jqueryx'`，随后业务文件直接使用全局 `$`／`jQuery`，不用逐文件 import。因此 `jquery.init.ts` 将导入的 jQuery 安装到 globalThis 是有意提供的功能，应保留；不能把使用全局变量本身判定为设计缺陷，也不需要改成手动调用安装函数。

问题收窄为发布产物的实例一致性：当前构建没有将 jquery 外部化，会把它内置到 jqueryx 产物。只使用该全局实例的应用不受实例分离影响；但应用或插件同时通过 `import ... from 'jquery'` 使用依赖时，就会存在另一实例。插件可能注册在另一个 fn 上，扩展、事件和 data 缓存不能作为同一套实例状态使用。这是混合使用场景的问题，因此从 P1 调整为 P2。

验证：仅为隔离实验去掉无效 dom 入口，保留其余打包行为，生成的包约 191 kB。导入后 `globalThis.$ !== originalJQuery`，两者 `fn.isEmpty` 不是同一个函数，原先的 jQuery 对象也不是新实例的 `instanceof`。源码测试使用同一依赖，不能发现这一发布行为。

建议保留入口自动初始化和全局使用方式，只在库构建时将 `jquery` 设为 external，让 jquery.init.ts 从运行环境的依赖图导入 jQuery，再将同一个实例赋给全局 `$` 和 `jQuery`，然后安装扩展。external 不表示要求业务文件自行 import，也不表示依赖未声明的全局 jquery；产物仍保留正常的模块依赖。包元数据可用 peerDependencies 表达与宿主共享 jQuery 的要求，并用 devDependencies 满足本地开发；它是依赖兼容约定，不能代替 external，也不能保证任意版本或 script 标签来源的实例自动相同。

应用入口应先导入 jqueryx，再导入会在顶层使用 `$` 的业务模块。全局别名及覆盖行为应作为入口副作用写进 README；声明入口还需显式带入 jQuery 的全局基础类型，使消费者在 TypeScript 文件中直接使用 `$`，这一发布类型问题继续由 issue 9 跟踪。无需为了本项在每个扩展或业务文件添加 `import $ from 'jquery'`。

修复：保留 jquery.init.ts 的全局初始化；Vite 将 jquery 设为 external；package.json 将 jquery 改为 peerDependency 和 devDependency，锁文件同步更新。

验证：新增 test/package.test.ts 及消费者 fixtures，在独立 Node/jsdom 进程中通过包入口消费构建产物，确认另一业务模块不 import jquery 也能直接使用 `$`；全局 `$`／`jQuery` 与宿主模块实例相同，已有插件和 data 缓存共享。测试只构建 index 入口以隔离未修复的 issue 8，没有将此结果表述为完整构建通过。

### 2. [已修复 2026-09-05] [P1] 异步事件包装器的取消、互斥和错误传递模型不成立

位置：[jquery.events.ts:94](../src/extensions/jquery.events.ts#L94)、[jquery.events.ts:153](../src/extensions/jquery.events.ts#L153)。

`onClick` 在 `await handler(...)` 后的 finally 中执行 `preventDefault`、`stopPropagation` 和 `stopImmediatePropagation`，`onKeyDown` 也在 await 之后阻止后续处理。即使 handler 同步返回，await 仍让出执行：本次事件已经继续传播，浏览器也已判断是否执行默认行为。默认开启的 `preventDefault` 因而不能可靠阻止链接导航或表单提交。

`disableWhileProcessing` 只设置整个集合的 `pointer-events: none`，既没有每个元素的执行状态，也不能阻止键盘或程序触发点击；并发调用会提前恢复状态。finally 固定写入 `initial`，会丢失原有样式。handler 抛错会变成 jQuery 不等待的异步监听器 rejection，而方法返回 JQuery，调用方没有对应的 Promise 可等待。

验证：原生事件 dispatch 返回 true、`defaultPrevented === false`，后续监听器和父节点监听器均执行；微任务后才变成已取消。连续两次 `.click()` 在同一 Promise 完成前调用 handler 两次；初始 `pointer-events: auto` 结束后变成 `initial`。

建议把事件取消放在同步阶段；明确逐元素互斥规则、保存／恢复状态和异步错误处理方式。`onEnterDown` 应沿用修正后的模型。

修复：onClick 在调用用户 handler 前同步执行各项事件取消选项；disableWhileProcessing 按每次绑定、每个绑定元素防重入，不再禁用整个集合。独立绑定仍各自执行，原始 pointer-events 值及 important 优先级由共享计数管理，最后一个 handler 结束后才恢复。成功或失败都释放执行状态，并在错误回调之前完成恢复。

onClick、onKeyDown 和 onEnterDown 保留返回 JQuery 的链式 API，新增可选 onError 处理同步异常／异步拒绝；未提供时写入 console.error，onError 自身失败也写入 console.error。handler 的返回值继续被忽略，支持返回普通值或 Promise 的表达式函数。onKeyDown 同步阻止传播并保留默认行为；onEnterDown 只对 Enter 执行这一行为，不拦截其他键。

验证：test/jquery.events.test.ts 的 40 项用例覆盖同步取消、传播选项、原生和 jQuery 重触发、同步递归、集合内独立执行、并行绑定、样式恢复、关闭防重入、键盘过滤及错误路径。完整测试共 44 项通过；类型检查、声明生成通过，消费者类型测试也覆盖新的 onError 参数。运行时验证使用 jsdom，没有将其表述为真实浏览器导航测试；issue 8 和 10 的既有验证限制仍保留。

### 3. [已修复 2026-09-05] [P2] observe 丢弃观察器，调用方无法可靠管理订阅生命周期

位置：[jquery.ts:245](../src/extensions/jquery.ts#L245)。

每个元素创建一个 MutationObserver，但返回的是原 JQuery，底层 `Node.observe` 返回的观察器全部被丢弃。使用合法选项 `{ callOnStart: false }` 时，在发生第一次 mutation 以前，调用方甚至无法从 callback 获得观察器；组件卸载或重复安装时无法立即断开整组观察。

验证：两个元素创建两个独立观察器，返回值仍然是输入 JQuery。测试只能通过拦截底层实现获得句柄并清理。

建议返回包含 `disconnect()` 的订阅对象或观察器集合，或接收 AbortSignal；不要要求调用方等待回调来收集生命周期句柄。

修复：观察相关代码移至 `src/extensions/jquery.observe.ts`。`observe` 返回公开的 `JQueryObservation`，一次 `disconnect()` 停止本次调用创建的全部观察器，可重复调用；空集合也返回可清理的订阅。保留 builtinx 的全局默认值、启动回调、过滤、debounce 和生命周期钩子，保留跨 iframe 的 prototype.call 调用。注册中途抛错时清理已经创建的观察器；断开后屏蔽尚未执行的延迟回调及钩子。底层 debounce 未提供取消计时器的 API，因此这里只屏蔽延迟投递，不宣称取消底层计时器。

这是返回类型的有意变更：原先 `.observe(...).addClass(...)` 应改为先保存集合，再保存订阅，并在组件卸载时调用订阅的 `disconnect()`。启动回调仍可能同步执行，不能在其中引用尚未赋值的订阅变量。

验证：`test/jquery.observe.test.ts` 的 13 项回归测试覆盖首次 mutation 前取消、整组清理、独立订阅、延迟回调屏蔽、启动钩子顺序、宿主默认值和显式覆盖、回调内清理、过滤、中途失败、空集合与同源 iframe。消费者运行时测试改用发布包返回的订阅进行清理，不再拦截原生 MutationObserver 收集句柄。

### 4. [已修复 2026-09-05] [P2] onNodeExists 的轮询没有取消和完成契约

位置：[jquery.ts:23](../src/extensions/jquery.ts#L23)、[jquery.ts:224](../src/extensions/jquery.ts#L224)。

公开签名允许省略 `maxCount`，实现却没有默认值。`count >= undefined` 永远为 false，所以目标不存在时每 500 ms 无限轮询并捕获原集合／回调；方法返回 void，无法取消或获知重试已结束。提供次数上限时，耗尽也静默结束。

验证：省略 maxCount，推进 50 秒虚拟时间后仍有下一轮 timer。

建议明确为 `waitForNode` 一类等待操作，返回 Promise，提供 timeout／AbortSignal；若继续使用 callback，则返回取消句柄。`maxCount` 应命名为 `maxAttempts`，避免与匹配节点数量混淆，并明确默认值、合法范围和耗尽行为。

用户补充用途：等待页面中由 AJAX 等异步插入的节点出现，然后继续后续操作。因此这是一次性的等待操作，采用 `waitForNodes<TElement extends Element = HTMLElement>(selector, options): Promise<JQuery<TElement>>` 替代回调轮询。用户已确认此方案，旧 onNodeExists 已移除。

已实现的契约：

- 对已经存在的稳定容器调用，例如 `await $(document).waitForNodes('.ajax-result', { timeoutMs: 30_000, signal })`。只查找后代；空根集合立即报错，避免对 `$('.尚不存在')` 这样的快照无限等待。
- 先立即查找；已有匹配则完成。否则用 MutationObserver 监听子树的节点、属性和文本变化，每次重新查询；第一次查到至少一个节点时返回当时的匹配集合，仅完成一次，不等待所有未来节点。
- `timeoutMs` 默认 30 秒，必须是有限非负数；0 表示只立即检查一次。超时拒绝为 TimeoutError，取消使用 AbortSignal 的 reason；预先取消的 signal 优先于查找。非法选择器立即拒绝。
- 成功、超时、取消和错误都清理 observer、定时器和事件监听器。支持 DOM 变化驱动的选择器；`:visible`、`:hover` 等仅由布局或交互状态改变的条件不在此等待契约内。
- iframe 用显式 `includeIframes` 选项，默认 false。开启时只检查可访问的同源文档，同时处理新增 iframe 和 load 后的文档替换；跨源文档跳过。避免默认观察所有 frame 的开销和隐含边界。

这能直接表达 `const nodes = await ...; nodes.doSomething()` 的使用顺序，也让后续操作的异常自然进入调用方的 try/catch。

实现位于 `src/extensions/jquery.wait.ts`，选项类型 WaitForNodesOptions 从根入口导出。selector 使用标准 CSS 选择器，由原生 querySelectorAll 查询；不支持 jQuery 专属伪类。这样避免 jQuery 查询复杂选择器时临时修改根节点 ID，造成观察器反馈循环或多个等待之间互相触发。

验证：29 项等待测试覆盖已有／异步节点、多根去重、属性／字符数据变化、DocumentFragment、超时边界、AbortSignal、非法输入、注册失败清理、复杂选择器与并发等待、iframe 新增／嵌套／load 文档替换／移除、不可访问文档及后续错误。iframe 导航与访问拒绝使用受控文档替换和异常模拟，未声称验证真实浏览器导航。发布包消费者也验证异步等待，类型测试验证结果泛型、根节点约束及旧 API 已移除。

### 5. [已修复 2026-09-05] [P2] 扩展签名丢失 JQuery 的元素类型，部分声明直接不真实

位置：[jquery.ts:7](../src/extensions/jquery.ts#L7)、[jquery.attr.ts:4](../src/extensions/jquery.attr.ts#L4)、[jquery.css.ts:2](../src/extensions/jquery.css.ts#L2)。

多数扩展固定返回裸 `JQuery`，把 `JQuery<HTMLButtonElement>` 等类型退化为默认 HTMLElement；`entries`、`asEnumerable`、`where` 等还将任意集合中的元素固定声明为 HTMLElement。运行时集合可以包含 SVG、Text，项目自身也返回 `JQuery<HTMLNode>`。

验证：`$(button).tap(() => {})[0].disabled = true` 被 tsc 拒绝；反过来 SVG 集合的 `asEnumerable().toArray()` 可以错误地赋给 `HTMLElement[]`，Text 集合的 entries 元素也能赋给 HTMLElement。

建议增强 `JQuery<TElement>`，链式不改变集合的方法返回 `this`，回调和枚举保持 TElement。需要 HTMLElement／Element 能力的方法应在 this 参数上表达约束。`color()` 声明为 string，但空集合会从底层 css 得到 undefined，也应一并校正。

修复：各实例扩展统一增强 `JQuery<TElement>`，保持集合的链式方法返回 `this`；entries、where、asEnumerable、enumerate 和 observe 回调保留实际元素类型，tap/tapIf 回调保留集合类型。replaceBy 推断替换后的元素类型，ifEmpty 返回原元素与选择器默认元素的联合类型，ancestor 返回 Element 集合。通过 this 参数分别要求 Node、Element、带 style 的 Element、HTMLElement 或 EventTarget；SVG 样式和 Text 文本／观察操作仍可使用。事件 target 仍表示实际触发节点，未错误地收窄为绑定集合中的按钮类型。

`color()` 现在返回 `string | undefined`；colorHex 的原颜色回退也包含 undefined，字符串回退与失败抛错的重载仍返回 string。文本范围、URL 改写与一次性序列等其他条目不在本次修复范围内。

验证：独立消费者编译真实发射的声明，覆盖各模块按钮链、回调和序列泛型、替换与 fallback 类型、SVG／Text 正常用法，以及错误 DOM 能力调用和颜色非空赋值的拒绝。另有 3 项运行时测试验证链式集合身份、Text／SVG 枚举身份和空集合颜色。完整测试共 63 项通过；类型检查和声明构建通过。消费者仍用 skipLibCheck 隔离 issue 10，完整 Vite 构建仍受 issue 8 阻塞。

### 6. [已修复 2026-09-05] [P2] textContent 与 ownText 的文本范围和集合写入规则不一致

位置：[jquery.attr.ts:44](../src/extensions/jquery.attr.ts#L44)、[jquery.ts:313](../src/extensions/jquery.ts#L313)。

两者用途均为获取／设置文本，但 `textContent()` 实际只取直接文本，与原生 textContent／jQuery text 的后代文本语义不一致。setter 将整个集合的直接文本合并处理：仅给全局第一个文本节点赋值，删除其他元素的文本；如果集合完全没有直接文本，则退回 `this.text(value)`，又会删除所有子元素。结果由是否碰巧存在直接文本决定。

验证：两个 div 分别含 `a<b>keep</b>` 和 `b<i>keep too</i>`，赋值后第二个 div 的直接文本被删除。`<div><button>keep</button></div>` 的 getter 返回空串，setter 却删除 button。

当前用户明确的契约：textContent 读取全部后代文本；setter 逐根合并文本到第一个 Text 节点，删除其余 Text，但保留非文本节点。没有 Text 的元素或 DocumentFragment 在开头插入新文本。ownText 仍仅操作直接文本。

复核用户修改：逐根设置已经成立，且能保留非文本节点；此前按 .text(value) 编写的“删除子元素”测试不符合用户最新确认的意图，已修正。新边界测试进一步发现 textNodes() 默认跳过 a、button 等标签，使写入后仍残留文本（例如得到 newbc）；根节点没有文本时也没有写入。

修复：保留用户逐根设置的实现，遍历文本时明确禁用标签跳过；无文本时使用所属 document 创建 Text，插入元素／fragment 的开头。有文本时原位设置第一个 Text，并删除其余 Text。没有使用 .text(value)，元素身份、嵌套结构、事件、jQuery data 与注释均保留。独立 Text 的写入继续支持；ownText 的其他独立缺陷仍由 issue 13、16 跟踪。

验证：11 项文本回归测试覆盖后代顺序、逐根写入、无文本插入、空字符串、空集合、独立 Text、DocumentFragment、同源 iframe、a/button、相邻 Text、首个 Text 位于深层的情况，以及非文本节点身份／事件／data／注释的保留。发布包消费者测试也改为断言保留非文本节点。

### 7. [已修复 2026-09-05] [P2] refineUrls 无条件承担图片备用链接的插入职责

位置：[jquery.ts:369](../src/extensions/jquery.ts#L369)、[jquery.ts:435](../src/extensions/jquery.ts#L435)。

IMG 在验证 URL 和 hosts 之前就加入 images 列表，因此即使完全没有匹配、没有改写 URL，也会在图片后插入链接。重复调用还会重复插入链接和 load 监听器。方法名无法提示调用方它还会改变页面布局。

验证：不匹配 hosts 的同一图片调用两次后，src 未变，但 DOM 新增两个 a。

按用户确认的方向，将备用链接行为放入命名清晰的 option，例如 `addImageFallbackLinks`；明确默认值及作用对象。启用时复用／更新已有备用链接，避免重复节点和订阅。若以 URL 改写为主，`rewriteUrls` 比 `refineUrls` 更能表达职责。

修复：URL 相关实现移至 `src/extensions/jquery.urls.ts`，保留 refineUrls 名称，第三个参数接受 RefineUrlsOptions（从根入口导出），包含 pathRewrite 和 addImageFallbackLinks；原有第三参数直接传路径回调的形式继续可用。addImageFallbackLinks 默认 false；显式开启时作用于选中集合内所有有 src 的图片，包括未命中 hosts 的图片。链接使用改写后的最终 src，不受 URL 是否改写的偶然结果影响。

每个图片复用同一链接和 load/error 监听器，重复调用更新 href、文本、位置与显隐状态。关闭选项或 src 为空时，移除本方法管理的链接和监听器，不影响用户已有链接。链接使用图片所属 document 创建，成功加载时隐藏，失败或尚未完成时显示。

验证：11 项回归测试覆盖默认关闭、不匹配 hosts、重复调用、URL 更新、关闭／重新开启、空 src、缓存成功／load／error、文本安全写入、图片移动、旧／新路径回调、重复集合元素及 iframe 所属文档；消费者类型与运行时测试验证新选项可从发布入口使用。

## 构建、发布和验证

### 8. [已修复 2026-09-05] [P1] Vite 配置引用不存在的 src/dom.ts，构建无法完成

位置：[vite.config.ts:15](../vite.config.ts#L15)。

入口声明包含 `src/dom.ts`，仓库不存在该文件，package exports 也只声明根入口。实际运行 `pnpm run build:ts` 失败：`[UNRESOLVED_ENTRY] Cannot resolve entry module src/dom.ts`。这会阻止 pnpm build 和发布。

建议依照 jqueryx 的真实入口删除遗留 dom 配置，或实现并导出确有需要的入口，不应只让源码 type-check 代替打包验证。

复核时磁盘上的 vite.config.ts 仍包含该入口；经用户确认，已移除 dom，仅保留 index。包测试构建 helper 同步移除覆盖入口的临时绕过，直接使用实际 Vite 配置。

验证：完整 pnpm build（类型检查、Vite 打包、声明生成）通过。当前全部 109 项测试通过，包含真实配置构建后的消费者验证。此前各条目中隔离 issue 8 的记录是历史验证结果；当前已不再需要该隔离。issue 10 的依赖声明冲突仍独立存在，消费者测试继续使用现有 skipLibCheck。

### 9. [已修复 2026-09-05] [P2] 发布声明没有带入所依赖的 jQuery 基础类型

位置：[package.json:40](../package.json#L40)、[jquery.init.ts:1](../src/extensions/jquery.init.ts#L1)、[index.ts:1](../src/index.ts#L1)。

`@types/jquery` 仅在 devDependencies 中；声明发射后 jquery.init.d.ts 是 `export {}`，没有任何 jquery 类型引用。项目自身靠默认加载 node_modules/@types 而通过，消费者只加载 jqueryx 声明时则缺少基础 `JQuery<TElement>` 定义。

验证：对生成的 dist/index.d.ts 运行独立 tsc、限制 `--types node`，出现六处 `Type 'JQuery' is not generic`；加入 `--types node,jquery` 后这六处错误消失。

建议将发布声明所需类型放在消费者能安装到的位置，并在声明入口显式 import／reference jQuery 基础类型，避免依赖消费者的隐式 ambient types 配置。

修复：将 @types/jquery 从 devDependencies 移至 dependencies，并在 src/index.ts 显式 `import 'jquery'`。发射后的 dist/index.d.ts 保留该引用，从而加载 jQuery 基础类型和全局工厂声明。

验证：消费者使用独立 tsconfig，关闭 ambient @types 自动发现（types: []），只导入 jqueryx 即可使用 `$`、`jQuery`、`JQuery<HTMLButtonElement>` 和扩展方法；错误的元素泛型赋值仍被拒绝。测试启用 skipLibCheck 以隔离未修复的 issue 10，不表示 builtinx/dom 的声明冲突已解决。

### 10. [已修复 2026-09-05] [P2] 根入口引入的 builtinx/dom 声明与原生 DOM 类型冲突

位置：[index.ts:1](../src/index.ts#L1)、[tsconfig.json:7](../tsconfig.json#L7)。

初次审查时 builtinx 0.2.2 为 Element 声明返回 this 类型的 `show`，原生 HTMLDialogElement.show 返回 void，继承关系不兼容。jqueryx 根声明无条件导入 builtinx/dom，将此冲突带给所有消费者；当时项目的 skipLibCheck 为 true，因此常规检查不报告。

验证：在已明确加载 jquery 基础类型的前提下，使用不跳过声明检查的独立 tsc，仍报 HTMLDialogElement 的 TS2430，以及两个 HTMLElementTagNameMap 的 TS2344。

根因在依赖声明，不能算 jqueryx 自己实现的 DOM 方法缺陷；但它已经影响本包交付。建议修正／升级依赖的冲突 API 或解除该入口的声明依赖，并用消费者配置验证，不应要求消费者打开 skipLibCheck 来掩盖。

复核：package.json、锁文件和已安装包均为 builtinx 0.3.0，peerDependencies 同步为 ^0.3.0。该版本不再增强 Element.show/hide，改为 setVisible，原生 HTMLDialogElement.show 的 void 返回契约不再被覆盖。用户也已从根 tsconfig 移除 skipLibCheck。

验证：显式关闭 skipLibCheck 的整个项目类型检查通过；发布包消费者配置改为 skipLibCheck: false，基础声明及依赖声明完整检查通过，并增加 dialog.show(): void、dialog.setVisible(): HTMLDialogElement 与 SVG setVisible 的回归编译用例。先前为 issue 10 保留的声明检查隔离已取消。

### 11. [已修复 2026-09-05] [P2] 仓库没有测试用例，测试命令与 CI 当前直接失败

位置：[vitest.config.ts:12](../vitest.config.ts#L12)、[test/setupFiles.ts:1](../test/setupFiles.ts#L1)、[build.yml:83](../.github/workflows/build.yml#L83)。

初次审查时 test 目录只有 setupFiles.ts，没有配置所匹配的 `test/**/*.test.ts`。当时干净基线执行 pnpm test 返回退出码 1：`No test files found`，工作流在发布前无条件执行同一命令。

建议先补核心行为和消费产物的测试，尤其是 jQuery 实例安装、同步事件取消、文本写入及观察器清理；仅允许无测试通过不能解决缺少验证的问题。

复核：现有 7 个 .test.ts 文件覆盖事件、观察、等待、文本、URL、类型相关运行时行为与发布包消费者。当前 pnpm test 执行 114 项测试全部通过，已不存在 No test files found 问题；完整 pnpm build 也通过。此处确认本地结果，未实际运行 GitHub Actions。

### 12. [已修复 2026-09-05] [P2] PR 检查的构建步骤与触发范围

位置：[build.yml:83](../.github/workflows/build.yml#L83)、[build.yml:86](../.github/workflows/build.yml#L86)。

初次审查时工作流唯一的 pnpm build 位于 main push 且版本尚未发布的分支；PR 只执行 pnpm test。Vitest 的源码执行不能替代完整类型检查和发布构建，因此补上测试后，入口缺失或错误声明仍可在 PR 中通过，直到发布时才暴露。已发布版本的 main push 也会跳过 build。此外，paths filter 未包含 pnpm-lock.yaml／pnpm-workspace.yaml，单独修改依赖解析或安装配置也会跳过检查。

建议将类型检查、测试、构建作为独立且无条件的验证步骤，发布只消费验证后的产物；把锁文件与 workspace 配置纳入触发范围。

复核：用户新增的 Run build with pnpm 位于发布步骤之前，无步骤级 if 条件；PR 和 main push 只要进入 build job 都会运行。pnpm build 已包含 type-check、Vite 打包和声明生成，本地完整运行通过，因此无需再加一个重复的 type-check 步骤。

再次复核：用户已将 `**/pnpm-lock.yaml` 和 `**/pnpm-workspace.yaml` 加入 paths filter，两个模式均覆盖仓库根目录对应文件；本项已修复。新增 test/build-workflow.test.ts，从实际 workflow 的 filter 中提取模式，验证两个根目录文件都在触发范围内。本次确认配置和本地构建／测试结果，未实际运行 GitHub Actions。发布分支中的第二次 build 可另行去重，但不属于正确性阻塞。

## 实现缺陷

### 13. [已修复 2026-09-05] [P2] ownText 删除实时 childNodes 中的节点会漏删相邻文本

位置：[jquery.ts:330](../src/extensions/jquery.ts#L330)。

childNodes 是实时列表，在 for-of 中删除当前 child 会改变后续索引，导致下一个相邻文本节点被跳过。通过 DOM API 拼接文本或编辑后的节点可能自然具有多个相邻 Text。

验证：一个 div 顺序 append 四个文本节点 a、b、c、d，调用 ownText('new') 后实际文本为 `newc`，不是 `new`。

建议先快照 childNodes，或显式保存 nextSibling 再删除，保留且设置一个文本节点。

复核：用户现在先将待删除 Text 放入 toRemove，完成 childNodes 遍历后统一删除，不再改变正在遍历的实时列表。保留该实现，未再次改写。

验证：新增 3 项 ownText 回归测试，确认四个相邻文本节点不会漏删，夹杂元素／注释时保留节点身份和后代文本，多根集合及空字符串也逐根正确处理。

### 14. [已修复 2026-09-05] [P2] asEnumerable 把可重复遍历的集合变成一次性序列

位置：[jquery.ts:252](../src/extensions/jquery.ts#L252)。

每次 asEnumerable 调用只创建一个 generator 对象，然后把该对象传给 Enumerable.from。后者重新枚举时得到的仍是同一个已消耗迭代器，因此 count／toArray／first 等一次枚举会影响后续操作；enumerate 也继承此问题。

验证：同一包含两个节点的 sequence，第一次 toArray 长度 2，第二次为 0。输入 JQuery 本身完全没有改变。

建议直接将 JQuery 作为可重复遍历的 array-like 输入，或传入每次创建迭代器的工厂。

复核：用户改为 `Enumerable.from(() => enumerate(this))`，每次枚举都由工厂创建新的 generator；修复方向和实际运行结果均正确，保留该实现。

验证：test/jquery.enumeration.test.ts 的 5 项测试覆盖 count 后继续遍历、多次 toArray、两个迭代器交错推进、提前退出后重新遍历、enumerate 派生序列及空集合。发布包消费者也验证同一序列可以重复枚举。

### 15. [已修复 2026-09-05] [P2] from 的元素识别在独立文档和 iframe 输入之间不一致

位置：[jquery.static.ts:18](../src/extensions/jquery.static.ts#L18)、[jquery.static.ts:104](../src/extensions/jquery.static.ts#L104)。

`isElement` 要求 ownerDocument.defaultView 存在，但 `document.implementation.createHTMLDocument()` 创建的文档没有 defaultView，其元素依然是合法 Element。数组分支又放弃 isElement，改用当前窗口的 instanceof Element，拒绝 iframe 的元素。

验证：独立文档的 div 满足 `instanceof Element`，却被 isElement 判为 false，from 抛错；iframe 元素单独传入 from 成功，把同一元素放入数组就失败。这些输入都符合公开签名。

建议统一元素识别策略，同时处理当前 realm、无 window 的文档和其他 realm；单项与 ArrayLike 分支复用同一判断。

修复前的补充验证：还复现了 iframe 元素被 adoptNode 移至其他 document 后识别失败，以及仿 Element 原型或带抛错 ownerDocument getter 的对象令 isElement 抛错。这说明不能只增加当前窗口 instanceof 的 fallback。

修复：isElement 使用当前 realm 的原生 Element.tagName getter 校验接收者，支持其他 realm、没有 window 的 HTML／XML 文档以及被 adoptNode 移动的元素；不再读取输入的 ownerDocument 来选择构造函数。非 Element 返回 false。from 的单元素与 ArrayLike 成员识别统一调用 isElement，保留输入元素身份。

验证：test/jquery.static.test.ts 的 22 项测试覆盖当前文档、独立 HTML 文档、iframe 及其独立文档、XML、跨文档 adoption、已移除 iframe、SVG、HTMLCollection／NodeList、混合集合、非元素和伪装对象，以及原有 selector／JQuery／空输入行为。发布包消费者覆盖独立文档和 iframe 数组输入，声明测试检查元素子类型保留。运行时验证使用 jsdom，未声称执行真实浏览器跨源访问测试。全部 146 项测试、严格声明检查及完整 pnpm build 通过。

### 16. [已修复 2026-09-06] [P2] DOM 原型包装方法不能处理本包 search 返回的 iframe 节点

位置：[jquery.ts:319](../src/extensions/jquery.ts#L319)、[jquery.ts:364](../src/extensions/jquery.ts#L364)、[jquery.ts:462](../src/extensions/jquery.ts#L462)。

search 默认会检索 iframe，但 ownText getter、collapseBrs、trimLeadingBrs 和 isNewLineTextNode 直接调用节点上的 builtinx 扩展。builtinx/dom 只增强当前 realm 的原型，iframe 原型没有这些方法。observe 已专门处理跨 realm，其他包装没有保持同一支持边界。

验证：同源 iframe 中创建 div 后，ownText、collapseBrs 和 trimLeadingBrs 均抛 TypeError。

建议使用独立 helper 或一致的跨 realm 调用实现，并检查依赖方法内部是否仍调用节点自身的扩展；仅给最外层方法加 call/apply 未必足够。

复核：用户已将四处调用改为 BuiltinX.Node／BuiltinX.Element 静态方法。检查已安装 builtinx 0.3.1 的实现，内部依赖也调用独立函数，不再要求 iframe 节点具有当前窗口的原型扩展。保留用户实现，并将 builtinx peerDependencies 从 ^0.3.0 提高至 ^0.3.1，与所用静态 API 的版本一致。

验证：test/jquery.dom.test.ts 的 4 项测试在 iframe 原型没有对应扩展方法的条件下，覆盖 search 结果的 ownText 获取／设置、换行 Text 判断、连续 br 合并和开头 br 清理。发布包消费者也验证这些跨 realm 静态调用。

### 17. [已修复 2026-09-06] [P2] scrollToNode 将视口坐标传给文档滚动 API

位置：[jquery.static.ts:62](../src/extensions/jquery.static.ts#L62)。

getBoundingClientRect().top 相对视口，scroll 的 y 是文档坐标。已滚动页面上调用时会少算当前 scrollY，并额外把水平滚动重置为 0；对 iframe 元素还会滚动错误的 window。

验证：模拟 scrollY 为 500、rect.top 为 100，实际调用 scroll(0, 100)，而目标文档位置应为 600。

建议明确目标滚动容器，优先使用元素的 scrollIntoView，或以元素所属窗口的滚动偏移计算绝对位置。

修复：使用目标元素的 scrollIntoView，默认 block: 'start'、inline: 'nearest'，可传入原生 ScrollIntoViewOptions。selector 和 JQuery 集合只处理第一个匹配元素；空匹配直接返回。元素输入使用 isElement 识别，支持 iframe 和独立文档，不再计算坐标或调用全局 scroll。

验证：test/jquery.scroll.test.ts 的 5 项测试覆盖原生方法委托、选项传递、首项选择、iframe／独立文档元素及空匹配；消费者编译测试覆盖新增参数。jsdom 中模拟了 scrollIntoView，未执行真实浏览器的布局与滚动效果验证。

### 18. [已修复 2026-09-06] [P2] cssImp 接受 number 却把有单位属性写成无效 CSS

位置：[jquery.css.ts:43](../src/extensions/jquery.css.ts#L43)。

签名允许 number，但实现对所有属性统一 toString 后调用 style.setProperty。padding、width 等非零长度需要单位，浏览器拒绝该值。这与同包 padding(number) 的有效行为也不一致。

验证：padding(12) 得到 12px，随后 cssImp('padding', 20) 仍然是 12px，设置没有生效。

建议只接受明确带单位的 string，或按照属性执行与 css 一致的数值归一化。名称 `cssImportant` 也比缩写 `cssImp` 清楚。

修复：方法更名为 cssImportant，移除旧名称，value 仅接受 string。长度值应写为 cssImportant('padding', '20px')；无单位属性可以传 '0.5'。运行时拒绝 number，避免静默设置失败。color(value, true) 已同步调用新名称。

验证：test/jquery.css.test.ts 的 5 项测试覆盖长度、无单位值、自定义属性、important 优先级、多元素、清除属性、空集合、SVG 和非法数值。消费者严格编译测试确认新名称保留链式元素类型，同时拒绝旧名称与 number；发布包运行时验证显式单位及优先级。

### 19. [已修复 2026-09-06] [P2] hasUrlHref 不符合公开的 boolean 返回契约

位置：[jquery.attr.ts:91](../src/extensions/jquery.attr.ts#L91)。

`return href && ...` 直接返回 falsy 的 href。空集合实际返回 undefined，无 href 的 a 返回空字符串；调用方按签名做严格布尔比较、存储状态或序列化时得到错误类型。

验证：`$().hasUrlHref()` 为 undefined，`$('<a>').hasUrlHref()` 为空串。

建议显式返回 boolean，并说明“URL href”究竟仅排除 javascript，还是要求可导航协议；不要让名称暗示实现没有提供的验证能力。

复核：用户已改为 !!href && !href.startsWith('javascript:')，所有分支均返回 boolean，保留该实现。当前行为仍是判断 href 非空且不以小写 javascript: 开头，不应将其作为协议安全校验器。

验证：test/jquery.attr.test.ts 的 7 项用例对空集合、普通元素、无 href 的 anchor、javascript:、HTTPS、相对链接和片段链接进行严格布尔断言；发布包消费者也确认空集合返回 false。

### 20. [已修复 2026-09-06] [P2] replaceBy 返回的集合遗漏实际插入的克隆节点

位置：[jquery.ts:275](../src/extensions/jquery.ts#L275)。

非同一对象分支对整个 this 调用 after(newNodes)。多个目标时 jQuery 会复制替换节点，但最终只返回最初的 newNodes，所以链式操作只影响其中最后那份替换。相同对象分支又采用逐项插入，两个分支的集合语义不同。

验证：两个 div 调用 replaceBy(() => $('<span>new</span>')) 后 DOM 中有两个 span，返回集合长度却是 1。

建议先确定回调按整个集合还是逐元素执行；保留多目标行为时，应返回所有实际插入节点。若只支持单目标，应把限制表达清楚并校验。

修复：按用户确认采用逐元素语义，回调接收单元素 JQuery 和原集合索引。返回集合按回调顺序汇总所有替换节点，可继续统一链式操作。返回当前元素表示保留，空集合表示删除；重复使用替换节点或返回另一个源节点时克隆，并保留 jQuery 事件和数据。无父节点的输入返回回调产生的节点。后续回调抛错时保留前面已经完成的替换，不提供事务回滚。

验证：test/jquery.replace.test.ts 的 11 项测试覆盖逐元素回调／索引、多个替换节点顺序、共享节点克隆及事件数据、保留自身、空返回删除、空输入、原节点与新兄弟共同返回、子节点替换父节点、游离节点、其他源节点和回调异常。消费者编译测试验证回调／返回泛型，发布包运行时验证多目标返回集合与 DOM 一致。

本轮第 16–20 项验证：全部 178 项测试通过，包含发布包消费者的严格声明检查；pnpm build 的项目类型检查、Vite 打包和声明生成均通过。

### 21. [已修复 2026-09-06] [P2] isJQuery 将任意含 jquery 属性的对象收窄为完整 JQuery

位置：[jquery.static.ts:14](../src/extensions/jquery.static.ts#L14)。

只判断 `'jquery' in value`，不检查值或任何 jQuery 行为。`{ jquery: false }` 也返回 true；from 信任这个类型守卫，直接将普通对象作为 JQuery 返回，下游调用方法才崩溃。

验证：上述普通对象通过 isJQuery，并被 from 原样返回。

建议在确定第 1 项实例模型后采用一致的实例／结构验证策略。若支持跨实例，至少验证版本标记和需要依赖的关键结构，而不是仅验证同名字段存在。

修复：按共享 jQuery 实例模型，isJQuery 使用 value instanceof $ 判断。当前实例包装的 iframe 元素、Text、Document 和普通对象仍能识别；仅带 jquery 属性的对象不再通过。移除未经验证的元素泛型参数，类型守卫仅收窄为 JQuery<unknown>，不声称已检查集合内容。from 对共享实例保持原集合身份，其他实例的元素集合走现有 ArrayLike 分支，重新包装为具有本包扩展的共享实例集合。

验证：新增 20 项运行时回归测试，修复前其中 7 项失败，修复后全部通过；覆盖空集合、派生集合、不同节点内容、伪造／继承标记、直接与嵌套非法输入、带标记的合法 ArrayLike，以及 iframe 中独立创建的 jQuery 实例。消费者声明测试拒绝未经检查的元素类型和旧泛型调用，发布包运行时验证共享实例识别与原集合身份。全部 198 项测试、严格声明检查及完整 pnpm build 通过。

## 文档与其余命名检查

### 22. [P2] README 整体描述另一个包，无法指导 jqueryx 的使用

位置：[README.md:1](../README.md#L1)、[package.json:5](../package.json#L5)。

README 的包名、徽章、安装和导入示例均为 builtinx，主体描述原生对象扩展、BuiltinX 和 builtinx/dom；没有说明 jqueryx 的 jQuery 安装关系及任何本包 API。照着执行不会安装或初始化 jqueryx。package description 也沿用同一描述。

建议在安装模型确定后重写为 jqueryx：说明依赖与实例、入口副作用、支持的 DOM／iframe 范围、主要 API、类型和异步生命周期契约，并只保留本仓库可执行的示例。

另外已检查其余公开名称、参数和辅助类型，以下是非阻塞的 API 整理建议，不另计问题数：

- [已整理 2026-09-06] `onClick`／`onKeyDown` 的回调参数已使用 `target`、`originalEvent`／`key`。补充说明 target 可为绑定元素的后代、originalEvent 为原生 MouseEvent（jQuery 触发时可能缺省）；内部 currentTarget 变量改名 boundElement，键过滤参数改名 requiredKey。
- [已整理 2026-09-06] colorHex 改为 colorHex(uppercase?: boolean)，参数 uppercase 默认 false。读取首元素的计算 rgb()/rgba() 颜色，不透明颜色返回 #rrggbb，其他颜色返回保留 alpha 的 #rrggbbaa，分量四舍五入为一个字节。空集合和不支持的格式（例如未转换为 rgb()/rgba() 的广色域颜色）返回 undefined；调用方通过 ?? 设置默认值。删除原颜色回退和失败抛错重载，uppercase 直接传入，不再使用 ColorHexOptions 对象。
- [已整理 2026-09-06] tryCss／tryAddClass 更名为 cssIfNotEmpty／addClassIfNotEmpty，移除旧名称。跳过 undefined 和空字符串，class 数组为空时也直接返回；保留多元素处理和原集合链式返回，不捕获底层错误。消费者类型测试检查新名称和移除的旧接口，运行时覆盖空值与多元素行为。
- [已验证 2026-09-06] 用户将根入口改为 export * from './types/lib'，ClickOptions 已能作为运行时类导入，JQueryNode／JQueryTextInfo 等类型也已导出。发布包消费者验证 ClickOptions 的默认值、构造参数覆盖和 onClick 参数类型。
- [已整理 2026-09-06] 用户确认 textNodes 的 selector 用于剪枝，并已通过复制 skipTags 修复输入数组被修改的问题；修改前以冻结数组验证通过。现改为 textNodes(traverseSelector?: string, excludeSelectors?: readonly string[])：traverseSelector 只对元素（包括元素根）判断，未匹配则剪枝；excludeSelectors 支持只读选择器数组，按用户后续要求默认 []，不排除任何元素。删除冗余 skipAnchor 参数，需要排除子树时直接指定 excludeSelectors。保留文档顺序、节点身份及 template 内容遍历；重叠根避免重复遍历；Text／Document／DocumentFragment 根不参与元素选择器匹配。不自动进入 iframe 文档，需显式将其 document 作为根。textContent 的内部调用已迁移，两个参数直接传入，不再使用 TextNodesOptions 对象。遍历测试及发布消费者用例验证默认包含 anchor／button、显式排除和只读输入。本轮全部 230 项测试、严格类型检查及完整构建通过。

## 验证记录与覆盖边界

| 检查 | 结果 |
| --- | --- |
| 原始 `pnpm run type-check` | 通过；配置启用 skipLibCheck |
| 原始 `pnpm test` | 失败：No test files found，退出码 1 |
| `pnpm run build:ts` | 失败：src/dom.ts 无法解析 |
| `pnpm run build:dts` | 声明发射通过，不代表消费者声明检查通过 |
| 临时运行时探针 | 19 个断言用例通过，表示成功复现报告中的当前行为；不是修复后的回归测试通过 |
| 隔离打包探针 | 仅在临时配置移除不存在的 dom 入口后打包，用于验证独立 jQuery 实例；不是正式构建成功 |
| 类型使用探针 | 确认链式元素类型丢失，并允许 SVG／Text 被错误声明为 HTMLElement |
| 消费者严格声明检查 | 缺少 jQuery 基础声明；显式加载后仍有 builtinx/dom 原生 DOM 声明冲突 |
| 验证结束后的工作区 | 临时源码测试和脚本已删除；仅新增本报告；dist 为被忽略的验证产物 |

运行时验证使用当前依赖和 jsdom；没有把它表述为真实浏览器导航或完整页面布局测试。事件取消验证检查了 dispatch 返回值、defaultPrevented 和监听器执行顺序；滚动验证使用受控坐标。未执行任何发布、工作流、外部事件发送或清理脚本。

覆盖清单：src/index.ts、src/types/lib.ts、src/extensions 下全部 6 个文件（逐个检查声明和实现）；package.json／锁文件相关依赖解析、两个 tsconfig、Vite／Vitest、pnpm-workspace、test/setupFiles、两个 GitHub 工作流、build/clean.ps1、README、许可证及编辑器／格式配置。未把 node_modules 的全部实现作为本项目源码审查，也未将主观格式偏好计入缺陷。
