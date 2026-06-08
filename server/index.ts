import 'dotenv/config'
import express, { type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { prisma, closeDb } from './db.js'
import type { Prisma } from './generated/prisma/client.js'

const app = express()
const port = Number(process.env.PORT || 3001)
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173'

app.use(cors({
  origin(origin, callback) {
    if (!origin || origin === clientOrigin || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
      callback(null, true)
      return
    }
    callback(new Error(`CORS blocked origin: ${origin}`))
  },
}))
app.use(express.json({ limit: '10mb' }))

function getId(req: Request): string {
  const id = req.params.id
  const value = Array.isArray(id) ? id[0] : id
  if (!value) throw new Error('route id is required')
  return value
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue
}

async function fallbackSearchComponentFiles(query: string) {
  const roots = ['src', 'requirement', 'server/README.md', 'PROJECT_SUMMARY.md']
  const files: string[] = []

  async function visit(relativePath: string) {
    const absolutePath = path.resolve(process.cwd(), relativePath)
    const info = await stat(absolutePath).catch(() => null)
    if (!info) return
    if (info.isDirectory()) {
      const entries = await readdir(absolutePath)
      for (const entry of entries) {
        await visit(path.join(relativePath, entry))
      }
      return
    }
    if (/\.(ts|tsx|md|txt)$/i.test(relativePath)) files.push(relativePath.replace(/\\/g, '/'))
  }

  for (const root of roots) {
    await visit(root)
  }

  const normalized = query.toLowerCase()
  const matches = []
  for (const file of files) {
    const absolutePath = path.resolve(process.cwd(), file)
    const content = await readFile(absolutePath, 'utf8').catch(() => '')
    const haystack = `${file}\n${content}`.toLowerCase()
    if (!haystack.includes(normalized)) continue
    const firstLine = content.split(/\r?\n/).find((line) => line.trim()) || ''
    matches.push({
      id: `fallback:${file}`,
      path: file,
      name: path.basename(file),
      category: file.startsWith('requirement/') ? 'requirement' : file.startsWith('src/') ? 'source' : 'project',
      summary: firstLine.slice(0, 180),
      updatedAt: new Date().toISOString(),
    })
    if (matches.length >= 20) break
  }

  return matches
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== 'object' || value === null) return false
  const message = value as { role?: unknown; content?: unknown }
  return (
    (message.role === 'user' || message.role === 'assistant' || message.role === 'system') &&
    typeof message.content === 'string'
  )
}

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true })
})

type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const platformDictionaries = [
  {
    code: 'surface_roughness',
    name: '地面粗糙度标准',
    unit: 'mm',
    rows: [
      { key: '商业区', value: 1.0, label: '商业区' },
      { key: '郊区', value: 0.3, label: '郊区' },
      { key: '开阔地', value: 0.05, label: '开阔地' },
    ],
  },
  {
    code: 'pipe_material',
    name: '管材粗糙度',
    unit: 'mm',
    rows: [
      { key: '碳钢', value: 0.045, label: '碳钢' },
      { key: '不锈钢', value: 0.015, label: '不锈钢' },
      { key: 'PVC', value: 0.0015, label: 'PVC' },
    ],
  },
]

const platformTables = [
  {
    code: 'water_density',
    name: '水密度表',
    axis: 'temperature',
    unit: 'kg/m3',
    rows: [
      { temperature: 5, value: 999.97 },
      { temperature: 20, value: 998.21 },
      { temperature: 40, value: 992.22 },
      { temperature: 60, value: 983.2 },
      { temperature: 80, value: 971.8 },
    ],
  },
  {
    code: 'water_viscosity',
    name: '水动力粘度表',
    axis: 'temperature',
    unit: 'Pa.s',
    rows: [
      { temperature: 5, value: 0.00152 },
      { temperature: 20, value: 0.001 },
      { temperature: 40, value: 0.000653 },
      { temperature: 60, value: 0.000467 },
      { temperature: 80, value: 0.000355 },
    ],
  },
]

const platformFields = [
  { key: 'rho', label: '流体密度', unit: 'kg/m3', defaultValue: 1000, discipline: 'fluid', description: '计算介质密度，用于泵功率、压降和水力计算。' },
  { key: 'Q', label: '体积流量', unit: 'm3/s', defaultValue: 0.025, discipline: 'fluid', description: '系统设计流量。' },
  { key: 'D', label: '管径', unit: 'm', defaultValue: 0.125, discipline: 'fluid', description: '管道内径或特征直径。' },
  { key: 'H', label: '扬程', unit: 'm', defaultValue: 35, discipline: 'fluid', description: '泵计算中的设计扬程。' },
  { key: 'eta', label: '效率', unit: '%', defaultValue: 78, discipline: 'fluid', description: '泵或设备效率，百分数。' },
  { key: 'v', label: '流速', unit: 'm/s', defaultValue: 1.5, discipline: 'fluid', description: '管内平均流速。' },
  { key: 'L', label: '管长', unit: 'm', defaultValue: 80, discipline: 'fluid', description: '管段长度。' },
  { key: 'f', label: '沿程阻力系数', unit: '-', defaultValue: 0.02, discipline: 'fluid', description: 'Darcy-Weisbach 沿程阻力系数。' },
]

type PlatformOperator = {
  code: string
  name: string
  language: string
  version: string
  inputs: string[]
  outputs: string[]
  status: string
  description?: string
  sourceCode: string
  testCase?: {
    inputs: Record<string, number>
    expected: Record<string, number>
  }
  audit?: {
    score: number
    status: string
    suggestions: string[]
    auditedAt: string
  }
  publishedAt?: string
}

