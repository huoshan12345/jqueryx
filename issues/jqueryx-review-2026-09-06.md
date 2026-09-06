# jqueryx 第二轮代码审查（2026-09-06）

范围：当前全部 src 源码、公开类型、构建与发布配置。排除 README、文档完善程度和测试覆盖不足。以下使用本轮独立编号，不延续上一份报告的编号。

本轮没有修改产品源码。除第 9 项的 SVG 浏览器属性采用标准类型核对及受控模拟外，下面的运行时现象均用临时 TypeScript / Vitest 探针复现；类型问题另外经过 tsc 验证。探针断言描述的是缺陷现状，其通过不代表问题已经修复。

## 设计与公开 API

### 1. [源码已修复 2026-09-06，待 builtinx 发布] [P2] 发布声明只能在 Bundler 解析下工作，NodeNext 消费者无法加载扩展

位置：[package.json:30](D:/projects/_libraries/jqueryx/package.json:30)、[index.ts:3](D:/projects/_libraries/jqueryx/src/index.ts:3)。

包声明为 ESM，但 build:dts 生成的 dist/index.d.ts 仍含 `import './extensions'` 和 `export * from './types/lib'`，其余声明也使用无扩展名的相对路径。NodeNext / Node16 的 ESM 声明解析要求明确文件扩展名，而且目录入口应指向 index.js。

复现：消费者使用 `module: NodeNext`、`moduleResolution: NodeNext`、strict，在导入本次 dist/index.js 后报 TS2834；ClickOptions 报 TS2305，isEmpty 报 TS2551。正常 Bundler 构建通过，不能覆盖这类消费者。

建议：在声明生成阶段将相对导入改写为实际可解析的 `.js` 路径（包括目录入口），或者统一源码的 ESM 导入路径。已安装 builtinx 0.3.1 的 dom.d.ts 也存在相同问题，需要一起修复；仅修 jqueryx 不能完全消除本次消费者错误。

修复：jqueryx 及用户授权的 D:/projects/_libraries/builtinx 均将源码相对导入改为明确的 .js 路径，目录引用明确指向 index.js；builtinx 的 declare module 也改为相同的完整模块路径。未修改运行时逻辑或依赖版本，未使用 skipLibCheck 隔离错误。

验证：builtinx 新增生成声明后进行严格 NodeNext 消费检查的回归测试，662 项测试及完整构建通过。jqueryx 的发布包消费者新增 NodeNext 配置；通过 JQUERYX_BUILTINX_PACKAGE_DIR 指向本地 builtinx 构建，236 项测试（含 Bundler / NodeNext 严格声明检查）及完整构建通过。该环境变量只把指定 peer 产物复制到临时消费者，不覆盖 node_modules 中已安装的包。

剩余发布步骤：npm 最新 builtinx 仍为有问题的 0.3.1，需先发布修复版，再升级 jqueryx 的 devDependencies / peerDependencies 和锁文件。当前直接使用已安装 0.3.1 的 NodeNext 消费检查仍失败，不能将本地依赖验证视为 npm 版本已修复。

### 2. [已修复 2026-09-06] [P2] 事件回调的 target 仍被错误承诺为 HTMLElement

位置：[jquery.events.ts:15](D:/projects/_libraries/jqueryx/src/extensions/jquery.events.ts:15)、[jquery.events.ts:25](D:/projects/_libraries/jqueryx/src/extensions/jquery.events.ts:25)、[jquery.events.ts:31](D:/projects/_libraries/jqueryx/src/extensions/jquery.events.ts:31)。

限制绑定集合为 HTMLElement，并不能保证 event.target 也是 HTMLElement。按钮内的 SVG 图标可成为 click target；可聚焦的 SVG 子元素也可产生向父级冒泡的 keydown。

复现：`<button><svg><path></path></svg></button>` 上绑定 `onClick(target => target.click(), { onError })`，TypeScript 允许编译，但点击 path 后 onError 收到 TypeError，因为 SVG path 没有 HTMLElement.click。onKeyDown 用 SVG 子元素也复现相同错误；onEnterDown 共用同一路径和声明。

建议：将实际事件来源声明为合适的 EventTarget / Element，并根据运行时保证进行收窄。如果需要提供已知类型的绑定元素，另传 boundElement/currentTarget；不要用更窄的 target 类型代替它。保留用户已确认的实际事件来源语义。

修复：onClick、onKeyDown、onEnterDown 的 target 统一改为 EventTarget，继续传递原事件来源；没有用绑定元素替换 target。调用 HTMLElement 特有方法之前须自行收窄。新增三个 SVG 冒泡事件用例，并在消费者编译用例中确认未收窄的 click/focus 调用会被拒绝。

