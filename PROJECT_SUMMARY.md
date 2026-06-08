# ReteJS Grasshopper-style Node Editor — 项目总结

> 本文档汇总了截至目前的全部开发工作，供后续迭代参考。

---

## 一、项目概述

一个基于 **Rete.js v2** 的可视化节点编辑器，UI 风格模仿 **Grasshopper (Rhinoceros)**。支持在浏览器中拖拽连线、实时计算、Python 脚本执行，以及专业级文本报告生成。

**当前状态**：功能完备，默认场景为「水泵供水管网水力计算书」演示。

---

## 二、技术栈

| 层级 | 技术 |
|---|---|
| 构建工具 | Vite 8 + `@vitejs/plugin-react` |
| 前端框架 | React 19.2 + TypeScript 6.0 |
| 节点引擎 | Rete.js v2 (`rete`, `rete-area-plugin`, `rete-connection-plugin`, `rete-react-plugin`) |
| 插件生态 | `rete-context-menu-plugin`, `rete-minimap-plugin`, `rete-readonly-plugin` |
| Python 运行时 | Pyodide 0.29.3 (WASM CPython in browser) |
| Markdown 渲染 | `react-markdown` + `remark-gfm` |
| 样式 | 纯 CSS (`src/style.css`)，无 UI 组件库 |

**TSConfig 约束**：`verbatimModuleSyntax: true`，所有类型导入必须写 `import type { X }`。

---

## 三、核心架构

### 3.1 执行管线

```
用户操作 ──► engineEvents.triggerExecute() ──► DataflowEngine.execute()
    │                                              │
    │  (参数变化/连线变化)                            ▼
    │                                    拓扑排序 ──► node.execute(inputs)
    │                                              │
    │                                              ▼
    │                                    缓存结果 ──► 下游节点递归执行
    │
    └── 控制组件通过 engineEvents.ts 触发，避免 setup.ts ↔ Control.tsx 循环依赖
```

### 3.2 关键模块关系

```
App.tsx
  ├── Toolbar.tsx          (顶部菜单，读取 nodeRegistry)
  ├── setup.ts             (编辑器初始化，构建默认场景)
  │     ├── engine/dataflow.ts   (DataflowEngine 拓扑执行)
  │     ├── engineEvents.ts      (全局执行事件总线)
  │     ├── helpEvents.ts        (全局 Help 弹窗事件总线)
  │     ├── helpDocs.ts          (60+ 节点 Markdown 帮助文档)
  │     └── nodeRegistry.ts      (节点注册中心)
  │           └── nodes/*.ts     (各分类节点实现)
  └── style.css            (Grasshopper 暗色主题)
```

---

## 四、已完成功能清单

### 4.1 编辑器基础