const forbiddenPythonPatterns: Array<{ token: string; reason: string; pattern: RegExp }> = [
  { token: 'open', reason: '禁止访问本地文件', pattern: /\bopen\s*\(/i },
  { token: '__import__', reason: '禁止动态导入模块', pattern: /\b__import__\s*\(/i },
  { token: 'eval', reason: '禁止动态执行表达式', pattern: /\beval\s*\(/i },
  { token: 'exec', reason: '禁止动态执行代码', pattern: /\bexec\s*\(/i },
  { token: 'compile', reason: '禁止动态编译代码', pattern: /\bcompile\s*\(/i },
  { token: 'os', reason: '禁止访问操作系统能力', pattern: /(^|\n)\s*(import\s+os\b|from\s+os\s+import\b)/i },
  { token: 'sys', reason: '禁止访问系统运行环境', pattern: /(^|\n)\s*(import\s+sys\b|from\s+sys\s+import\b)/i },
  { token: 'subprocess', reason: '禁止执行系统命令', pattern: /(^|\n)\s*(import\s+subprocess\b|from\s+subprocess\s+import\b)/i },
  { token: 'socket', reason: '禁止网络访问', pattern: /(^|\n)\s*(import\s+socket\b|from\s+socket\s+import\b)/i },
  { token: 'requests', reason: '禁止网络请求', pattern: /(^|\n)\s*(import\s+requests\b|from\s+requests\s+import\b)/i },
  { token: 'urllib', reason: '禁止网络请求', pattern: /(^|\n)\s*(import\s+urllib\b|from\s+urllib\s+import\b)/i },
  { token: 'pathlib', reason: '禁止访问本地文件路径', pattern: /(^|\n)\s*(import\s+pathlib\b|from\s+pathlib\s+import\b)/i },
  { token: 'shutil', reason: '禁止操作本地文件系统', pattern: /(^|\n)\s*(import\s+shutil\b|from\s+shutil\s+import\b)/i },
]

function validatePythonSafety(code: string) {
  return forbiddenPythonPatterns
    .filter((item) => item.pattern.test(code))
    .map(({ token, reason }) => ({ token, reason }))
}

const platformOperators: PlatformOperator[] = [
  {
    code: 'pump_power',
    name: '水泵功率算子',
    language: 'python',
    version: '1.0.0',
    inputs: ['rho', 'Q', 'H', 'eta'],
    outputs: ['pe', 'pshaft', 'pshaft_kw'],
    status: 'published',
    description: '根据密度、流量、扬程和效率计算水泵有效功率与轴功率。',
    sourceCode: `import math

if rho is None: rho = 1000
if Q is None: Q = 0
if H is None: H = 0
if eta is None: eta = 75

eta_decimal = max(float(eta), 1.0) / 100.0
pe = float(rho) * 9.81 * float(Q) * float(H)
pshaft = pe / eta_decimal
pshaft_kw = pshaft / 1000.0
`,
    testCase: {
      inputs: { rho: 998.2, Q: 0.08, H: 12, eta: 78 },
      expected: { pe: 9399.8496, pshaft_kw: 12.05108923076923 },
    },
  },
  {
    code: 'pipe_pressure_drop',
    name: '管道压降算子',
    language: 'python',
    version: '0.1.0',
    inputs: ['rho', 'v', 'D', 'L', 'f'],
    outputs: ['dp', 'hloss'],
    status: 'draft',
    description: '用 Darcy-Weisbach 公式计算管段压降和水头损失。',
    sourceCode: `if rho is None: rho = 1000
if v is None: v = 1
if D is None: D = 0.1
if L is None: L = 10
if f is None: f = 0.02

g = 9.81
dp = float(f) * (float(L) / max(float(D), 1e-9)) * (float(rho) * float(v) ** 2 / 2.0)
hloss = dp / (float(rho) * g) if rho else 0
`,
    testCase: {
      inputs: { rho: 998.2, v: 1.5, D: 0.1, L: 80, f: 0.02 },
      expected: { dp: 17967.6, hloss: 1.834862385321101 },
    },
  },
]

const calculationBookDrafts: Array<{
  id: string
  title: string
  version: number
  status: string
  wbsCode: string
  reportPreview: string
  graphAttached: boolean
  resultKeys: string[]
  resultPreview: Array<{ key: string; value: unknown }>
  structuredResultCount: number
  traceCount: number
  nextActions: string[]
  syncStatus?: {
    progressPlan: string
    documentControl: string
    syncedAt: string
  }
  audit?: {
    score: number
    status: string
    suggestions: string[]
  }
  createdAt: string
}> = []

const platformResultReceipts: Array<{
  receiptId: string
  title: string
  reportPreview: string
  graphAttached: boolean
  resultKeys: string[]
  resultPreview: Array<{ key: string; value: unknown }>
  structuredResultCount: number
  traceCount: number
  returnedTo: string[]
  createdAt: string
}> = []

function getResultKeys(results: unknown) {
  return results && typeof results === 'object' ? Object.keys(results) : []
}

function getBusinessResultKeys(results: unknown) {
  return getResultKeys(results).filter((key) => !key.startsWith('__'))
}

function getBusinessResultPreview(results: unknown) {
  if (!results || typeof results !== 'object') return []
  const record = results as Record<string, unknown>
  return getBusinessResultKeys(results).slice(0, 8).map((key) => ({
    key,
    value: record[key],
  }))
}

function getTraceCount(results: unknown) {
  if (!results || typeof results !== 'object') return 0
  const trace = (results as { __trace?: unknown }).__trace
  return Array.isArray(trace) ? trace.length : 0
}

type SavedGraphLike = {
  nodes: unknown[]
  connections: unknown[]
  [key: string]: unknown
}

type CalculationBookTemplate = {
  code: string
  name: string
  discipline: string
  description: string
  tags: string[]
  graph: SavedGraphLike
}

const calculationBookTemplates: CalculationBookTemplate[] = [
  {
    code: 'pump-power-book-sections',
    name: '泵功率章节化计算书',
    discipline: 'fluid',
    description: '用平台原生 Python 泵功率算子完成计算，并用 Book Section / Book Assembler 编排复杂计算书章节。',
    tags: ['泵', '功率', 'Python算子', '章节化计算书', '平台回传'],
    graph: {
      version: 1,
      viewport: { x: -40, y: 20, k: 0.95 },
      nodes: [
        { id: 'tpl3-project', type: 'Project Context', label: '项目上下文', position: { x: 60, y: -95 }, controls: {}, data: {} },
        { id: 'tpl3-rho', type: 'Field Input', label: '流体密度 rho', position: { x: 60, y: 70 }, controls: { value: 1000 }, data: { variableName: 'rho', fieldKey: 'rho', fieldLabel: '流体密度', unit: 'kg/m3', discipline: 'fluid', description: '计算介质密度，用于泵功率、压降和水力计算。' } },
        { id: 'tpl3-q', type: 'Field Input', label: '体积流量 Q', position: { x: 60, y: 165 }, controls: { value: 0.025 }, data: { variableName: 'Q', fieldKey: 'Q', fieldLabel: '体积流量', unit: 'm3/s', discipline: 'fluid', description: '系统设计流量。' } },
        { id: 'tpl3-h', type: 'Field Input', label: '扬程 H', position: { x: 60, y: 260 }, controls: { value: 35 }, data: { variableName: 'H', fieldKey: 'H', fieldLabel: '扬程', unit: 'm', discipline: 'fluid', description: '泵计算中的设计扬程。' } },
        { id: 'tpl3-eta', type: 'Field Input', label: '效率 eta', position: { x: 60, y: 355 }, controls: { value: 78 }, data: { variableName: 'eta', fieldKey: 'eta', fieldLabel: '效率', unit: '%', discipline: 'fluid', description: '泵或设备效率，百分数。' } },
        {
          id: 'tpl3-op',
          type: 'Python Script',
          label: '泵功率 Python 内核',
          position: { x: 380, y: 165 },
          controls: {},
          data: {
            code: platformOperators[0].sourceCode,
            inputConfigs: platformOperators[0].inputs.map((key) => ({ key, label: key, type: 'number' })),
            outputConfigs: platformOperators[0].outputs.map((key) => ({ key, label: key, type: 'number' })),
            platformOperator: {
              code: platformOperators[0].code,
              name: platformOperators[0].name,
              version: platformOperators[0].version,
              status: platformOperators[0].status,
              description: platformOperators[0].description,
              testCase: platformOperators[0].testCase,
            },
          },
        },
        {
          id: 'tpl3-sec-input',
          type: 'Book Section',
          label: '输入参数章节',
          position: { x: 690, y: 55 },
          controls: {},
          data: {
            outputKey: 'section1',
            outputLabel: 'section1',
            inputConfigs: [
              { key: 'projectName', label: '项目名称' },
              { key: 'wbsCode', label: 'WBS' },
              { key: 'rho', label: 'rho' },
              { key: 'Q', label: 'Q' },
              { key: 'H', label: 'H' },
              { key: 'eta', label: 'eta' },
            ],
            template: '## 1 项目与输入参数\\n\\n- 项目：{projectName}\\n- WBS：{wbsCode}\\n- 流体密度 rho = {rho} kg/m3\\n- 体积流量 Q = {Q} m3/s\\n- 设计扬程 H = {H} m\\n- 设备效率 eta = {eta} %',
          },
        },
        {
          id: 'tpl3-field-table',
          type: 'Field Table',
          label: '参数表',
          position: { x: 690, y: 250 },
          controls: {},
          data: {
            outputKey: 'parameterTable',
            outputLabel: '参数表',
            inputConfigs: [
              { key: 'rho', label: '流体密度', unit: 'kg/m3', description: '计算介质密度，用于泵功率、压降和水力计算。' },
              { key: 'Q', label: '体积流量', unit: 'm3/s', description: '系统设计流量。' },
              { key: 'H', label: '扬程', unit: 'm', description: '泵计算中的设计扬程。' },
              { key: 'eta', label: '效率', unit: '%', description: '泵或设备效率，百分数。' },
            ],
          },
        },
        {
          id: 'tpl3-sec-calc',
          type: 'Book Section',
          label: '公式计算章节',
          position: { x: 690, y: 445 },
          controls: {},
          data: {
            outputKey: 'section2',
            outputLabel: 'section2',
            inputConfigs: [
              { key: 'pe', label: 'P_e' },
              { key: 'pshaft', label: 'P_shaft' },
              { key: 'pshaft_kw', label: 'P_shaft (kW)' },
            ],
            template: '## 2 公式与计算\\n\\n采用泵功率关系式：P_e = rho g Q H，P_shaft = P_e / eta。\\n\\n- 有效功率 P_e = {pe} W\\n- 轴功率 P_shaft = {pshaft} W\\n- 轴功率 P_shaft = {pshaft_kw} kW',
          },
        },
        {
          id: 'tpl3-sec-conclusion',
          type: 'Book Section',
          label: '结论章节',
          position: { x: 690, y: 640 },
          controls: {},
          data: {
            outputKey: 'section3',
            outputLabel: 'section3',
            inputConfigs: [
              { key: 'pshaft_kw', label: 'P_shaft (kW)' },
            ],
            template: '## 3 结论\\n\\n本工况下泵轴功率约为 {pshaft_kw} kW。该结果已由平台 Python 算子计算，可作为设备选型和计算书回传依据。',
          },
        },
        {
          id: 'tpl3-assembler',
          type: 'Book Assembler',
          label: '计算书装配器',
          position: { x: 1040, y: 330 },
          controls: {},
          data: {
            inputConfigs: [
              { key: 'section1', label: '输入参数章节' },
              { key: 'parameterTable', label: '参数表' },
              { key: 'section2', label: '公式计算章节' },
              { key: 'section3', label: '结论章节' },
            ],
            template: '# 泵功率计算书\\n\\n{section1}\\n\\n{parameterTable}\\n\\n{section2}\\n\\n{section3}',
          },
        },
        { id: 'tpl3-return', type: 'Platform Return', label: '平台成果回传', position: { x: 1370, y: 365 }, controls: {}, data: {} },
      ],
      connections: [
        { source: 'tpl3-project', sourceOutput: 'projectName', target: 'tpl3-sec-input', targetInput: 'projectName', isAutoVariable: true, variableName: 'projectName' },
        { source: 'tpl3-project', sourceOutput: 'wbsCode', target: 'tpl3-sec-input', targetInput: 'wbsCode', isAutoVariable: true, variableName: 'wbsCode' },
        { source: 'tpl3-project', sourceOutput: 'title', target: 'tpl3-return', targetInput: 'title', isAutoVariable: true, variableName: 'title' },
        { source: 'tpl3-rho', sourceOutput: 'value', target: 'tpl3-op', targetInput: 'rho', isAutoVariable: true, variableName: 'rho' },
        { source: 'tpl3-q', sourceOutput: 'value', target: 'tpl3-op', targetInput: 'Q', isAutoVariable: true, variableName: 'Q' },
        { source: 'tpl3-h', sourceOutput: 'value', target: 'tpl3-op', targetInput: 'H', isAutoVariable: true, variableName: 'H' },
        { source: 'tpl3-eta', sourceOutput: 'value', target: 'tpl3-op', targetInput: 'eta', isAutoVariable: true, variableName: 'eta' },
        { source: 'tpl3-rho', sourceOutput: 'value', target: 'tpl3-sec-input', targetInput: 'rho', isAutoVariable: true, variableName: 'rho' },
        { source: 'tpl3-q', sourceOutput: 'value', target: 'tpl3-sec-input', targetInput: 'Q', isAutoVariable: true, variableName: 'Q' },
        { source: 'tpl3-h', sourceOutput: 'value', target: 'tpl3-sec-input', targetInput: 'H', isAutoVariable: true, variableName: 'H' },
        { source: 'tpl3-eta', sourceOutput: 'value', target: 'tpl3-sec-input', targetInput: 'eta', isAutoVariable: true, variableName: 'eta' },
        { source: 'tpl3-rho', sourceOutput: 'value', target: 'tpl3-field-table', targetInput: 'rho', isAutoVariable: true, variableName: 'rho' },
        { source: 'tpl3-q', sourceOutput: 'value', target: 'tpl3-field-table', targetInput: 'Q', isAutoVariable: true, variableName: 'Q' },
        { source: 'tpl3-h', sourceOutput: 'value', target: 'tpl3-field-table', targetInput: 'H', isAutoVariable: true, variableName: 'H' },
        { source: 'tpl3-eta', sourceOutput: 'value', target: 'tpl3-field-table', targetInput: 'eta', isAutoVariable: true, variableName: 'eta' },
        { source: 'tpl3-op', sourceOutput: 'pe', target: 'tpl3-sec-calc', targetInput: 'pe', isAutoVariable: true, variableName: 'pe' },
        { source: 'tpl3-op', sourceOutput: 'pshaft', target: 'tpl3-sec-calc', targetInput: 'pshaft', isAutoVariable: true, variableName: 'pshaft' },
        { source: 'tpl3-op', sourceOutput: 'pshaft_kw', target: 'tpl3-sec-calc', targetInput: 'pshaft_kw', isAutoVariable: true, variableName: 'pshaft_kw' },
        { source: 'tpl3-op', sourceOutput: 'pshaft_kw', target: 'tpl3-sec-conclusion', targetInput: 'pshaft_kw', isAutoVariable: true, variableName: 'pshaft_kw' },
        { source: 'tpl3-sec-input', sourceOutput: 'section1', target: 'tpl3-assembler', targetInput: 'section1', isAutoVariable: true, variableName: 'section1' },
        { source: 'tpl3-field-table', sourceOutput: 'parameterTable', target: 'tpl3-assembler', targetInput: 'parameterTable', isAutoVariable: true, variableName: 'parameterTable' },
        { source: 'tpl3-sec-calc', sourceOutput: 'section2', target: 'tpl3-assembler', targetInput: 'section2', isAutoVariable: true, variableName: 'section2' },
        { source: 'tpl3-sec-conclusion', sourceOutput: 'section3', target: 'tpl3-assembler', targetInput: 'section3', isAutoVariable: true, variableName: 'section3' },
      ],
    },
  },
  {
    code: 'pump-power-latex',
    name: '泵轴功率公式计算书',
    discipline: 'fluid',
    description: '用 LaTeX 公式电池计算水泵有效功率、轴功率，并生成 Report。',
    tags: ['泵', '功率', 'LaTeX', 'Report'],
    graph: {
      version: 1,
      viewport: { x: 0, y: 0, k: 1 },
      nodes: [
        { id: 'tpl-rho', type: 'Field Input', label: '流体密度 rho', position: { x: 80, y: 80 }, controls: { value: 1000 }, data: { variableName: 'rho', fieldKey: 'rho', fieldLabel: '流体密度', unit: 'kg/m3', discipline: 'fluid', description: '计算介质密度，用于泵功率、压降和水力计算。' } },
        { id: 'tpl-q', type: 'Field Input', label: '体积流量 Q', position: { x: 80, y: 180 }, controls: { value: 0.025 }, data: { variableName: 'Q', fieldKey: 'Q', fieldLabel: '体积流量', unit: 'm3/s', discipline: 'fluid', description: '系统设计流量。' } },
        { id: 'tpl-h', type: 'Field Input', label: '扬程 H', position: { x: 80, y: 280 }, controls: { value: 35 }, data: { variableName: 'H', fieldKey: 'H', fieldLabel: '扬程', unit: 'm', discipline: 'fluid', description: '泵计算中的设计扬程。' } },
        { id: 'tpl-eta', type: 'Field Input', label: '效率 eta', position: { x: 80, y: 380 }, controls: { value: 78 }, data: { variableName: 'eta', fieldKey: 'eta', fieldLabel: '效率', unit: '%', discipline: 'fluid', description: '泵或设备效率，百分数。' } },
        {
          id: 'tpl-pe',
          type: 'Formula Cell',
          label: 'Effective Power',
          position: { x: 390, y: 140 },
          controls: {},
          data: {
            latexFormula: 'P_e=\\rho gQH',
            expression: 'rho * 9.81 * Q * H',
            inputConfigs: [
              { key: 'rho', label: 'rho' },
              { key: 'Q', label: 'Q' },
              { key: 'H', label: 'H' },
            ],
            outputKey: 'pe',
            outputLabel: 'P_e (W)',
          },
        },
        {
          id: 'tpl-pshaft',
          type: 'Formula Cell',
          label: 'Shaft Power',
          position: { x: 690, y: 210 },
          controls: {},
          data: {
            latexFormula: 'P_{shaft}=\\frac{P_e}{\\eta/100}',
            expression: 'pe / max(eta / 100, 1e-9)',
            inputConfigs: [
              { key: 'pe', label: 'P_e' },
              { key: 'eta', label: 'eta' },
            ],
            outputKey: 'P_shaft',
            outputLabel: 'P_shaft (W)',
          },
        },
        {
          id: 'tpl-report',
          type: 'Report',
          label: 'Report',
          position: { x: 1000, y: 190 },
          controls: {},
          data: {
            inputConfigs: [
              { key: 'rho', label: 'rho' },
              { key: 'Q', label: 'Q' },
              { key: 'H', label: 'H' },
              { key: 'eta', label: 'eta' },
              { key: 'pe', label: 'P_e' },
              { key: 'P_shaft', label: 'P_shaft' },
            ],
            template: '泵轴功率计算书\\n\\n输入参数\\n- rho = {rho} kg/m3\\n- Q = {Q} m3/s\\n- H = {H} m\\n- eta = {eta} %\\n\\n计算结果\\n- P_e = {pe} W\\n- P_shaft = {P_shaft} W',
          },
        },
      ],
      connections: [
        { source: 'tpl-rho', sourceOutput: 'value', target: 'tpl-pe', targetInput: 'rho', isAutoVariable: true, variableName: 'rho' },
        { source: 'tpl-q', sourceOutput: 'value', target: 'tpl-pe', targetInput: 'Q', isAutoVariable: true, variableName: 'Q' },
        { source: 'tpl-h', sourceOutput: 'value', target: 'tpl-pe', targetInput: 'H', isAutoVariable: true, variableName: 'H' },
        { source: 'tpl-pe', sourceOutput: 'pe', target: 'tpl-pshaft', targetInput: 'pe', isAutoVariable: true, variableName: 'pe' },
        { source: 'tpl-eta', sourceOutput: 'value', target: 'tpl-pshaft', targetInput: 'eta', isAutoVariable: true, variableName: 'eta' },
        { source: 'tpl-rho', sourceOutput: 'value', target: 'tpl-report', targetInput: 'rho', isAutoVariable: true, variableName: 'rho' },
        { source: 'tpl-q', sourceOutput: 'value', target: 'tpl-report', targetInput: 'Q', isAutoVariable: true, variableName: 'Q' },
        { source: 'tpl-h', sourceOutput: 'value', target: 'tpl-report', targetInput: 'H', isAutoVariable: true, variableName: 'H' },
        { source: 'tpl-eta', sourceOutput: 'value', target: 'tpl-report', targetInput: 'eta', isAutoVariable: true, variableName: 'eta' },
        { source: 'tpl-pe', sourceOutput: 'pe', target: 'tpl-report', targetInput: 'pe', isAutoVariable: true, variableName: 'pe' },
        { source: 'tpl-pshaft', sourceOutput: 'P_shaft', target: 'tpl-report', targetInput: 'P_shaft', isAutoVariable: true, variableName: 'P_shaft' },
      ],
    },
  },
  {
    code: 'pipe-pressure-drop',
    name: '管道压降计算书',
    discipline: 'fluid',
    description: '用平台 Python 算子计算 Darcy-Weisbach 管道压降，并生成 Report。',
    tags: ['管道', '压降', 'Python算子', 'Report'],
    graph: {
      version: 1,
      viewport: { x: 0, y: 0, k: 1 },
      nodes: [
        { id: 'tpl2-rho', type: 'Field Input', label: '流体密度 rho', position: { x: 80, y: 80 }, controls: { value: 998.2 }, data: { variableName: 'rho', fieldKey: 'rho', fieldLabel: '流体密度', unit: 'kg/m3', discipline: 'fluid', description: '计算介质密度，用于泵功率、压降和水力计算。' } },
        { id: 'tpl2-v', type: 'Field Input', label: '流速 v', position: { x: 80, y: 180 }, controls: { value: 1.5 }, data: { variableName: 'v', fieldKey: 'v', fieldLabel: '流速', unit: 'm/s', discipline: 'fluid', description: '管内平均流速。' } },
        { id: 'tpl2-d', type: 'Field Input', label: '管径 D', position: { x: 80, y: 280 }, controls: { value: 0.1 }, data: { variableName: 'D', fieldKey: 'D', fieldLabel: '管径', unit: 'm', discipline: 'fluid', description: '管道内径或特征直径。' } },
        { id: 'tpl2-l', type: 'Field Input', label: '管长 L', position: { x: 80, y: 380 }, controls: { value: 80 }, data: { variableName: 'L', fieldKey: 'L', fieldLabel: '管长', unit: 'm', discipline: 'fluid', description: '管段长度。' } },
        { id: 'tpl2-f', type: 'Field Input', label: '沿程阻力系数 f', position: { x: 80, y: 480 }, controls: { value: 0.02 }, data: { variableName: 'f', fieldKey: 'f', fieldLabel: '沿程阻力系数', unit: '-', discipline: 'fluid', description: 'Darcy-Weisbach 沿程阻力系数。' } },
        {
          id: 'tpl2-op',
          type: 'Python Script',
          label: '管道压降算子',
          position: { x: 420, y: 220 },
          controls: {},
          data: {
            code: platformOperators[1].sourceCode,
            inputConfigs: platformOperators[1].inputs.map((key) => ({ key, label: key, type: 'number' })),
            outputConfigs: platformOperators[1].outputs.map((key) => ({ key, label: key, type: 'number' })),
            platformOperator: {
              code: platformOperators[1].code,
              name: platformOperators[1].name,
              version: platformOperators[1].version,
              status: platformOperators[1].status,
              description: platformOperators[1].description,
              testCase: platformOperators[1].testCase,
            },
          },
        },
        {
          id: 'tpl2-report',
          type: 'Report',
          label: 'Report',
          position: { x: 760, y: 260 },
          controls: {},
          data: {
            inputConfigs: [
              { key: 'rho', label: 'rho' },
              { key: 'v', label: 'v' },
              { key: 'D', label: 'D' },
              { key: 'L', label: 'L' },
              { key: 'f', label: 'f' },
              { key: 'dp', label: 'dp' },
              { key: 'hloss', label: 'hloss' },
            ],
            template: '管道压降计算书\\n\\n输入参数\\n- rho = {rho} kg/m3\\n- v = {v} m/s\\n- D = {D} m\\n- L = {L} m\\n- f = {f}\\n\\n计算结果\\n- dp = {dp} Pa\\n- hloss = {hloss} m',
          },
        },
      ],
      connections: [
        { source: 'tpl2-rho', sourceOutput: 'value', target: 'tpl2-op', targetInput: 'rho', isAutoVariable: true, variableName: 'rho' },
        { source: 'tpl2-v', sourceOutput: 'value', target: 'tpl2-op', targetInput: 'v', isAutoVariable: true, variableName: 'v' },
        { source: 'tpl2-d', sourceOutput: 'value', target: 'tpl2-op', targetInput: 'D', isAutoVariable: true, variableName: 'D' },
        { source: 'tpl2-l', sourceOutput: 'value', target: 'tpl2-op', targetInput: 'L', isAutoVariable: true, variableName: 'L' },
        { source: 'tpl2-f', sourceOutput: 'value', target: 'tpl2-op', targetInput: 'f', isAutoVariable: true, variableName: 'f' },
        { source: 'tpl2-rho', sourceOutput: 'value', target: 'tpl2-report', targetInput: 'rho', isAutoVariable: true, variableName: 'rho' },
        { source: 'tpl2-v', sourceOutput: 'value', target: 'tpl2-report', targetInput: 'v', isAutoVariable: true, variableName: 'v' },
        { source: 'tpl2-d', sourceOutput: 'value', target: 'tpl2-report', targetInput: 'D', isAutoVariable: true, variableName: 'D' },
        { source: 'tpl2-l', sourceOutput: 'value', target: 'tpl2-report', targetInput: 'L', isAutoVariable: true, variableName: 'L' },
        { source: 'tpl2-f', sourceOutput: 'value', target: 'tpl2-report', targetInput: 'f', isAutoVariable: true, variableName: 'f' },
        { source: 'tpl2-op', sourceOutput: 'dp', target: 'tpl2-report', targetInput: 'dp', isAutoVariable: true, variableName: 'dp' },
        { source: 'tpl2-op', sourceOutput: 'hloss', target: 'tpl2-report', targetInput: 'hloss', isAutoVariable: true, variableName: 'hloss' },
      ],
    },
  },
]

function templateSummary(template: typeof calculationBookTemplates[number]) {
  return {
    code: template.code,
    name: template.name,
    discipline: template.discipline,
    description: template.description,
    tags: template.tags,
    nodeCount: template.graph.nodes.length,
    connectionCount: template.graph.connections.length,
  }
}

function slugifyTemplateCode(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'calculation-template'
}

function uniqueTemplateCode(base: string) {
  let code = base
  let index = 2
  while (calculationBookTemplates.some((item) => item.code === code)) {
    code = `${base}-${index}`
    index++
  }
  return code
}

function isSavedGraphLike(value: unknown): value is typeof calculationBookTemplates[number]['graph'] {
  if (typeof value !== 'object' || value === null) return false
  const graph = value as { nodes?: unknown; connections?: unknown }
  return Array.isArray(graph.nodes) && Array.isArray(graph.connections)
}

function interpolateTable(rows: Array<Record<string, number>>, axis: string, x: number) {
  const sorted = rows
    .filter((row) => typeof row[axis] === 'number' && typeof row.value === 'number')
    .sort((a, b) => a[axis] - b[axis])
  if (sorted.length === 0) return 0
  if (x <= sorted[0][axis]) return sorted[0].value
  if (x >= sorted[sorted.length - 1][axis]) return sorted[sorted.length - 1].value

  for (let i = 0; i < sorted.length - 1; i++) {
    const left = sorted[i]
    const right = sorted[i + 1]
    if (x >= left[axis] && x <= right[axis]) {
      const ratio = (x - left[axis]) / (right[axis] - left[axis])
      return left.value + (right.value - left.value) * ratio
    }
  }

  return sorted[0].value
}

function isOperatorTestCase(value: unknown): value is PlatformOperator['testCase'] {
  if (typeof value !== 'object' || value === null) return false
  const testCase = value as { inputs?: unknown; expected?: unknown }
  return isNumberRecord(testCase.inputs) && isNumberRecord(testCase.expected)
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value).every((item) => typeof item === 'number' && Number.isFinite(item))
  )
}

app.post('/api/ai/chat', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      res.status(400).json({ error: 'DEEPSEEK_API_KEY is not configured on the server' })
      return
    }

    const { messages, canvas } = req.body as { messages?: unknown; canvas?: unknown }
    if (!Array.isArray(messages)) {
      res.status(400).json({ error: 'messages is required' })
      return
    }

    const safeMessages = messages
      .filter(isChatMessage)
      .slice(-12)

    const systemPrompt = [
      '你是一个工程计算可视化编程平台的 AI 开发助手。',
      '平台使用 Rete 画布、电池组节点、字段自动连接、Report 输出和 Pyodide Python Script 节点。',
      '用户希望业务电池尽量原生 Python。你应优先建议 Python Script 电池，而不是 TypeScript 节点。',
      '但如果用户提到 NextChat、Cline、opencode、AI 开发助手、代码审查助手或想把当前画布打包给外部 AI 工具，必须优先输出 add_resource_node，resourceType 固定为 dev_assistant；这种场景不要输出 add_python_node。',
      '你可以用自然语言说明方案。',
      '如果需要创建自定义 Python 电池，请在回答末尾输出一个 JSON 代码块，格式为：',
      '{"actions":[{"type":"add_python_node","name":"节点名称","code":"Python代码","inputs":[{"key":"x","label":"x"}],"outputs":[{"key":"y","label":"y"}]}]}',
      '如果用户要求公式电池、LaTeX 公式或计算书公式，可以优先输出：',
      '{"actions":[{"type":"add_formula_node","name":"公式名称","latex":"P=\\\\frac{\\\\rho gQH}{\\\\eta}","expression":"rho * 9.81 * Q * H / max(eta / 100, 1e-9)","inputs":[{"key":"rho","label":"rho"},{"key":"Q","label":"Q"},{"key":"H","label":"H"},{"key":"eta","label":"eta"}],"outputKey":"P","outputLabel":"P"}]}',
      '如果需要生成或更新最终计算书报告电池，可以输出：',
      '{"actions":[{"type":"add_report_node","name":"Report","template":"泵功率计算书\\nP_shaft = {P_shaft} W","inputs":[{"key":"P_shaft","label":"P_shaft"}]},{"type":"auto_connect_fields"}]}',
      '如果用户要求把复杂计算书拆成章节、电池组编排或多段装配，可以输出 Book Section 与 Book Assembler：',
      '{"actions":[{"type":"add_book_section","name":"输入参数章节","outputKey":"section1","outputLabel":"section1","template":"## 输入参数\\n- rho = {rho} kg/m3\\n- Q = {Q} m3/s","inputs":[{"key":"rho","label":"rho"},{"key":"Q","label":"Q"}]},{"type":"add_book_section","name":"计算结果章节","outputKey":"section2","outputLabel":"section2","template":"## 计算结果\\n- P_shaft = {pshaft_kw} kW","inputs":[{"key":"pshaft_kw","label":"pshaft_kw"}]},{"type":"add_book_assembler","name":"计算书装配器","template":"# 泵功率计算书\\n\\n{section1}\\n\\n{section2}","inputs":[{"key":"section1","label":"输入参数章节"},{"key":"section2","label":"计算结果章节"}]},{"type":"auto_connect_fields"}]}',
      '如果需要把平台字段生成计算书参数表章节，可以输出 Field Table：',
      '{"actions":[{"type":"add_field_table_node","name":"参数表","fields":["rho","Q","H","eta"],"outputKey":"parameterTable","outputLabel":"参数表"},{"type":"auto_connect_fields"}]}',
      '如果用户要求从零开始搭建可交付的计算书骨架，优先输出：',
      '{"actions":[{"type":"build_delivery_scaffold","title":"工程计算书","fields":["rho","Q","H","eta"]}]}',
      '如果需要从平台资源库创建电池，也可以输出：',
      '{"actions":[{"type":"add_resource_node","resourceType":"dictionary|table|coolprop|project_context|platform_return|dev_assistant","code":"资源编码","key":"查询键","name":"节点名称"},{"type":"auto_connect_fields"}]}',
      '如果用户要求把画布接入项目、WBS、计算书编号、文控目标等平台上下文，优先输出：',
      '{"actions":[{"type":"add_resource_node","resourceType":"project_context","name":"项目上下文"},{"type":"auto_connect_fields"}]}',
      '如果用户提到 NextChat、Cline、opencode、AI 开发助手、代码审查助手或想把当前画布打包给外部 AI 工具，优先输出：',
      '{"actions":[{"type":"add_resource_node","resourceType":"dev_assistant","code":"Cline / opencode / NextChat","name":"AI 开发助手桥接"},{"type":"auto_connect_fields"}]}',
      '如果需要从平台字段库创建输入参数，可以输出：',
      '{"actions":[{"type":"add_platform_field_inputs","fields":["rho","Q","H","eta"]},{"type":"auto_connect_fields"}]}',
      '平台字段输入会创建 Field Input 电池，保留 key、单位、说明和默认值；不要用普通 Number 代替平台字段。',
      '如果需要修改已有 Field Input 的字段 key、名称、单位、说明或默认值，可以输出：',
      '{"actions":[{"type":"update_field_input_node","nodeId":"节点ID","label":"节点标题","name":"流体密度 rho","fieldKey":"rho","fieldLabel":"流体密度","unit":"kg/m3","discipline":"fluid","description":"计算介质密度","value":1000},{"type":"auto_connect_fields"}]}',
      '如果用户明确要求连接或重接两个已有节点端口，可以输出：',
      '{"actions":[{"type":"connect_nodes","sourceNodeId":"源节点ID","sourceLabel":"源节点标题","sourceOutput":"输出端口key","targetNodeId":"目标节点ID","targetLabel":"目标节点标题","targetInput":"输入端口key","variableName":"可选字段名","auto":false}]}',
      '如果用户要求断开某个输入端口，可以输出：',
      '{"actions":[{"type":"disconnect_node_input","targetNodeId":"目标节点ID","targetLabel":"目标节点标题","targetInput":"输入端口key"}]}',
      '如果用户要求重命名或删除明确目标节点，可以输出：',
      '{"actions":[{"type":"rename_node","nodeId":"节点ID","label":"旧标题","name":"新标题"},{"type":"delete_node","nodeId":"节点ID","label":"节点标题"}]}',
      '如果用户要求整理、排版、自动布局或让画布更清晰，可以输出：',
      '{"actions":[{"type":"auto_layout_canvas"}]}',
      '如果需要使用平台算子引擎中的原生 Python 算子，可以输出：',
      '{"actions":[{"type":"add_operator_node","code":"pump_power|pipe_pressure_drop","name":"可选节点名称"}]}',
      '如果用户要求把当前自定义 Python 电池发布/沉淀为平台算子，可以输出：',
      '{"actions":[{"type":"publish_selected_python_operator"}]}',
      '如果用户要求审核或正式发布当前平台算子，可以输出：',
      '{"actions":[{"type":"audit_selected_platform_operator"}]}',
      '如果用户要求检查当前画布是否可以回传、发布、生成计算书或做交付审查，可以输出：',
      '{"actions":[{"type":"audit_canvas"}]}',
      '如果用户想从计算书模板开始，可以输出：',
      '{"actions":[{"type":"apply_calculation_template","code":"pump-power-book-sections|pump-power-latex|pipe-pressure-drop"}]}',
      '如果用户要求把当前画布沉淀、保存或发布为可复用计算书模板，可以输出：',
      '{"actions":[{"type":"publish_calculation_template","name":"模板名称","description":"模板说明","discipline":"fluid","tags":["AI编排","计算书模板"]}]}',
      '如果用户要求把当前画布、计算链或电池组转换/封装为原生 Python 内核，可以输出：',
      '{"actions":[{"type":"pythonize_canvas"}]}',
      '如果用户要求把当前选中的 Formula Cell 或公式电池转换为原生 Python 电池，可以输出：',
      '{"actions":[{"type":"convert_selected_formula_to_python"}]}',
      '如果用户要求把当前画布中所有 Formula Cell、LaTeX 公式电池或公式节点都转换为原生 Python 电池，可以输出：',
      '{"actions":[{"type":"convert_all_formulas_to_python"}]}',
      '如果用户要求把当前画布先转换为原生 Python 内核并沉淀/发布为平台算子，可以输出：',
      '{"actions":[{"type":"pythonize_and_publish_operator"}]}',
      '如果用户要求把当前画布转换为原生 Python 内核、发布为平台算子，并立即审核/正式发布，可以输出：',
      '{"actions":[{"type":"pythonize_publish_audit_operator"}]}',
      '如果需要把当前画布成果回传为计算书草稿、触发平台 AI 审核，并同步到进度计划/文控，可以输出：',
      '{"actions":[{"type":"submit_audit_sync_calculation_book","title":"泵计算书草稿"}]}',
      '如果用户明确只要求单独生成、审核或同步草稿，也可以分别输出 submit_calculation_book_draft、audit_calculation_book_draft、sync_calculation_book_draft。',
      '如果需要编辑现有画布，可以输出：',
      '{"actions":[{"type":"set_node_variable","nodeId":"节点ID","label":"节点标题","variableName":"字段名"},{"type":"update_python_node","nodeId":"节点ID","label":"节点标题","name":"新标题","code":"Python代码","inputs":[{"key":"x","label":"x"}],"outputs":[{"key":"y","label":"y"}]}]}',
      '{"actions":[{"type":"update_formula_node","nodeId":"节点ID","label":"节点标题","name":"公式名称","latex":"LaTeX","expression":"Python表达式","inputs":[{"key":"x","label":"x"}],"outputKey":"result","outputLabel":"Result"}]}',
      '{"actions":[{"type":"update_report_node","nodeId":"节点ID","label":"Report","name":"Report","template":"模板文本，使用 {变量名} 占位","inputs":[{"key":"变量名","label":"变量名"}]}]}',
      '当 nodeId 可从画布摘要中获得时优先使用 nodeId；否则使用 label 或当前选中节点。',
      'Python 代码中输入变量名必须等于 inputs.key，输出变量名必须等于 outputs.key。',
      '不要输出会访问文件、网络、系统命令的 Python 代码。',
    ].join('\n')

    const deepseekRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `当前画布摘要：\n${JSON.stringify(canvas ?? {}, null, 2)}` },
          ...safeMessages,
        ],
        stream: false,
        thinking: { type: 'disabled' },
        temperature: 0.2,
        max_tokens: 1800,
      }),
    })

    if (!deepseekRes.ok) {
      const text = await deepseekRes.text()
      res.status(deepseekRes.status).json({ error: text || 'DeepSeek request failed' })
      return
    }

    const data = await deepseekRes.json() as {
      choices?: Array<{ message?: { content?: string } }>
      usage?: unknown
      model?: string
    }
    const content = data.choices?.[0]?.message?.content || ''

    res.json({
      content,
      model: data.model,
      usage: data.usage,
    })
  } catch (error) {
    next(error)
  }
})