### 3. [已修复 2026-09-06] [P2] $.from 丢失现有 JQuery 集合的元素类型

位置：[jquery.static.ts:8](D:/projects/_libraries/jqueryx/src/extensions/jquery.static.ts:8)。

第一个公开重载把 JQuery 输入固定为默认的 JQuery<HTMLElement>。传入 JQuery<HTMLInputElement> 时，这个重载优先匹配，返回类型被扩宽，即使运行时返回的是同一个集合。

复现：`const inputs = $(document.createElement('input')); const result: JQuery<HTMLInputElement> = $.from(inputs);` 编译失败；运行时 `$.from(inputs) === inputs`。调用方因此无法继续类型安全地使用 input.value 等具体成员。

建议：增加优先匹配的 `from<T>(value: JQuery<T>): JQuery<T>` 重载，再按实际支持边界处理 JQuery 集合数组。不要通过任意指定泛型来假装验证集合内容。

修复：增加优先匹配的 JQuery<T> 元素集合重载，并让元素、集合及二者混合的 ArrayLike 输入保留 T extends Element 类型；保留 null/undefined 和空数组的默认 HTMLElement 集合类型。运行时继续保留现有共享实例集合的身份，集合分组使用既有展开逻辑。消费者类型与运行时用例覆盖 input/button/SVG、分组、混合输入、空输入和错误元素类型赋值。

### 4. [P2] ownText setter 的 Node 接收范围大于实现支持范围

位置：[jquery.ts:52](D:/projects/_libraries/jqueryx/src/extensions/jquery.ts:52)、[jquery.ts:285](D:/projects/_libraries/jqueryx/src/extensions/jquery.ts:285)。

setter 只特殊处理 Text，对其他无直接文本子节点的 Node 都尝试插入 Text。Document 不允许直接插入 Text，Comment 也不能拥有子节点，但它们都满足公开的 JQuery<Node> 类型。

复现：`$(document).ownText('text')` 和 `$(document.createComment('old')).ownText('text')` 均通过类型检查并在运行时抛 HierarchyRequestError。

建议：getter 与 setter 分别表达接收范围；setter 至少限定为 Element / DocumentFragment / Text，或明确定义并实现其他节点类型的写入行为。

## 行为缺陷

### 5. [P1] refineUrls 更新可见 URL 时删除链接内部结构和事件数据

位置：[jquery.urls.ts:79](D:/projects/_libraries/jqueryx/src/extensions/jquery.urls.ts:79)。

改写 href 后，只要链接的聚合文本含有原 URL，就执行 `node.text(newText)`。这会删除全部子元素，而不只是更新 URL 所在的文本节点。

复现：`<a href="https://remote.example/path"><span>https://remote.example/path</span><img src="icon.png"></a>` 改写后 span 和 img 都消失；span 上的 jQuery data 也被清除。实际页面中的图标、格式和子元素监听器会一起丢失。

建议：将属性改写和展示文本改写分开；需要同步展示文本时，仅修改对应 Text 节点，保留其他节点身份。跨多个 Text 节点的 URL 需要明确处理规则，不能通过整体 `.text()` 隐式销毁结构。

### 6. [P2] onClickGotoHref 会清除混合集合中非链接元素的 click 行为

位置：[jquery.events.ts:142](D:/projects/_libraries/jqueryx/src/extensions/jquery.events.ts:142)。

用户确认该方法的目的是让超链接点击后跳转到 href。当前 `this.isNot('a')` 基于集合的 any-match 判断：只要含有一个 a，就会对整个集合添加捕获监听器、清除 click 处理，并可能设置 target。

复现：一个 a 和一个带 click 回调的 button 同时调用 onClickGotoHref，随后 button.trigger('click') 不再执行原回调。

建议：先筛出需要恢复导航的链接，再只处理该子集，最终返回原集合保留链式操作。按这个目的，名称可考虑 restoreHrefNavigation；不应让非链接元素承担恢复链接导航的副作用。

### 7. [P2] replaceBy 未处理父子节点同时入选的情况

位置：[jquery.ts:190](D:/projects/_libraries/jqueryx/src/extensions/jquery.ts:190)、[jquery.ts:206](D:/projects/_libraries/jqueryx/src/extensions/jquery.ts:206)。

先对输入做快照，然后按顺序替换。父元素先被替换并 remove 后，子元素仍在快照里，但已经位于被移除的子树；后续回调的替换节点被插入那棵游离子树，仍被加入返回集合。

复现：`<main><section><i>old</i></section></main>` 的 `find('section, i').replaceBy(() => $('<b>new</b>'))` 返回两个 b，main 中却只有一个。父元素的 remove 还会在子元素回调前清除子元素的 jQuery 数据。

