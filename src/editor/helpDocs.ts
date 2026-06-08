/**
 * Node help documentation mapping.
 * Key = node label, Value = markdown help text.
 */

export const nodeHelps: Record<string, string> = {
  // ── Params ──
  Number: `## Number

输入一个浮点数值。

### 输出
- **Number** — 当前设置的数值

### 用途
作为任意计算节点的常数输入。`,

  'Field Input': `## Field Input

来自平台字段库的工程输入参数。

### 输出
- **Value** — 当前字段数值
- **Field Key** — 平台字段 key，例如 rho、Q、H
- **Label** — 字段中文名称
- **Unit** — 单位
- **Description** — 字段说明

### 特点
- 节点会自动设置字段名，供同名变量一键虚线连接
- 保存画布时会保留单位、专业和描述
- 适合作为计算书参数表、Python 电池输入和平台回传溯源的标准入口`,

  Slider: `## Slider

通过滑块在限定范围内选择一个数值。

### 输出
- **Number** — 当前滑块值`,

  Integer: `## Integer

输入一个整数值，自动四舍五入。

### 输出
- **Integer** — 当前整数值`,

  Boolean: `## Boolean

开关量，输出 0 或 1。

### 输出
- **Boolean** — 0 (关) 或 1 (开)`,

  Domain: `## Domain

定义一个数值区间 [min, max]。

### 输出
- **Domain** — { min, max } 对象`,

  Panel: `## Panel

显示上游传入的数据内容，支持树形结构展开。`,

  'Python Script': `## Python Script

在浏览器中通过 Pyodide 执行 Python 代码。

### 默认输入
- **x, y, z** — 任意数值输入

### 默认输出
- **a** — 代码执行结果

### 语法
- 双击节点或点击 ✎ 编辑代码
- 使用 ghenv.Component 访问 Grasshopper 兼容接口
- 未连接的输入在 Python 中为 None

### 示例
${'```'}python
import math
if x is None: x = 0
a = math.sqrt(x**2 + y**2)
${'```'}`,

  Report: `## Report

根据模板生成格式化文本报告。

### 使用方式
1. 双击节点或点击 ✎ 编辑模板
2. 模板中使用 {variable} 作为占位符
3. 连接同名输入端口，数值自动替换

### 示例模板
${'```'}
流量 Q = {q} m³/s
流速 v = {v} m/s
${'```'}`,

  'Book Section': `## Book Section

把复杂计算书拆成可编排的章节电池。

### 用法
- 模板中使用 {变量名} 占位
- 输入端口接入公式、电池组或平台字段
- 输出 Section 文本给 Book Assembler

### 适合
参数表、公式推导、校核结果、结论建议等章节。`,

  'Field Table': `## Field Table

把平台字段输入编排成计算书参数表。

### 输入
- 每个输入端口对应一个工程字段，例如 rho、Q、H、eta

### 输出
- **Parameter Table** — Markdown 参数表章节

### 用途
连接 Field Input 的数值输出，自动生成“字段、名称、数值、单位、说明”表格，再接入 Book Assembler。`,

  'Book Assembler': `## Book Assembler

汇总多个 Book Section，生成最终计算书正文。

### 特点
- 只有输入，没有输出，可作为计算书终端电池
- 默认支持 section1、section2、section3
- 可通过编辑器调整章节输入和总模板`,

  Toggle: `## Toggle

开关按钮，输出 True / False。

### 输出
- **Toggle** — 布尔值`,

  Colour: `## Colour

颜色选择器，输出 RGB 对象。

### 输出
- **Colour** — { r, g, b, a }`,

  'Value List': `## Value List

下拉列表，从预定义选项中选择一个值。`,

  'Domain Slider': `## Domain Slider

双滑块，选择一个数值区间。`,

  Button: `## Button

点击计数器，每次点击输出递增的整数。`,

  // ── Math ──
  Addition: `## Addition

两数相加：A + B

### 输入
- **A, B** — 加数

### 输出
- **R** — 和`,

  Subtraction: `## Subtraction

两数相减：A - B

### 输出
- **R** — 差`,

  Multiplication: `## Multiplication

两数相乘：A × B

### 输出
- **R** — 积`,

  Division: `## Division

两数相除：A / B

### 输出
- **R** — 商（B=0 时返回 0）`,

  Negative: `## Negative

取相反数：-A

### 输出
- **R** — 相反数`,

  Power: `## Power

幂运算：A^B

### 输出
- **R** — 幂`,

  'Formula Cell': `## Formula Cell

用 LaTeX 显示公式，并用原生 Python 表达式计算结果。

### 配置
- **LaTeX** — 节点中展示的公式，例如 P=\\frac{\\rho gQH}{\\eta}
- **Python 表达式** — 实际执行的表达式，例如 rho * 9.81 * Q * H / max(eta / 100, 1e-9)
- **输入变量** — 逗号分隔的 Python 变量名，会生成同名输入端口
- **输出 key** — 下游连接使用的结果字段

### 用途
适合把计算书中的单条公式做成可读、可调试、可自动连接字段的公式电池。`,

  Absolute: `## Absolute

绝对值：|A|

### 输出
- **R** — 绝对值`,

  'Integer Division': `## Integer Division

整除：A // B

### 输出
- **R** — 整数商`,

  Factorial: `## Factorial

阶乘：A!

### 输出
- **R** — 阶乘结果`,

  Modulus: `## Modulus

取余：A % B

### 输出
- **R** — 余数`,

  Sine: `## Sine

正弦函数：sin(A)（弧度制）

### 输出
- **R** — sin(A)`,

  Cosine: `## Cosine

余弦函数：cos(A)（弧度制）`,

  Tangent: `## Tangent

正切函数：tan(A)（弧度制）`,

  Floor: `## Floor

向下取整：⌊A⌋

### 输出
- **R** — 不大于 A 的最大整数`,

  Ceiling: `## Ceiling

向上取整：⌈A⌉

### 输出
- **R** — 不小于 A 的最小整数`,

  Round: `## Round

四舍五入到最近的整数。`,

  Maximum: `## Maximum

返回 A 和 B 中的较大值。`,

  Minimum: `## Minimum

返回 A 和 B 中的较小值。`,

  Average: `## Average

返回 A 和 B 的平均值：(A+B)/2`,

  'Mass Addition': `## Mass Addition

对列表中的所有数值求和。`,

  'Mass Multiplication': `## Mass Multiplication

对列表中的所有数值求积。`,

  'Relative Differences': `## Relative Differences

计算列表中相邻元素的差值。`,

  'Larger Than': `## Larger Than

比较：A > B，成立返回 1，否则返回 0。`,

  'Smaller Than': `## Smaller Than

比较：A < B，成立返回 1，否则返回 0。`,

  Equality: `## Equality

比较：A == B，成立返回 1，否则返回 0。`,

  Similarity: `## Similarity

相似性比较：|A-B| < tol`,

  'Gate And': `## Gate And

逻辑与：A && B`,

  'Gate Or': `## Gate Or

逻辑或：A || B`,

  'Gate Not': `## Gate Not

逻辑非：!A`,

  'Gate Xor': `## Gate Xor

逻辑异或。`,

  'Gate Majority': `## Gate Majority

多数表决：输入中超过半数非零则返回 1。`,

  'Gate Nand': `## Gate Nand

与非门。`,

  'Gate Nor': `## Gate Nor

或非门。`,

  'Gate Xnor': `## Gate Xnor

同或门。`,

  Remap: `## Remap

将数值从源区间映射到目标区间：
R = tMin + (V-sMin)/(sMax-sMin) × (tMax-tMin)`,

  Expression: `## Expression

自定义数学表达式求值器。
支持变量 x, y, z 和标准数学函数。`,

  Range: `## Range

生成等差数列：从 Domain 的起始值到结束值，步长为 N。`,

  Series: `## Series

生成指定数量和步长的数列。`,

  // ── Fluid ──
  Bernoulli: `## Bernoulli

伯努利能量方程：
P₁ + ½ρv₁² + ρgz₁ = P₂ + ½ρv₂² + ρgz₂

### 输入
- **P₁, v₁, z₁** — 截面 1 的压强、流速、高程
- **v₂, z₂** — 截面 2 的流速、高程
- **ρ, g** — 流体密度、重力加速度

### 输出
- **P₂** — 截面 2 的压强
- **Head** — 水头`,

  Continuity: `## Continuity

连续性方程：Q = A₁v₁ = A₂v₂

### 输入
- **A₁, v₁** — 截面 1
- **A₂** — 截面 2 面积

### 输出
- **v₂** — 截面 2 流速
- **Q** — 体积流量`,

  Reynolds: `## Reynolds

雷诺数计算与流态判别：
Re = ρvD / μ

### 输入
- **ρ** — 流体密度 (kg/m³)
- **v** — 流速 (m/s)
- **D** — 特征直径 (m)
- **μ** — 动力粘度 (Pa·s)

### 输出
- **Re** — 雷诺数
- **State** — 流态：1=层流, 2=过渡, 3=湍流`,

  Velocity: `## Velocity

由流量和管径计算平均流速：
v = 4Q / (πD²)

### 输入
- **Q** — 体积流量 (m³/s)
- **D** — 管径 (m)

### 输出
- **v** — 平均流速 (m/s)`,

  'Darcy-Weisbach': `## Darcy-Weisbach

达西-魏斯巴赫沿程阻力公式：
ΔP = f·(L/D)·(ρv²/2)
h_loss = ΔP / (ρg)

### 输入
- **f** — 沿程阻力系数
- **L** — 管长 (m)
- **D** — 管径 (m)
- **ρ** — 密度 (kg/m³)
- **v** — 流速 (m/s)

### 输出
- **ΔP** — 沿程压降 (Pa)
- **h_loss** — 沿程水头损失 (m)`,

  'Local Resistance': `## Local Resistance

局部阻力压降计算：
ΔP = Σξ · (ρv²/2)
h = ΔP / (ρg)

### 输入
- **Σξ** — 局部阻力系数总和
- **ρ** — 密度 (kg/m³)
- **v** — 流速 (m/s)

### 输出
- **ΔP** — 局部压降 (Pa)
- **h** — 局部水头损失 (m)`,

  'Friction Factor': `## Friction Factor

沿程阻力系数计算。

**层流 (Re < 2300)**：f = 64/Re

**湍流 (Swamee-Jain 显式公式)**：
f = 0.25 / [log₁₀(ε/3.7D + 5.74/Re^0.9)]²

### 输入
- **Re** — 雷诺数
- **ε** — 管壁粗糙度 (mm)，默认 0.045mm
- **D** — 管径 (m)

### 输出
- **f** — 沿程阻力系数`,

  'Pipe Area': `## Pipe Area

圆管几何参数：
A = πD²/4
Perimeter = πD

### 输入
- **D** — 管径 (m)

### 输出
- **A** — 截面积 (m²)
- **Perimeter** — 湿周 (m)`,

  'Total Head': `## Total Head

系统总扬程计算：
H_req = h₁_f + h₁_l + h₂_f + h₂_l + Δz
ΔP_total = ρg · H_req

### 输入
- **h₁_f** — 吸入管沿程水头损失
- **h₁_l** — 吸入管局部水头损失
- **h₂_f** — 压出管沿程水头损失
- **h₂_l** — 压出管局部水头损失
- **Δz** — 几何提升高度 (m)

### 输出
- **h₁** — 吸入管总水头损失
- **h₂** — 压出管总水头损失
- **H_req** — 系统需求扬程 (m)
- **ΔP_total** — 系统总压降 (Pa)`,

  'Pump Power': `## Pump Power

水泵功率计算。

**有效功率**：P_e = ρgQH

**轴功率**：P_shaft = P_e / η

### 输入
- **ρ** — 密度 (kg/m³)
- **Q** — 流量 (m³/s)
- **H** — 扬程 (m)
- **η** — 效率 (%)

### 输出
- **P_e** — 有效功率 (W)
- **P_shaft** — 轴功率 (W)
- **P_shaft (kW)** — 轴功率 (kW)`,

  NPSH: `## NPSH

汽蚀余量可用值计算：
NPSH_a = P_atm/(ρg) - Z_s - h_s - P_v/(ρg)

### 输入
- **P_atm** — 大气压 (Pa)
- **P_v** — 饱和蒸汽压 (Pa)
- **Z_s** — 吸上高度 (m)
- **h_s** — 吸入管总水头损失 (m)
- **ρ** — 密度 (kg/m³)
- **g** — 重力加速度 (m/s²)

### 输出
- **NPSH_a** — 可用汽蚀余量 (m)

### 校核标准
NPSH_a ≥ 3m 时一般认为不会发生汽蚀。`,

  Torricelli: `## Torricelli

托里拆利定律（小孔出流）：
v = √(2gh)

### 输入
- **g** — 重力加速度
- **h** — 液面高度

### 输出
- **v** — 出流速度`,

  Poiseuille: `## Poiseuille

泊肃叶定律（层流圆管）：
Q = πR⁴ΔP / (8μL)
v_max = ΔP·R² / (4μL)

### 输入
- **R** — 管半径 (m)
- **ΔP** — 压差 (Pa)
- **μ** — 动力粘度 (Pa·s)
- **L** — 管长 (m)

### 输出
- **Q** — 体积流量
- **v_max** — 管轴最大流速`,

  Archimedes: `## Archimedes

阿基米德浮力：
F_b = ρVg

### 输入
- **ρ** — 流体密度
- **V** — 排开体积
- **g** — 重力加速度

### 输出
- **F_b** — 浮力 (N)`,

  // ── Platform Resources ──
  'Dictionary Lookup': `## Dictionary Lookup

从平台数据字典读取标准值，例如管材粗糙度、地面粗糙度等。

### 输入
- **Key** — 字典项名称，未连接时使用节点默认项

### 输出
- **Value** — 查到的数值
- **Label** — 标准项名称`,

  'Table Lookup': `## Table Lookup

从工程数据表按自变量插值读取数据，例如水密度、粘度表。

### 输入
- **X** — 查询点

### 输出
- **Value** — 插值结果
- **Source** — 平台资源来源`,

  'CoolProp Props': `## CoolProp Props

通过平台 CoolProp 适配接口获取流体物性。

### 输入
- **T** — 温度 (°C)
- **P** — 压力 (Pa)

### 输出
- **ρ** — 密度 (kg/m³)
- **μ** — 动力粘度 (Pa·s)`,

  'Project Context': `## Project Context

从外部平台读取当前项目上下文，让画布可以直接使用平台资源。

### 输出
- **Project** — 项目名称
- **Code** — 项目编号
- **WBS** — 当前任务或专业 WBS
- **Book ID** — 平台计算书编号
- **Title** — 默认计算书标题
- **Targets** — 文控、进度计划等回传目标

### 用途
可连接到 Book Section、Report 或 Platform Return，把项目、任务和文控目标写入计算书与回传结果。`,

  'Platform Return': `## Platform Return

将报告文本或计算成果回传到外部平台，用于计算书、进度计划和文控平台联动。

### 输入
- **Title** — 回传标题，未连接时使用默认标题
- **Report** — 上游 Report 电池输出的文本

### 输出
- **Receipt** — 平台回传回执编号
- **Status** — submitted / failed
- **Targets** — 已回传到的外部平台目标`,

  'AI Dev Bridge': `## AI Dev Bridge

把当前画布整理成 AI 开发助手任务包，便于交给 NextChat、Cline、opencode 等工具继续生成代码、审查计算链或补充节点。

### 输入
- **Task** — 交给开发助手的任务说明
- **Report** — 当前计算书正文，未连接时自动读取 Report 或 Book Assembler

### 输出
- **Prompt** — Markdown 任务包
- **Context JSON** — 画布节点、连线、字段、报告的结构化上下文
- **Target** — 目标助手名称

### 用途
适合把可视化计算书、Python 电池、字段映射和平台回传链路打包给外部 AI 开发助手，形成“画布编排 -> AI 改造 -> 平台回传”的协同闭环。`,

  // ── Vector ──
  Point: `## Point

构造三维点：{ x, y, z }

### 输出
- **Point** — 点坐标对象`,

  Vector: `## Vector XYZ

构造三维向量：{ x, y, z }

### 输出
- **Vector** — 向量对象`,

  'Deconstruct Point': `## Deconstruct Point

将点/向量分解为 x, y, z 分量。`,

  Distance: `## Distance

计算两点之间的距离。`,

  'Unit Vector': `## Unit Vector

将向量单位化：v̂ = v / |v|`,

  'Vector Length': `## Vector Length

计算向量模长：|v| = √(x²+y²+z²)`,

  'Cross Product': `## Cross Product

向量叉积：a × b`,

  'Dot Product': `## Dot Product

向量点积：a · b`,

  Move: `## Move

将几何对象沿向量平移。`,

  // ── Curve ──
  Line: `## Line

由两点构造线段。`,

  'Line SDL': `## Line SDL

由起点 S、方向 D、长度 L 构造射线/线段。`,

  Circle: `## Circle

由圆心和平面法向构造圆。`,

  Arc: `## Arc

由三点或角度构造圆弧。`,

  PolyLine: `## PolyLine

由点列表构造多段线。`,

  'Divide Curve': `## Divide Curve

在曲线上等分取点。`,

  Explode: `## Explode

将复合曲线分解为线段列表。`,

  // ── Surface ──
  Plane: `## Plane

由原点和平面法向构造平面。`,

  'Plane Origin': `## Plane Origin

提取平面的原点和法向。`,

  Extrude: `## Extrude

将曲线沿方向拉伸为曲面。`,

  Revolve: `## Revolve

将曲线绕轴旋转为曲面。`,

  // ── Transform ──
  Rotate: `## Rotate

旋转几何对象。`,

  Scale: `## Scale

缩放几何对象。`,

  Mirror: `## Mirror

关于平面对称镜像。`,

  // ── Sets ──
  'List Item': `## List Item

按索引提取列表中的元素。`,

  'List Length': `## List Length

返回列表元素个数。`,

  'Cull Pattern': `## Cull Pattern

根据布尔掩码筛选列表元素。`,

  'Repeat Data': `## Repeat Data

将数据重复 N 次。`,

  'Flatten Tree': `## Flatten Tree

将树形结构的所有路径合并为单一路径 {0: [...]}。`,

  'Graft Tree': `## Graft Tree

将列表中的每个元素提升为独立路径。`,

  'Simplify Tree': `## Simplify Tree

移除树形结构中的冗余单元素路径。`,

  'Cross Reference': `## Cross Reference

两个树形结构的笛卡尔积。`,

  'Longest List': `## Longest List

以最长列表为基准，短列表循环补齐。`,

  'Shortest List': `## Shortest List

以最短列表为基准，截断长列表。`,

  'Tree Stats': `## Tree Stats

统计树形结构的层级数、总元素数等信息。`,
}

export function getNodeHelp(label: string): string | undefined {
  return nodeHelps[label]
}
