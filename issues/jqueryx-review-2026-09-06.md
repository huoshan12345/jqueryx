# jqueryx 第二轮代码审查（2026-09-06）

范围：当前全部 src 源码、公开类型、构建与发布配置。排除 README、文档完善程度和测试覆盖不足。以下使用本轮独立编号，不延续上一份报告的编号。

本轮没有修改产品源码。除第 9 项的 SVG 浏览器属性采用标准类型核对及受控模拟外，下面的运行时现象均用临时 TypeScript / Vitest 探针复现；类型问题另外经过 tsc 验证。探针断言描述的是缺陷现状，其通过不代表问题已经修复。

## 设计与公开 API

### 1. [已修复并验证已安装依赖 2026-09-06] [P2] 发布声明只能在 Bundler 解析下工作，NodeNext 消费者无法加载扩展

位置：[package.json:30](D:/projects/_libraries/jqueryx/package.json:30)、[index.ts:3](D:/projects/_libraries/jqueryx/src/index.ts:3)。

包声明为 ESM，但 build:dts 生成的 dist/index.d.ts 仍含 `import './extensions'` 和 `export * from './types/lib'`，其余声明也使用无扩展名的相对路径。NodeNext / Node16 的 ESM 声明解析要求明确文件扩展名，而且目录入口应指向 index.js。

复现：消费者使用 `module: NodeNext`、`moduleResolution: NodeNext`、strict，在导入本次 dist/index.js 后报 TS2834；ClickOptions 报 TS2305，isEmpty 报 TS2551。正常 Bundler 构建通过，不能覆盖这类消费者。

建议：在声明生成阶段将相对导入改写为实际可解析的 `.js` 路径（包括目录入口），或者统一源码的 ESM 导入路径。已安装 builtinx 0.3.1 的 dom.d.ts 也存在相同问题，需要一起修复；仅修 jqueryx 不能完全消除本次消费者错误。

修复：jqueryx 及用户授权的 D:/projects/_libraries/builtinx 均将源码相对导入改为明确的 .js 路径，目录引用明确指向 index.js；builtinx 的 declare module 也改为相同的完整模块路径。未修改运行时逻辑或依赖版本，未使用 skipLibCheck 隔离错误。

验证：builtinx 新增生成声明后进行严格 NodeNext 消费检查的回归测试，662 项测试及完整构建通过。jqueryx 的发布包消费者新增 NodeNext 配置；通过 JQUERYX_BUILTINX_PACKAGE_DIR 指向本地 builtinx 构建，236 项测试（含 Bundler / NodeNext 严格声明检查）及完整构建通过。该环境变量只把指定 peer 产物复制到临时消费者，不覆盖 node_modules 中已安装的包。

依赖升级验证：当前锁文件及实际安装版本为 builtinx 0.3.3、linqx 0.3.4。直接使用已安装依赖、清除 JQUERYX_BUILTINX_PACKAGE_DIR 后，严格 Bundler / NodeNext 消费检查通过；额外覆盖 linqx/extensions 的数组、Map 和 DOM 集合返回类型。peerDependencies 下限同步为 builtinx ^0.3.3、linqx ^0.3.4，避免继续允许已知存在声明问题的旧版本。离线锁文件校验通过，无需变更；pnpm test 的 16 个测试文件、236 项测试全部通过，pnpm build 的类型检查、Vite 构建及声明生成全部通过。

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

### 4. [已修复 2026-09-06] [P2] ownText setter 的 Node 接收范围大于实现支持范围

位置：[jquery.ts:52](D:/projects/_libraries/jqueryx/src/extensions/jquery.ts:52)、[jquery.ts:285](D:/projects/_libraries/jqueryx/src/extensions/jquery.ts:285)。

setter 只特殊处理 Text，对其他无直接文本子节点的 Node 都尝试插入 Text。Document 不允许直接插入 Text，Comment 也不能拥有子节点，但它们都满足公开的 JQuery<Node> 类型。

复现：`$(document).ownText('text')` 和 `$(document.createComment('old')).ownText('text')` 均通过类型检查并在运行时抛 HierarchyRequestError。

建议：getter 与 setter 分别表达接收范围；setter 至少限定为 Element / DocumentFragment / Text，或明确定义并实现其他节点类型的写入行为。

修复：按用户确认的跳过策略保留 JQuery<Node> 签名。setter 只处理 Element、DocumentFragment（含 ShadowRoot）和 Text；其他节点保持原样并继续处理集合内后续节点，返回原集合。Element / DocumentFragment 仍只修改直接文本并保留其他子节点，Text 直接赋值。新增回归用例覆盖六类被跳过节点、混合集合、三类容器的开头插入、清空及节点身份保留。

