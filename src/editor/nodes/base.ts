import { ClassicPreset } from 'rete'
import type { NodeEditor } from 'rete'
import type { AreaPlugin } from 'rete-area-plugin'

export type Schemes = {
  Node: GHNode
  Connection: ClassicPreset.Connection<ClassicPreset.Node, ClassicPreset.Node> & {
    isLoop?: boolean
    isAutoVariable?: boolean
    variableName?: string
  }
}

export abstract class GHNode extends ClassicPreset.Node<
  Record<string, ClassicPreset.Socket>,
  Record<string, ClassicPreset.Socket>,
  Record<string, ClassicPreset.Control>
> {
  abstract category: string
  abstract execute(inputs: Record<string, unknown>): Record<string, unknown> | Promise<Record<string, unknown>>
  width = 180
  height = 100
  display?: string
  resultDisplay?: string
  variableName?: string
  inputAliases?: Record<string, string[]>
  outputAliases?: Record<string, string[]>
  lastInputs?: Record<string, unknown>
  lastOutputs?: Record<string, unknown>
  helpMarkdown?: string
  graph?: {
    editor: NodeEditor<Schemes>
    area: AreaPlugin<Schemes, any>
  }

  constructor(label: string) {
    super(label)
  }

  async data(inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
    return await this.execute(inputs)
  }

  setGraphContext(editor: NodeEditor<Schemes>, area: AreaPlugin<Schemes, any>) {
    this.graph = { editor, area }
  }

  async removeInvalidConnections(nextInputs: string[], nextOutputs: string[]) {
    if (!this.graph) return

    const nextInputSet = new Set(nextInputs)
    const nextOutputSet = new Set(nextOutputs)
    const connections = this.graph.editor.getConnections().filter((conn) => {
      if (conn.target === this.id && !nextInputSet.has(conn.targetInput as string)) return true
      if (conn.source === this.id && !nextOutputSet.has(conn.sourceOutput as string)) return true
      return false
    })

    for (const conn of connections) {
      await this.graph.editor.removeConnection(conn.id)
    }
  }

  async refreshNodeView() {
    await this.graph?.area.update('node', this.id)
  }
}

// Grasshopper-style socket colors
export const socketColors: Record<string, string> = {
  number: '#f5a623',   // GH Number = yellow/orange
  point:  '#7ed321',   // GH Point/Vector = green
  line:   '#4a90e2',   // GH Curve = blue
  plane:  '#bd10e0',   // GH Surface = purple
  boolean:'#d0021b',   // GH Boolean = red
  generic:'#9b9b9b',   // GH Generic = gray
  any:    '#9b9b9b',
}

export const socketNumber = new ClassicPreset.Socket('number')
export const socketPoint = new ClassicPreset.Socket('point')
export const socketLine = new ClassicPreset.Socket('line')
export const socketPlane = new ClassicPreset.Socket('plane')
export const socketBoolean = new ClassicPreset.Socket('boolean')
export const socketGeneric = new ClassicPreset.Socket('generic')

export function getSocket(type: string): ClassicPreset.Socket {
  switch (type) {
    case 'number': return socketNumber
    case 'point': return socketPoint
    case 'line': return socketLine
    case 'plane': return socketPlane
    case 'boolean': return socketBoolean
    case 'generic': return socketGeneric
    default: return socketGeneric
  }
}

export function getSocketColor(socket: ClassicPreset.Socket): string {
  return socketColors[socket.name] || socketColors.generic
}
