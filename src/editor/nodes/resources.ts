import { ClassicPreset } from 'rete'
import { GHNode, getSocket } from './base'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

type LookupResponse = {
  value?: unknown
  label?: unknown
  key?: unknown
  unit?: unknown
  source?: unknown
}

type CoolPropResponse = {
  rho?: unknown
  mu?: unknown
  fluid?: unknown
  source?: unknown
}

type ProjectContextResponse = {
  projectName?: unknown
  projectCode?: unknown
  wbsCode?: unknown
  calculationBookId?: unknown
  currentUser?: unknown
  documentControl?: {
    returnTargets?: unknown
  }
}

type SubmitResponse = {
  ok?: unknown
  receiptId?: unknown
  returnedTo?: unknown
  graphAttached?: unknown
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(await res.text())
  return await res.json() as T
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return await res.json() as T
}

function valueAsText(value: unknown, fallback: string) {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
}

function valueAsNumber(value: unknown, fallback = 0) {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : fallback
}

export class DictionaryLookupNode extends GHNode {
  category = 'Resources'
  codeControl: ClassicPreset.InputControl<'text'>
  keyControl: ClassicPreset.InputControl<'text'>

  constructor(dictionaryCode = 'pipe_material', defaultKey = '碳钢') {
    super('Dictionary Lookup')
    this.codeControl = new ClassicPreset.InputControl('text', { initial: dictionaryCode })
    this.keyControl = new ClassicPreset.InputControl('text', { initial: defaultKey })
    this.width = 210
    this.inputAliases = { key: ['key', 'dict_key', 'dictionary_key'] }
    this.outputAliases = { value: [dictionaryCode, defaultKey] }

    this.addInput('key', new ClassicPreset.Input(getSocket('generic'), 'Key'))
    this.addOutput('value', new ClassicPreset.Output(getSocket('number'), 'Value'))
    this.addOutput('label', new ClassicPreset.Output(getSocket('generic'), 'Label'))
    this.addControl('dictionaryCode', this.codeControl)
    this.addControl('defaultKey', this.keyControl)
  }

  async execute(inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
    try {
      const dictionaryCode = valueAsText(this.codeControl.value, 'pipe_material')
      const defaultKey = valueAsText(this.keyControl.value, '碳钢')
      const key = valueAsText(inputs.key, defaultKey)
      this.outputAliases = { value: [dictionaryCode, key], label: [key] }
      const data = await apiGet<LookupResponse>(
        `/api/platform/resources/dictionaries/${encodeURIComponent(dictionaryCode)}/lookup?key=${encodeURIComponent(key)}`
      )
      const value = valueAsNumber(data.value)
      const label = valueAsText(data.label, key)
      this.display = `${dictionaryCode}\n${label} = ${value} ${valueAsText(data.unit, '')}`
      return { value, label }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.display = `资源读取失败\n${message}`
      return { value: 0, label: valueAsText(this.keyControl.value, '碳钢') }
    }
  }
}

export class TableLookupNode extends GHNode {
  category = 'Resources'
  codeControl: ClassicPreset.InputControl<'text'>

  constructor(tableCode = 'water_density') {
    super('Table Lookup')
    this.codeControl = new ClassicPreset.InputControl('text', { initial: tableCode })
    this.width = 210
    this.inputAliases = { x: ['temperature', 'temp', 'T'] }
    this.outputAliases = { value: [tableCode, 'rho', 'mu'] }

    this.addInput('x', new ClassicPreset.Input(getSocket('number'), 'X'))
    this.addOutput('value', new ClassicPreset.Output(getSocket('number'), 'Value'))
    this.addOutput('source', new ClassicPreset.Output(getSocket('generic'), 'Source'))
    this.addControl('tableCode', this.codeControl)
  }

  async execute(inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
    try {
      const tableCode = valueAsText(this.codeControl.value, 'water_density')
      const x = valueAsNumber(inputs.x, 20)
      this.outputAliases = { value: [tableCode, tableCode.includes('viscosity') ? 'mu' : 'rho'] }
      const data = await apiGet<LookupResponse>(
        `/api/platform/resources/tables/${encodeURIComponent(tableCode)}/lookup?x=${encodeURIComponent(String(x))}`
      )
      const value = valueAsNumber(data.value)
      this.display = `${tableCode}\nX = ${x}\nValue = ${value} ${valueAsText(data.unit, '')}`
      return { value, source: valueAsText(data.source, 'platform-table') }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.display = `资源读取失败\n${message}`
      return { value: 0, source: 'error' }
    }
  }
}

