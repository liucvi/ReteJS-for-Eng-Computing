import type { NodeEditor } from 'rete'
import type { ClassicPreset } from 'rete'
import type { AreaPlugin } from 'rete-area-plugin'
import type { Schemes } from '../nodes/base'

export class DataflowEngine {
  editor: NodeEditor<Schemes>
  area?: AreaPlugin<Schemes, any>

  constructor(editor: NodeEditor<Schemes>, area?: AreaPlugin<Schemes, any>) {
    this.editor = editor
    this.area = area
  }

  private topologicalSort(): string[] {
    const nodes = Array.from(this.editor.getNodes())
    const connections = Array.from(this.editor.getConnections())
    const inDegree = new Map<string, number>()
    const adj = new Map<string, string[]>()

    for (const node of nodes) {
      inDegree.set(node.id, 0)
      adj.set(node.id, [])
    }

    for (const conn of connections) {
      const from = conn.source
      const to = conn.target
      adj.get(from)!.push(to)
      inDegree.set(to, (inDegree.get(to) || 0) + 1)
    }

    const queue: string[] = []
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id)
    }

    const result: string[] = []
    while (queue.length > 0) {
      const id = queue.shift()!
      result.push(id)
      for (const neighbor of adj.get(id) || []) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1
        inDegree.set(neighbor, newDegree)
        if (newDegree === 0) queue.push(neighbor)
      }
    }

    return result
  }

  async execute(nodeId?: string): Promise<Map<string, Record<string, unknown>>> {
    const order = this.topologicalSort()
    const outputs = new Map<string, Record<string, unknown>>()

    const nodesToExecute = nodeId
      ? order.slice(0, order.indexOf(nodeId) + 1)
      : order

    for (const id of nodesToExecute) {
      const node = this.editor.getNode(id)
      if (!node) continue

      const inputData: Record<string, unknown> = {}
      const connections = Array.from(this.editor.getConnections()).filter(
        (c) => c.target === id
      )

      for (const conn of connections) {
        if (!(conn.targetInput as string in node.inputs)) continue
        const sourceNode = this.editor.getNode(conn.source)
        if (!sourceNode || !(conn.sourceOutput as string in sourceNode.outputs)) continue
        const sourceOutputs = outputs.get(conn.source)
        if (sourceOutputs) {
          inputData[conn.targetInput as string] = sourceOutputs[conn.sourceOutput as string]
        }
      }

      // fill defaults from input controls
      for (const key of Object.keys(node.inputs)) {
        const input = node.inputs[key as keyof typeof node.inputs]
        if (input && !(key in inputData) && input.control) {
          const control = input.control as ClassicPreset.InputControl<'number'>
          inputData[key] = control.value
        }
      }

      const nodeOutputs = await node.data(inputData)
      outputs.set(id, nodeOutputs)
      node.lastInputs = inputData
      node.lastOutputs = nodeOutputs
      node.resultDisplay = formatOutputs(node, nodeOutputs)
    }

    // update panel displays
    if (this.area) {
      for (const node of this.editor.getNodes()) {
        await this.area.update('node', node.id)
      }
    }

    return outputs
  }
}

function formatOutputs(node: Schemes['Node'], outputs: Record<string, unknown>) {
  const entries = Object.entries(outputs)
  if (entries.length === 0) return ''
  return entries
    .slice(0, 4)
    .map(([key, value]) => `${getOutputLabel(node, key)} = ${formatValue(value)}`)
    .join('\n')
}

function getOutputLabel(node: Schemes['Node'], key: string) {
  const output = node.outputs[key]
  return (output as { label?: string } | undefined)?.label || key
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null) return 'N/A'
  if (typeof value === 'number') {
    if (Math.abs(value) >= 10000 || (Math.abs(value) < 0.001 && value !== 0)) {
      return value.toExponential(4)
    }
    return value.toFixed(4).replace(/\.?0+$/, '')
  }
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (Array.isArray(value)) return `[${value.slice(0, 4).map(formatValue).join(', ')}${value.length > 4 ? ', ...' : ''}]`
  if (typeof value === 'object') return '{...}'
  return String(value)
}