app.get('/api/platform/project-context', (_req: Request, res: Response) => {
  res.json({
    projectId: 'demo-project',
    projectName: '示例工程项目',
    calculationBookId: 'calcbook-demo',
    wbsCode: 'WBS-PIPE-001',
    documentControl: {
      enabled: true,
      returnTargets: ['calculation-book', 'progress-plan', 'document-control'],
    },
  })
})

app.get('/api/platform/fields', (_req: Request, res: Response) => {
  res.json(platformFields)
})

app.get('/api/platform/calculation-book-templates', (_req: Request, res: Response) => {
  res.json(calculationBookTemplates.map(templateSummary))
})

app.post('/api/platform/calculation-book-templates', (req: Request, res: Response) => {
  const body = req.body as {
    name?: unknown
    description?: unknown
    discipline?: unknown
    tags?: unknown
    graph?: unknown
  }
  const name = typeof body.name === 'string' && body.name.trim()
    ? body.name.trim()
    : '可视化计算书模板'
  if (!isSavedGraphLike(body.graph)) {
    res.status(400).json({ error: 'graph with nodes and connections is required' })
    return
  }

  const template = {
    code: uniqueTemplateCode(slugifyTemplateCode(name)),
    name,
    discipline: typeof body.discipline === 'string' && body.discipline.trim() ? body.discipline.trim() : 'custom',
    description: typeof body.description === 'string' && body.description.trim()
      ? body.description.trim()
      : `由可视化画布发布，包含 ${body.graph.nodes.length} 个节点和 ${body.graph.connections.length} 条连线。`,
    tags: Array.isArray(body.tags)
      ? body.tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 8)
      : ['AI编排', '自定义模板'],
    graph: body.graph,
  }
  calculationBookTemplates.unshift(template)
  res.status(201).json(templateSummary(template))
})

