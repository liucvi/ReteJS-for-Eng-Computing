import { ClassicPreset } from 'rete'
import { GHNode, getSocket } from './base'

export type ReportPortConfig = {
  key: string
  label: string
  unit?: string
  description?: string
}

export class ReportNode extends GHNode {
  category = 'Params'
  width = 280
  height = 120

  inputConfigs: ReportPortConfig[] = []
  template = ''

  constructor() {
    super('Report')
    this.rebuildPorts()
  }

  rebuildPorts() {
    for (const key of Object.keys(this.inputs)) {
      this.removeInput(key)
    }
    for (const cfg of this.inputConfigs) {
      this.addInput(cfg.key, new ClassicPreset.Input(getSocket('number'), cfg.label))
    }
  }

  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    let text = this.template

    // Replace {key} placeholders with values
    for (const cfg of this.inputConfigs) {
      const val = inputs[cfg.key]
      const formatted = formatValue(val)
      text = text.replace(new RegExp(`\\{${cfg.key}\\}`, 'g'), formatted)
    }

    // Clean up unused placeholders
    text = text.replace(/\{\w+\}/g, 'N/A')

    this.display = text || '(No template set. Double-click to edit.)'
    return {}
  }
}

export class BookSectionNode extends GHNode {
  category = 'Params'
  width = 280
  height = 130

  inputConfigs: ReportPortConfig[] = []
  template = '## 章节标题\n\n- 参数 = {value}\n'
  outputKey = 'section'
  outputLabel = 'Section'

  constructor() {
    super('Book Section')
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
      this.addInput(cfg.key, new ClassicPreset.Input(getSocket('generic'), cfg.label))
    }
    this.addOutput(this.outputKey, new ClassicPreset.Output(getSocket('generic'), this.outputLabel))
    this.outputAliases = {
      ...this.outputAliases,
      [this.outputKey]: [this.outputKey, this.outputLabel, this.label],
    }
  }

  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const text = renderTemplate(this.template, this.inputConfigs, inputs)
    this.display = text || '(No section template set. Double-click to edit.)'
    return { [this.outputKey]: this.display }
  }
}

export class FieldTableNode extends GHNode {
  category = 'Params'
  width = 300
  height = 130

  inputConfigs: ReportPortConfig[] = [
    { key: 'rho', label: '流体密度', unit: 'kg/m3', description: '计算介质密度' },
    { key: 'Q', label: '体积流量', unit: 'm3/s', description: '系统设计流量' },
    { key: 'H', label: '扬程', unit: 'm', description: '设计扬程' },
    { key: 'eta', label: '效率', unit: '%', description: '设备效率' },
  ]
  outputKey = 'parameterTable'
  outputLabel = 'Parameter Table'

  constructor() {
    super('Field Table')
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
      const label = cfg.unit ? `${cfg.label} (${cfg.unit})` : cfg.label
      this.addInput(cfg.key, new ClassicPreset.Input(getSocket('generic'), label))
    }
    this.addOutput(this.outputKey, new ClassicPreset.Output(getSocket('generic'), this.outputLabel))
    this.outputAliases = {
      ...this.outputAliases,
      [this.outputKey]: [this.outputKey, this.outputLabel, '参数表', 'fieldTable'],
    }
  }

  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const rows = this.inputConfigs.map((cfg) => [
      cfg.key,
      cfg.label,
      formatValue(inputs[cfg.key]),
      cfg.unit || '-',
      cfg.description || '-',
    ])
    const table = [
      '## 参数表',
      '',
      '| 字段 | 名称 | 数值 | 单位 | 说明 |',
      '|---|---|---:|---|---|',
      ...rows.map((row) => `| ${row.map(escapeMarkdownCell).join(' | ')} |`),
    ].join('\n')
    this.display = table
    return { [this.outputKey]: table }
  }
}

export class BookAssemblerNode extends GHNode {
  category = 'Params'
  width = 300
  height = 140

  inputConfigs: ReportPortConfig[] = [
    { key: 'section1', label: 'Section 1' },
    { key: 'section2', label: 'Section 2' },
    { key: 'section3', label: 'Section 3' },
  ]
  template = '# 计算书\n\n{section1}\n\n{section2}\n\n{section3}'

  constructor() {
    super('Book Assembler')
    this.rebuildPorts()
  }

  rebuildPorts() {
    for (const key of Object.keys(this.inputs)) {
      this.removeInput(key)
    }
    for (const cfg of this.inputConfigs) {
      this.addInput(cfg.key, new ClassicPreset.Input(getSocket('generic'), cfg.label))
    }
  }

  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    let text = renderTemplate(this.template, this.inputConfigs, inputs)
    const appended = this.inputConfigs
      .map((cfg) => formatValue(inputs[cfg.key]))
      .filter((value) => value && value !== 'N/A')

    if (!this.template.trim() && appended.length > 0) {
      text = appended.join('\n\n')
    }

    this.display = text || '(No assembled sections. Connect Book Section nodes.)'
    return {}
  }
}

function renderTemplate(template: string, configs: ReportPortConfig[], inputs: Record<string, unknown>) {
  let text = template
  for (const cfg of configs) {
    const formatted = formatValue(inputs[cfg.key])
    text = text.replace(new RegExp(`\\{${cfg.key}\\}`, 'g'), formatted)
  }
  return text.replace(/\{\w+\}/g, 'N/A')
}

function formatValue(v: unknown): string {
  if (v === undefined || v === null) return 'N/A'
  if (typeof v === 'number') {
    if (Math.abs(v) >= 10000 || (Math.abs(v) < 0.001 && v !== 0)) {
      return v.toExponential(4)
    }
    return v.toFixed(4).replace(/\.?0+$/, '')
  }
  if (typeof v === 'string') return v
  if (typeof v === 'boolean') return v ? 'True' : 'False'
  if (Array.isArray(v)) return `[${v.map(formatValue).join(', ')}]`
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>
    const entries = Object.entries(obj).map(([k, val]) => `${k}=${formatValue(val)}`)
    return `{${entries.join(', ')}}`
  }
  return String(v)
}

function escapeMarkdownCell(value: string) {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ')
}
