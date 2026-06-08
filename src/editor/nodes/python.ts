import { ClassicPreset } from 'rete'
import { GHNode, getSocket } from './base'
import { getPyodide } from '../pyodide'

export type PyPortConfig = {
  key: string
  label: string
  type: 'number'
}

export type PythonSafetyIssue = {
  token: string
  reason: string
}

export type PythonTestCase = {
  inputs: Record<string, number>
  expected: Record<string, number>
}

export type PythonTestStatus = {
  status: 'pass' | 'fail' | 'not-run'
  summary: string
  checkedAt?: string
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

export function validatePythonSafety(code: string): PythonSafetyIssue[] {
  return forbiddenPythonPatterns
    .filter((item) => item.pattern.test(code))
    .map(({ token, reason }) => ({ token, reason }))
}

export class PythonScriptNode extends GHNode {
  category = 'Script'
  mergedGraph?: unknown
  mergedGraphLabel?: string
  mergedBoundary?: {
    inputs: Record<string, { target: string; targetInput: string }>
    outputs: Record<string, { source: string; sourceOutput: string }>
  }
  platformOperator?: {
    code: string
    name: string
    version: string
    status: string
    description?: string
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
  }
  testCase?: PythonTestCase
  testStatus?: PythonTestStatus
  code = `import math

# Grasshopper Python Script
# ghenv.Component.Name = "Python Script"
# RunMode: 0=Automatic, 1=Manual

# Unconnected inputs are None in GH style
if x is None: x = 0
if y is None: y = 0
if z is None: z = 0

a = x + y + z
`
  inputConfigs: PyPortConfig[] = [
    { key: 'x', label: 'x', type: 'number' },
    { key: 'y', label: 'y', type: 'number' },
    { key: 'z', label: 'z', type: 'number' },
  ]
  outputConfigs: PyPortConfig[] = [
    { key: 'a', label: 'a', type: 'number' },
  ]

  constructor() {
    super('Python Script')
    this.width = 180
    this.height = 100
    this.rebuildPorts()
  }

  rebuildPorts() {
    for (const key of Object.keys(this.inputs)) {
      this.removeInput(key)
    }
    for (const key of Object.keys(this.outputs)) {
      this.removeOutput(key)
    }
    for (const cfg of this.inputConfigs) {
      this.addInput(cfg.key, new ClassicPreset.Input(getSocket('number'), cfg.label))
    }
    for (const cfg of this.outputConfigs) {
      this.addOutput(cfg.key, new ClassicPreset.Output(getSocket('number'), cfg.label))
    }
    this.inputAliases = Object.fromEntries(
      this.inputConfigs.map((cfg) => [cfg.key, [cfg.key, cfg.label]])
    )
    this.outputAliases = Object.fromEntries(
      this.outputConfigs.map((cfg) => [cfg.key, [cfg.key, cfg.label]])
    )
  }

  async execute(inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
    const safetyIssues = validatePythonSafety(this.code)
    if (safetyIssues.length > 0) {
      this.display = [
        '✗ Python sandbox blocked',
        ...safetyIssues.map((issue) => `${issue.token}: ${issue.reason}`),
      ].join('\n')
      const out: Record<string, unknown> = {}
      for (const cfg of this.outputConfigs) out[cfg.key] = 0
      return out
    }

    const py = getPyodide()
    if (!py) {
      this.display = '⚠ Python not loaded\nClick Retry in top bar'
      const out: Record<string, unknown> = {}
      for (const cfg of this.outputConfigs) out[cfg.key] = 0
      return out
    }

    try {
      // Build ghenv object (Grasshopper-style environment)
      const ghenv = {
        Component: {
          Name: this.label,
          NickName: this.label,
          RunMode: 0,
        },
      }
      py.globals.set('ghenv', ghenv)

      // Inject inputs (Grasshopper style: None if not connected)
      for (const cfg of this.inputConfigs) {
        const val = inputs[cfg.key]
        if (val === undefined || val === null) {
          py.globals.set(cfg.key, py.globals.get('None'))
        } else {
          py.globals.set(cfg.key, val as number)
        }
      }

      await py.runPythonAsync(this.code)

      // Read outputs
      const result: Record<string, unknown> = {}
      let displayLines: string[] = ['✓ GH Python OK']
      for (const cfg of this.outputConfigs) {
        const val = py.globals.get(cfg.key)
        const num = val === py.globals.get('None') ? 0 : (typeof val === 'number' ? val : Number(val) || 0)
        result[cfg.key] = num
        displayLines.push(`${cfg.label} = ${num}`)
      }
      this.display = displayLines.join('\n')
      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.display = `✗ Error:\n${msg}`
      const out: Record<string, unknown> = {}
      for (const cfg of this.outputConfigs) out[cfg.key] = 0
      return out
    }
  }
}