## 行为缺陷

### 5. [已修复并验证 2026-09-06] [P1] refineUrls 更新可见 URL 时删除链接内部结构和事件数据

位置：[jquery.urls.ts:79](D:/projects/_libraries/jqueryx/src/extensions/jquery.urls.ts:79)。

改写 href 后，只要链接的聚合文本含有原 URL，就执行 `node.text(newText)`。这会删除全部子元素，而不只是更新 URL 所在的文本节点。

复现：`<a href="https://remote.example/path"><span>https://remote.example/path</span><img src="icon.png"></a>` 改写后 span 和 img 都消失；span 上的 jQuery data 也被清除。实际页面中的图标、格式和子元素监听器会一起丢失。

建议：将属性改写和展示文本改写分开；需要同步展示文本时，仅修改对应 Text 节点，保留其他节点身份。跨多个 Text 节点的 URL 需要明确处理规则，不能通过整体 `.text()` 隐式销毁结构。

复核：用户改为遍历 textNodes()，逐个修改匹配 Text 节点的 nodeValue。原先被合并的前缀、strong 中的 URL、em 中的后缀现保持各自位置，子元素、Text 节点身份、jQuery data 和事件监听器均保留。新增回归测试覆盖格式保持、多个独立文本节点中的 URL 替换及跨元素文本边界；252 项测试和完整构建通过，本次复核未修改产品源码。

当前边界：只有完整落在单个 Text 节点内的 URL 才会替换；跨多个 Text 节点的 URL 保持原展示文本，href 仍更新。用户已将 replace 改为 replaceAll，同一 Text 节点中的多个 URL（含相邻匹配）均能替换，新增两个回归用例通过。

替换字符串复核：用户已改为 `text.replaceAll(src, () => newSrc)`，新 URL 作为字面值写入。新增回归用例覆盖新路径中的 `$&`、`$$`、`$'` 与重复匹配，确认展示文本和 href 一致，前后文字、Text 节点身份及其他子元素不变。257 项测试及完整构建通过；第 5 项的上述遗留问题均已解决，跨文本节点仍保留原展示文本。

### 6. [已修复并验证 2026-09-06] [P2] onClickGotoHref 会清除混合集合中非链接元素的 click 行为

位置：[jquery.events.ts:142](D:/projects/_libraries/jqueryx/src/extensions/jquery.events.ts:142)。

用户确认该方法的目的是让超链接点击后跳转到 href。当前 `this.isNot('a')` 基于集合的 any-match 判断：只要含有一个 a，就会对整个集合添加捕获监听器、清除 click 处理，并可能设置 target。

复现：一个 a 和一个带 click 回调的 button 同时调用 onClickGotoHref，随后 button.trigger('click') 不再执行原回调。

建议：先筛出需要恢复导航的链接，再只处理该子集，最终返回原集合保留链式操作。按这个目的，名称可考虑 restoreHrefNavigation；不应让非链接元素承担恢复链接导航的副作用。

复核：用户改为 enumerate 后逐元素判断 a，仅对链接执行原有操作，返回原集合。新增 openNew 为 undefined / false / true 的混合集合回归测试，验证非链接元素的 jQuery 和原生 click 监听器、向父级冒泡、onclick 和 target 属性均保留；两个链接的 click 清理和 target 设置符合原有规则。验证范围为本项的非链接副作用，不代表已执行浏览器页面跳转。

### 7. [已修复并验证 2026-09-06] [P2] replaceBy 未处理父子节点同时入选的情况

位置：[jquery.ts:190](D:/projects/_libraries/jqueryx/src/extensions/jquery.ts:190)、[jquery.ts:206](D:/projects/_libraries/jqueryx/src/extensions/jquery.ts:206)。

先对输入做快照，然后按顺序替换。父元素先被替换并 remove 后，子元素仍在快照里，但已经位于被移除的子树；后续回调的替换节点被插入那棵游离子树，仍被加入返回集合。

复现：`<main><section><i>old</i></section></main>` 的 `find('section, i').replaceBy(() => $('<b>new</b>'))` 返回两个 b，main 中却只有一个。父元素的 remove 还会在子元素回调前清除子元素的 jQuery 数据。