app.get('/api/platform/calculation-book-templates/:code', (req: Request, res: Response) => {
  const template = calculationBookTemplates.find((item) => item.code === req.params.code)
  if (!template) {
    res.status(404).json({ error: 'template not found' })
    return
  }
  res.json(template)
})

app.get('/api/platform/resources/dictionaries', (_req: Request, res: Response) => {
  res.json(platformDictionaries.map(({ rows, ...dict }) => ({
    ...dict,
    size: rows.length,
  })))
})

app.get('/api/platform/resources/dictionaries/:code/lookup', (req: Request, res: Response) => {
  const dict = platformDictionaries.find((item) => item.code === req.params.code)
  if (!dict) {
    res.status(404).json({ error: 'dictionary not found' })
    return
  }

  const key = typeof req.query.key === 'string' ? req.query.key : dict.rows[0]?.key
  const row = dict.rows.find((item) => item.key === key) || dict.rows[0]
  res.json({
    code: dict.code,
    name: dict.name,
    key: row.key,
    label: row.label,
    value: row.value,
    unit: dict.unit,
    source: 'platform-dictionary',
  })
})

app.get('/api/platform/resources/tables', (_req: Request, res: Response) => {
  res.json(platformTables.map(({ rows, ...table }) => ({
    ...table,
    size: rows.length,
  })))
})

