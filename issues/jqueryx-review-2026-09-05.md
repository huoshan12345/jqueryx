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

### 2. [P1] 异步事件包装器的取消、互斥和错误传递模型不成立

位置：[jquery.ts:87](../src/extensions/jquery.ts#L87)、[jquery.ts:206](../src/extensions/jquery.ts#L206)。

`onClick` 在 `await handler(...)` 后的 finally 中执行 `preventDefault`、`stopPropagation` 和 `stopImmediatePropagation`，`onKeyDown` 也在 await 之后阻止后续处理。即使 handler 同步返回，await 仍让出执行：本次事件已经继续传播，浏览器也已判断是否执行默认行为。默认开启的 `preventDefault` 因而不能可靠阻止链接导航或表单提交。

`disableWhileProcessing` 只设置整个集合的 `pointer-events: none`，既没有每个元素的执行状态，也不能阻止键盘或程序触发点击；并发调用会提前恢复状态。finally 固定写入 `initial`，会丢失原有样式。handler 抛错会变成 jQuery 不等待的异步监听器 rejection，而方法返回 JQuery，调用方没有对应的 Promise 可等待。

验证：原生事件 dispatch 返回 true、`defaultPrevented === false`，后续监听器和父节点监听器均执行；微任务后才变成已取消。连续两次 `.click()` 在同一 Promise 完成前调用 handler 两次；初始 `pointer-events: auto` 结束后变成 `initial`。

建议把事件取消放在同步阶段；明确逐元素互斥规则、保存／恢复状态和异步错误处理方式。`onEnterDown` 应沿用修正后的模型。

### 3. [P2] observe 丢弃观察器，调用方无法可靠管理订阅生命周期

位置：[jquery.ts:245](../src/extensions/jquery.ts#L245)。

每个元素创建一个 MutationObserver，但返回的是原 JQuery，底层 `Node.observe` 返回的观察器全部被丢弃。使用合法选项 `{ callOnStart: false }` 时，在发生第一次 mutation 以前，调用方甚至无法从 callback 获得观察器；组件卸载或重复安装时无法立即断开整组观察。

验证：两个元素创建两个独立观察器，返回值仍然是输入 JQuery。测试只能通过拦截底层实现获得句柄并清理。

建议返回包含 `disconnect()` 的订阅对象或观察器集合，或接收 AbortSignal；不要要求调用方等待回调来收集生命周期句柄。

### 4. [P2] onNodeExists 的轮询没有取消和完成契约

位置：[jquery.ts:23](../src/extensions/jquery.ts#L23)、[jquery.ts:224](../src/extensions/jquery.ts#L224)。

公开签名允许省略 `maxCount`，实现却没有默认值。`count >= undefined` 永远为 false，所以目标不存在时每 500 ms 无限轮询并捕获原集合／回调；方法返回 void，无法取消或获知重试已结束。提供次数上限时，耗尽也静默结束。

验证：省略 maxCount，推进 50 秒虚拟时间后仍有下一轮 timer。

建议明确为 `waitForNode` 一类等待操作，返回 Promise，提供 timeout／AbortSignal；若继续使用 callback，则返回取消句柄。`maxCount` 应命名为 `maxAttempts`，避免与匹配节点数量混淆，并明确默认值、合法范围和耗尽行为。

### 5. [P2] 扩展签名丢失 JQuery 的元素类型，部分声明直接不真实

位置：[jquery.ts:7](../src/extensions/jquery.ts#L7)、[jquery.attr.ts:4](../src/extensions/jquery.attr.ts#L4)、[jquery.css.ts:2](../src/extensions/jquery.css.ts#L2)。

多数扩展固定返回裸 `JQuery`，把 `JQuery<HTMLButtonElement>` 等类型退化为默认 HTMLElement；`entries`、`asEnumerable`、`where` 等还将任意集合中的元素固定声明为 HTMLElement。运行时集合可以包含 SVG、Text，项目自身也返回 `JQuery<HTMLNode>`。

验证：`$(button).tap(() => {})[0].disabled = true` 被 tsc 拒绝；反过来 SVG 集合的 `asEnumerable().toArray()` 可以错误地赋给 `HTMLElement[]`，Text 集合的 entries 元素也能赋给 HTMLElement。

建议增强 `JQuery<TElement>`，链式不改变集合的方法返回 `this`，回调和枚举保持 TElement。需要 HTMLElement／Element 能力的方法应在 this 参数上表达约束。`color()` 声明为 string，但空集合会从底层 css 得到 undefined，也应一并校正。

### 6. [P2] textContent 与 ownText 的文本范围和集合写入规则不一致

位置：[jquery.attr.ts:44](../src/extensions/jquery.attr.ts#L44)、[jquery.ts:313](../src/extensions/jquery.ts#L313)。

两者用途均为获取／设置文本，但 `textContent()` 实际只取直接文本，与原生 textContent／jQuery text 的后代文本语义不一致。setter 将整个集合的直接文本合并处理：仅给全局第一个文本节点赋值，删除其他元素的文本；如果集合完全没有直接文本，则退回 `this.text(value)`，又会删除所有子元素。结果由是否碰巧存在直接文本决定。

验证：两个 div 分别含 `a<b>keep</b>` 和 `b<i>keep too</i>`，赋值后第二个 div 的直接文本被删除。`<div><button>keep</button></div>` 的 getter 返回空串，setter 却删除 button。

建议明确两种可理解的契约：完整文本直接使用现有 `.text()`；仅直接文本统一为 `.ownText()`，逐元素设置并保留元素子节点。若保留 textContent 别名，应与其中一种契约完全一致，不能继续保留第三套规则。

### 7. [P2] refineUrls 无条件承担图片备用链接的插入职责

位置：[jquery.ts:369](../src/extensions/jquery.ts#L369)、[jquery.ts:435](../src/extensions/jquery.ts#L435)。

IMG 在验证 URL 和 hosts 之前就加入 images 列表，因此即使完全没有匹配、没有改写 URL，也会在图片后插入链接。重复调用还会重复插入链接和 load 监听器。方法名无法提示调用方它还会改变页面布局。

验证：不匹配 hosts 的同一图片调用两次后，src 未变，但 DOM 新增两个 a。

按用户确认的方向，将备用链接行为放入命名清晰的 option，例如 `addImageFallbackLinks`；明确默认值及作用对象。启用时复用／更新已有备用链接，避免重复节点和订阅。若以 URL 改写为主，`rewriteUrls` 比 `refineUrls` 更能表达职责。

## 构建、发布和验证

### 8. [P1] Vite 配置引用不存在的 src/dom.ts，构建无法完成

位置：[vite.config.ts:15](../vite.config.ts#L15)。

入口声明包含 `src/dom.ts`，仓库不存在该文件，package exports 也只声明根入口。实际运行 `pnpm run build:ts` 失败：`[UNRESOLVED_ENTRY] Cannot resolve entry module src/dom.ts`。这会阻止 pnpm build 和发布。

建议依照 jqueryx 的真实入口删除遗留 dom 配置，或实现并导出确有需要的入口，不应只让源码 type-check 代替打包验证。

### 9. [已修复 2026-09-05] [P2] 发布声明没有带入所依赖的 jQuery 基础类型

位置：[package.json:40](../package.json#L40)、[jquery.init.ts:1](../src/extensions/jquery.init.ts#L1)、[index.ts:1](../src/index.ts#L1)。

`@types/jquery` 仅在 devDependencies 中；声明发射后 jquery.init.d.ts 是 `export {}`，没有任何 jquery 类型引用。项目自身靠默认加载 node_modules/@types 而通过，消费者只加载 jqueryx 声明时则缺少基础 `JQuery<TElement>` 定义。

验证：对生成的 dist/index.d.ts 运行独立 tsc、限制 `--types node`，出现六处 `Type 'JQuery' is not generic`；加入 `--types node,jquery` 后这六处错误消失。

建议将发布声明所需类型放在消费者能安装到的位置，并在声明入口显式 import／reference jQuery 基础类型，避免依赖消费者的隐式 ambient types 配置。

修复：将 @types/jquery 从 devDependencies 移至 dependencies，并在 src/index.ts 显式 `import 'jquery'`。发射后的 dist/index.d.ts 保留该引用，从而加载 jQuery 基础类型和全局工厂声明。

验证：消费者使用独立 tsconfig，关闭 ambient @types 自动发现（types: []），只导入 jqueryx 即可使用 `$`、`jQuery`、`JQuery<HTMLButtonElement>` 和扩展方法；错误的元素泛型赋值仍被拒绝。测试启用 skipLibCheck 以隔离未修复的 issue 10，不表示 builtinx/dom 的声明冲突已解决。

### 10. [P2] 根入口引入的 builtinx/dom 声明与原生 DOM 类型冲突

位置：[index.ts:1](../src/index.ts#L1)、[tsconfig.json:7](../tsconfig.json#L7)。

当前 builtinx 0.2.2 为 Element 声明返回 this 类型的 `show`，原生 HTMLDialogElement.show 返回 void，继承关系不兼容。jqueryx 根声明无条件导入 builtinx/dom，将此冲突带给所有消费者；项目的 skipLibCheck 为 true，因此常规检查不报告。

验证：在已明确加载 jquery 基础类型的前提下，使用不跳过声明检查的独立 tsc，仍报 HTMLDialogElement 的 TS2430，以及两个 HTMLElementTagNameMap 的 TS2344。

根因在依赖声明，不能算 jqueryx 自己实现的 DOM 方法缺陷；但它已经影响本包交付。建议修正／升级依赖的冲突 API 或解除该入口的声明依赖，并用消费者配置验证，不应要求消费者打开 skipLibCheck 来掩盖。

### 11. [P2] 仓库没有测试用例，测试命令与 CI 当前直接失败

位置：[vitest.config.ts:12](../vitest.config.ts#L12)、[test/setupFiles.ts:1](../test/setupFiles.ts#L1)、[build.yml:83](../.github/workflows/build.yml#L83)。

test 目录只有 setupFiles.ts，没有配置所匹配的 `test/**/*.test.ts`。干净基线执行 pnpm test 返回退出码 1：`No test files found`，工作流在发布前无条件执行同一命令。

建议先补核心行为和消费产物的测试，尤其是 jQuery 实例安装、同步事件取消、文本写入及观察器清理；仅允许无测试通过不能解决缺少验证的问题。

### 12. [P2] PR 检查没有执行类型检查和构建

位置：[build.yml:83](../.github/workflows/build.yml#L83)、[build.yml:86](../.github/workflows/build.yml#L86)。

工作流唯一的 pnpm build 位于 main push 且版本尚未发布的分支；PR 只执行 pnpm test。Vitest 的源码执行不能替代完整类型检查和发布构建，因此补上测试后，入口缺失或错误声明仍可在 PR 中通过，直到发布时才暴露。已发布版本的 main push 也会跳过 build。此外，paths filter 未包含 pnpm-lock.yaml／pnpm-workspace.yaml，单独修改依赖解析或安装配置也会跳过检查。

建议将类型检查、测试、构建作为独立且无条件的验证步骤，发布只消费验证后的产物；把锁文件与 workspace 配置纳入触发范围。

## 实现缺陷

### 13. [P2] ownText 删除实时 childNodes 中的节点会漏删相邻文本

位置：[jquery.ts:330](../src/extensions/jquery.ts#L330)。

childNodes 是实时列表，在 for-of 中删除当前 child 会改变后续索引，导致下一个相邻文本节点被跳过。通过 DOM API 拼接文本或编辑后的节点可能自然具有多个相邻 Text。

验证：一个 div 顺序 append 四个文本节点 a、b、c、d，调用 ownText('new') 后实际文本为 `newc`，不是 `new`。

建议先快照 childNodes，或显式保存 nextSibling 再删除，保留且设置一个文本节点。

### 14. [P2] asEnumerable 把可重复遍历的集合变成一次性序列

位置：[jquery.ts:252](../src/extensions/jquery.ts#L252)。

每次 asEnumerable 调用只创建一个 generator 对象，然后把该对象传给 Enumerable.from。后者重新枚举时得到的仍是同一个已消耗迭代器，因此 count／toArray／first 等一次枚举会影响后续操作；enumerate 也继承此问题。

验证：同一包含两个节点的 sequence，第一次 toArray 长度 2，第二次为 0。输入 JQuery 本身完全没有改变。

建议直接将 JQuery 作为可重复遍历的 array-like 输入，或传入每次创建迭代器的工厂。

### 15. [P2] from 的元素识别在独立文档和 iframe 输入之间不一致

位置：[jquery.static.ts:18](../src/extensions/jquery.static.ts#L18)、[jquery.static.ts:104](../src/extensions/jquery.static.ts#L104)。

`isElement` 要求 ownerDocument.defaultView 存在，但 `document.implementation.createHTMLDocument()` 创建的文档没有 defaultView，其元素依然是合法 Element。数组分支又放弃 isElement，改用当前窗口的 instanceof Element，拒绝 iframe 的元素。

验证：独立文档的 div 满足 `instanceof Element`，却被 isElement 判为 false，from 抛错；iframe 元素单独传入 from 成功，把同一元素放入数组就失败。这些输入都符合公开签名。

建议统一元素识别策略，同时处理当前 realm、无 window 的文档和其他 realm；单项与 ArrayLike 分支复用同一判断。

### 16. [P2] DOM 原型包装方法不能处理本包 search 返回的 iframe 节点

位置：[jquery.ts:319](../src/extensions/jquery.ts#L319)、[jquery.ts:364](../src/extensions/jquery.ts#L364)、[jquery.ts:462](../src/extensions/jquery.ts#L462)。

search 默认会检索 iframe，但 ownText getter、collapseBrs、trimLeadingBrs 和 isNewLineTextNode 直接调用节点上的 builtinx 扩展。builtinx/dom 只增强当前 realm 的原型，iframe 原型没有这些方法。observe 已专门处理跨 realm，其他包装没有保持同一支持边界。

验证：同源 iframe 中创建 div 后，ownText、collapseBrs 和 trimLeadingBrs 均抛 TypeError。

建议使用独立 helper 或一致的跨 realm 调用实现，并检查依赖方法内部是否仍调用节点自身的扩展；仅给最外层方法加 call/apply 未必足够。

### 17. [P2] scrollToNode 将视口坐标传给文档滚动 API

位置：[jquery.static.ts:62](../src/extensions/jquery.static.ts#L62)。

getBoundingClientRect().top 相对视口，scroll 的 y 是文档坐标。已滚动页面上调用时会少算当前 scrollY，并额外把水平滚动重置为 0；对 iframe 元素还会滚动错误的 window。

验证：模拟 scrollY 为 500、rect.top 为 100，实际调用 scroll(0, 100)，而目标文档位置应为 600。

建议明确目标滚动容器，优先使用元素的 scrollIntoView，或以元素所属窗口的滚动偏移计算绝对位置。

### 18. [P2] cssImp 接受 number 却把有单位属性写成无效 CSS

位置：[jquery.css.ts:43](../src/extensions/jquery.css.ts#L43)。

签名允许 number，但实现对所有属性统一 toString 后调用 style.setProperty。padding、width 等非零长度需要单位，浏览器拒绝该值。这与同包 padding(number) 的有效行为也不一致。

验证：padding(12) 得到 12px，随后 cssImp('padding', 20) 仍然是 12px，设置没有生效。

建议只接受明确带单位的 string，或按照属性执行与 css 一致的数值归一化。名称 `cssImportant` 也比缩写 `cssImp` 清楚。

### 19. [P2] hasUrlHref 不符合公开的 boolean 返回契约

位置：[jquery.attr.ts:91](../src/extensions/jquery.attr.ts#L91)。

`return href && ...` 直接返回 falsy 的 href。空集合实际返回 undefined，无 href 的 a 返回空字符串；调用方按签名做严格布尔比较、存储状态或序列化时得到错误类型。

验证：`$().hasUrlHref()` 为 undefined，`$('<a>').hasUrlHref()` 为空串。

建议显式返回 boolean，并说明“URL href”究竟仅排除 javascript，还是要求可导航协议；不要让名称暗示实现没有提供的验证能力。

### 20. [P2] replaceBy 返回的集合遗漏实际插入的克隆节点

位置：[jquery.ts:275](../src/extensions/jquery.ts#L275)。

非同一对象分支对整个 this 调用 after(newNodes)。多个目标时 jQuery 会复制替换节点，但最终只返回最初的 newNodes，所以链式操作只影响其中最后那份替换。相同对象分支又采用逐项插入，两个分支的集合语义不同。

验证：两个 div 调用 replaceBy(() => $('<span>new</span>')) 后 DOM 中有两个 span，返回集合长度却是 1。

建议先确定回调按整个集合还是逐元素执行；保留多目标行为时，应返回所有实际插入节点。若只支持单目标，应把限制表达清楚并校验。

### 21. [P2] isJQuery 将任意含 jquery 属性的对象收窄为完整 JQuery

位置：[jquery.static.ts:14](../src/extensions/jquery.static.ts#L14)。

只判断 `'jquery' in value`，不检查值或任何 jQuery 行为。`{ jquery: false }` 也返回 true；from 信任这个类型守卫，直接将普通对象作为 JQuery 返回，下游调用方法才崩溃。

验证：上述普通对象通过 isJQuery，并被 from 原样返回。

建议在确定第 1 项实例模型后采用一致的实例／结构验证策略。若支持跨实例，至少验证版本标记和需要依赖的关键结构，而不是仅验证同名字段存在。

## 文档与其余命名检查

### 22. [P2] README 整体描述另一个包，无法指导 jqueryx 的使用

位置：[README.md:1](../README.md#L1)、[package.json:5](../package.json#L5)。

README 的包名、徽章、安装和导入示例均为 builtinx，主体描述原生对象扩展、BuiltinX 和 builtinx/dom；没有说明 jqueryx 的 jQuery 安装关系及任何本包 API。照着执行不会安装或初始化 jqueryx。package description 也沿用同一描述。

建议在安装模型确定后重写为 jqueryx：说明依赖与实例、入口副作用、支持的 DOM／iframe 范围、主要 API、类型和异步生命周期契约，并只保留本仓库可执行的示例。

另外已检查其余公开名称、参数和辅助类型，以下是非阻塞的 API 整理建议，不另计问题数：

- `onClick`／`onKeyDown` 的 `e` 实际是 DOM target，不是 event；命名为 `target`，事件参数明确为原生事件或 jQuery 事件，减少使用歧义。
- `colorHex(toUpperCase, defaultValue?: string | true)` 用 true 表示返回原始颜色，却仍声明返回 hex 的方法名；建议使用命名选项，明确 alpha、无法转换和空集合的处理。
- `tryCss`／`tryAddClass` 的 try 表示“有值才执行”，不是捕获失败；应在文档中明确，或使用表达条件赋值的名称。
- `ClickOptions` 是内部使用的运行时 class，根入口没有公开导出；`JQueryNode`／`JQueryTextInfo` 在本仓库没有实际使用，根入口也没有导出。应决定哪些是真正支持的公共类型，避免留下看似公开但消费者无法正常导入的 API。
- `textNodes` 的 selector 目前具有“剪枝整个未匹配子树”的含义，skipTags 在 skipAnchor=false 时还会被原地修改。应明确 selector 是匹配入口、遍历节点还是结果，且不要修改调用方传入的配置数组。

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