export class CoolPropNode extends GHNode {
  category = 'Resources'
  fluidControl: ClassicPreset.InputControl<'text'>

  constructor(fluid = 'Water') {
    super('CoolProp Props')
    this.fluidControl = new ClassicPreset.InputControl('text', { initial: fluid })
    this.width = 220
    this.inputAliases = {
      temperature: ['temperature', 'temp', 'T'],
      pressure: ['pressure', 'P'],
    }
    this.outputAliases = {
      rho: ['rho', 'density'],
      mu: ['mu', 'viscosity'],
    }

    this.addInput('temperature', new ClassicPreset.Input(getSocket('number'), 'T (°C)'))
    this.addInput('pressure', new ClassicPreset.Input(getSocket('number'), 'P (Pa)'))
    this.addOutput('rho', new ClassicPreset.Output(getSocket('number'), 'ρ (kg/m³)'))
    this.addOutput('mu', new ClassicPreset.Output(getSocket('number'), 'μ (Pa·s)'))
    this.addControl('fluid', this.fluidControl)
  }

  async execute(inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
    try {
      const fluid = valueAsText(this.fluidControl.value, 'Water')
      const temperature = valueAsNumber(inputs.temperature, 20)
      const pressure = valueAsNumber(inputs.pressure, 101325)
      const data = await apiGet<CoolPropResponse>(
        `/api/platform/resources/coolprop/props?fluid=${encodeURIComponent(fluid)}&temperature=${temperature}&pressure=${pressure}`
      )
      const rho = valueAsNumber(data.rho)
      const mu = valueAsNumber(data.mu)
      this.display = `${valueAsText(data.fluid, fluid)}\nrho = ${rho}\nmu = ${mu}`
      return { rho, mu }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.display = `CoolProp 读取失败\n${message}`
      return { rho: 0, mu: 0 }
    }
  }
}

export class ProjectContextNode extends GHNode {
  category = 'Resources'

  constructor() {
    super('Project Context')
    this.width = 230
    this.outputAliases = {
      projectName: ['projectName', 'project_name', 'project'],
      projectCode: ['projectCode', 'project_code'],
      wbsCode: ['wbsCode', 'wbs', 'wbs_code'],
      calculationBookId: ['calculationBookId', 'book_id', 'calculation_book_id'],
      title: ['title', 'calculation_book_title'],
      returnTargets: ['returnTargets', 'targets', 'returnedTo'],
    }

    this.addOutput('projectName', new ClassicPreset.Output(getSocket('generic'), 'Project'))
    this.addOutput('projectCode', new ClassicPreset.Output(getSocket('generic'), 'Code'))
    this.addOutput('wbsCode', new ClassicPreset.Output(getSocket('generic'), 'WBS'))
    this.addOutput('calculationBookId', new ClassicPreset.Output(getSocket('generic'), 'Book ID'))
    this.addOutput('title', new ClassicPreset.Output(getSocket('generic'), 'Title'))
    this.addOutput('returnTargets', new ClassicPreset.Output(getSocket('generic'), 'Targets'))
  }

  async execute(): Promise<Record<string, unknown>> {
    try {
      const data = await apiGet<ProjectContextResponse>('/api/platform/project-context')
      const projectName = valueAsText(data.projectName, '工程项目')
      const projectCode = valueAsText(data.projectCode, 'project')
      const wbsCode = valueAsText(data.wbsCode, 'WBS')
      const calculationBookId = valueAsText(data.calculationBookId, 'calculation-book')
      const returnTargets = Array.isArray(data.documentControl?.returnTargets)
        ? data.documentControl.returnTargets.map((item) => valueAsText(item, '')).filter(Boolean).join(', ')
        : ''
      const title = `${projectName} ${wbsCode} 计算书`
      this.display = `${projectName}\n${wbsCode}\n${returnTargets || '未配置回传目标'}`
      return {
        projectName,
        projectCode,
        wbsCode,
        calculationBookId,
        title,
        returnTargets,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.display = `项目上下文读取失败\n${message}`
      return {
        projectName: '',
        projectCode: '',
        wbsCode: '',
        calculationBookId: '',
        title: '可视化编程计算书',
        returnTargets: '',
      }
    }
  }
}

export class PlatformReturnNode extends GHNode {
  category = 'Resources'

