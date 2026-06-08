import { ClassicPreset } from 'rete'
import type { EditorAPI } from './components/Toolbar'
import type { GHNode, Schemes } from './nodes/base'
import { nodeCategories } from './nodeRegistry'
import {
  ButtonControl,
  ColourControl,
  DomainSliderControl,
  NumberControl,
  ToggleControl,
  ValueListControl,
} from './controls'
import { FieldInputNode } from './nodes/number'
import type { PythonScriptNode } from './nodes/python'
import { FormulaCellNode } from './nodes/formula'
import { BookAssemblerNode, BookSectionNode, FieldTableNode, type ReportNode } from './nodes/report'
import {
  CoolPropNode,
  DevAssistantBridgeNode,
  DictionaryLookupNode,
  PlatformReturnNode,
  ProjectContextNode,
  TableLookupNode,
} from './nodes/resources'
import { triggerExecute } from './engineEvents'

type SavedNode = {
  id: string
  type?: string
  label: string
  position: { x: number; y: number }
  controls: Record<string, unknown>
  data?: Record<string, unknown>
}

type SavedConnection = {
  source: string
  sourceOutput: string
  target: string
  targetInput: string
  isAutoVariable?: boolean
  variableName?: string
}

export type SavedGraph = {
  version: 1
  viewport: { x: number; y: number; k: number }
  nodes: SavedNode[]
  connections: SavedConnection[]
}

const factories = new Map<string, () => GHNode>(
  nodeCategories.flatMap((cat) => cat.items.map((item) => [item.label, item.factory] as const))
)

export function serializeGraph(api: EditorAPI): SavedGraph {
  return {
    version: 1,
    viewport: { ...api.area.area.transform },
    nodes: api.editor.getNodes().map((node) => ({
      id: node.id,
      type: getFactoryLabel(node),
      label: node.label,
      position: api.area.nodeViews.get(node.id)?.position || { x: 0, y: 0 },
      controls: serializeControls(node),
      data: serializeNodeData(node),
    })),
    connections: api.editor.getConnections().map((conn) => ({
      source: conn.source,
      sourceOutput: conn.sourceOutput as string,
      target: conn.target,
      targetInput: conn.targetInput as string,
      isAutoVariable: conn.isAutoVariable,
      variableName: conn.variableName,
    })),
  }
}

export async function loadGraph(api: EditorAPI, graph: SavedGraph) {
  const connections = [...api.editor.getConnections()]
  for (const conn of connections) {
    await api.editor.removeConnection(conn.id)
  }

  const nodes = [...api.editor.getNodes()]
  for (const node of nodes) {
    await api.editor.removeNode(node.id)
  }

  const nodeMap = new Map<string, GHNode>()

  for (const saved of graph.nodes) {
    const factory = factories.get(saved.type || saved.label)
    if (!factory) {
      console.warn(`Unknown node type skipped: ${saved.type || saved.label}`)
      continue
    }

    const node = factory()
    node.label = saved.label
    node.setGraphContext(api.editor, api.area)
    applyNodeData(node, saved.data)
    applyControls(node, saved.controls)

    await api.editor.addNode(node)
    await api.area.translate(node.id, saved.position)
    await api.area.update('node', node.id)
    nodeMap.set(saved.id, node)
  }

  for (const saved of graph.connections) {
    const source = nodeMap.get(saved.source)
    const target = nodeMap.get(saved.target)
    if (!source || !target) continue
    if (!(saved.sourceOutput in source.outputs) || !(saved.targetInput in target.inputs)) continue

    const connection = new ClassicPreset.Connection(source, saved.sourceOutput, target, saved.targetInput) as Schemes['Connection']
    connection.isAutoVariable = saved.isAutoVariable
    connection.variableName = saved.variableName
    await api.editor.addConnection(connection)
  }

  await api.area.area.translate(graph.viewport.x, graph.viewport.y)
  await api.area.area.zoom(graph.viewport.k, 0, 0)
  triggerExecute()
}

export async function appendGraph(
  api: EditorAPI,
  graph: SavedGraph,
  offset: { x: number; y: number } = { x: 36, y: 36 }
) {
  const nodeMap = new Map<string, GHNode>()

  for (const saved of graph.nodes) {
    const factory = factories.get(saved.type || saved.label)
    if (!factory) {
      console.warn(`Unknown node type skipped: ${saved.type || saved.label}`)
      continue
    }

    const node = factory()
    node.label = saved.label
    node.setGraphContext(api.editor, api.area)
    applyNodeData(node, saved.data)
    applyControls(node, saved.controls)

    await api.editor.addNode(node)
    await api.area.translate(node.id, {
      x: saved.position.x + offset.x,
      y: saved.position.y + offset.y,
    })
    await api.area.update('node', node.id)
    nodeMap.set(saved.id, node)
  }

  for (const saved of graph.connections) {
    const source = nodeMap.get(saved.source)
    const target = nodeMap.get(saved.target)
    if (!source || !target) continue
    if (!(saved.sourceOutput in source.outputs) || !(saved.targetInput in target.inputs)) continue

    const connection = new ClassicPreset.Connection(source, saved.sourceOutput, target, saved.targetInput) as Schemes['Connection']
    connection.isAutoVariable = saved.isAutoVariable
    connection.variableName = saved.variableName
    await api.editor.addConnection(connection)
  }

  triggerExecute()
  return nodeMap
}

