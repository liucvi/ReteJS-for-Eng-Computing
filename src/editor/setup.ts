import { NodeEditor } from 'rete'
import { AreaPlugin, AreaExtensions } from 'rete-area-plugin'
import { ConnectionPlugin, Presets as ConnectionPresets } from 'rete-connection-plugin'
import { ReactPlugin, Presets, type ReactArea2D } from 'rete-react-plugin'
import { MinimapPlugin, type MinimapExtra } from 'rete-minimap-plugin'
import { ContextMenuPlugin, type ContextMenuExtra, Presets as ContextMenuPresets } from 'rete-context-menu-plugin'
import { ReadonlyPlugin } from 'rete-readonly-plugin'
import { createRoot } from 'react-dom/client'

import type { Schemes, GHNode } from './nodes/base'
import { nodeCategories } from './nodeRegistry'
import { helpEvents } from './helpEvents'
import { getNodeHelp } from './helpDocs'
import { NumberNode } from './nodes/number'
import { ReportNode } from './nodes/report'
import { PythonScriptNode } from './nodes/python'
import { CustomNode } from './components/Node'
import { CustomSocket } from './components/Socket'
import { CustomControl } from './components/Control'
import { CustomConnection } from './components/Connection'
import { DataflowEngine } from './engine/dataflow'
import { onExecute, triggerExecute } from './engineEvents'
import { autoConnectFields } from './variableBinding'
import { appendGraph, serializeGraph, type SavedGraph } from './graphPersistence'