app.get('/api/platform/resources/tables/:code/lookup', (req: Request, res: Response) => {
  const table = platformTables.find((item) => item.code === req.params.code)
  if (!table) {
    res.status(404).json({ error: 'table not found' })
    return
  }

  const x = typeof req.query.x === 'string' ? Number(req.query.x) : 20
  const value = interpolateTable(table.rows, table.axis, Number.isFinite(x) ? x : 20)
  res.json({
    code: table.code,
    name: table.name,
    axis: table.axis,
    x,
    value,
    unit: table.unit,
    source: 'platform-engineering-table',
  })
})

app.get('/api/platform/resources/coolprop/props', (req: Request, res: Response) => {
  const temperature = typeof req.query.temperature === 'string' ? Number(req.query.temperature) : 20
  const pressure = typeof req.query.pressure === 'string' ? Number(req.query.pressure) : 101325
  const density = interpolateTable(platformTables[0].rows, 'temperature', Number.isFinite(temperature) ? temperature : 20)
  const viscosity = interpolateTable(platformTables[1].rows, 'temperature', Number.isFinite(temperature) ? temperature : 20)
  res.json({
    fluid: typeof req.query.fluid === 'string' ? req.query.fluid : 'Water',
    temperature,
    pressure,
    rho: density,
    mu: viscosity,
    source: 'platform-coolprop-adapter',
  })
})