function getFactoryLabel(node: GHNode): string {
  if (node instanceof FieldInputNode) return 'Field Input'
  if (isPythonNode(node)) return 'Python Script'
  if (node instanceof FormulaCellNode) return 'Formula Cell'
  if (node instanceof BookSectionNode) return 'Book Section'
  if (node instanceof FieldTableNode) return 'Field Table'
  if (node instanceof BookAssemblerNode) return 'Book Assembler'
  if (isReportNode(node)) return 'Report'
  if (node instanceof DictionaryLookupNode) return 'Dictionary Lookup'
  if (node instanceof TableLookupNode) return 'Table Lookup'
  if (node instanceof CoolPropNode) return 'CoolProp Props'
  if (node instanceof ProjectContextNode) return 'Project Context'
  if (node instanceof PlatformReturnNode) return 'Platform Return'
  if (node instanceof DevAssistantBridgeNode) return 'AI Dev Bridge'
  return node.label
}

function serializeControls(node: GHNode): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, control] of Object.entries(node.controls)) {
    if (!control) continue
    if (control instanceof NumberControl) result[key] = control.value
    else if (control instanceof ToggleControl) result[key] = control.value
    else if (control instanceof ColourControl) result[key] = control.value
    else if (control instanceof ValueListControl) result[key] = control.value
    else if (control instanceof DomainSliderControl) result[key] = { min: control.min, max: control.max }
    else if (control instanceof ButtonControl) result[key] = control.clicks
    else if (control instanceof ClassicPreset.InputControl) result[key] = control.value
  }

  return result
}

function applyControls(node: GHNode, controls: Record<string, unknown>) {
  for (const [key, value] of Object.entries(controls || {})) {
    const control = node.controls[key]
    if (!control) continue

    if (control instanceof NumberControl && typeof value === 'number') control.setValue(value)
    else if (control instanceof ToggleControl && typeof value === 'boolean') control.setValue(value)
    else if (control instanceof ColourControl && typeof value === 'string') control.setValue(value)
    else if (control instanceof ValueListControl && typeof value === 'string') control.setValue(value)
    else if (control instanceof DomainSliderControl && isDomainValue(value)) {
      control.setMin(value.min)
      control.setMax(value.max)
    } else if (control instanceof ButtonControl && typeof value === 'number') {
      control.clicks = value
    } else if (control instanceof ClassicPreset.InputControl) {
      control.setValue(value as never)
    }
  }
}

function serializeNodeData(node: GHNode): Record<string, unknown> | undefined {
  const baseData: Record<string, unknown> = {}
  if (node.variableName) baseData.variableName = node.variableName

  if (isPythonNode(node)) {
    const py = node as PythonScriptNode
    return {
      ...baseData,
      code: py.code,
      inputConfigs: py.inputConfigs,
      outputConfigs: py.outputConfigs,
      mergedGraph: py.mergedGraph,
      mergedGraphLabel: py.mergedGraphLabel,
      mergedBoundary: py.mergedBoundary,
      platformOperator: py.platformOperator,
      testCase: py.testCase,
      testStatus: py.testStatus,
    }
  }

  if (node instanceof FormulaCellNode) {
    return {
      ...baseData,
      latexFormula: node.latexFormula,
      expression: node.expression,
      inputConfigs: node.inputConfigs,
      outputKey: node.outputKey,
      outputLabel: node.outputLabel,
    }
  }

  if (node instanceof FieldInputNode) {
    return {
      ...baseData,
      fieldKey: node.fieldKey,
      fieldLabel: node.fieldLabel,
      unit: node.unit,
      discipline: node.discipline,
      description: node.description,
    }
  }

  if (isReportNode(node)) {
    const report = node as ReportNode | BookSectionNode | BookAssemblerNode | FieldTableNode
    return {
      ...baseData,
      ...('template' in report ? { template: report.template } : {}),
      inputConfigs: report.inputConfigs,
      ...('outputKey' in report ? { outputKey: report.outputKey, outputLabel: report.outputLabel } : {}),
    }
  }

  return Object.keys(baseData).length > 0 ? baseData : undefined
}