export async function createEditor(container: HTMLElement) {
  const editor = new NodeEditor<Schemes>()
  const area = new AreaPlugin<Schemes, AreaExtra>(container)
  const connection = new ConnectionPlugin<Schemes, AreaExtra>()
  const reactPlugin = new ReactPlugin<Schemes, AreaExtra>({ createRoot })

  const flatItems = nodeCategories.flatMap((cat) =>
    cat.items.map((item) => [
      item.label,
      () => {
        const node = item.factory()
        node.setGraphContext(editor, area)
        return node
      },
    ] as [string, () => ReturnType<typeof item.factory>])
  )

  const classicPreset = ContextMenuPresets.classic.setup(flatItems)
  function applyHelp(node: GHNode) {
    node.helpMarkdown = getNodeHelp(node.label)
  }

  const contextMenu = new ContextMenuPlugin<Schemes>({
    items: (context, plugin) => {
      const result = classicPreset(context, plugin)
      if (context !== 'root' && 'id' in context) {
        const node = context as unknown as GHNode
        result.list.unshift({
          label: 'Delete',
          key: 'delete',
          handler: async () => {
            const connections = editor.getConnections().filter((connection) =>
              connection.source === node.id || connection.target === node.id
            )
            for (const connection of connections) {
              await editor.removeConnection(connection.id)
            }
            await editor.removeNode(node.id)
            triggerExecute()
          }
        })
        result.list.unshift({
          label: 'Copy',
          key: 'copy',
          handler: async () => {
            const graph = serializeGraph({ editor, area })
            const source = graph.nodes.find((item) => item.id === node.id)
            if (!source) return
            const duplicate: SavedGraph = {
              ...graph,
              nodes: [{
                ...source,
                label: `${source.label} Copy`,
                position: { x: 0, y: 0 },
              }],
              connections: [],
            }
            await appendGraph({ editor, area }, duplicate, {
              x: source.position.x + 56,
              y: source.position.y + 56,
            })
            await autoConnectFields(editor)
            triggerExecute()
          }
        })
        if (node instanceof PythonScriptNode && node.mergedGraph) {
          result.list.unshift({
            label: 'Expand Source Graph',
            key: 'expand-source-graph',
            handler: async () => {
              const position = area.nodeViews.get(node.id)?.position || { x: 0, y: 0 }
              await appendGraph({ editor, area }, node.mergedGraph as SavedGraph, {
                x: position.x + 72,
                y: position.y + 72,
              })
              triggerExecute()
            }
          })
        }
        if (node.helpMarkdown) {
          result.list.unshift({
            label: 'Help',
            key: 'help',
            handler: () => {
              helpEvents.showHelp(node.id)
            }
          })
        }
      }
      return result
    }
  })

  const minimap = new MinimapPlugin<Schemes>()
  const readonly = new ReadonlyPlugin<Schemes>()

  reactPlugin.addPreset(
    Presets.classic.setup({
      customize: {
        node() {
          return CustomNode
        },
        socket() {
          return CustomSocket
        },
        control() {
          return CustomControl
        },
        connection() {
          return CustomConnection
        },
      },
    })
  )
  reactPlugin.addPreset(Presets.contextMenu.setup())

  connection.addPreset(ConnectionPresets.classic.setup())

  editor.use(readonly.root)
  editor.use(area)
  area.use(reactPlugin)
  area.use(connection)
  area.use(contextMenu)
  area.use(readonly.area)
  area.use(minimap)

  AreaExtensions.simpleNodesOrder(area)
  AreaExtensions.showInputControl(area)
  AreaExtensions.selectableNodes(area, AreaExtensions.selector(), {
    accumulating: AreaExtensions.accumulateOnCtrl(),
  })

  const dataflow = new DataflowEngine(editor, area)
  const offExecute = onExecute(() => dataflow.execute().catch(console.error))

  editor.addPipe((context) => {
    if (context.type === 'connectioncreated' || context.type === 'connectionremoved') {
      triggerExecute()
    }
    return context
  })

  // Simple starter scene: compact pump sizing calculation
  const nRho = new NumberNode(1000, -100000, 100000, 'rho')
  const nQ = new NumberNode(0.025, -100000, 100000, 'Q')
  const nD = new NumberNode(0.125, -100000, 100000, 'D')
  const nH = new NumberNode(35, -100000, 100000, 'H')
  const nEta = new NumberNode(78, 0, 100, 'eta')

  const hydraulics = new PythonScriptNode()
  hydraulics.label = 'Pipe Hydraulics Python'
  hydraulics.inputConfigs = [
    { key: 'Q', label: 'Q', type: 'number' },
    { key: 'D', label: 'D', type: 'number' },
  ]
  hydraulics.outputConfigs = [
    { key: 'a', label: 'A', type: 'number' },
    { key: 'v', label: 'u', type: 'number' },
  ]
  hydraulics.code = `import math

if Q is None: Q = 0
if D is None: D = 0.1

a = math.pi * float(D) ** 2 / 4.0
v = 0 if a == 0 else float(Q) / a
`
  hydraulics.rebuildPorts()

  const power = new PythonScriptNode()
  power.label = 'Pump Power Python'
  power.inputConfigs = [
    { key: 'rho', label: 'rho', type: 'number' },
    { key: 'Q', label: 'Q', type: 'number' },
    { key: 'H', label: 'H', type: 'number' },
    { key: 'eta', label: 'eta', type: 'number' },
  ]
  power.outputConfigs = [
    { key: 'pe', label: 'P_e', type: 'number' },
    { key: 'pshaft', label: 'P_shaft', type: 'number' },
    { key: 'pshaft_kw', label: 'P_shaft (kW)', type: 'number' },
  ]
  power.code = `if rho is None: rho = 1000
if Q is None: Q = 0
if H is None: H = 0
if eta is None: eta = 75

pe = float(rho) * 9.81 * float(Q) * float(H)
pshaft = pe / max(float(eta) / 100.0, 1e-9)
pshaft_kw = pshaft / 1000.0
`
  power.rebuildPorts()

  const report = new ReportNode()
  report.inputConfigs = [
    { key: 'rho', label: 'rho' },
    { key: 'Q', label: 'Q' },
    { key: 'D', label: 'D' },
    { key: 'H', label: 'H' },
    { key: 'eta', label: 'eta' },
    { key: 'a', label: 'A' },
    { key: 'v', label: 'u' },
    { key: 'pshaft_kw', label: 'P_shaft' },
  ]
  report.rebuildPorts()
  report.template = `迷你泵功率计算

输入参数
- 流体密度 rho = {rho} kg/m3
- 设计流量 Q = {Q} m3/s
- 管径 D = {D} m
- 设计扬程 H = {H} m
- 泵效率 eta = {eta} %

过程结果
- 管道截面积 A = {a} m2
- 管内流速 u = {v} m/s
- 泵轴功率 P_shaft = {pshaft_kw} kW

这个画布用于演示：输入电池 -> 原生 Python 计算电池 -> 结果报告。`

  const allNodes = [nRho, nQ, nD, nH, nEta, hydraulics, power, report]
  for (const n of allNodes) {
    n.setGraphContext(editor, area)
    applyHelp(n)
    await editor.addNode(n)
  }

  const col = (c: number) => c * 300 + 80
  const row = (r: number) => r * 92 + 70

  await area.translate(nRho.id, { x: col(0), y: row(0) })
  await area.translate(nQ.id, { x: col(0), y: row(1) })
  await area.translate(nD.id, { x: col(0), y: row(2) })
  await area.translate(nH.id, { x: col(0), y: row(3) })
  await area.translate(nEta.id, { x: col(0), y: row(4) })

  await area.translate(hydraulics.id, { x: col(1), y: row(2) })
  await area.translate(power.id, { x: col(2), y: row(2.4) })
  await area.translate(report.id, { x: col(3), y: row(2) })

  await autoConnectFields(editor)

  dataflow.execute().catch(console.error)

  return {
    editor,
    area,
    dataflow,
    destroy() {
      offExecute()
      area.destroy()
    },
  }
}

type AreaExtra = ReactArea2D<Schemes> | ContextMenuExtra | MinimapExtra