app.get('/api/platform/resources/operators', (_req: Request, res: Response) => {
  res.json(platformOperators.map(({ sourceCode, testCase, description, ...operator }) => ({
    ...operator,
    description,
    hasSource: Boolean(sourceCode),
    hasTestCase: Boolean(testCase),
  })))
})

app.get('/api/platform/resources/operators/:code', (req: Request, res: Response) => {
  const operator = platformOperators.find((item) => item.code === req.params.code)
  if (!operator) {
    res.status(404).json({ error: 'operator not found' })
    return
  }
  res.json(operator)
})

app.post('/api/platform/resources/operators', (req: Request, res: Response) => {
  const { name, code, sourceCode, inputs, outputs, description, testCase } = req.body as {
    name?: unknown
    code?: unknown
    sourceCode?: unknown
    inputs?: unknown
    outputs?: unknown
    description?: unknown
    testCase?: unknown
  }

  if (typeof sourceCode !== 'string' || !sourceCode.trim()) {
    res.status(400).json({ error: 'sourceCode is required' })
    return
  }
  if (!Array.isArray(inputs) || !Array.isArray(outputs)) {
    res.status(400).json({ error: 'inputs and outputs are required' })
    return
  }
  const safetyIssues = validatePythonSafety(sourceCode)
  if (safetyIssues.length > 0) {
    res.status(400).json({
      error: 'Python source violates sandbox policy',
      issues: safetyIssues,
    })
    return
  }

  const rawName = typeof name === 'string' && name.trim() ? name.trim() : '自定义 Python 算子'
  const baseCode = typeof code === 'string' && code.trim()
    ? code.trim()
    : rawName.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'custom_operator'
  let nextCode = baseCode
  let index = 2
  while (platformOperators.some((item) => item.code === nextCode)) {
    nextCode = `${baseCode}_${index++}`
  }

  const operator: PlatformOperator = {
    code: nextCode,
    name: rawName,
    language: 'python',
    version: '0.1.0',
    inputs: inputs.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).slice(0, 16),
    outputs: outputs.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).slice(0, 16),
    status: 'draft',
    description: typeof description === 'string' ? description.slice(0, 300) : '由可视化编程平台发布的自定义 Python 电池。',
    sourceCode,
    testCase: isOperatorTestCase(testCase) ? testCase : undefined,
    publishedAt: new Date().toISOString(),
  }

  platformOperators.unshift(operator)
  res.status(201).json(operator)
})