建议：先确定重叠根策略，例如仅处理最外层源节点，或在修改前拒绝包含祖先／后代的集合。当前“逐元素”本身不足以决定这种冲突，不能等父节点移除后再悄悄操作脱离页面的子树。

### 8. [P2] waitForNodes 可查询根外祖先条件，但不会观察条件变化

位置：[jquery.wait.ts:74](D:/projects/_libraries/jqueryx/src/extensions/jquery.wait.ts:74)、[jquery.wait.ts:118](D:/projects/_libraries/jqueryx/src/extensions/jquery.wait.ts:118)。

Element.querySelectorAll 的选择器可以依赖根元素以外的祖先，但 MutationObserver 只观察根及其后代。这导致“选择器实际已经匹配”与“等待仍无法结束”并存。

复现：`<main><section><i></i></section></main>` 中对 section 调用 `waitForNodes('.ready i')`，随后只给 main 加 ready。此时 section.querySelectorAll('.ready i') 已有一个结果，等待仍直到 TimeoutError 才结束。

建议：统一查询与观察边界。支持这类选择器时，需要观察影响匹配的祖先变化；若仅支持由根内变化驱动的匹配，应在 API 设计上明确这个限制，而不是声称支持任意 DOM 驱动的选择器变化。

### 9. [P2] hasUrlHref 假设所有 Element.href 都是字符串

位置：[jquery.attr.ts:98](D:/projects/_libraries/jqueryx/src/extensions/jquery.attr.ts:98)。

签名接受任意 Element，但 SVG 的 a.href 是 SVGAnimatedString。jQuery 的 prop('href') 直接返回该对象，随后调用 startsWith 会抛 TypeError。[MDN 的 SVGAElement.href 定义](https://developer.mozilla.org/en-US/docs/Web/API/SVGAElement/href)明确了该属性类型。

验证边界：本地 jsdom 未实现这一 SVG 属性，直接测试不会复现真实浏览器的异常；按标准返回值形状进行的受控模拟复现了 startsWith TypeError。浏览器安全策略阻止了临时 data: 探针页面，因此这里不声称已经执行真实浏览器复现。

建议：如果该 API 按 href 属性判断，读取 getAttribute / attr；如果仅服务于 HTML 链接，则收紧接收类型并处理非链接输入。不要对未知的 href property 直接调用字符串方法。

### 10. [P2] refineUrls 漏掉协议相对地址和大写协议的远端 URL

位置：[jquery.urls.ts:50](D:/projects/_libraries/jqueryx/src/extensions/jquery.urls.ts:50)。

用原始属性是否 startsWith('http') 判断是否本站链接，会把 `//remote.example/path` 和 `HTTPS://remote.example/path` 这样的有效远端地址直接跳过。

复现：hosts 包含 remote.example、baseUrl 为 https://local.example，两种 href 调用 refineUrls 后均完全没有变化。

建议：先结合元素所属文档的基准 URL 解析地址，再根据解析后的 protocol 和 host 判断是否改写。协议相对地址需要基准 URL；普通相对链接是否改写则应遵守已有的本站链接策略。

### 11. [P2] textContent 在 template 上的 getter 与 setter 操作不同范围

位置：[jquery.attr.ts:49](D:/projects/_libraries/jqueryx/src/extensions/jquery.attr.ts:49)。

setter 通过 textNodes 进入 template.content，但 getter 委托 jQuery.text()，后者读取 template 元素自身的 textContent，不包含 template.content。

复现：template.innerHTML 为 `<span>old</span>`，调用 `$(template).textContent('new')` 后 template.content.textContent 为 new，但 `$(template).textContent()` 仍返回空字符串。相同 API 的写入结果无法由自己的 getter 读回。

建议：明确模板内容是否属于该 API 的文本范围，并让 getter 和 setter 一致。若支持模板，应共享对应的遍历逻辑，同时保持用户要求的非文本节点身份。

## 验证与范围

- 临时缺陷探针：12 个断言用例通过（其中包含第 9 项的受控模拟），并通过项目类型检查。它们是现状复现，已在审查结束前删除。
- 独立 NodeNext 声明检查：失败，复现第 1 项；同时定位到 builtinx 的同类声明问题。
- 删除临时探针后，常规 pnpm test 的 230 项测试全部通过，pnpm build 的类型检查、Vite 构建及声明生成全部通过。NodeNext 错误与 Bundler 模式的通过结果应分别看待。
- 覆盖 src 下全部文件、package.json、tsconfig、Vite、pnpm 配置、两个 GitHub 工作流和清理脚本；没有执行发布、工作流或清理脚本。
- 未把 README、文档完善程度、测试用例不足或已确认的剪枝／逐元素／保留非文本节点语义列为问题。