- [x] **画布**：浅灰背景 `#dcdcdc` + 点阵网格，支持平移/缩放
- [x] **节点渲染**：深色节点 `#2a2a2a`，圆角 2px，分类色顶边
- [x] **Socket 着色**：Number=橙, Point=绿, Curve=蓝, Surface=紫, Boolean=红
- [x] **连线**：贝塞尔曲线，hover 高亮蓝色
- [x] **Minimap**：右下角缩略图
- [x] **Context Menu**：画布右键创建节点，节点右键 Delete/Clone/**Help**
- [x] **框选**：Ctrl + 拖拽多选

### 4.2 顶部工具栏菜单

8 大分类，60+ 组件，悬停展开子菜单：

| 分类 | 数量 | 代表节点 |
|---|---|---|
| Params | 13 | Number, Slider, Python Script, Report, Toggle, Colour, Button |
| Math | 36 | 四则运算、三角函数、逻辑门、Remap、Expression |
| Fluid | 14 | Bernoulli, Reynolds, Darcy-Weisbach, Pump Power, NPSH, Total Head |
| Vector | 9 | Point, Vector XYZ, Cross/Dot Product, Unit Vector |
| Curve | 7 | Line, Circle, Arc, PolyLine, Divide Curve |
| Surface | 4 | Plane, Extrude, Revolve |
| Transform | 3 | Rotate, Scale, Mirror |
| Sets | 13 | Range, Series, Flatten Tree, Graft Tree, Cross Reference, Tree Stats |

### 4.3 参数控件（Params）

- [x] **Number** — 浮点输入框
- [x] **Slider** — 范围滑块
- [x] **Integer** — 整数输入（自动四舍五入）
- [x] **Boolean** — 开关量 (0/1)
- [x] **Domain** — 区间 [min, max]
- [x] **Toggle** — ON/OFF 按钮
- [x] **Colour** — 颜色选择器 (RGB)
- [x] **Value List** — 下拉选项
- [x] **Domain Slider** — 双滑块区间
- [x] **Button** — 点击计数器
- [x] **Panel** — 数据显示面板（支持树形结构）

### 4.4 数据树 / List 机制

- [x] `DataTree` 类型：`{ paths: Record<string, any[]> }`
- [x] **Flatten Tree** — 合并所有路径到 `{ '0': [...] }`
- [x] **Graft Tree** — 每个元素独立成路径
- [x] **Simplify Tree** — 移除冗余单元素路径
- [x] **Cross Reference** — 笛卡尔积
- [x] **Longest List** / **Shortest List** — 列表补齐/截断
- [x] **Tree Stats** — 统计层级与元素数

### 4.5 Python Script 节点

- [x] 基于 Pyodide 的浏览器内 CPython 执行
- [x] GH 兼容语法：`ghenv.Component.Name/NickName/RunMode`
- [x] 未连接输入默认为 `None`
- [x] 自定义 I/O 端口（Inputs/Outputs/Code Tabs）
- [x] 双击或 ✎ 按钮打开 `PythonEditor` 弹窗
- [x] 默认模板包含 `if x is None: x = 0` 守卫

### 4.6 Report 节点

- [x] 模板驱动文本生成，`{variable}` 占位符替换
- [x] 数值自动格式化为 4 位有效数字 / 科学计数法
- [x] 支持多行专业计算书模板
- [x] 双击或 ✎ 按钮打开 `ReportEditor` 弹窗
- [x] 动态重建输入端口（`rebuildPorts()`）

### 4.7 流体动力学组件（14 个）

| 节点 | 功能 |
|---|---|
| Bernoulli | 伯努利能量方程 |
| Continuity | 连续性方程 Q=A₁v₁=A₂v₂ |
| Reynolds | 雷诺数 + 流态判别 (层流/过渡/湍流) |
| Velocity | v = 4Q/(πD²) |
| Darcy-Weisbach | 沿程阻力 ΔP = f·(L/D)·(ρv²/2) |
| Local Resistance | 局部阻力 ΔP = Σξ·(ρv²/2) |
| Friction Factor | Swamee-Jain 显式公式 |
| Pipe Area | A = πD²/4 |
| Total Head | 系统总扬程 H_req = h₁+h₂+Δz |
| Pump Power | 有效功率 + 轴功率 (含 kW) |
| NPSH | 汽蚀余量可用值 NPSH_a |
| Torricelli | 小孔出流 v = √(2gh) |
| Poiseuille | 层流圆管 Q = πR⁴ΔP/(8μL) |
| Archimedes | 浮力 F_b = ρVg |

### 4.8 数学运算符（36 个）

- 四则运算、幂、绝对值、整除、阶乘、取模
- 三角函数（sin/cos/tan）
- 取整（floor/ceiling/round）
- 极值/平均/质量运算
- 比较运算（> / < / == / 相似性）
- 逻辑门：AND/OR/NOT/XOR/Majority/Nand/Nor/Xnor
- Remap、Expression、Range、Series

### 4.9 Help / Markdown 文档系统

- [x] **帮助文档映射** (`src/editor/helpDocs.ts`)：60+ 节点 Markdown 文档
- [x] **自动注入**：`withHelp()` 包装 factory，节点创建时自动绑定 help
- [x] **节点悬停**：header `?` 按钮悬停显示 tooltip（前 12 行摘要）
- [x] **节点点击**：打开 HelpModal，完整 Markdown 渲染
- [x] **右键菜单**：节点右键菜单顶部新增 **Help** 选项
- [x] **样式**：暗色主题弹窗，支持代码块、表格、引用

---

## 五、默认演示场景

加载编辑器后自动构建一个 **「水泵供水管网水力计算」** 系统：

| 列 | x 坐标 | 内容 |
|---|---|---|
| 第1列 | ~40 | 全部输入参数（ρ, μ, g, Q, H_pump, η, 管径/管长/阻力系数, 高程等） |
| 第2列 | ~320 | 吸入管段完整水力链：PipeArea → Velocity → Reynolds → FrictionFactor → DarcyWeisbach + LocalResistance |
| 第3列 | ~600 | 压出管段完整水力链（同上） |
| 第4列 | ~880 | 系统汇总：TotalHead → PumpPower → NPSH |
| 第5列 | ~1160 | Report 节点（8 章节中文水力计算书） |

**Report 模板涵盖**：编制依据、物性参数、水泵参数、吸入管水力计算、压出管水力计算、系统总扬程、水泵功率、NPSH 校核、结论建议。

---

## 六、关键文件速查

| 文件 | 职责 |
|---|---|
| `src/App.tsx` | React 根组件，加载 Pyodide，挂载 Toolbar + Editor |
| `src/editor/setup.ts` | 编辑器初始化、插件装配、默认场景构建 |
| `src/editor/nodeRegistry.ts` | 节点注册中心，8 大分类 60+ 节点 |
| `src/editor/helpDocs.ts` | 节点 Markdown 帮助文档映射 |
| `src/editor/helpEvents.ts` | Help 弹窗全局事件总线 |
| `src/editor/engineEvents.ts` | 执行触发全局事件总线 |
| `src/editor/engine/dataflow.ts` | 拓扑排序执行引擎 |
| `src/editor/nodes/base.ts` | `GHNode` 基类 + Socket 颜色 |
| `src/editor/nodes/fluid.ts` | 14 个流体力学节点 |
| `src/editor/nodes/math.ts` | 36 个数学运算节点 |
| `src/editor/nodes/number.ts` | Number/Slider/Integer/Boolean/Domain 控件 |
| `src/editor/nodes/params.ts` | Toggle/Colour/ValueList/DomainSlider/Button |
| `src/editor/nodes/python.ts` | Python Script 节点 |
| `src/editor/nodes/report.ts` | Report 节点 |
| `src/editor/nodes/tree.ts` | 数据树操作节点 |
| `src/editor/components/Node.tsx` | 自定义节点 React 渲染器 |
| `src/editor/components/Control.tsx` | 自定义控件渲染器 |
| `src/editor/components/HelpModal.tsx` | Markdown 帮助弹窗 |
| `src/editor/components/PythonEditor.tsx` | Python 代码编辑器弹窗 |
| `src/editor/components/ReportEditor.tsx` | Report 模板编辑器弹窗 |
| `src/style.css` | Grasshopper 主题样式 |

---

## 七、开发注意事项

### 7.1 循环依赖禁忌

**永远不要**在 `Control.tsx` 或任何节点文件中直接 `import { triggerExecute } from './setup.ts'`。

✅ 正确做法：
```typescript
import { engineEvents } from './engineEvents'
engineEvents.triggerExecute()
```

同理，Help 弹窗使用 `helpEvents.showHelp(nodeId)`，而非直接操作组件 state。

### 7.2 类型导入约束

TSConfig `verbatimModuleSyntax: true` 要求：
```typescript
import type { Schemes } from './nodes/base'   // ✅ type-only
import { GHNode } from './nodes/base'         // ✅ value
import { Schemes } from './nodes/base'        // ❌ TS1484
```

### 7.3 Rete.js v2 API 备忘

```typescript
// Connection / ContextMenu presets 是 namespace
import { Presets as ConnectionPresets } from 'rete-connection-plugin'
connection.addPreset(ConnectionPresets.classic.setup())

// ReactPlugin 需要 createRoot
import { createRoot } from 'react-dom/client'
const reactPlugin = new ReactPlugin<Schemes, AreaExtra>({ createRoot })

// ReadonlyPlugin 没有 nodeLink，用 .root/.area/.connection
readonly.area  // area-level readonly
```

### 7.4 节点创建时的 Help 注入

通过 Toolbar/右键菜单创建的节点自动带 help（`withHelp()` 包装）。

如果直接在 `setup.ts` 中 `new NumberNode()` 创建节点，需手动调用：
```typescript
import { getNodeHelp } from './helpDocs'
node.helpMarkdown = getNodeHelp(node.label)
```

### 7.5 添加新节点步骤

1. 在 `src/editor/nodes/<category>.ts` 创建类，继承 `GHNode`
2. 在 `src/editor/nodeRegistry.ts` 导入并注册到对应分类
3. 在 `src/editor/helpDocs.ts` 添加同名 key 的 Markdown 帮助
4. **无需修改 setup.ts**（菜单自动从 registry 生成）

---

## 八、已知问题

| 问题 | 状态 | 说明 |
|---|---|---|
| Vite dev server 后台任务超时 | ⚠️ 已知 | `npm run dev` 需在前台终端手动运行，后台 60s 超时 |
| Pyodide 首次加载慢 | ⚠️ 已知 | CDN 下载 ~6MB，有 `public/pyodide/` 本地副本但 build 仍引用 CDN |
| JS bundle 体积 556KB | ⚠️ 已知 | react-markdown 引入较大，可通过 dynamic import 拆分 |
| 默认场景节点 help 已注入 | ✅ 已解决 | setup.ts 中 `applyHelp()` 统一处理 |

---

## 九、下一步可扩展方向

1. **几何预览**：在 Canvas 上直接渲染 Point/Line/Curve/Surface 的 SVG/Canvas 预览
2. **文件 I/O**：导入/导出 JSON 场景，支持保存/加载 workflow
3. **Undo/Redo**：集成 `rete-history-plugin`
4. **代码生成**：将节点图编译为 Python/JavaScript 脚本
5. **动态端口**：Python Script / Expression 节点支持运行时增删端口
6. **3D 预览**：集成 Three.js 渲染几何结果
7. **组件分组**：Group/Cluster 节点，支持折叠
8. **性能优化**：大数据流下的虚拟化、懒计算