app.post('/api/platform/resources/operators/:code/audit', (req: Request, res: Response) => {
  const operator = platformOperators.find((item) => item.code === req.params.code)
  if (!operator) {
    res.status(404).json({ error: 'operator not found' })
    return
  }

  const suggestions: string[] = []
  if (!operator.sourceCode.trim()) suggestions.push('算子源码为空。')
  if (operator.inputs.length === 0) suggestions.push('缺少输入端口定义。')
  if (operator.outputs.length === 0) suggestions.push('缺少输出端口定义。')
  if (!operator.testCase) {
    suggestions.push('缺少测试用例，建议在画布执行成功后重新发布。')
  } else {
    const missingInputs = operator.inputs.filter((key) => !(key in operator.testCase!.inputs))
    const missingOutputs = operator.outputs.filter((key) => !(key in operator.testCase!.expected))
    if (missingInputs.length > 0) suggestions.push(`测试用例缺少输入：${missingInputs.join(', ')}。`)
    if (missingOutputs.length > 0) suggestions.push(`测试用例缺少期望输出：${missingOutputs.join(', ')}。`)
  }
  const safetyIssues = validatePythonSafety(operator.sourceCode)
  if (safetyIssues.length === 0) {
    suggestions.push('未发现文件、系统命令或网络访问风险。')
  } else {
    suggestions.push(`源码包含受限 Python 能力：${safetyIssues.map((issue) => `${issue.token}（${issue.reason}）`).join('、')}。`)
  }

  const riskSuggestions = suggestions.filter((item) => !item.includes('未发现'))
  const audit = {
    score: Math.max(50, 100 - riskSuggestions.length * 18),
    status: riskSuggestions.length === 0 ? 'pass' : 'needs-review',
    suggestions,
    auditedAt: new Date().toISOString(),
  }
  operator.audit = audit
  operator.status = audit.status === 'pass' ? 'published' : 'review-required'
  if (operator.status === 'published') operator.publishedAt = audit.auditedAt
  res.json(operator)
})

app.post('/api/platform/results/submit', (req: Request, res: Response) => {
  const { title, report, graph, results } = req.body as {
    title?: unknown
    report?: unknown
    graph?: unknown
    results?: unknown
  }
  const receipt = {
    receiptId: `receipt-${Date.now()}`,
    title: typeof title === 'string' ? title : '可视化计算结果',
    reportPreview: typeof report === 'string' ? report.slice(0, 200) : '',
    graphAttached: Boolean(graph),
    resultKeys: getResultKeys(results),
    resultPreview: getBusinessResultPreview(results),
    structuredResultCount: getBusinessResultKeys(results).length,
    traceCount: getTraceCount(results),
    returnedTo: ['calculation-book', 'progress-plan', 'document-control'],
    createdAt: new Date().toISOString(),
  }
  platformResultReceipts.unshift(receipt)
  res.status(201).json({
    ok: true,
    ...receipt,
  })
})

