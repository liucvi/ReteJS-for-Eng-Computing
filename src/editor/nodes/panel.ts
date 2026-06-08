import { ClassicPreset } from 'rete'
import { GHNode, getSocket } from './base'
import { DataTree } from '../engine/dataTree'

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'number') return value.toFixed(6).replace(/\.?0+$/, '')
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'True' : 'False'
  if (value instanceof DataTree) {
    return value.toString()
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    return value.map((v, i) => `${i}: ${formatValue(v)}`).join('\n')
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if ('x' in obj && 'y' in obj) {
      const z = 'z' in obj ? `, ${formatValue(obj.z)}` : ''
      return `{${formatValue(obj.x)}, ${formatValue(obj.y)}${z}}`
    }
    return JSON.stringify(value, null, 2)
  }
  return String(value)
}

export class PanelNode extends GHNode {
  category = 'Params'

  constructor() {
    super('Panel')
    this.width = 200
    this.height = 120
    this.addInput('data', new ClassicPreset.Input(getSocket('any'), 'Data'))
  }

  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const value = inputs.data
    this.display = formatValue(value)
    return {}
  }
}