  constructor() {
    super('Platform Return')
    this.width = 220
    this.inputAliases = {
      title: ['title', 'name', 'calculation_book_title'],
      report: ['report', 'text', 'html'],
    }
    this.outputAliases = {
      receipt: ['receipt', 'receiptId'],
      status: ['status', 'ok'],
      targets: ['targets', 'returnedTo'],
    }
    this.addInput('title', new ClassicPreset.Input(getSocket('generic'), 'Title'))
    this.addInput('report', new ClassicPreset.Input(getSocket('generic'), 'Report'))
    this.addOutput('receipt', new ClassicPreset.Output(getSocket('generic'), 'Receipt'))
    this.addOutput('status', new ClassicPreset.Output(getSocket('generic'), 'Status'))
    this.addOutput('targets', new ClassicPreset.Output(getSocket('generic'), 'Targets'))
  }

  async execute(inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
    try {
      const title = valueAsText(inputs.title, '可视化编程计算结果')
      const report = valueAsText(inputs.report, this.findReportText())
      const graph = this.graph
        ? {
            nodes: this.graph.editor.getNodes().map((node) => ({
              id: node.id,
              label: node.label,
              category: node.category,
              field: node.variableName,
            })),
            connections: this.graph.editor.getConnections().map((connection) => ({
              source: connection.source,
              sourceOutput: connection.sourceOutput,
              target: connection.target,
              targetInput: connection.targetInput,
              variableName: connection.variableName,
            })),
          }
        : undefined
      const values: Record<string, unknown> = {}
      const trace = this.graph
        ? this.graph.editor.getNodes().flatMap((node) => {
            if (!node.lastOutputs) return []
            return Object.entries(node.lastOutputs).map(([outputKey, value]) => {
              const aliases = [
                ...(outputKey === 'value' || outputKey === 'result' ? [node.variableName || ''] : []),
                ...(node.outputAliases?.[outputKey] || []),
              ].filter(Boolean)
              const fieldKey = aliases[0] || `${node.label.replace(/[^A-Za-z0-9_]/g, '_')}_${outputKey}`
              if (!(fieldKey in values)) values[fieldKey] = value
              return {
                fieldKey,
                aliases,
                value,
                nodeId: node.id,
                nodeLabel: node.label,
                nodeCategory: node.category,
                outputKey,
                inputs: node.lastInputs || {},
                outputs: node.lastOutputs || {},
                display: node.resultDisplay || node.display || '',
              }
            })
          })
        : []
      const data = await apiPost<SubmitResponse>('/api/platform/results/submit', {
        title,
        report,
        graph,
        results: {
          ...values,
          __trace: trace,
          __report: { length: report.length },
          __generatedAt: new Date().toISOString(),
          title,
        },
      })
      const receipt = valueAsText(data.receiptId, 'submitted')
      const returnedTo = Array.isArray(data.returnedTo) ? data.returnedTo.join(', ') : ''
      const status = data.ok ? 'submitted' : 'pending'
      this.display = `已回传平台\n${receipt}\n${returnedTo}\ngraph=${data.graphAttached ? 'yes' : 'no'}`
      return { receipt, status, targets: returnedTo }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.display = `回传失败\n${message}`
      return { receipt: 'failed', status: 'failed', targets: '' }
    }
  }

  private findReportText() {
    const nodes = this.graph?.editor.getNodes() || []
    const reportNode = nodes.find((node) =>
      node.label === 'Book Assembler' &&
      'template' in node &&
      'inputConfigs' in node &&
      typeof node.display === 'string' &&
      node.display.trim()
    ) || nodes.find((node) =>
      node.label === 'Report' &&
      'template' in node &&
      'inputConfigs' in node &&
      typeof node.display === 'string' &&
      node.display.trim()
    )
    return reportNode?.display || ''
  }
}

export class DevAssistantBridgeNode extends GHNode {
  category = 'Resources'
  targetControl: ClassicPreset.InputControl<'text'>