建议：先确定重叠根策略，例如仅处理最外层源节点，或在修改前拒绝包含祖先／后代的集合。当前“逐元素”本身不足以决定这种冲突，不能等父节点移除后再悄悄操作脱离页面的子树。

修复：按用户确认的规则，在执行回调前对输入去重并筛选最外层节点。仅这些节点调用回调，保持原集合顺序并传入首次出现的原始索引；即使父节点被保留或回调移走后代，初始筛掉的后代也不再处理。用于保护其他待处理源节点的集合同步缩小到最外层节点，因此父节点返回被筛掉的子节点时仍保留其身份和数据。

验证：新增七项回归用例覆盖父子顺序颠倒、非直接祖先、重复输入、多棵子树的顺序及索引、保留或删除父节点、用子节点替换父节点、回调移动后代。原复现仅调用一次回调并返回 main 中唯一的 b。264 项测试及完整构建通过。

### 8. [已修复并验证 2026-09-06] [P2] waitForNodes 可查询根外祖先条件，但不会观察条件变化

位置：[jquery.wait.ts:74](D:/projects/_libraries/jqueryx/src/extensions/jquery.wait.ts:74)、[jquery.wait.ts:118](D:/projects/_libraries/jqueryx/src/extensions/jquery.wait.ts:118)。

Element.querySelectorAll 的选择器可以依赖根元素以外的祖先，但 MutationObserver 只观察根及其后代。这导致“选择器实际已经匹配”与“等待仍无法结束”并存。

复现：`<main><section><i></i></section></main>` 中对 section 调用 `waitForNodes('.ready i')`，随后只给 main 加 ready。此时 section.querySelectorAll('.ready i') 已有一个结果，等待仍直到 TimeoutError 才结束。

建议：统一查询与观察边界。支持这类选择器时，需要观察影响匹配的祖先变化；若仅支持由根内变化驱动的匹配，应在 API 设计上明确这个限制，而不是声称支持任意 DOM 驱动的选择器变化。

修复：按用户确认的方案改用 JQueryStatic 上的 $.waitForNodes(selector, options?)，默认查询当前 document，移除实例方法、多根节点处理及根参数。立即查询一次，随后按 pollIntervalMs（默认 100 ms，有限正数）重复查询；保留泛型返回值、默认 30 秒超时、零超时只查一次、AbortSignal、去重结果及同源 iframe 查询。每轮重新发现 iframe 文档，不再维护 MutationObserver 或 load 监听。使用单个递归 setTimeout 调度查询或超时；超时优先于同一时刻的后续查询，长延时按原生定时器上限分段，成功、失败和取消均释放定时器及 abort 监听。实现继续放在 jquery.wait.ts。

验证：新增并调整回归测试，覆盖页面内祖先 class、checked property、默认及自定义轮询间隔、超时边界、取消、查询异常、iframe 新增/移除/文档更换及访问权限变化。静态入口不依赖接收对象，包含 documentElement，并且只在游离节点插入页面后匹配；iframe 文档和结果去重。两种加载顺序的发布包运行时用例验证实际定时器等待及旧实例入口已移除；严格 Bundler / NodeNext 消费者声明覆盖静态泛型、pollIntervalMs 类型，并拒绝旧实例调用和 root 选项。281 项测试及完整构建通过。轮询可能漏掉两次查询之间短暂出现又消失的匹配，此限制已写入 API 注释。

### 9. [已修复并验证 2026-09-06] [P2] hasUrlHref 假设所有 Element.href 都是字符串

位置：[jquery.attr.ts:98](D:/projects/_libraries/jqueryx/src/extensions/jquery.attr.ts:98)。