function applyNodeData(node: GHNode, data: Record<string, unknown> | undefined) {
  if (!data) return
  if (typeof data.variableName === 'string') {
    node.variableName = data.variableName
    node.outputAliases = {
      ...node.outputAliases,
      value: data.variableName ? [data.variableName] : [],
    }
  }

  if (isPythonNode(node)) {
    const py = node as PythonScriptNode
    if (typeof data.code === 'string') py.code = data.code
    if (Array.isArray(data.inputConfigs)) py.inputConfigs = data.inputConfigs as PythonScriptNode['inputConfigs']
    if (Array.isArray(data.outputConfigs)) py.outputConfigs = data.outputConfigs as PythonScriptNode['outputConfigs']
    if (data.mergedGraph) py.mergedGraph = data.mergedGraph
    if (typeof data.mergedGraphLabel === 'string') py.mergedGraphLabel = data.mergedGraphLabel
    if (isMergedBoundaryData(data.mergedBoundary)) py.mergedBoundary = data.mergedBoundary
    if (isPlatformOperatorData(data.platformOperator)) py.platformOperator = data.platformOperator
    if (isPythonTestCaseData(data.testCase)) py.testCase = data.testCase
    if (isPythonTestStatusData(data.testStatus)) py.testStatus = data.testStatus
    py.rebuildPorts()
  }

  if (node instanceof FormulaCellNode) {
    if (typeof data.latexFormula === 'string') node.latexFormula = data.latexFormula
    if (typeof data.expression === 'string') node.expression = data.expression
    if (Array.isArray(data.inputConfigs)) node.inputConfigs = data.inputConfigs as FormulaCellNode['inputConfigs']
    if (typeof data.outputKey === 'string') node.outputKey = data.outputKey
    if (typeof data.outputLabel === 'string') node.outputLabel = data.outputLabel
    node.rebuildPorts()
  }

  if (node instanceof FieldInputNode) {
    if (typeof data.fieldKey === 'string') node.fieldKey = data.fieldKey
    if (typeof data.fieldLabel === 'string') node.fieldLabel = data.fieldLabel
    if (typeof data.unit === 'string') node.unit = data.unit
    if (typeof data.discipline === 'string') node.discipline = data.discipline
    if (typeof data.description === 'string') node.description = data.description
    node.syncFieldMetadata()
  }

  if (isReportNode(node)) {
    const report = node as ReportNode | BookSectionNode | BookAssemblerNode | FieldTableNode
    if ('template' in report && typeof data.template === 'string') report.template = data.template
    if (Array.isArray(data.inputConfigs)) report.inputConfigs = data.inputConfigs as ReportNode['inputConfigs']
    if ('outputKey' in report && typeof data.outputKey === 'string') report.outputKey = data.outputKey
    if ('outputLabel' in report && typeof data.outputLabel === 'string') report.outputLabel = data.outputLabel
    report.rebuildPorts()
  }
}

function isPythonNode(node: GHNode): node is PythonScriptNode {
  return node.category === 'Script' && 'code' in node && 'inputConfigs' in node
}

function isReportNode(node: GHNode): node is ReportNode | BookSectionNode | BookAssemblerNode | FieldTableNode {
  return node instanceof FieldTableNode || ('template' in node && 'inputConfigs' in node)
}

function isPlatformOperatorData(value: unknown): value is PythonScriptNode['platformOperator'] {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { code?: unknown }).code === 'string' &&
    typeof (value as { name?: unknown }).name === 'string' &&
    typeof (value as { version?: unknown }).version === 'string' &&
    typeof (value as { status?: unknown }).status === 'string'
  )
}

function isMergedBoundaryData(value: unknown): value is PythonScriptNode['mergedBoundary'] {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { inputs?: unknown }).inputs === 'object' &&
    typeof (value as { outputs?: unknown }).outputs === 'object'
  )
}

function isPythonTestCaseData(value: unknown): value is PythonScriptNode['testCase'] {
  return (
    typeof value === 'object' &&
    value !== null &&
    isNumberRecord((value as { inputs?: unknown }).inputs) &&
    isNumberRecord((value as { expected?: unknown }).expected)
  )
}

function isPythonTestStatusData(value: unknown): value is PythonScriptNode['testStatus'] {
  const status = (value as { status?: unknown } | null)?.status
  return (
    typeof value === 'object' &&
    value !== null &&
    (status === 'pass' || status === 'fail' || status === 'not-run') &&
    typeof (value as { summary?: unknown }).summary === 'string'
  )
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value).every((item) => typeof item === 'number' && Number.isFinite(item))
  )
}

function isDomainValue(value: unknown): value is { min: number; max: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { min?: unknown }).min === 'number' &&
    typeof (value as { max?: unknown }).max === 'number'
  )
}