  constructor(target = 'Cline / opencode / NextChat') {
    super('AI Dev Bridge')
    this.width = 250
    this.targetControl = new ClassicPreset.InputControl('text', { initial: target })
    this.inputAliases = {
      task: ['task', 'prompt', 'request'],
      report: ['report', 'calculation_book', 'book'],
    }
    this.outputAliases = {
      prompt: ['prompt', 'ai_dev_prompt'],
      contextJson: ['context', 'graph_context'],
      target: ['target', 'assistant'],
    }

    this.addInput('task', new ClassicPreset.Input(getSocket('generic'), 'Task'))
    this.addInput('report', new ClassicPreset.Input(getSocket('generic'), 'Report'))
    this.addOutput('prompt', new ClassicPreset.Output(getSocket('generic'), 'Prompt'))
    this.addOutput('contextJson', new ClassicPreset.Output(getSocket('generic'), 'Context JSON'))
    this.addOutput('target', new ClassicPreset.Output(getSocket('generic'), 'Target'))
    this.addControl('target', this.targetControl)
  }

  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const target = valueAsText(this.targetControl.value, 'Cline / opencode / NextChat')
    const task = valueAsText(inputs.task, '请基于当前可视化计算书画布，生成可执行的工程计算改进建议或代码修改计划。')
    const report = valueAsText(inputs.report, this.findReportText())
    const context = this.collectGraphContext()
    const contextJson = JSON.stringify(context, null, 2)
    const prompt = [
      `# ${target} 任务包`,
      '',
      '## 任务',
      task,
      '',
      '## 当前计算书',
      report || '当前画布尚未生成计算书正文。',
      '',
      '## 画布上下文 JSON',
      '```json',
      contextJson,
      '```',
      '',
      '## 输出要求',
      '- 优先给出可落地的代码或节点编排修改。',
      '- 保留字段名、单位、公式来源和平台回传链路。',
      '- 对 Python 电池说明输入、输出、测试用例和安全限制。',
    ].join('\n')

    this.display = [
      `目标助手：${target}`,
      `节点：${context.nodes.length}`,
      `连线：${context.connections.length}`,
      `字段：${context.fields.length}`,
      `任务包：${prompt.length} 字符`,
    ].join('\n')

    return { prompt, contextJson, target }
  }

  private collectGraphContext() {
    const nodes = this.graph?.editor.getNodes() || []
    const connections = this.graph?.editor.getConnections() || []
    return {
      generatedAt: new Date().toISOString(),
      nodes: nodes.map((node) => ({
        id: node.id,
        label: node.label,
        category: node.category,
        field: node.variableName,
        inputs: Object.keys(node.inputs),
        outputs: Object.keys(node.outputs),
        display: node.resultDisplay || node.display || '',
      })),
      connections: connections.map((connection) => ({
        source: connection.source,
        sourceOutput: connection.sourceOutput,
        target: connection.target,
        targetInput: connection.targetInput,
        variableName: connection.variableName,
        auto: Boolean(connection.isAutoVariable),
      })),
      fields: nodes.flatMap((node) => Object.entries(node.outputAliases || {}).flatMap(([outputKey, aliases]) =>
        aliases.map((field) => ({
          field,
          nodeId: node.id,
          nodeLabel: node.label,
          outputKey,
        }))
      )),
      terminalReports: nodes
        .filter((node) => (
          (node.label === 'Report' || node.label === 'Book Assembler') &&
          typeof node.display === 'string' &&
          node.display.trim()
        ))
        .map((node) => ({
          id: node.id,
          label: node.label,
          text: node.display,
        })),
    }
  }

  private findReportText() {
    const nodes = this.graph?.editor.getNodes() || []
    const reportNode = nodes.find((node) =>
      node.label === 'Book Assembler' &&
      typeof node.display === 'string' &&
      node.display.trim()
    ) || nodes.find((node) =>
      node.label === 'Report' &&
      typeof node.display === 'string' &&
      node.display.trim()
    )
    return reportNode?.display || ''
  }
}