签名接受任意 Element，但 SVG 的 a.href 是 SVGAnimatedString。jQuery 的 prop('href') 直接返回该对象，随后调用 startsWith 会抛 TypeError。[MDN 的 SVGAElement.href 定义](https://developer.mozilla.org/en-US/docs/Web/API/SVGAElement/href)明确了该属性类型。

验证边界：本地 jsdom 未实现这一 SVG 属性，直接测试不会复现真实浏览器的异常；按标准返回值形状进行的受控模拟复现了 startsWith TypeError。浏览器安全策略阻止了临时 data: 探针页面，因此这里不声称已经执行真实浏览器复现。

建议：如果该 API 按 href 属性判断，读取 getAttribute / attr；如果仅服务于 HTML 链接，则收紧接收类型并处理非链接输入。不要对未知的 href property 直接调用字符串方法。

复核：用户已改为 attr('href')，只读取字符串属性。新增空 href 和五组 SVG 锚点回归用例（缺失、空、javascript、相对及 HTTPS），模拟 SVGAnimatedString 形状的 href getter 并确认完全不会访问它。此验证不依赖 jsdom 实现 SVGAnimatedString，也不声称执行了真实浏览器测试。

### 10. [已修复并验证 2026-09-06] [P2] refineUrls 漏掉协议相对地址和大写协议的远端 URL

位置：[jquery.urls.ts:50](D:/projects/_libraries/jqueryx/src/extensions/jquery.urls.ts:50)。

用原始属性是否 startsWith('http') 判断是否本站链接，会把 `//remote.example/path` 和 `HTTPS://remote.example/path` 这样的有效远端地址直接跳过。

复现：hosts 包含 remote.example、baseUrl 为 https://local.example，两种 href 调用 refineUrls 后均完全没有变化。

建议：先结合元素所属文档的基准 URL 解析地址，再根据解析后的 protocol 和 host 判断是否改写。协议相对地址需要基准 URL；普通相对链接是否改写则应遵守已有的本站链接策略。

修复：接受大小写不敏感的 HTTP(S) 前缀和协议相对地址，使用 new URL(src, el.baseURI) 解析，再按解析后的 protocol 与 host 筛选。保留普通相对路径、查询及片段不改写的既有策略。新增链接与图片的协议相对/大小写协议、同站和未匹配主机、非 HTTP 协议、owner document 基准地址、路径重写、端口/查询/片段及图片备用链接用例。第 9、10 项合计新增 34 项回归测试；315 项测试及完整构建通过。

### 11. [已修复并验证 2026-09-06] [P2] textContent 在 template 上的 getter 与 setter 操作不同范围

位置：[jquery.attr.ts:49](D:/projects/_libraries/jqueryx/src/extensions/jquery.attr.ts:49)。

setter 通过 textNodes 进入 template.content，但 getter 委托 jQuery.text()，后者读取 template 元素自身的 textContent，不包含 template.content。

复现：template.innerHTML 为 `<span>old</span>`，调用 `$(template).textContent('new')` 后 template.content.textContent 为 new，但 `$(template).textContent()` 仍返回空字符串。相同 API 的写入结果无法由自己的 getter 读回。

建议：明确模板内容是否属于该 API 的文本范围，并让 getter 和 setter 一致。若支持模板，应共享对应的遍历逻辑，同时保持用户要求的非文本节点身份。

复核：用户已改为通过 textNodes() 获取文本并拼接。新增回归测试确认已有文本的模板、单一路径的嵌套模板及普通元素/模板混合集合可以读取并读回写入值，模板子元素、Text 节点及 jQuery 数据和事件保留。

空模板修复：setter 的无文本分支将 HTML template 的插入目标改为 template.content，并使用目标的 ownerDocument 创建 Text。通过原生 Element 判断及命名空间/localName 识别模板，支持 iframe 和无 window 的独立文档，同时不将 SVG 中同名元素当成 HTML 模板。其他节点保持原插入规则。

DFS 复核：用户已将根节点和子节点反序入栈，并先收集 Text 数组再通过 $.from 包装。模板混排 abcd、嵌套模板 abc、普通元素/模板混合集合及原有重叠/倒序根、剪枝和去重测试均通过，相关顺序问题已修复。

验证：空模板和仅含空 button 的模板这两个正式复现测试已通过，并增加清空/重复写入、iframe/独立文档、子元素/注释/事件数据保留以及非 HTML 同名元素测试。此前 $.from 的各类 Node、跨 iframe、NodeList/ArrayLike、混合分组和类型推断用例继续通过。全量 343 项测试、完整构建及严格 Bundler / NodeNext 消费者检查均通过。

## 验证与范围

- 临时缺陷探针：12 个断言用例通过（其中包含第 9 项的受控模拟），并通过项目类型检查。它们是现状复现，已在审查结束前删除。
- 独立 NodeNext 声明检查：失败，复现第 1 项；同时定位到 builtinx 的同类声明问题。
- 删除临时探针后，常规 pnpm test 的 230 项测试全部通过，pnpm build 的类型检查、Vite 构建及声明生成全部通过。NodeNext 错误与 Bundler 模式的通过结果应分别看待。
- 覆盖 src 下全部文件、package.json、tsconfig、Vite、pnpm 配置、两个 GitHub 工作流和清理脚本；没有执行发布、工作流或清理脚本。
- 未把 README、文档完善程度、测试用例不足或已确认的剪枝／逐元素／保留非文本节点语义列为问题。