app.get('/api/platform/results/receipts', (_req: Request, res: Response) => {
  res.json(platformResultReceipts)
})

app.post('/api/platform/calculation-books/run', (req: Request, res: Response) => {
  const { inputs, graph } = req.body as { inputs?: unknown; graph?: unknown }
  res.json({
    ok: true,
    mode: 'external-api',
    html: '<h1>计算书运行结果</h1><p>外部平台已提交参数，可视化编排图已接收。</p>',
    inputs: inputs ?? {},
    graphReceived: Boolean(graph),
  })
})

app.get('/api/platform/calculation-books/drafts', (_req: Request, res: Response) => {
  res.json(calculationBookDrafts)
})

app.post('/api/platform/calculation-books/drafts', (req: Request, res: Response) => {
  const { title, report, graph, results, wbsCode } = req.body as {
    title?: unknown
    report?: unknown
    graph?: unknown
    results?: unknown
    wbsCode?: unknown
  }
  const version = calculationBookDrafts.length + 1
  const draft = {
    id: `draft-${Date.now()}`,
    title: typeof title === 'string' && title.trim() ? title.trim() : '可视化编程计算书',
    version,
    status: 'draft',
    wbsCode: typeof wbsCode === 'string' && wbsCode.trim() ? wbsCode.trim() : 'WBS-PIPE-001',
    reportPreview: typeof report === 'string' ? report.slice(0, 300) : '',
    graphAttached: Boolean(graph),
    resultKeys: getResultKeys(results),
    resultPreview: getBusinessResultPreview(results),
    structuredResultCount: getBusinessResultKeys(results).length,
    traceCount: getTraceCount(results),
    nextActions: ['ai-audit', 'submit-review', 'sync-progress-plan', 'return-document-control'],
    createdAt: new Date().toISOString(),
  }
  calculationBookDrafts.unshift(draft)
  res.status(201).json(draft)
})

app.post('/api/platform/calculation-books/drafts/:id/audit', (req: Request, res: Response) => {
  const draft = calculationBookDrafts.find((item) => item.id === req.params.id)
  if (!draft) {
    res.status(404).json({ error: 'draft not found' })
    return
  }

  const suggestions: string[] = []
  if (!draft.reportPreview) suggestions.push('计算书报告正文为空，建议连接 Report 电池后再提交。')
  if (!draft.graphAttached) suggestions.push('未附加画布 Graph，后续无法追溯计算逻辑。')
  if (draft.structuredResultCount === 0) suggestions.push('未收到结构化结果字段，建议为关键输出设置变量名后回传。')
  if (draft.traceCount === 0) suggestions.push('未收到字段级溯源，建议先执行画布再提交。')
  if (!/P_shaft|pshaft|轴功率|功率/i.test(draft.reportPreview)) {
    suggestions.push('报告中未识别到关键功率结果，建议补充主要输出变量。')
  }
  if (suggestions.length === 0) suggestions.push('报告、图谱和关键结果齐备，可进入人工复核。')

  const audit = {
    score: Math.max(60, 100 - Math.max(0, suggestions.length - 1) * 15),
    status: suggestions.length <= 1 ? 'pass' : 'needs-review',
    suggestions,
  }
  draft.audit = audit
  draft.status = audit.status === 'pass' ? 'audited' : 'review-required'
  res.json({ ...draft, audit })
})

app.post('/api/platform/calculation-books/drafts/:id/sync', (req: Request, res: Response) => {
  const draft = calculationBookDrafts.find((item) => item.id === req.params.id)
  if (!draft) {
    res.status(404).json({ error: 'draft not found' })
    return
  }

  draft.syncStatus = {
    progressPlan: `已同步 WBS ${draft.wbsCode} 的计算完成状态`,
    documentControl: `已回写计算书 ${draft.title} v${draft.version}`,
    syncedAt: new Date().toISOString(),
  }
  draft.status = draft.audit?.status === 'pass' ? 'synced' : 'sync-pending-review'
  res.json(draft)
})

app.get('/api/projects', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    res.json(projects)
  } catch (error) {
    next(error)
  }
})

app.post('/api/projects', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, graphJson } = req.body as { name?: unknown; graphJson?: unknown }
    if (typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'name is required' })
      return
    }

    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        graphJson: toJsonValue(graphJson),
      },
    })
    res.status(201).json(project)
  } catch (error) {
    next(error)
  }
})

app.get('/api/projects/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await prisma.project.findUnique({ where: { id: getId(req) } })
    if (!project) {
      res.status(404).json({ error: 'project not found' })
      return
    }
    res.json(project)
  } catch (error) {
    next(error)
  }
})

app.put('/api/projects/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, graphJson } = req.body as { name?: unknown; graphJson?: unknown }
    const data: Prisma.ProjectUpdateInput = {}
    if (typeof name === 'string' && name.trim()) data.name = name.trim()
    if (graphJson !== undefined) data.graphJson = toJsonValue(graphJson)

    const project = await prisma.project.update({
      where: { id: getId(req) },
      data,
    })
    res.json(project)
  } catch (error) {
    next(error)
  }
})

app.delete('/api/projects/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.project.delete({ where: { id: getId(req) } })
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

app.get('/api/components/files', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const files = await prisma.componentFile.findMany({
      orderBy: { path: 'asc' },
      select: {
        id: true,
        path: true,
        name: true,
        category: true,
        summary: true,
        updatedAt: true,
      },
    })
    res.json(files)
  } catch (error) {
    next(error)
  }
})

app.get('/api/components/search', async (req: Request, res: Response, next: NextFunction) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  try {
    if (!q) {
      res.json([])
      return
    }

    const files = await prisma.componentFile.findMany({
      where: {
        OR: [
          { path: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { category: { contains: q, mode: 'insensitive' } },
          { summary: { contains: q, mode: 'insensitive' } },
          { content: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ category: 'asc' }, { path: 'asc' }],
      take: 20,
      select: {
        id: true,
        path: true,
        name: true,
        category: true,
        summary: true,
        updatedAt: true,
      },
    })

    res.json(files)
  } catch (error) {
    try {
      res.json(await fallbackSearchComponentFiles(q))
    } catch {
      next(error)
    }
  }
})

app.get('/api/components/chunks/search', async (req: Request, res: Response, next: NextFunction) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  try {
    if (!q) {
      res.json([])
      return
    }

    const chunks = await prisma.componentChunk.findMany({
      where: {
        content: { contains: q, mode: 'insensitive' },
      },
      orderBy: [{ fileId: 'asc' }, { chunkIndex: 'asc' }],
      take: 20,
      include: {
        file: {
          select: {
            path: true,
            name: true,
            category: true,
            summary: true,
          },
        },
      },
    })

    res.json(chunks)
  } catch (error) {
    try {
      const files = await fallbackSearchComponentFiles(q)
      res.json(files.map((file, index) => ({
        id: `fallback-chunk:${file.path}`,
        fileId: file.id,
        chunkIndex: index,
        heading: file.name,
        content: file.summary,
        file,
      })))
    } catch {
      next(error)
    }
  }
})

app.get('/api/components/files/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = await prisma.componentFile.findUnique({
      where: { id: getId(req) },
      include: { chunks: { orderBy: { chunkIndex: 'asc' } } },
    })
    if (!file) {
      res.status(404).json({ error: 'component file not found' })
      return
    }
    res.json(file)
  } catch (error) {
    next(error)
  }
})

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error)
  res.status(500).json({ error: 'internal server error' })
})

const server = app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`)
})

async function shutdown() {
  server.close()
  await closeDb()
  process.exit(0)
}

process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())
