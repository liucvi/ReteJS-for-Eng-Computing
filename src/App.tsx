import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { ClassicPreset } from 'rete'
import { createEditor } from './editor/setup'
import { Toolbar } from './editor/components/Toolbar'
import { initPyodide, getPyodideError, resetPyodide } from './editor/pyodide'
import { nodeCategories } from './editor/nodeRegistry'
import { onExecute, triggerExecute } from './editor/engineEvents'
import { autoConnectFields } from './editor/variableBinding'
import {
  auditCalculationBookDraft,
  chatWithAssistant,
  createCalculationBookDraft,
  auditPlatformOperator,
  getCalculationBookTemplate,
  getPlatformOperator,
  getPlatformProjectContext,
  listCalculationBookTemplates,
  listCalculationBookDrafts,
  listPlatformDictionaries,
  listPlatformFields,
  listPlatformOperators,
  listPlatformResultReceipts,
  listPlatformTables,
  publishCalculationBookTemplate,
  publishPlatformOperator,
  runPlatformCalculationBook,
  searchComponentFiles,
  syncCalculationBookDraft,
  type AiChatMessage,
  type CalculationBookTemplateSummary,
  type CalculationBookDraft,
  type ComponentFileSummary,
  type PlatformResultReceipt,
  type PlatformFieldDefinition,
  type PlatformOperatorSummary,
  type PlatformProjectContext,
  type PlatformResourceSummary,
} from './editor/projectApi'
import { PythonScriptNode, validatePythonSafety, type PyPortConfig } from './editor/nodes/python'
import { FormulaCellNode, type FormulaPortConfig } from './editor/nodes/formula'
import { BookAssemblerNode, BookSectionNode, FieldTableNode, ReportNode, type ReportPortConfig } from './editor/nodes/report'
import { FieldInputNode, NumberNode } from './editor/nodes/number'
import { DictionaryLookupNode, TableLookupNode, CoolPropNode, PlatformReturnNode, ProjectContextNode, DevAssistantBridgeNode } from './editor/nodes/resources'
import { appendGraph, loadGraph, serializeGraph, type SavedGraph } from './editor/graphPersistence'
import type { EditorAPI } from './editor/components/Toolbar'
import type { GHNode, Schemes } from './editor/nodes/base'

type InspectorTab = 'properties' | 'assistant' | 'results'

type QuickAddState = {
  x: number
  y: number
  worldX: number
  worldY: number
  query: string
}

type CanvasStats = {
  nodes: number
  edges: number
  selected: GHNode | null
  status: string
}

type CanvasAuditItem = {
  level: 'error' | 'warning' | 'success'
  title: string
  detail: string
}

type CanvasAudit = {
  score: number
  status: 'ready' | 'needs-work'
  checkedAt: string
  items: CanvasAuditItem[]
}

type FieldInputDraft = {
  fieldKey: string
  fieldLabel: string
  unit: string
  discipline: string
  description: string
  value: string
}

type AiActionTone = 'create' | 'update' | 'connect' | 'platform' | 'danger' | 'default'

type AiActionSummary = {
  creates: number
  updates: number
  links: number
  platform: number
  risky: number
  nodeTargets: string[]
}

type AssistantCanvasContext = {
  selected: {
    id: string
    label: string
    category: string
    field?: string
    inputs: string[]
    outputs: string[]
    result: string
  } | null
  nodes: number
  connections: number
  fields: Array<{
    field: string
    node: string
    output: string
  }>
  unresolvedInputs: string[]
  terminalNodes: string[]
  formulaNodes: string[]
  componentResources: Array<{
    name: string
    category: string
  }>
  pythonNodes: Array<{
    label: string
    status: string
  }>
  platform: {
    project: string
    wbs: string
    fields: number
    operators: number
    drafts: number
  } | null
}

type AiAction =
  | {
      type: 'add_python_node'
      name?: string
      code?: string
      inputs?: Array<{ key: string; label?: string }>
      outputs?: Array<{ key: string; label?: string }>
    }
  | {
      type: 'add_formula_node'
      name?: string
      latex?: string
      expression?: string
      inputs?: Array<{ key: string; label?: string }>
      outputKey?: string
      outputLabel?: string
    }
  | {
      type: 'add_resource_node'
      resourceType?: 'dictionary' | 'table' | 'coolprop' | 'platform_return' | 'project_context' | 'dev_assistant'
      code?: string
      key?: string
      name?: string
    }
  | {
      type: 'add_report_node'
      name?: string
      template?: string
      inputs?: Array<{ key: string; label?: string }>
    }
  | {
      type: 'add_book_section'
      name?: string
      template?: string
      inputs?: Array<{ key: string; label?: string }>
      outputKey?: string
      outputLabel?: string
    }
  | {
      type: 'add_book_assembler'
      name?: string
      template?: string
      inputs?: Array<{ key: string; label?: string }>
    }
  | {
      type: 'add_field_table_node'
      name?: string
      fields?: string[]
      inputs?: Array<{ key: string; label?: string; unit?: string; description?: string }>
      outputKey?: string
      outputLabel?: string
    }
  | {
      type: 'add_operator_node'
      code?: string
      name?: string
    }
  | {
      type: 'add_platform_field_inputs'
      fields?: string[]
    }
  | {
      type: 'build_delivery_scaffold'
      title?: string
      fields?: string[]
    }
  | {
      type: 'auto_connect_fields'
    }
  | {
      type: 'connect_nodes'
      sourceNodeId?: string
      sourceLabel?: string
      sourceOutput?: string
      targetNodeId?: string
      targetLabel?: string
      targetInput?: string
      variableName?: string
      auto?: boolean
    }
  | {
      type: 'disconnect_node_input'
      targetNodeId?: string
      targetLabel?: string
      targetInput?: string
    }
  | {
      type: 'rename_node'
      nodeId?: string
      label?: string
      name?: string
    }
  | {
      type: 'delete_node'
      nodeId?: string
      label?: string
    }
  | {
      type: 'auto_layout_canvas'
    }
  | {
      type: 'submit_calculation_book_draft'
      title?: string
    }
  | {
      type: 'audit_calculation_book_draft'
    }
  | {
      type: 'sync_calculation_book_draft'
    }
  | {
      type: 'submit_audit_sync_calculation_book'
      title?: string
    }
  | {
      type: 'apply_calculation_template'
      code?: string
    }
  | {
      type: 'publish_calculation_template'
      name?: string
      description?: string
      discipline?: string
      tags?: string[]
    }
  | {
      type: 'pythonize_canvas'
    }
  | {
      type: 'convert_selected_formula_to_python'
    }
  | {
      type: 'convert_all_formulas_to_python'
    }
  | {
      type: 'pythonize_and_publish_operator'
    }
  | {
      type: 'pythonize_publish_audit_operator'
    }
  | {
      type: 'publish_selected_python_operator'
    }
  | {
      type: 'audit_selected_platform_operator'
    }
  | {
      type: 'audit_canvas'
    }
  | {
      type: 'set_node_variable'
      nodeId?: string
      label?: string
      variableName?: string
    }
  | {
      type: 'update_field_input_node'
      nodeId?: string
      label?: string
      name?: string
      fieldKey?: string
      fieldLabel?: string
      unit?: string
      discipline?: string
      description?: string
      value?: number
    }
  | {
      type: 'update_python_node'
      nodeId?: string
      label?: string
      name?: string
      code?: string
      inputs?: Array<{ key: string; label?: string }>
      outputs?: Array<{ key: string; label?: string }>
    }
  | {
      type: 'update_formula_node'
      nodeId?: string
      label?: string
      name?: string
      latex?: string
      expression?: string
      inputs?: Array<{ key: string; label?: string }>
      outputKey?: string
      outputLabel?: string
    }
  | {
      type: 'update_report_node'
      nodeId?: string
      label?: string
      name?: string
      template?: string
      inputs?: Array<{ key: string; label?: string }>
    }

function extractAiActions(content: string): AiAction[] {
  const blocks = [...content.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((match) => match[1])
  const candidates = blocks.length > 0 ? blocks : [content]

  for (const candidate of candidates) {
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start < 0 || end <= start) continue

    try {
      const parsed = JSON.parse(candidate.slice(start, end + 1)) as { actions?: unknown }
      if (!Array.isArray(parsed.actions)) continue
      return parsed.actions.filter(isAiAction)
    } catch {
      // Keep scanning other candidates.
    }
  }

  return []
}

function isAiAction(value: unknown): value is AiAction {
  if (typeof value !== 'object' || value === null) return false
  const type = (value as { type?: unknown }).type
  if (
    type === 'add_python_node' ||
    type === 'add_formula_node' ||
    type === 'add_report_node' ||
    type === 'add_book_section' ||
    type === 'add_book_assembler' ||
    type === 'add_field_table_node' ||
    type === 'build_delivery_scaffold' ||
    type === 'auto_connect_fields' ||
    type === 'connect_nodes' ||
    type === 'disconnect_node_input' ||
    type === 'rename_node' ||
    type === 'delete_node' ||
    type === 'auto_layout_canvas' ||
    type === 'add_operator_node' ||
    type === 'add_platform_field_inputs'
  ) return true
  if (
    type === 'submit_calculation_book_draft' ||
    type === 'audit_calculation_book_draft' ||
    type === 'sync_calculation_book_draft' ||
    type === 'submit_audit_sync_calculation_book' ||
    type === 'apply_calculation_template' ||
    type === 'publish_calculation_template' ||
    type === 'pythonize_canvas' ||
    type === 'convert_selected_formula_to_python' ||
    type === 'convert_all_formulas_to_python' ||
    type === 'pythonize_and_publish_operator' ||
    type === 'pythonize_publish_audit_operator' ||
    type === 'publish_selected_python_operator' ||
    type === 'audit_selected_platform_operator' ||
    type === 'audit_canvas'
  ) return true
  if (
    type === 'set_node_variable' ||
    type === 'update_field_input_node' ||
    type === 'update_python_node' ||
    type === 'update_formula_node' ||
    type === 'update_report_node'
  ) return true
  if (type !== 'add_resource_node') return false
  const resourceType = (value as { resourceType?: unknown }).resourceType
  return (
    resourceType === 'dictionary' ||
    resourceType === 'table' ||
    resourceType === 'coolprop' ||
    resourceType === 'project_context' ||
    resourceType === 'platform_return'
  )
}

function normalizePorts(
  ports: Array<{ key: string; label?: string }> | undefined,
  fallback: PyPortConfig[]
): PyPortConfig[] {
  if (!Array.isArray(ports) || ports.length === 0) return fallback
  return ports
    .filter((port) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(port.key))
    .slice(0, 12)
    .map((port) => ({
      key: port.key,
      label: port.label?.trim() || port.key,
      type: 'number',
    }))
}

function normalizePythonKey(raw: string, fallback: string) {
  const ascii = raw.replace(/[^A-Za-z0-9_]/g, '_').replace(/^([^A-Za-z_])/, '_$1')
  const compact = ascii.replace(/_+/g, '_').replace(/^_+|_+$/g, '')
  return compact || fallback
}

function formatTraceValue(value: unknown): string {
  if (typeof value === 'number') {
    if (Math.abs(value) >= 10000 || (Math.abs(value) < 0.001 && value !== 0)) return value.toExponential(4)
    return value.toFixed(4).replace(/\.?0+$/, '')
  }
  if (typeof value === 'string') return value.length > 80 ? `${value.slice(0, 77)}...` : value
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (value === null || value === undefined) return 'N/A'
  if (Array.isArray(value)) return `[${value.slice(0, 4).map(formatTraceValue).join(', ')}${value.length > 4 ? ', ...' : ''}]`
  if (typeof value === 'object') return '{...}'
  return String(value)
}

function formatResultPreview(items?: Array<{ key: string; value: unknown }>) {
  if (!items || items.length === 0) return '-'
  return items.map((item) => `${item.key}=${formatTraceValue(item.value)}`).join(' / ')
}

function safeFileName(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80) || 'calculation_book'
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function uniqueKey(base: string, used: Set<string>) {
  let key = normalizePythonKey(base, `p${used.size + 1}`)
  if (!used.has(key)) {
    used.add(key)
    return key
  }
  let i = 2
  while (used.has(`${key}_${i}`)) i++
  key = `${key}_${i}`
  used.add(key)
  return key
}

function normalizeFormulaPorts(
  ports: Array<{ key: string; label?: string }> | undefined,
  fallback: FormulaPortConfig[]
): FormulaPortConfig[] {
  if (!Array.isArray(ports) || ports.length === 0) return fallback
  const used = new Set<string>()
  return ports
    .filter((port) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(port.key))
    .slice(0, 12)
    .map((port) => {
      const key = uniqueKey(port.key, used)
      return { key, label: port.label?.trim() || key }
    })
}

function normalizeReportPorts(
  ports: Array<{ key: string; label?: string }> | undefined,
  fallback: ReportPortConfig[]
): ReportPortConfig[] {
  if (!Array.isArray(ports) || ports.length === 0) return fallback
  const used = new Set<string>()
  return ports
    .filter((port) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(port.key))
    .slice(0, 24)
    .map((port) => {
      const key = uniqueKey(port.key, used)
      return { key, label: port.label?.trim() || key }
    })
}

function isTemplateReportNode(node: GHNode | null): node is ReportNode | BookSectionNode | BookAssemblerNode | FieldTableNode {
  return node instanceof ReportNode || node instanceof BookSectionNode || node instanceof BookAssemblerNode || node instanceof FieldTableNode
}

function parseFormulaInputList(value: string): FormulaPortConfig[] {
  const used = new Set<string>()
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(item))
    .slice(0, 12)
    .map((item) => {
      const key = uniqueKey(item, used)
      return { key, label: item }
    })
}

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [api, setApi] = useState<EditorAPI | null>(null)
  const [pyLoading, setPyLoading] = useState(true)
  const [pyError, setPyError] = useState('')
  const [pyRetry, setPyRetry] = useState(0)
  const [quickAdd, setQuickAdd] = useState<QuickAddState | null>(null)
  const [activeTab, setActiveTab] = useState<InspectorTab>('assistant')
  const [workflowNotice, setWorkflowNotice] = useState('AI 助手已读取当前画布，可从计算书描述生成电池组编排建议。')
  const [aiMessages, setAiMessages] = useState<AiChatMessage[]>([
    {
      role: 'assistant',
      content: '我可以读取当前画布，帮你规划电池组、生成 Python 自定义电池，并给出可应用到画布的操作。',
    },
  ])
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [platformContext, setPlatformContext] = useState<PlatformProjectContext | null>(null)
  const [platformFields, setPlatformFields] = useState<PlatformFieldDefinition[]>([])
  const [calculationTemplates, setCalculationTemplates] = useState<CalculationBookTemplateSummary[]>([])
  const [platformDictionaries, setPlatformDictionaries] = useState<PlatformResourceSummary[]>([])
  const [platformTables, setPlatformTables] = useState<PlatformResourceSummary[]>([])
  const [platformOperators, setPlatformOperators] = useState<PlatformOperatorSummary[]>([])
  const [platformDrafts, setPlatformDrafts] = useState<CalculationBookDraft[]>([])
  const [platformReceipts, setPlatformReceipts] = useState<PlatformResultReceipt[]>([])
  const [platformRun, setPlatformRun] = useState('')
  const [platformLoading, setPlatformLoading] = useState(false)
  const [componentQuery, setComponentQuery] = useState('泵')
  const [componentResults, setComponentResults] = useState<ComponentFileSummary[]>([])
  const [componentSearchStatus, setComponentSearchStatus] = useState('')
  const [draftId, setDraftId] = useState('')
  const [canvasAudit, setCanvasAudit] = useState<CanvasAudit | null>(null)
  const [fieldDraft, setFieldDraft] = useState('')
  const [fieldInputDraft, setFieldInputDraft] = useState<FieldInputDraft>({
    fieldKey: '',
    fieldLabel: '',
    unit: '',
    discipline: '',
    description: '',
    value: '',
  })
  const [formulaDraft, setFormulaDraft] = useState({
    title: '',
    latex: '',
    expression: '',
    inputs: '',
    outputKey: '',
    outputLabel: '',
  })
  const [stats, setStats] = useState<CanvasStats>({
    nodes: 0,
    edges: 0,
    selected: null,
    status: '初始化',
  })
  const historyRef = useRef<SavedGraph[]>([])
  const redoRef = useRef<SavedGraph[]>([])
  const historyKeyRef = useRef('')
  const suppressHistoryRef = useRef(false)
  const historyTimerRef = useRef<number | null>(null)
  const [historyState, setHistoryState] = useState({
    undo: 0,
    redo: 0,
  })

  useEffect(() => {
    initPyodide()
      .then(() => {
        setPyLoading(false)
        setPyError('')
      })
      .catch(() => {
        setPyLoading(false)
        setPyError(getPyodideError())
      })
  }, [pyRetry])

  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current

    let cleanup: (() => void) | undefined
    let cancelled = false

    createEditor(container).then((created) => {
      cleanup = created.destroy
      if (cancelled) {
        created.destroy()
        return
      }
      setApi({ editor: created.editor, area: created.area })
    })

    return () => {
      cancelled = true
      setApi(null)
      if (cleanup) cleanup()
    }
  }, [])

  useEffect(() => {
    if (!api) return

    const syncStats = () => {
      const nodes = api.editor.getNodes() as GHNode[]
      const selected = nodes.find((node) => Boolean((node as GHNode & { selected?: boolean }).selected)) || null
      setStats({
        nodes: nodes.length,
        edges: api.editor.getConnections().length,
        selected,
        status: selected ? '已选中节点' : '待执行',
      })
    }

    syncStats()
    const timer = window.setInterval(syncStats, 500)
    return () => window.clearInterval(timer)
  }, [api])

  useEffect(() => {
    if (!api) return

    historyRef.current = []
    redoRef.current = []
    historyKeyRef.current = ''
    setHistoryState({ undo: 0, redo: 0 })

    const capture = () => scheduleHistoryCapture()
    const initialTimer = window.setTimeout(capture, 500)
    const offExecute = onExecute(capture)
    api.area.addPipe((context) => {
      if (context.type === 'nodedragged') {
        scheduleHistoryCapture()
      }
      return context
    })

    return () => {
      window.clearTimeout(initialTimer)
      if (historyTimerRef.current !== null) window.clearTimeout(historyTimerRef.current)
      offExecute()
    }
  }, [api])

  function updateHistoryState() {
    setHistoryState({
      undo: Math.max(0, historyRef.current.length - 1),
      redo: redoRef.current.length,
    })
  }

  function getHistoryKey(graph: SavedGraph) {
    return JSON.stringify(graph)
  }

  function scheduleHistoryCapture() {
    if (!api || suppressHistoryRef.current) return
    if (historyTimerRef.current !== null) window.clearTimeout(historyTimerRef.current)
    historyTimerRef.current = window.setTimeout(() => {
      historyTimerRef.current = null
      captureHistorySnapshot()
    }, 120)
  }

  function captureHistorySnapshot() {
    if (!api || suppressHistoryRef.current) return
    const snapshot = serializeGraph(api)
    const key = getHistoryKey(snapshot)
    if (key === historyKeyRef.current) return

    historyRef.current = [...historyRef.current, snapshot].slice(-60)
    redoRef.current = []
    historyKeyRef.current = key
    updateHistoryState()
  }

  async function restoreHistorySnapshot(snapshot: SavedGraph) {
    if (!api) return
    suppressHistoryRef.current = true
    try {
      await loadGraph(api, snapshot)
      historyKeyRef.current = getHistoryKey(snapshot)
      updateHistoryState()
    } finally {
      window.setTimeout(() => {
        suppressHistoryRef.current = false
      }, 200)
    }
  }

  async function undoCanvas() {
    if (!api || historyRef.current.length < 2) return
    const current = historyRef.current[historyRef.current.length - 1]
    const previous = historyRef.current[historyRef.current.length - 2]
    historyRef.current = historyRef.current.slice(0, -1)
    redoRef.current = [current, ...redoRef.current].slice(0, 60)
    setWorkflowNotice('已撤销上一步画布编辑。')
    await restoreHistorySnapshot(previous)
  }

  async function redoCanvas() {
    if (!api || redoRef.current.length === 0) return
    const next = redoRef.current[0]
    redoRef.current = redoRef.current.slice(1)
    historyRef.current = [...historyRef.current, next].slice(-60)
    setWorkflowNotice('已重做下一步画布编辑。')
    await restoreHistorySnapshot(next)
  }

  useEffect(() => {
    let cancelled = false

    async function loadPlatformResources() {
      try {
        const [context, fields, templates, dictionaries, tables, operators, drafts, receipts] = await Promise.all([
          getPlatformProjectContext(),
          listPlatformFields(),
          listCalculationBookTemplates(),
          listPlatformDictionaries(),
          listPlatformTables(),
          listPlatformOperators(),
          listCalculationBookDrafts(),
          listPlatformResultReceipts(),
        ])
        if (cancelled) return
        setPlatformContext(context)
        setPlatformFields(fields)
        setCalculationTemplates(templates)
        setPlatformDictionaries(dictionaries)
        setPlatformTables(tables)
        setPlatformOperators(operators)
        setPlatformDrafts(drafts)
        setPlatformReceipts(receipts)
      } catch (error) {
        if (!cancelled) {
          setPlatformRun(`平台资源读取失败：${error instanceof Error ? error.message : String(error)}`)
        }
      }
    }

    void loadPlatformResources()
    return () => {
      cancelled = true
    }
  }, [])

  async function refreshPlatformDrafts() {
    try {
      const [drafts, receipts] = await Promise.all([
        listCalculationBookDrafts(),
        listPlatformResultReceipts(),
      ])
      setPlatformDrafts(drafts)
      setPlatformReceipts(receipts)
    } catch (error) {
      setPlatformRun(`平台草稿列表读取失败：${error instanceof Error ? error.message : String(error)}`)
    }
  }

  useEffect(() => {
    setFieldDraft(stats.selected?.variableName || '')
  }, [stats.selected?.id, stats.selected?.variableName])

  useEffect(() => {
    if (!(stats.selected instanceof FieldInputNode)) return
    setFieldInputDraft({
      fieldKey: stats.selected.fieldKey,
      fieldLabel: stats.selected.fieldLabel,
      unit: stats.selected.unit,
      discipline: stats.selected.discipline,
      description: stats.selected.description,
      value: String(stats.selected.control.value ?? ''),
    })
  }, [stats.selected?.id])

  useEffect(() => {
    function handleHistoryShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      const key = event.key.toLowerCase()
      if ((event.ctrlKey || event.metaKey) && key === 'z') {
        event.preventDefault()
        if (event.shiftKey) void redoCanvas()
        else void undoCanvas()
      }
      if ((event.ctrlKey || event.metaKey) && key === 'y') {
        event.preventDefault()
        void redoCanvas()
      }
      if ((event.ctrlKey || event.metaKey) && key === 'd') {
        event.preventDefault()
        void duplicateSelectedNodes()
      }
    }

    window.addEventListener('keydown', handleHistoryShortcut)
    return () => window.removeEventListener('keydown', handleHistoryShortcut)
  }, [api, historyState.undo, historyState.redo, stats.selected?.id])

  function captureCanvasHistoryNow() {
    captureHistorySnapshot()
  }

  useEffect(() => {
    if (!(stats.selected instanceof FormulaCellNode)) return
    setFormulaDraft({
      title: stats.selected.label,
      latex: stats.selected.latexFormula,
      expression: stats.selected.expression,
      inputs: stats.selected.inputConfigs.map((cfg) => cfg.key).join(', '),
      outputKey: stats.selected.outputKey,
      outputLabel: stats.selected.outputLabel,
    })
  }, [stats.selected?.id])

  const quickItems = nodeCategories.flatMap((cat) =>
    cat.items.map((item) => ({ ...item, category: cat.name }))
  )
  const filteredQuickItems = quickAdd
    ? quickItems
        .filter((item) => item.label.toLowerCase().includes(quickAdd.query.trim().toLowerCase()))
        .slice(0, 8)
    : []

  async function addQuickNode(factory: () => GHNode) {
    if (!api || !quickAdd) return
    const node = factory()
    node.setGraphContext(api.editor, api.area)
    await api.editor.addNode(node)
    await api.area.translate(node.id, {
      x: quickAdd.worldX - (node.width || 160) / 2,
      y: quickAdd.worldY - (node.height || 60) / 2,
    })
    await api.area.update('node', node.id)
    setQuickAdd(null)
    triggerExecute()
  }

  async function addNodeAtCenter(node: GHNode, offsetIndex = 0) {
    if (!api) return
    node.setGraphContext(api.editor, api.area)
    await api.editor.addNode(node)

    const rect = containerRef.current?.getBoundingClientRect()
    const transform = api.area.area.transform
    const worldX = rect ? ((rect.width * 0.55 - transform.x) / transform.k) : 420
    const worldY = rect ? ((rect.height * 0.35 - transform.y) / transform.k) : 180
    await api.area.translate(node.id, { x: worldX, y: worldY + offsetIndex * 140 })
    await api.area.update('node', node.id)
  }

  async function addPlatformFieldInput(field: PlatformFieldDefinition, offsetIndex = 0) {
    if (!api) return
    const node = new FieldInputNode(field.key, field.label, field.defaultValue, field.unit, field.discipline, field.description)
    node.label = `${field.label} ${field.key}`
    await addNodeAtCenter(node, offsetIndex)
    triggerExecute()
    setWorkflowNotice(`已从平台字段库添加输入字段 ${field.key}（${field.label}）。`)
  }

  async function applyCalculationTemplate(code: string) {
    if (!api || platformLoading) return
    const templateSummary = calculationTemplates.find((item) => item.code === code)
    const confirmed = window.confirm(`套用「${templateSummary?.name || code}」会替换当前画布，是否继续？`)
    if (!confirmed) return

    setPlatformLoading(true)
    try {
      const template = await getCalculationBookTemplate(code)
      await loadGraph(api, template.graph as SavedGraph)
      setActiveTab('assistant')
      setWorkflowNotice(`已套用平台计算书模板「${template.name}」，可直接调整输入、执行计算并回传平台。`)
    } catch (error) {
      setPlatformRun(`套用计算书模板失败：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setPlatformLoading(false)
    }
  }

  function openQuickAdd(e: MouseEvent<HTMLDivElement>) {
    if (!api) return
    const target = e.target as HTMLElement
    if (target.closest('.gh-node, .rete-context-menu, .gh-quick-add')) return
    const rect = e.currentTarget.getBoundingClientRect()
    const transform = api.area.area.transform
    const localX = e.clientX - rect.left
    const localY = e.clientY - rect.top
    setQuickAdd({
      x: e.clientX,
      y: e.clientY,
      worldX: (localX - transform.x) / transform.k,
      worldY: (localY - transform.y) / transform.k,
      query: '',
    })
  }

  function describeSelectedNode() {
    const node = stats.selected
    if (!node) return null

    const inputs = Object.keys(node.inputs)
    const outputs = Object.keys(node.outputs)
    return {
      title: node.label,
      category: node.category,
      inputs: inputs.length,
      outputs: outputs.length,
      display: node.display || '尚未执行，暂无结果预览。',
    }
  }

  function getPortRows(node: GHNode | null, direction: 'input' | 'output') {
    if (!node) return []
    const ports = direction === 'input' ? node.inputs : node.outputs
    const aliases = direction === 'input' ? node.inputAliases : node.outputAliases
    return Object.entries(ports)
      .filter(([, port]) => Boolean(port))
      .map(([key, port]) => {
        const label = (port as { label?: string } | undefined)?.label || key
        return {
          key,
          label,
          aliases: aliases?.[key] || [],
        }
      })
  }

  function getFieldRows() {
    if (!api) return []
    return (api.editor.getNodes() as GHNode[])
      .flatMap((node) => Object.keys(node.outputs).map((outputKey) => ({
        node,
        outputKey,
        label: (node.outputs[outputKey] as { label?: string } | undefined)?.label || outputKey,
        fieldNames: [
          ...(outputKey === 'value' || outputKey === 'result' ? [node.variableName || ''] : []),
          ...(node.outputAliases?.[outputKey] || []),
        ].filter(Boolean),
      })))
      .filter((row) => row.fieldNames.length > 0)
  }

  function getDeliveryChecklist() {
    if (!api) return []
    const nodes = api.editor.getNodes() as GHNode[]
    const pythonNodes = nodes.filter((node): node is PythonScriptNode => node instanceof PythonScriptNode)
    return [
      {
        label: '项目上下文',
        ready: nodes.some((node) => node instanceof ProjectContextNode),
        detail: 'Project Context 接入项目、WBS 和文控目标',
      },
      {
        label: '平台字段输入',
        ready: nodes.some((node) => node instanceof FieldInputNode),
        detail: 'Field Input 保存字段 key、单位和说明',
      },
      {
        label: '参数表章节',
        ready: nodes.some((node) => node instanceof FieldTableNode),
        detail: 'Field Table 生成计算书参数表',
      },
      {
        label: '计算书终端',
        ready: nodes.some((node) => node instanceof BookAssemblerNode || node instanceof ReportNode),
        detail: 'Book Assembler 或 Report 作为最终正文',
      },
      {
        label: '平台回传',
        ready: nodes.some((node) => node instanceof PlatformReturnNode),
        detail: 'Platform Return 支持节点级成果回传',
      },
      {
        label: 'Python 测试',
        ready: pythonNodes.length === 0 || pythonNodes.every((node) => node.testCase || node.platformOperator?.testCase),
        detail: pythonNodes.length === 0 ? '当前无 Python 电池' : '自定义 Python 电池具备测试用例',
      },
    ]
  }

  function getTraceRows() {
    if (!api) return []
    const nodes = api.editor.getNodes() as GHNode[]
    return nodes.flatMap((node) => {
      if (!node.lastOutputs) return []
      return Object.entries(node.lastOutputs).map(([outputKey, value]) => {
        const outputLabel = (node.outputs[outputKey] as { label?: string } | undefined)?.label || outputKey
        const aliases = [
          ...(outputKey === 'value' || outputKey === 'result' ? [node.variableName || ''] : []),
          ...(node.outputAliases?.[outputKey] || []),
        ].filter(Boolean)
        const fieldKey = aliases[0] || `${normalizePythonKey(node.label, 'node')}_${normalizePythonKey(outputKey, 'output')}`
        return {
          fieldKey,
          aliases,
          value,
          nodeId: node.id,
          nodeLabel: node.label,
          nodeCategory: node.category,
          outputKey,
          outputLabel,
          inputs: node.lastInputs || {},
          outputs: node.lastOutputs || {},
          display: node.resultDisplay || node.display || '',
        }
      })
    })
  }

  function getExecutionDebugRows() {
    if (!api) return []
    return (api.editor.getNodes() as GHNode[]).map((node) => {
      const outputs = Object.entries(node.lastOutputs || {})
      const display = node.display || node.resultDisplay || ''
      const hasError = /error|失败|blocked|阻止|✗/i.test(display)
      const hasZeroOnlyOutputs = outputs.length > 0 && outputs.every(([, value]) => (
        typeof value === 'number' && value === 0
      ))
      const status = hasError
        ? 'error'
        : outputs.length === 0 && Object.keys(node.outputs).length > 0
          ? 'pending'
          : hasZeroOnlyOutputs
            ? 'warning'
            : 'ok'
      return {
        id: node.id,
        label: node.label,
        category: node.category,
        status,
        inputs: Object.keys(node.lastInputs || {}).length,
        outputs: outputs.length,
        summary: display || node.resultDisplay || '尚无执行结果',
      }
    })
  }

  async function runCanvasAudit(options: { switchTab?: boolean } = {}) {
    if (!api) return null

    triggerExecute()
    await new Promise((resolve) => window.setTimeout(resolve, 350))
    const nodes = api.editor.getNodes() as GHNode[]
    const connections = api.editor.getConnections()
    const connectedInputs = new Set(connections.map((conn) => `${conn.target}:${String(conn.targetInput)}`))
    const items: CanvasAuditItem[] = []
    const addItem = (level: CanvasAuditItem['level'], title: string, detail: string) => {
      items.push({ level, title, detail })
    }

    const unconnectedInputs = nodes.flatMap((node) =>
      Object.entries(node.inputs)
        .filter(([key, input]) => (
          Boolean(input) &&
          !input?.control &&
          !connectedInputs.has(`${node.id}:${key}`) &&
          !isOptionalPlatformReturnInput(node, key)
        ))
        .map(([key, input]) => `${node.label}.${(input as { label?: string } | undefined)?.label || key}`)
    )
    if (unconnectedInputs.length > 0) {
      addItem('error', '存在未连接输入', unconnectedInputs.slice(0, 8).join(' / '))
    } else {
      addItem('success', '输入连接完整', '所有无默认控件的输入端口都已有连接。')
    }

    const reportNodes = nodes.filter(isTemplateReportNode)
    const fieldTableNodes = nodes.filter((node) => node instanceof FieldTableNode)
    const projectContextNodes = nodes.filter((node) => node instanceof ProjectContextNode)
    const primaryReport = reportNodes.find((node) => node instanceof BookAssemblerNode) || reportNodes.find((node) => node instanceof ReportNode)
    if (!primaryReport) {
      addItem('error', '缺少最终计算书终端', '平台回传和计算书草稿需要 Report 或 Book Assembler 展示节点。')
    } else if (!primaryReport.display || primaryReport.display.includes('N/A')) {
      addItem('error', '计算书仍有缺值', primaryReport.display || '计算书终端尚未执行或模板为空。')
    } else {
      addItem('success', '计算书可交付', `已生成 ${primaryReport.display.length} 字符的计算书正文。`)
    }
    const reportWithOutputs = reportNodes.filter((node) => (
      (node instanceof ReportNode || node instanceof BookAssemblerNode) &&
      Object.keys(node.outputs).length > 0
    ))
    if (reportWithOutputs.length > 0) {
      addItem('warning', '计算书终端不应暴露输出端口', reportWithOutputs.map((node) => node.label).join(' / '))
    }
    if (fieldTableNodes.length === 0) {
      addItem('warning', '缺少字段参数表', '建议添加 Field Table，将平台字段输入自动编排为计算书参数表。')
    } else {
      addItem('success', '字段参数表已编排', `已放置 ${fieldTableNodes.length} 个 Field Table 参数表电池。`)
    }
    if (projectContextNodes.length === 0) {
      addItem('warning', '缺少项目上下文', '建议添加 Project Context，将项目、WBS、计算书编号和文控目标接入计算书。')
    } else {
      addItem('success', '项目上下文已接入', `已放置 ${projectContextNodes.length} 个 Project Context 电池。`)
    }

    const fieldRows = getFieldRows()
    if (fieldRows.length === 0) {
      addItem('warning', '缺少字段追踪', '建议为输入和关键输出设置变量名，方便平台资源映射和自动连接。')
    } else {
      addItem('success', '字段可追踪', `当前有 ${fieldRows.length} 个可识别字段。`)
    }

    const formulaNodes = nodes.filter((node): node is FormulaCellNode => node instanceof FormulaCellNode)
    if (formulaNodes.length > 0) {
      addItem('warning', '存在待 Python 化公式电池', `${formulaNodes.map((node) => node.label).slice(0, 5).join(' / ')}；建议执行“公式全转 Python”以统一原生 Python 内核。`)
    } else {
      addItem('success', '公式已 Python-first', '当前画布没有遗留 Formula Cell，可按原生 Python 内核路线交付。')
    }

    const platformReturnNodes = nodes.filter((node) => node instanceof PlatformReturnNode)
    if (platformReturnNodes.length === 0) {
      addItem('warning', '未放置电池级回传节点', '仍可通过“生成计算书草稿并回传”提交；若要节点级回传，可添加 Platform Return。')
    } else {
      addItem('success', '存在平台回传节点', `已放置 ${platformReturnNodes.length} 个 Platform Return 电池。`)
    }

    const pythonNodes = nodes.filter((node): node is PythonScriptNode => node instanceof PythonScriptNode)
    const unsafePythonNodes = pythonNodes
      .map((node) => ({ node, issues: validatePythonSafety(node.code) }))
      .filter((item) => item.issues.length > 0)
    if (unsafePythonNodes.length > 0) {
      addItem('error', 'Python 电池包含受限能力', unsafePythonNodes.map((item) => `${item.node.label}: ${item.issues.map((issue) => issue.token).join(', ')}`).slice(0, 5).join(' / '))
    } else if (pythonNodes.length > 0) {
      addItem('success', 'Python 沙箱检查通过', `${pythonNodes.length} 个 Python 电池未发现文件、网络或系统命令访问。`)
    }
    const pythonWithoutTests = pythonNodes.filter((node) => !node.testCase && !node.platformOperator?.testCase)
    const pythonFailedTests = pythonNodes.filter((node) => node.testStatus?.status === 'fail')
    if (pythonFailedTests.length > 0) {
      addItem('error', 'Python 测试用例未通过', pythonFailedTests.map((node) => `${node.label}: ${node.testStatus?.summary || '输出与期望不一致'}`).slice(0, 5).join(' / '))
    } else if (pythonWithoutTests.length > 0) {
      addItem('warning', 'Python 电池缺少测试用例', pythonWithoutTests.map((node) => node.label).slice(0, 5).join(' / '))
    } else if (pythonNodes.length > 0) {
      addItem('success', 'Python 测试用例完整', `${pythonNodes.length} 个 Python 电池已有本地或平台测试用例。`)
    }

    const unpublishedPython = pythonNodes.filter((node) => !node.platformOperator)
    if (unpublishedPython.length > 0) {
      addItem('warning', '存在未沉淀的 Python 电池', unpublishedPython.map((node) => node.label).slice(0, 5).join(' / '))
    } else if (pythonNodes.length > 0) {
      addItem('success', 'Python 算子已关联平台', `${pythonNodes.length} 个 Python 电池均已有关联算子信息。`)
    }
    const mergedPythonGroups = pythonNodes.filter((node) => node.mergedGraph)
    if (mergedPythonGroups.length > 0) {
      addItem('success', '存在可拆分电池组', `${mergedPythonGroups.length} 个 Python 电池保留来源子图，可拆分恢复。`)
    }

    const autoConnections = connections.filter((conn) => conn.isAutoVariable).length
    if (autoConnections > 0) {
      addItem('success', '字段自动连接已启用', `当前有 ${autoConnections} 条字段虚线连接。`)
    } else {
      addItem('warning', '未发现字段自动连接', '可点击“自动连接字段”或让 AI 执行 auto_connect_fields。')
    }

    const errorCount = items.filter((item) => item.level === 'error').length
    const warningCount = items.filter((item) => item.level === 'warning').length
    const score = Math.max(0, 100 - errorCount * 30 - warningCount * 10)
    const audit: CanvasAudit = {
      score,
      status: errorCount === 0 ? 'ready' : 'needs-work',
      checkedAt: new Date().toLocaleString(),
      items,
    }

    setCanvasAudit(audit)
    if (options.switchTab !== false) setActiveTab('results')
    setWorkflowNotice(errorCount === 0
      ? `画布健康检查通过，评分 ${score}。可以生成草稿、回传平台或继续让 AI 优化。`
      : `画布健康检查发现 ${errorCount} 个阻塞项，建议先修复再回传平台。`
    )
    return audit
  }

  function isOptionalPlatformReturnInput(node: GHNode, key: string) {
    return node instanceof PlatformReturnNode && (key === 'title' || key === 'report')
  }

  async function applySelectedFieldName() {
    if (!api || !stats.selected) return
    const fieldName = fieldDraft.trim()
    stats.selected.variableName = fieldName || undefined

    const outputKeys = Object.keys(stats.selected.outputs)
    const primaryOutput = outputKeys.includes('value')
      ? 'value'
      : outputKeys.includes('result')
        ? 'result'
        : outputKeys[0]
    if (primaryOutput) {
      stats.selected.outputAliases = {
        ...stats.selected.outputAliases,
        [primaryOutput]: fieldName ? [fieldName] : [],
      }
    }

    await api.area.update('node', stats.selected.id)
    const created = fieldName ? await autoConnectFields(api.editor) : 0
    triggerExecute()
    setWorkflowNotice(fieldName
      ? `已将「${stats.selected.label}」标记为字段 ${fieldName}${created > 0 ? `，并自动连接 ${created} 条同名输入。` : '。'}`
      : `已清除「${stats.selected.label}」的字段名。`
    )
  }

  async function applySelectedFieldInputConfig() {
    if (!api || !(stats.selected instanceof FieldInputNode)) return
    const node = stats.selected
    const fieldKey = normalizePythonKey(fieldInputDraft.fieldKey, node.fieldKey || 'field')
    const fieldLabel = fieldInputDraft.fieldLabel.trim() || fieldKey
    const parsedValue = Number(fieldInputDraft.value)

    if (!fieldKey) {
      setWorkflowNotice('字段 Key 不能为空。')
      return
    }
    if (!Number.isFinite(parsedValue)) {
      setWorkflowNotice('字段当前值必须是可计算的数字。')
      return
    }

    node.fieldKey = fieldKey
    node.fieldLabel = fieldLabel
    node.unit = fieldInputDraft.unit.trim()
    node.discipline = fieldInputDraft.discipline.trim()
    node.description = fieldInputDraft.description.trim()
    node.control.setValue(parsedValue)
    node.syncFieldMetadata()
    setFieldDraft(fieldKey)
    setFieldInputDraft({
      fieldKey,
      fieldLabel,
      unit: node.unit,
      discipline: node.discipline,
      description: node.description,
      value: String(node.control.value ?? ''),
    })

    await api.area.update('node', node.id)
    const created = await autoConnectFields(api.editor)
    triggerExecute()
    setWorkflowNotice(`已更新平台字段「${fieldLabel}」，变量名 ${fieldKey}${created > 0 ? ` 已自动连接 ${created} 条同名输入。` : ' 可用于一键虚线连接。'}`)
  }

  async function applySelectedFormulaConfig() {
    if (!api || !(stats.selected instanceof FormulaCellNode)) return
    const inputs = parseFormulaInputList(formulaDraft.inputs)
    const outputKey = normalizePythonKey(formulaDraft.outputKey, 'result')
    const outputLabel = formulaDraft.outputLabel.trim() || outputKey

    if (inputs.length === 0 || !formulaDraft.expression.trim()) {
      setWorkflowNotice('公式电池至少需要 1 个输入变量和 1 条 Python 表达式。')
      return
    }

    const node = stats.selected
    await node.removeInvalidConnections(inputs.map((cfg) => cfg.key), [outputKey])
    node.label = formulaDraft.title.trim() || 'Formula Cell'
    node.latexFormula = formulaDraft.latex.trim() || formulaDraft.expression.trim()
    node.expression = formulaDraft.expression.trim()
    node.inputConfigs = inputs
    node.outputKey = outputKey
    node.outputLabel = outputLabel
    node.rebuildPorts()
    await api.area.update('node', node.id)
    triggerExecute()
    setWorkflowNotice(`已更新公式电池「${node.label}」，输出字段 ${outputLabel}。`)
  }

  async function convertSelectedFormulaToPython() {
    if (!api || !(stats.selected instanceof FormulaCellNode)) return null
    return await convertFormulaNodeToPython(stats.selected)
  }

  async function convertAllFormulaNodesToPython() {
    if (!api) return []
    const formulaNodes = (api.editor.getNodes() as GHNode[]).filter((node): node is FormulaCellNode => node instanceof FormulaCellNode)
    const converted: PythonScriptNode[] = []
    for (const node of formulaNodes) {
      const pythonNode = await convertFormulaNodeToPython(node, { silent: true })
      if (pythonNode) converted.push(pythonNode)
    }
    if (converted.length === 0) {
      setWorkflowNotice('当前画布没有需要转换的公式电池。')
    } else {
      setActiveTab('assistant')
      setWorkflowNotice(`已将 ${converted.length} 个公式电池批量转换为原生 Python 电池，并保留上下游连线。`)
      await autoConnectFields(api.editor)
      triggerExecute()
    }
    return converted
  }

  async function convertFormulaNodeToPython(node: FormulaCellNode, options: { silent?: boolean } = {}) {
    if (!api) return null
    const pythonNode = new PythonScriptNode()
    pythonNode.label = `${node.label} Python`
    pythonNode.code = buildPythonCodeFromFormula(node)
    pythonNode.inputConfigs = node.inputConfigs.map((cfg) => ({ key: cfg.key, label: cfg.label, type: 'number' }))
    pythonNode.outputConfigs = [{ key: node.outputKey, label: node.outputLabel, type: 'number' }]
    pythonNode.variableName = node.variableName
    pythonNode.inputAliases = node.inputAliases
    pythonNode.outputAliases = node.outputAliases
    pythonNode.rebuildPorts()
    pythonNode.setGraphContext(api.editor, api.area)

    const position = api.area.nodeViews.get(node.id)?.position || { x: 420, y: 220 }
    const connections = [...api.editor.getConnections()]
    const inbound = connections.filter((connection) => connection.target === node.id)
    const outbound = connections.filter((connection) => connection.source === node.id)

    await api.editor.addNode(pythonNode)
    await api.area.translate(pythonNode.id, position)

    for (const connection of [...inbound, ...outbound]) {
      await api.editor.removeConnection(connection.id)
    }

    for (const connection of inbound) {
      const source = api.editor.getNode(connection.source)
      const targetInput = String(connection.targetInput)
      if (!source || !(String(connection.sourceOutput) in source.outputs) || !(targetInput in pythonNode.inputs)) continue
      const next = new ClassicPreset.Connection(source, connection.sourceOutput, pythonNode, targetInput) as Schemes['Connection']
      next.isAutoVariable = connection.isAutoVariable
      next.variableName = connection.variableName
      await api.editor.addConnection(next)
    }

    for (const connection of outbound) {
      const target = api.editor.getNode(connection.target)
      const sourceOutput = String(connection.sourceOutput)
      if (!target || !(sourceOutput in pythonNode.outputs) || !(String(connection.targetInput) in target.inputs)) continue
      const next = new ClassicPreset.Connection(pythonNode, sourceOutput, target, connection.targetInput) as Schemes['Connection']
      next.isAutoVariable = connection.isAutoVariable
      next.variableName = connection.variableName
      await api.editor.addConnection(next)
    }

    await api.editor.removeNode(node.id)
    await api.area.update('node', pythonNode.id)
    triggerExecute()
    if (!options.silent) {
      setActiveTab('assistant')
      setWorkflowNotice(`已将公式电池「${node.label}」转换为原生 Python 电池「${pythonNode.label}」，并保留上下游连线。`)
    }
    return pythonNode
  }

  function buildPythonCodeFromFormula(node: FormulaCellNode) {
    const inputDefaults = node.inputConfigs
      .map((cfg) => `if ${cfg.key} is None: ${cfg.key} = 0`)
      .join('\n')
    return [
      'import math',
      '',
      '# Generated from Formula Cell',
      inputDefaults,
      '',
      `${node.outputKey} = ${node.expression}`,
    ].join('\n')
  }

  async function addOperatorTestInputs() {
    if (!api || !(stats.selected instanceof PythonScriptNode) || !stats.selected.platformOperator?.testCase) return
    const testInputs = stats.selected.platformOperator.testCase.inputs
    const targetPosition = api.area.nodeViews.get(stats.selected.id)?.position || { x: 560, y: 220 }
    let index = 0

    for (const [key, value] of Object.entries(testInputs)) {
      const node = new NumberNode(value, -100000000, 100000000, key)
      node.setGraphContext(api.editor, api.area)
      await api.editor.addNode(node)
      await api.area.translate(node.id, {
        x: targetPosition.x - 260,
        y: targetPosition.y + index * 92,
      })
      await api.area.update('node', node.id)
      index++
    }

    const created = await autoConnectFields(api.editor)
    triggerExecute()
    setWorkflowNotice(`已为「${stats.selected.label}」生成 ${index} 个测试输入，并自动连接 ${created} 条字段线。`)
  }

  async function publishSelectedPythonOperator() {
    if (!api || !(stats.selected instanceof PythonScriptNode) || platformLoading) return
    await publishPythonOperatorNode(stats.selected)
  }

  async function publishPythonOperatorNode(node: PythonScriptNode) {
    if (!api || platformLoading) return null
    setPlatformLoading(true)

    try {
      const safetyIssues = validatePythonSafety(node.code)
      if (safetyIssues.length > 0) {
        setWorkflowNotice(`发布已阻止：「${node.label}」包含受限 Python 能力：${safetyIssues.map((issue) => `${issue.token}（${issue.reason}）`).join('、')}。`)
        return null
      }

      triggerExecute()
      await new Promise((resolve) => window.setTimeout(resolve, 250))
      const testCase = collectPythonOperatorTestCase(node)
      const operator = await publishPlatformOperator({
        name: node.label,
        code: getPythonOperatorCode(node),
        sourceCode: node.code,
        inputs: node.inputConfigs.map((cfg) => cfg.key),
        outputs: node.outputConfigs.map((cfg) => cfg.key),
        description: `由画布电池「${node.label}」发布，输入 ${node.inputConfigs.map((cfg) => cfg.key).join(', ')}，输出 ${node.outputConfigs.map((cfg) => cfg.key).join(', ')}。`,
        testCase,
      })
      node.platformOperator = {
        code: operator.code,
        name: operator.name,
        version: operator.version,
        status: operator.status,
        description: operator.description,
        testCase: operator.testCase,
      }
      setPlatformOperators((items) => [
        {
          code: operator.code,
          name: operator.name,
          language: operator.language,
          version: operator.version,
          inputs: operator.inputs,
          outputs: operator.outputs,
          status: operator.status,
          description: operator.description,
          hasSource: true,
          hasTestCase: Boolean(operator.testCase),
        },
        ...items.filter((item) => item.code !== operator.code),
      ])
      await api.area.update('node', node.id)
      setActiveTab('properties')
      setWorkflowNotice(`已发布「${node.label}」为平台 Python 算子 ${operator.code}，${operator.testCase ? '已附带测试用例' : '当前画布暂无完整数字测试用例'}，可在算子引擎中复用。`)
      return operator
    } catch (error) {
      setWorkflowNotice(`发布平台算子失败：${error instanceof Error ? error.message : String(error)}`)
      return null
    } finally {
      setPlatformLoading(false)
    }
  }

  function getPythonOperatorCode(node: PythonScriptNode) {
    if (node.label.includes('Python 化')) return 'python_kernel'
    if (node.label.includes('合并')) return 'merged_cell_group'
    return normalizePythonKey(node.label.toLowerCase(), 'custom_operator')
  }

  function collectPythonOperatorTestCase(node: PythonScriptNode) {
    if (node.testCase) {
      node.testStatus = comparePythonTestCase(node)
      return node.testCase
    }

    const inputs: Record<string, number> = {}
    const expected: Record<string, number> = {}

    for (const cfg of node.inputConfigs) {
      const value = node.lastInputs?.[cfg.key]
      if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
      inputs[cfg.key] = value
    }

    for (const cfg of node.outputConfigs) {
      const value = node.lastOutputs?.[cfg.key]
      if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
      expected[cfg.key] = value
    }

    if (Object.keys(inputs).length === 0 || Object.keys(expected).length === 0) return undefined
    node.testCase = { inputs, expected }
    node.testStatus = { status: 'pass', summary: '已从当前画布执行结果生成测试用例。', checkedAt: new Date().toISOString() }
    return node.testCase
  }

  function comparePythonTestCase(node: PythonScriptNode) {
    if (!node.testCase) return undefined
    const mismatches: string[] = []
    for (const [key, expected] of Object.entries(node.testCase.expected)) {
      const actual = node.lastOutputs?.[key]
      if (typeof actual !== 'number' || Math.abs(actual - expected) > Math.max(1e-6, Math.abs(expected) * 1e-6)) {
        mismatches.push(`${key}: expected ${expected}, got ${typeof actual === 'number' ? actual : 'N/A'}`)
      }
    }
    return mismatches.length > 0
      ? { status: 'fail' as const, summary: mismatches.join('；'), checkedAt: new Date().toISOString() }
      : { status: 'pass' as const, summary: '测试用例通过，当前输出与期望值一致。', checkedAt: new Date().toISOString() }
  }

  async function auditSelectedPlatformOperator() {
    if (!api || !(stats.selected instanceof PythonScriptNode) || !stats.selected.platformOperator || platformLoading) return
    await auditPythonOperatorNode(stats.selected)
  }

  async function auditPythonOperatorNode(node: PythonScriptNode) {
    if (!api || !node.platformOperator || platformLoading) return null
    const currentOperator = node.platformOperator
    const operatorCode = currentOperator.code
    setPlatformLoading(true)

    try {
      const operator = await auditPlatformOperator(operatorCode)
      node.platformOperator = {
        code: operator.code,
        name: operator.name,
        version: operator.version,
        status: operator.status,
        description: operator.description,
        testCase: operator.testCase,
        audit: operator.audit,
      }
      setPlatformOperators((items) => items.map((item) => (
        item.code === operator.code
          ? {
              ...item,
              status: operator.status,
              description: operator.description,
              hasSource: true,
              hasTestCase: Boolean(operator.testCase),
            }
          : item
      )))
      await api.area.update('node', node.id)
      setWorkflowNotice(`平台算子审核完成：${operator.name} · ${operator.audit?.status || operator.status} · ${operator.audit?.score ?? '-'} 分。`)
      return operator
    } catch (error) {
      setWorkflowNotice(`平台算子审核失败：${error instanceof Error ? error.message : String(error)}`)
      return null
    } finally {
      setPlatformLoading(false)
    }
  }

  function getSelectedNodes() {
    return (api?.editor.getNodes() as (GHNode & { selected?: boolean })[] | undefined)
      ?.filter((node) => node.selected) || []
  }

  async function duplicateSelectedNodes() {
    if (!api) return

    const selected = getSelectedNodes()
    const fallbackSelected = stats.selected ? [stats.selected] : []
    const targets = selected.length > 0 ? selected : fallbackSelected

    if (targets.length === 0) {
      setActiveTab('properties')
      setWorkflowNotice('请先选中一个领域电池或电池组，再执行复制。')
      return
    }

    const snapshot = makeSelectedGraphSnapshot(new Set(targets.map((node) => node.id)))
    if (!snapshot || snapshot.nodes.length === 0) {
      setWorkflowNotice('当前选中内容无法复制，请重新选择节点后再试。')
      return
    }

    const sourcePositions = snapshot.nodes.map((node) => node.position)
    const sourceMinX = Math.min(...sourcePositions.map((position) => position.x))
    const sourceMinY = Math.min(...sourcePositions.map((position) => position.y))
    const copyIndex = api.editor.getNodes().length + 1
    const duplicateGraph: SavedGraph = {
      ...snapshot,
      nodes: snapshot.nodes.map((node) => ({
        ...node,
        label: targets.length === 1 ? `${node.label} Copy` : node.label,
        position: {
          x: node.position.x - sourceMinX,
          y: node.position.y - sourceMinY,
        },
      })),
      viewport: { ...snapshot.viewport },
    }

    await appendGraph(api, duplicateGraph, {
      x: sourceMinX + 56,
      y: sourceMinY + 56,
    })
    await runFieldAutoConnect({ silent: true })
    captureCanvasHistoryNow()
    setWorkflowNotice(
      targets.length === 1
        ? `已复制领域电池「${targets[0].label}」，保留配置并偏移放置为第 ${copyIndex} 个节点。`
        : `已复制 ${targets.length} 个电池及其内部连线，可继续合并为领域电池组或 Python 化。`
    )
  }

  async function deleteSelectedNode() {
    if (!api || !stats.selected) {
      setWorkflowNotice('请先选中一个节点，再执行删除。')
      return
    }

    const target = stats.selected
    const connections = api.editor.getConnections().filter((connection) =>
      connection.source === target.id || connection.target === target.id
    )
    for (const connection of connections) {
      await api.editor.removeConnection(connection.id)
    }
    await api.editor.removeNode(target.id)
    triggerExecute()
    captureCanvasHistoryNow()
    setWorkflowNotice(`已删除节点「${target.label}」，并清理 ${connections.length} 条相关连线。`)
  }

  async function expandSelectedMergedGraph() {
    if (!api || !(stats.selected instanceof PythonScriptNode) || !stats.selected.mergedGraph) {
      setWorkflowNotice('当前选中节点没有可展开的来源子图。请选中由“合并/Python化”生成的电池组。')
      return
    }

    const selected = stats.selected
    const position = api.area.nodeViews.get(selected.id)?.position || { x: 0, y: 0 }
    const restored = await appendGraph(api, selected.mergedGraph as SavedGraph, {
      x: position.x + 72,
      y: position.y + 72,
    })
    triggerExecute()
    captureCanvasHistoryNow()
    setWorkflowNotice(`已展开「${selected.label}」的来源子图，共恢复 ${restored.size} 个节点快照。`)
  }

  function getPythonizableCanvasNodes() {
    if (!api) return []
    return (api.editor.getNodes() as GHNode[]).filter((node) => (
      node.label !== 'Number' && isPythonizableNode(node)
    ))
  }

  function isPythonizableNode(node: GHNode) {
    if (node instanceof FormulaCellNode) return true
    return [
      'Number',
      'Pipe Area',
      'Velocity',
      'Pump Power',
      'Addition',
      'Subtraction',
      'Multiplication',
      'Division',
    ].includes(node.label)
  }

  function makeSelectedGraphSnapshot(selectedIds: Set<string>): SavedGraph | null {
    if (!api) return null
    const graph = serializeGraph(api)
    return {
      ...graph,
      nodes: graph.nodes.filter((node) => selectedIds.has(node.id)),
      connections: graph.connections.filter((connection) => (
        selectedIds.has(connection.source) && selectedIds.has(connection.target)
      )),
    }
  }

  async function runMergeAssistant() {
    if (!api) return null
    const selected = getSelectedNodes()
    const mergeNodes = selected.length >= 2 ? selected : getPythonizableCanvasNodes()
    const selectedCount = selected.length
    const mergeCount = mergeNodes.length
    const wholeCanvasMode = selectedCount < 2

    if (mergeCount >= 2) {
      const result = compileSelectedNodes(mergeNodes)
      if (!result) {
        setActiveTab('assistant')
        setWorkflowNotice(wholeCanvasMode
          ? '当前画布没有形成可整体 Python 化的支持节点链。可先使用 Number、Formula Cell、基础数学、Pipe Area、Velocity、Pump Power 等电池编排计算，再执行合并。'
          : '当前选择里包含暂不支持自动编译的节点。请先选择 Number、Formula Cell、基础数学、Pipe Area、Velocity、Pump Power 等可翻译电池，或让 AI 生成自定义 Python 电池。'
        )
        return null
      }

      const selectedIds = new Set(mergeNodes.map((node) => node.id))
      const snapshot = makeSelectedGraphSnapshot(selectedIds)
      if (!snapshot) return null

      const merged = new PythonScriptNode()
      merged.label = wholeCanvasMode ? 'Python 化计算内核' : '合并电池组'
      merged.code = result.code
      merged.inputConfigs = result.inputs
      merged.outputConfigs = result.outputs
      merged.mergedGraph = snapshot
      merged.mergedGraphLabel = mergeNodes.map((node) => node.label).join(' + ')
      merged.mergedBoundary = {
        inputs: Object.fromEntries(
          [...result.inboundInputKeys.entries()].map(([targetPort, inputKey]) => {
            const [target, targetInput] = targetPort.split(':')
            return [inputKey, { target, targetInput }]
          })
        ),
        outputs: Object.fromEntries(
          [...result.outboundOutputKeys.entries()].map(([sourcePort, outputKey]) => {
            const [source, sourceOutput] = sourcePort.split(':')
            return [outputKey, { source, sourceOutput }]
          })
        ),
      }
      merged.display = [
        '可复用 Python 电池组',
        `来源节点：${mergeNodes.length}`,
        `输入：${result.inputs.map((cfg) => cfg.key).join(', ') || '-'}`,
        `输出：${result.outputs.map((cfg) => cfg.key).join(', ') || '-'}`,
        '可拆分恢复来源子图',
      ].join('\n')
      merged.rebuildPorts()
      merged.setGraphContext(api.editor, api.area)
      await api.editor.addNode(merged)

      const positions = mergeNodes
        .map((node) => api.area.nodeViews.get(node.id)?.position)
        .filter((position): position is { x: number; y: number } => Boolean(position))
      const center = positions.length > 0
        ? {
            x: positions.reduce((sum, position) => sum + position.x, 0) / positions.length,
            y: positions.reduce((sum, position) => sum + position.y, 0) / positions.length,
          }
        : { x: 420, y: 220 }
      await api.area.translate(merged.id, center)

      const connections = [...api.editor.getConnections()]
      const inbound = connections.filter((connection) => (
        !selectedIds.has(connection.source) && selectedIds.has(connection.target)
      ))
      const outbound = connections.filter((connection) => (
        selectedIds.has(connection.source) && !selectedIds.has(connection.target)
      ))

      for (const connection of connections.filter((item) => selectedIds.has(item.source) || selectedIds.has(item.target))) {
        await api.editor.removeConnection(connection.id)
      }

      for (const connection of inbound) {
        const inputKey = result.inboundInputKeys.get(`${connection.target}:${String(connection.targetInput)}`)
        const source = api.editor.getNode(connection.source)
        if (!inputKey || !source || !(String(connection.sourceOutput) in source.outputs)) continue
        const next = new ClassicPreset.Connection(source, connection.sourceOutput, merged, inputKey) as Schemes['Connection']
        next.isAutoVariable = connection.isAutoVariable
        next.variableName = connection.variableName
        await api.editor.addConnection(next)
      }

      for (const connection of outbound) {
        const outputKey = result.outboundOutputKeys.get(`${connection.source}:${String(connection.sourceOutput)}`)
        const target = api.editor.getNode(connection.target)
        if (!outputKey || !target || !(String(connection.targetInput) in target.inputs)) continue
        const next = new ClassicPreset.Connection(merged, outputKey, target, connection.targetInput) as Schemes['Connection']
        next.isAutoVariable = connection.isAutoVariable
        next.variableName = connection.variableName
        await api.editor.addConnection(next)
      }

      for (const node of mergeNodes) {
        await api.editor.removeNode(node.id)
      }

      await api.area.update('node', merged.id)
      triggerExecute()
      setActiveTab('assistant')
      setWorkflowNotice(wholeCanvasMode
        ? `已将当前画布中的 ${mergeCount} 个计算节点封装为原生 Python 电池「Python 化计算内核」。Report 等终端节点已保留并重新接入。`
        : `已将 ${mergeCount} 个节点合并为 Python 电池「合并电池组」。原始子图已存入该电池，可选中它后执行拆分节点恢复。`
      )
      return merged
    }

    setActiveTab('assistant')
    setWorkflowNotice(
      selectedCount >= 2
        ? `已识别 ${selectedCount} 个待合并节点。建议生成一个领域电池组，并把外部依赖转成输入端口、末端结果转成输出端口。`
        : '当前画布没有足够的可 Python 化计算节点。请先编排至少 2 个 Number、Formula Cell 或流体公式节点。'
    )
    return null
  }

  async function pythonizeCanvasAndPublishOperator() {
    if (!api || platformLoading) return
    const merged = await runMergeAssistant()
    if (!(merged instanceof PythonScriptNode)) return
    await new Promise((resolve) => window.setTimeout(resolve, 350))
    const operator = await publishPythonOperatorNode(merged)
    if (operator) {
      setActiveTab('assistant')
      setWorkflowNotice(`已将当前画布 Python 化为「${merged.label}」，并发布为平台算子 ${operator.code}。后续可从算子引擎复用、审核并正式发布。`)
    }
  }

  async function pythonizePublishAndAuditOperator() {
    if (!api || platformLoading) return
    const target = stats.selected instanceof PythonScriptNode ? stats.selected : await runMergeAssistant()
    if (!(target instanceof PythonScriptNode)) return

    await new Promise((resolve) => window.setTimeout(resolve, 350))
    const operator = await publishPythonOperatorNode(target)
    if (!operator) return

    await new Promise((resolve) => window.setTimeout(resolve, 150))
    const audited = await auditPythonOperatorNode(target)
    setActiveTab('assistant')
    if (audited) {
      setWorkflowNotice(`已完成 Python 化、发布与审核：${audited.name} · ${audited.status} · ${audited.audit?.score ?? '-'} 分。`)
    } else {
      setWorkflowNotice(`已发布平台算子 ${operator.code}，但审核未完成，请稍后在属性栏重试审核。`)
    }
  }

  async function runSplitAssistant() {
    setActiveTab('assistant')
    if (api && stats.selected instanceof PythonScriptNode && stats.selected.mergedGraph) {
      const merged = stats.selected
      const position = api.area.nodeViews.get(merged.id)?.position || { x: 0, y: 0 }
      const externalConnections = api.editor.getConnections().filter((connection) => (
        connection.source === merged.id || connection.target === merged.id
      ))
      const inbound = externalConnections.filter((connection) => connection.target === merged.id)
      const outbound = externalConnections.filter((connection) => connection.source === merged.id)

      for (const connection of externalConnections) {
        await api.editor.removeConnection(connection.id)
      }

      const restoredNodes = await appendGraph(api, merged.mergedGraph as SavedGraph, { x: 42, y: 42 })
      await reconnectSplitBoundary(merged, restoredNodes, inbound, outbound)
      await api.editor.removeNode(merged.id)
      triggerExecute()
      setWorkflowNotice(`已拆分「${merged.label}」，并在原位置附近恢复来源子图；可识别的外部连线已重新接回。`)
      if (position) void position
      return
    }
    setWorkflowNotice(
      stats.selected
        ? `「${stats.selected.label}」不是由合并功能生成的电池，暂无可恢复快照。`
        : '请选择一个领域节点或复杂电池组，再执行拆分节点。'
    )
  }

  async function reconnectSplitBoundary(
    merged: PythonScriptNode,
    restoredNodes: Map<string, GHNode>,
    inbound: Schemes['Connection'][],
    outbound: Schemes['Connection'][]
  ) {
    if (!api || !merged.mergedBoundary) return

    for (const connection of inbound) {
      const boundary = merged.mergedBoundary.inputs[String(connection.targetInput)]
      if (!boundary) continue
      const source = api.editor.getNode(connection.source)
      const target = restoredNodes.get(boundary.target)
      if (!source || !target) continue
      if (!(String(connection.sourceOutput) in source.outputs) || !(boundary.targetInput in target.inputs)) continue
      const next = new ClassicPreset.Connection(source, connection.sourceOutput, target, boundary.targetInput) as Schemes['Connection']
      next.isAutoVariable = connection.isAutoVariable
      next.variableName = connection.variableName
      await api.editor.addConnection(next)
    }

    for (const connection of outbound) {
      const boundary = merged.mergedBoundary.outputs[String(connection.sourceOutput)]
      if (!boundary) continue
      const source = restoredNodes.get(boundary.source)
      const target = api.editor.getNode(connection.target)
      if (!source || !target) continue
      if (!(boundary.sourceOutput in source.outputs) || !(String(connection.targetInput) in target.inputs)) continue
      const next = new ClassicPreset.Connection(source, boundary.sourceOutput, target, connection.targetInput) as Schemes['Connection']
      next.isAutoVariable = connection.isAutoVariable
      next.variableName = connection.variableName
      await api.editor.addConnection(next)
    }
  }

  async function runFieldAutoConnect(options: { silent?: boolean } = {}) {
    if (!api) return
    const created = await autoConnectFields(api.editor)
    triggerExecute()
    if (options.silent) return
    setActiveTab('assistant')
    setWorkflowNotice(
      created > 0
        ? `已根据字段/变量名自动连接 ${created} 条虚线。手动连线会优先保留，自动连接只补齐空缺输入。`
        : '没有发现新的同名字段可连接。请确认输入电池已有变量名，并且目标输入端口使用相同字段。'
    )
  }

  function findTargetNode(nodeId?: string, label?: string) {
    if (!api) return null
    const nodes = api.editor.getNodes() as (GHNode & { selected?: boolean })[]
    if (nodeId) {
      const byId = nodes.find((node) => node.id === nodeId)
      if (byId) return byId
    }
    if (label) {
      const byLabel = nodes.find((node) => node.label === label)
      if (byLabel) return byLabel
    }
    return nodes.find((node) => node.selected) || null
  }

  async function connectCanvasNodes(action: Extract<AiAction, { type: 'connect_nodes' }>) {
    if (!api) return false
    const source = findTargetNode(action.sourceNodeId, action.sourceLabel)
    const target = findTargetNode(action.targetNodeId, action.targetLabel)
    const sourceOutput = action.sourceOutput?.trim()
    const targetInput = action.targetInput?.trim()
    if (!source || !target || !sourceOutput || !targetInput) return false
    if (!(sourceOutput in source.outputs) || !(targetInput in target.inputs)) return false

    const existing = api.editor.getConnections()
    const duplicate = existing.find((connection) => (
      connection.source === source.id &&
      String(connection.sourceOutput) === sourceOutput &&
      connection.target === target.id &&
      String(connection.targetInput) === targetInput
    ))
    if (duplicate) return true

    for (const connection of existing.filter((item) => item.target === target.id && String(item.targetInput) === targetInput)) {
      await api.editor.removeConnection(connection.id)
    }

    const next = new ClassicPreset.Connection(source, sourceOutput, target, targetInput) as Schemes['Connection']
    next.isAutoVariable = Boolean(action.auto)
    next.variableName = action.variableName?.trim() || undefined
    await api.editor.addConnection(next)
    return true
  }

  async function disconnectNodeInput(action: Extract<AiAction, { type: 'disconnect_node_input' }>) {
    if (!api) return 0
    const target = findTargetNode(action.targetNodeId, action.targetLabel)
    const targetInput = action.targetInput?.trim()
    if (!target || !targetInput) return 0

    const connections = api.editor.getConnections().filter((connection) => (
      connection.target === target.id && String(connection.targetInput) === targetInput
    ))
    for (const connection of connections) {
      await api.editor.removeConnection(connection.id)
    }
    return connections.length
  }

  async function renameCanvasNode(action: Extract<AiAction, { type: 'rename_node' }>) {
    if (!api) return false
    const target = findTargetNode(action.nodeId, action.label)
    const name = action.name?.trim()
    if (!target || !name) return false
    target.label = name
    await api.area.update('node', target.id)
    return true
  }

  async function deleteCanvasNode(action: Extract<AiAction, { type: 'delete_node' }>) {
    if (!api) return false
    const target = findTargetNode(action.nodeId, action.label)
    if (!target) return false
    const connections = api.editor.getConnections().filter((connection) => (
      connection.source === target.id || connection.target === target.id
    ))
    for (const connection of connections) {
      await api.editor.removeConnection(connection.id)
    }
    await api.editor.removeNode(target.id)
    return true
  }

  async function autoLayoutCanvas() {
    if (!api) return 0
    const nodes = api.editor.getNodes() as GHNode[]
    const connections = api.editor.getConnections()
    if (nodes.length === 0) return 0

    const nodeById = new Map(nodes.map((node) => [node.id, node]))
    const incoming = new Map<string, Schemes['Connection'][]>()
    const outgoing = new Map<string, Schemes['Connection'][]>()
    for (const node of nodes) {
      incoming.set(node.id, [])
      outgoing.set(node.id, [])
    }
    for (const connection of connections) {
      if (!nodeById.has(connection.source) || !nodeById.has(connection.target)) continue
      incoming.get(connection.target)?.push(connection)
      outgoing.get(connection.source)?.push(connection)
    }

    const layerById = new Map<string, number>()
    const visiting = new Set<string>()
    const resolveLayer = (nodeId: string): number => {
      if (layerById.has(nodeId)) return layerById.get(nodeId) || 0
      if (visiting.has(nodeId)) return 0
      visiting.add(nodeId)
      const parents = incoming.get(nodeId) || []
      const layer = parents.length === 0
        ? 0
        : Math.max(...parents.map((connection) => resolveLayer(connection.source) + 1))
      visiting.delete(nodeId)
      layerById.set(nodeId, layer)
      return layer
    }

    for (const node of nodes) resolveLayer(node.id)

    const terminalNodes = nodes.filter((node) => (
      node instanceof ReportNode ||
      node instanceof BookAssemblerNode ||
      node instanceof PlatformReturnNode ||
      Object.keys(node.outputs).length === 0
    ))
    const maxLayer = Math.max(0, ...nodes.map((node) => layerById.get(node.id) || 0))
    for (const node of terminalNodes) {
      layerById.set(node.id, Math.max(layerById.get(node.id) || 0, maxLayer + (node instanceof PlatformReturnNode ? 2 : 1)))
    }

    const groups = new Map<number, GHNode[]>()
    for (const node of nodes) {
      const layer = layerById.get(node.id) || 0
      groups.set(layer, [...(groups.get(layer) || []), node])
    }

    let moved = 0
    const sortedLayers = [...groups.keys()].sort((a, b) => a - b)
    for (const layer of sortedLayers) {
      const group = (groups.get(layer) || []).sort((a, b) => {
        const rank = getLayoutRank(a) - getLayoutRank(b)
        return rank !== 0 ? rank : a.label.localeCompare(b.label)
      })
      for (const [index, node] of group.entries()) {
        const x = 80 + sortedLayers.indexOf(layer) * 310
        const y = 70 + index * 145
        await api.area.translate(node.id, { x, y })
        moved++
      }
    }

    for (const node of nodes) {
      await api.area.update('node', node.id)
    }
    triggerExecute()
    setActiveTab('assistant')
    setWorkflowNotice(`已按输入、计算、章节和平台回传分层整理 ${moved} 个节点。`)
    return moved
  }

  function getLayoutRank(node: GHNode) {
    if (node instanceof ProjectContextNode) return 0
    if (node instanceof FieldTableNode || node instanceof BookSectionNode) return 3
    if (node.label === 'Number' || node.category === 'Params') return 0
    if (node instanceof FormulaCellNode || node.category === 'Formula') return 1
    if (node instanceof PythonScriptNode || node.category === 'Script') return 2
    if (node instanceof ReportNode || node instanceof BookAssemblerNode) return 4
    if (node instanceof PlatformReturnNode) return 5
    return 6
  }

  function compileSelectedNodes(selected: GHNode[]) {
    if (!api) return null
    const selectedIds = new Set(selected.map((node) => node.id))
    const allConnections = api.editor.getConnections()
    const internalConnections = allConnections.filter((connection) => (
      selectedIds.has(connection.source) && selectedIds.has(connection.target)
    ))
    const inboundConnections = allConnections.filter((connection) => (
      !selectedIds.has(connection.source) && selectedIds.has(connection.target)
    ))
    const outboundConnections = allConnections.filter((connection) => (
      selectedIds.has(connection.source) && !selectedIds.has(connection.target)
    ))
    const usedInputs = new Set<string>()
    const usedOutputs = new Set<string>()
    const inboundInputKeys = new Map<string, string>()
    const inboundSourceKeys = new Map<string, string>()
    const outboundOutputKeys = new Map<string, string>()
    const inputConfigs: PyPortConfig[] = []
    const outputConfigs: PyPortConfig[] = []
    const inputExprByTarget = new Map<string, string>()
    const outputExprBySource = new Map<string, string>()

    for (const node of selected) {
      if (node.label === 'Number' || node instanceof FieldInputNode) {
        const key = uniqueKey(node.variableName || 'value', usedInputs)
        inputConfigs.push({ key, label: node.variableName || key, type: 'number' })
        inputExprByTarget.set(`${node.id}:value`, key)
      }
    }

    for (const connection of inboundConnections) {
      const target = api.editor.getNode(connection.target)
      if (!target) continue
      const targetInput = String(connection.targetInput)
      const input = target.inputs[targetInput]
      const label = (input as { label?: string } | undefined)?.label || targetInput
      const sourceKey = `${connection.source}:${String(connection.sourceOutput)}`
      const key = inboundSourceKeys.get(sourceKey) || uniqueKey(connection.variableName || targetInput, usedInputs)
      inboundSourceKeys.set(sourceKey, key)
      inboundInputKeys.set(`${connection.target}:${targetInput}`, key)
      if (!inputConfigs.some((cfg) => cfg.key === key)) {
        inputConfigs.push({ key, label: connection.variableName || label, type: 'number' })
      }
      inputExprByTarget.set(`${connection.target}:${targetInput}`, key)
    }

    const ordered = sortSelectedNodes(selected, internalConnections)
    const lines = [
      'import math',
      'from math import *',
      '',
      '# Auto-generated by visual cell merge.',
      '# Original nodes can be restored with Split Node.',
      '',
    ]

    const exprForInput = (node: GHNode, key: string, fallback: number) => {
      const internal = internalConnections.find((connection) => (
        connection.target === node.id && String(connection.targetInput) === key
      ))
      if (internal) {
        return outputExprBySource.get(`${internal.source}:${String(internal.sourceOutput)}`) || String(fallback)
      }
      return inputExprByTarget.get(`${node.id}:${key}`) || String(fallback)
    }

    const setOutput = (node: GHNode, outputKey: string, expression: string) => {
      const variable = uniqueKey(`${normalizePythonKey(node.label, 'node')}_${outputKey}`, new Set([...usedInputs, ...usedOutputs]))
      usedOutputs.add(variable)
      outputExprBySource.set(`${node.id}:${outputKey}`, variable)
      lines.push(`${variable} = ${expression}`)
      return variable
    }

    for (const node of ordered) {
      if (node.label === 'Number' || node instanceof FieldInputNode) {
        const inputVar = inputExprByTarget.get(`${node.id}:value`)
        if (inputVar) outputExprBySource.set(`${node.id}:value`, inputVar)
        continue
      }

      const generated = generateNodePython(node, exprForInput, setOutput)
      if (!generated) return null
      if (generated.length > 0) lines.push(...generated, '')
    }

    const exposedOutputs = outboundConnections.length > 0
      ? outboundConnections.map((connection) => ({
          source: connection.source,
          output: String(connection.sourceOutput),
        }))
      : findTerminalOutputs(selected, internalConnections)

    for (const item of exposedOutputs) {
      const sourceNode = api.editor.getNode(item.source)
      const sourceExpr = outputExprBySource.get(`${item.source}:${item.output}`)
      if (!sourceNode || !sourceExpr) continue
      const output = sourceNode.outputs[item.output]
      const label = (output as { label?: string } | undefined)?.label || item.output
      const key = uniqueKey(item.output, usedInputs)
      outboundOutputKeys.set(`${item.source}:${item.output}`, key)
      outputConfigs.push({ key, label, type: 'number' })
      lines.push(`${key} = ${sourceExpr}`)
    }

    if (outputConfigs.length === 0) return null
    return {
      code: lines.join('\n'),
      inputs: inputConfigs,
      outputs: outputConfigs,
      inboundInputKeys,
      outboundOutputKeys,
    }
  }

  function sortSelectedNodes(nodes: GHNode[], internalConnections: Schemes['Connection'][]) {
    const inDegree = new Map(nodes.map((node) => [node.id, 0]))
    const byId = new Map(nodes.map((node) => [node.id, node]))
    const edges = new Map(nodes.map((node) => [node.id, [] as string[]]))
    for (const connection of internalConnections) {
      edges.get(connection.source)?.push(connection.target)
      inDegree.set(connection.target, (inDegree.get(connection.target) || 0) + 1)
    }
    const queue = nodes.filter((node) => (inDegree.get(node.id) || 0) === 0)
    const result: GHNode[] = []
    while (queue.length > 0) {
      const node = queue.shift()!
      result.push(node)
      for (const nextId of edges.get(node.id) || []) {
        const nextDegree = (inDegree.get(nextId) || 0) - 1
        inDegree.set(nextId, nextDegree)
        if (nextDegree === 0) {
          const next = byId.get(nextId)
          if (next) queue.push(next)
        }
      }
    }
    return result.length === nodes.length ? result : nodes
  }

  function findTerminalOutputs(nodes: GHNode[], internalConnections: Schemes['Connection'][]) {
    return nodes.flatMap((node) => {
      const internalOutgoing = internalConnections.some((connection) => connection.source === node.id)
      if (internalOutgoing) return []
      return Object.keys(node.outputs).map((output) => ({ source: node.id, output }))
    })
  }

  function generateNodePython(
    node: GHNode,
    input: (node: GHNode, key: string, fallback: number) => string,
    output: (node: GHNode, key: string, expression: string) => string
  ) {
    if (node instanceof FormulaCellNode) {
      let expression = node.expression
      for (const cfg of [...node.inputConfigs].sort((a, b) => b.key.length - a.key.length)) {
        const pattern = new RegExp(`(^|[^A-Za-z0-9_])${escapeRegExp(cfg.key)}(?=$|[^A-Za-z0-9_])`, 'g')
        expression = expression.replace(pattern, (_match, prefix: string) => `${prefix}(${input(node, cfg.key, 0)})`)
      }
      output(node, node.outputKey, `(${expression})`)
      return []
    }

    switch (node.label) {
      case 'Pipe Area': {
        const d = input(node, 'd', 0.1)
        output(node, 'a', `math.pi * (${d}) * (${d}) / 4.0`)
        output(node, 'perimeter', `math.pi * (${d})`)
        return []
      }
      case 'Velocity': {
        const q = input(node, 'q', 0)
        const d = input(node, 'd', 0.1)
        output(node, 'v', `0 if (${d}) == 0 else (${q}) / (math.pi * (${d}) * (${d}) / 4.0)`)
        return []
      }
      case 'Pump Power': {
        const rho = input(node, 'rho', 1000)
        const q = input(node, 'q', 0)
        const h = input(node, 'h', 0)
        const eta = input(node, 'eta', 75)
        const pe = output(node, 'pe', `(${rho}) * 9.81 * (${q}) * (${h})`)
        const pshaft = output(node, 'pshaft', `0 if max(float(${eta}), 1.0) == 0 else (${pe}) / (max(float(${eta}), 1.0) / 100.0)`)
        output(node, 'pshaft_kw', `(${pshaft}) / 1000.0`)
        return []
      }
      case 'Addition':
        output(node, 'result', `(${input(node, 'a', 0)}) + (${input(node, 'b', 0)})`)
        output(node, 'sum', `(${input(node, 'a', 0)}) + (${input(node, 'b', 0)})`)
        output(node, 'r', `(${input(node, 'a', 0)}) + (${input(node, 'b', 0)})`)
        return []
      case 'Subtraction':
        output(node, 'result', `(${input(node, 'a', 0)}) - (${input(node, 'b', 0)})`)
        output(node, 'r', `(${input(node, 'a', 0)}) - (${input(node, 'b', 0)})`)
        return []
      case 'Multiplication':
        output(node, 'result', `(${input(node, 'a', 0)}) * (${input(node, 'b', 0)})`)
        output(node, 'r', `(${input(node, 'a', 0)}) * (${input(node, 'b', 0)})`)
        return []
      case 'Division':
        output(node, 'result', `0 if (${input(node, 'b', 1)}) == 0 else (${input(node, 'a', 0)}) / (${input(node, 'b', 1)})`)
        output(node, 'r', `0 if (${input(node, 'b', 1)}) == 0 else (${input(node, 'a', 0)}) / (${input(node, 'b', 1)})`)
        return []
      default:
        return null
    }
  }

  function summarizeCanvas() {
    if (!api) return { nodes: [], connections: [] }
    return {
      nodes: (api.editor.getNodes() as GHNode[]).map((node) => ({
        id: node.id,
        label: node.label,
        category: node.category,
        field: node.variableName,
        inputs: Object.entries(node.inputs).map(([key, input]) => ({
          key,
          label: input ? (input as { label?: string }).label : key,
        })),
        outputs: Object.entries(node.outputs).map(([key, output]) => ({
          key,
          label: output ? (output as { label?: string }).label : key,
        })),
        result: node.resultDisplay,
      })),
      connections: api.editor.getConnections().map((connection) => ({
        source: connection.source,
        sourceOutput: connection.sourceOutput,
        target: connection.target,
        targetInput: connection.targetInput,
        autoField: connection.isAutoVariable,
        variableName: connection.variableName,
      })),
    }
  }

  function getAssistantCanvasContext(): AssistantCanvasContext {
    if (!api) {
      return {
        selected: null,
        nodes: 0,
        connections: 0,
        fields: [],
        unresolvedInputs: [],
        terminalNodes: [],
        formulaNodes: [],
        componentResources: componentResults.slice(0, 5).map((item) => ({ name: item.name, category: item.category })),
        pythonNodes: [],
        platform: platformContext
          ? {
              project: platformContext.projectName,
              wbs: platformContext.wbsCode,
              fields: platformFields.length,
              operators: platformOperators.length,
              drafts: platformDrafts.length,
            }
          : null,
      }
    }

    const nodes = api.editor.getNodes() as GHNode[]
    const connections = api.editor.getConnections()
    const connectedInputs = new Set(connections.map((conn) => `${conn.target}:${String(conn.targetInput)}`))
    const sourceIds = new Set(connections.map((conn) => conn.source))
    const unresolvedInputs = nodes.flatMap((node) =>
      Object.entries(node.inputs)
        .filter(([key, input]) => (
          Boolean(input) &&
          !input?.control &&
          !connectedInputs.has(`${node.id}:${key}`) &&
          !isOptionalPlatformReturnInput(node, key)
        ))
        .map(([key, input]) => `${node.label}.${(input as { label?: string } | undefined)?.label || key}`)
    )
    const terminalNodes = nodes
      .filter((node) => Object.keys(node.outputs).length === 0 || !sourceIds.has(node.id))
      .map((node) => `${node.label}${node.variableName ? ` (${node.variableName})` : ''}`)
    const formulaNodes = nodes
      .filter((node): node is FormulaCellNode => node instanceof FormulaCellNode)
      .map((node) => node.label)
    const pythonNodes = nodes
      .filter((node): node is PythonScriptNode => node instanceof PythonScriptNode)
      .map((node) => ({
        label: node.label,
        status: node.platformOperator?.status || 'local',
      }))

    return {
      selected: stats.selected
        ? {
            id: stats.selected.id,
            label: stats.selected.label,
            category: stats.selected.category,
            field: stats.selected.variableName,
            inputs: Object.keys(stats.selected.inputs),
            outputs: Object.keys(stats.selected.outputs),
            result: stats.selected.resultDisplay || stats.selected.display || '尚无运行结果',
          }
        : null,
      nodes: nodes.length,
      connections: connections.length,
      fields: getFieldRows().slice(0, 12).map((row) => ({
        field: row.fieldNames.join(' / '),
        node: row.node.label,
        output: row.outputKey,
      })),
      unresolvedInputs: unresolvedInputs.slice(0, 12),
      terminalNodes: terminalNodes.slice(0, 8),
      formulaNodes: formulaNodes.slice(0, 8),
      componentResources: componentResults.slice(0, 5).map((item) => ({ name: item.name, category: item.category })),
      pythonNodes,
      platform: platformContext
        ? {
            project: platformContext.projectName,
            wbs: platformContext.wbsCode,
            fields: platformFields.length,
            operators: platformOperators.length,
            drafts: platformDrafts.length,
          }
        : null,
    }
  }

  function formatAssistantContextForPrompt(context: AssistantCanvasContext) {
    return [
      '当前画布上下文：',
      `- 规模：${context.nodes} 个电池，${context.connections} 条连接`,
      context.selected
        ? `- 选中电池：${context.selected.label}，类型 ${context.selected.category}，id ${context.selected.id}，字段 ${context.selected.field || '-'}，输入 ${context.selected.inputs.join('/') || '-'}，输出 ${context.selected.outputs.join('/') || '-'}，结果 ${context.selected.result.slice(0, 160)}`
        : '- 选中电池：无',
      `- 字段映射：${context.fields.map((row) => `${row.field}->${row.node}.${row.output}`).join('；') || '-'}`,
      `- 未连接输入：${context.unresolvedInputs.join('；') || '无'}`,
      `- 末端电池：${context.terminalNodes.join('；') || '-'}`,
      `- 公式电池：${context.formulaNodes.join('；') || '无'}`,
      `- 平台知识资源：${context.componentResources.map((item) => `${item.category}/${item.name}`).join('；') || '-'}`,
      `- Python 电池：${context.pythonNodes.map((node) => `${node.label}(${node.status})`).join('；') || '-'}`,
      context.platform
        ? `- 平台：${context.platform.project} / ${context.platform.wbs}，字段 ${context.platform.fields}，算子 ${context.platform.operators}，草稿 ${context.platform.drafts}`
        : '- 平台：未连接',
      '请优先返回可应用 JSON actions；需要编辑选中电池时优先使用上面的 id。',
    ].join('\n')
  }

  function appendAssistantContextToInput() {
    const contextText = formatAssistantContextForPrompt(getAssistantCanvasContext())
    setAiInput((value) => value.trim() ? `${value.trim()}\n\n${contextText}` : contextText)
  }

  async function searchPlatformComponents(query = componentQuery) {
    const text = query.trim()
    if (!text) {
      setComponentResults([])
      setComponentSearchStatus('请输入平台资源关键词。')
      return
    }

    setComponentSearchStatus('正在搜索平台知识资源...')
    try {
      const results = await searchComponentFiles(text)
      setComponentResults(results)
      setComponentSearchStatus(results.length > 0 ? `找到 ${results.length} 条平台知识资源。` : '未找到匹配资源，可先运行 npm run db:sync-knowledge 同步项目知识。')
    } catch (error) {
      setComponentSearchStatus(`平台知识搜索失败：${error instanceof Error ? error.message : String(error)}`)
    }
  }

  function appendComponentResourcesToInput() {
    const text = [
      '平台知识资源检索结果：',
      componentResults.length > 0
        ? componentResults.slice(0, 8).map((item, index) => `${index + 1}. ${item.category}/${item.name}\n路径：${item.path}\n摘要：${item.summary || '-'}`).join('\n')
        : componentSearchStatus || '暂无检索结果。',
      '请结合这些平台资源生成可应用 JSON actions，或说明当前画布如何利用这些资源。',
    ].join('\n')
    setActiveTab('assistant')
    setAiInput((value) => value.trim() ? `${value.trim()}\n\n${text}` : text)
  }

  async function sendAiMessage() {
    const text = aiInput.trim()
    if (!text || aiLoading) return

    await sendAiText(text)
  }

  async function sendAiText(text: string) {
    if (!text.trim() || aiLoading) return

    const nextMessages: AiChatMessage[] = [...aiMessages, { role: 'user', content: text.trim() }]
    setAiMessages(nextMessages)
    setAiInput('')
    setAiLoading(true)
    setAiError('')

    try {
      const response = await chatWithAssistant(nextMessages, summarizeCanvas())
      setAiMessages([...nextMessages, { role: 'assistant', content: response.content }])
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setAiError(message)
      setAiMessages([...nextMessages, { role: 'assistant', content: `调用 DeepSeek 失败：${message}` }])
    } finally {
      setAiLoading(false)
    }
  }

  async function askAiToFixAudit() {
    const audit = canvasAudit || await runCanvasAudit({ switchTab: false })
    if (!audit) return

    const issueText = audit.items
      .filter((item) => item.level !== 'success')
      .map((item) => `- ${item.level}: ${item.title}：${item.detail}`)
      .join('\n') || '- 当前没有阻塞项，请优化平台回传和字段追踪体验。'

    setActiveTab('assistant')
    await sendAiText([
      '请根据下面的发布前健康检查结果，生成可应用到当前画布的 JSON actions。',
      '这是“让 AI 修复审查项”按钮触发的请求：不仅 error 要修复，warning 也要尽量转成可应用动作。',
      '如果 warning 是“未放置电池级回传节点”，必须输出 add_resource_node platform_return，并追加 auto_connect_fields。',
      '如果 warning 是“存在待 Python 化公式电池”，必须输出 convert_all_formulas_to_python。',
      '如果 warning 是“缺少字段参数表”，优先输出 add_field_table_node，并追加 auto_connect_fields。',
      '如果 warning 是“缺少项目上下文”，优先输出 add_resource_node project_context，并追加 auto_connect_fields。',
      '如果缺少最终计算书终端、参数表和项目上下文较多，可以输出 build_delivery_scaffold。',
      '如果 warning 是“Python 电池缺少测试用例”，可提示用户在 Python 编辑器 Test 页补充，或先发布平台算子让审核指出缺口。',
      '如果用户希望封装、合并或沉淀电池组，可以输出 pythonize_canvas 或 pythonize_and_publish_operator。',
      '其他 warning 可用 add_resource_node、auto_connect_fields、update_report_node、set_node_variable、publish_selected_python_operator 等动作处理。',
      '不要泛泛说明，回答末尾必须给出 JSON actions。',
      '',
      `健康检查评分：${audit.score}，状态：${audit.status}`,
      issueText,
    ].join('\n'))
  }

  function getLatestAiActions() {
    const latest = [...aiMessages].reverse().find((message) => message.role === 'assistant')
    if (!latest) return []
    return extractAiActions(latest.content)
  }

  function describeAiAction(action: AiAction) {
    switch (action.type) {
      case 'add_python_node':
        return { title: '新增 Python 电池', detail: action.name || 'Python Script' }
      case 'update_python_node':
        return { title: '更新 Python 电池', detail: action.name || action.label || action.nodeId || '当前节点' }
      case 'add_formula_node':
        return { title: '新增公式电池', detail: action.name || action.outputLabel || action.outputKey || 'Formula Cell' }
      case 'update_formula_node':
        return { title: '更新公式电池', detail: action.name || action.label || action.nodeId || '当前公式' }
      case 'add_report_node':
        return { title: '新增 Report 电池', detail: `${action.inputs?.length || 0} 个输入字段` }
      case 'add_book_section':
        return { title: '新增计算书章节', detail: `${action.name || 'Book Section'} -> ${action.outputKey || '自动编号'}` }
      case 'add_book_assembler':
        return { title: '新增计算书装配器', detail: `${action.inputs?.length || 0} 个章节输入` }
      case 'add_field_table_node':
        return { title: '新增字段参数表', detail: action.fields?.join(' / ') || `${action.inputs?.length || 0} 个字段` }
      case 'update_report_node':
        return { title: '更新 Report 电池', detail: `${action.inputs?.length || 0} 个输入字段` }
      case 'add_resource_node':
        return { title: '添加平台资源电池', detail: `${action.resourceType || 'resource'} · ${action.name || action.code || '-'}` }
      case 'add_operator_node':
        return { title: '添加平台 Python 算子', detail: action.name || action.code || '平台算子' }
      case 'add_platform_field_inputs':
        return { title: '添加平台字段输入', detail: action.fields?.join(' / ') || '默认字段' }
      case 'build_delivery_scaffold':
        return { title: '生成交付骨架', detail: action.fields?.join(' / ') || '项目上下文/字段/参数表/计算书/回传' }
      case 'auto_connect_fields':
        return { title: '自动连接字段', detail: '按变量名补齐虚线连接' }
      case 'connect_nodes':
        return {
          title: '连接节点端口',
          detail: `${action.sourceLabel || action.sourceNodeId || '?'}:${action.sourceOutput || '?'} -> ${action.targetLabel || action.targetNodeId || '?'}:${action.targetInput || '?'}`,
        }
      case 'disconnect_node_input':
        return {
          title: '断开输入端口',
          detail: `${action.targetLabel || action.targetNodeId || '?'}:${action.targetInput || '?'}`,
        }
      case 'rename_node':
        return { title: '重命名节点', detail: `${action.label || action.nodeId || '节点'} -> ${action.name || '-'}` }
      case 'delete_node':
        return { title: '删除节点', detail: action.label || action.nodeId || '当前节点' }
      case 'auto_layout_canvas':
        return { title: '整理画布布局', detail: '按依赖关系分层排列节点' }
      case 'submit_calculation_book_draft':
        return { title: '生成计算书草稿', detail: action.title || 'AI 生成计算书草稿' }
      case 'audit_calculation_book_draft':
        return { title: '审核计算书草稿', detail: '调用平台 AI 审核' }
      case 'sync_calculation_book_draft':
        return { title: '同步进度与文控', detail: '回写平台进度计划/文控' }
      case 'submit_audit_sync_calculation_book':
        return { title: '回传审核并同步', detail: action.title || '计算书平台闭环' }
      case 'apply_calculation_template':
        return { title: '套用计算书模板', detail: action.code || 'pump-power-latex' }
      case 'publish_calculation_template':
        return { title: '发布计算书模板', detail: action.name || 'AI 发布计算书模板' }
      case 'pythonize_canvas':
        return { title: 'Python 化当前画布', detail: '封装为原生 Python 计算内核' }
      case 'convert_selected_formula_to_python':
        return { title: '公式转 Python 电池', detail: '替换选中公式并保留连线' }
      case 'convert_all_formulas_to_python':
        return { title: '全部公式转 Python', detail: '批量替换画布中的 Formula Cell 并保留连线' }
      case 'pythonize_and_publish_operator':
        return { title: 'Python 化并发布算子', detail: '生成内核并沉淀到平台算子库' }
      case 'pythonize_publish_audit_operator':
        return { title: 'Python 化发布并审核', detail: '生成内核、发布草稿并触发平台审核' }
      case 'publish_selected_python_operator':
        return { title: '发布选中 Python 电池', detail: '沉淀为平台算子草稿' }
      case 'audit_selected_platform_operator':
        return { title: '审核选中平台算子', detail: '提交平台算子审核' }
      case 'audit_canvas':
        return { title: '检查画布健康度', detail: '发布前连接/字段/Report 审查' }
      case 'set_node_variable':
        return { title: '设置节点字段名', detail: `${action.label || action.nodeId || '节点'} -> ${action.variableName || '-'}` }
      case 'update_field_input_node':
        return { title: '更新字段输入', detail: `${action.label || action.nodeId || 'Field Input'} -> ${action.fieldKey || action.fieldLabel || action.name || '-'}` }
      default:
        return { title: 'AI 画布操作', detail: '待执行' }
    }
  }

  function getAiActionTone(action: AiAction): AiActionTone {
    if (
      action.type === 'delete_node' ||
      action.type === 'apply_calculation_template' ||
      action.type === 'submit_audit_sync_calculation_book'
    ) return 'danger'
    if (
      action.type === 'connect_nodes' ||
      action.type === 'disconnect_node_input' ||
      action.type === 'auto_connect_fields'
    ) return 'connect'
    if (
      action.type === 'submit_calculation_book_draft' ||
      action.type === 'audit_calculation_book_draft' ||
      action.type === 'sync_calculation_book_draft' ||
      action.type === 'publish_calculation_template' ||
      action.type === 'publish_selected_python_operator' ||
      action.type === 'audit_selected_platform_operator' ||
      action.type === 'pythonize_and_publish_operator' ||
      action.type === 'pythonize_publish_audit_operator'
    ) return 'platform'
    if (
      action.type === 'update_python_node' ||
      action.type === 'update_formula_node' ||
      action.type === 'update_report_node' ||
      action.type === 'update_field_input_node' ||
      action.type === 'set_node_variable' ||
      action.type === 'rename_node'
    ) return 'update'
    if (
      action.type === 'add_python_node' ||
      action.type === 'add_formula_node' ||
      action.type === 'add_report_node' ||
      action.type === 'add_book_section' ||
      action.type === 'add_book_assembler' ||
      action.type === 'add_field_table_node' ||
      action.type === 'add_operator_node' ||
      action.type === 'add_platform_field_inputs' ||
      action.type === 'add_resource_node' ||
      action.type === 'build_delivery_scaffold'
    ) return 'create'
    return 'default'
  }

  function summarizeAiActions(actions: AiAction[]): AiActionSummary {
    const nodeTargets = new Set<string>()
    const summary: AiActionSummary = {
      creates: 0,
      updates: 0,
      links: 0,
      platform: 0,
      risky: 0,
      nodeTargets: [],
    }

    for (const action of actions) {
      const tone = getAiActionTone(action)
      if (tone === 'create') summary.creates++
      if (tone === 'update') summary.updates++
      if (tone === 'connect') summary.links++
      if (tone === 'platform') summary.platform++
      if (tone === 'danger') summary.risky++

      const target = 'label' in action && typeof action.label === 'string'
        ? action.label
        : 'name' in action && typeof action.name === 'string'
          ? action.name
          : 'nodeId' in action && typeof action.nodeId === 'string'
            ? action.nodeId
            : ''
      if (target.trim()) nodeTargets.add(target.trim())
    }

    summary.nodeTargets = Array.from(nodeTargets).slice(0, 6)
    return summary
  }

  async function applyAiActions() {
    if (!api) return
    const actions = getLatestAiActions()
    let applied = 0
    let currentDraftId = draftId
    let nextBookSectionIndex = (api.editor.getNodes() as GHNode[])
      .filter((node) => node instanceof BookSectionNode)
      .length + 1

    for (const action of actions) {
      if (action.type === 'auto_connect_fields') {
        applied += await autoConnectFields(api.editor)
        continue
      }

      if (action.type === 'connect_nodes') {
        if (await connectCanvasNodes(action)) applied++
        continue
      }

      if (action.type === 'disconnect_node_input') {
        applied += await disconnectNodeInput(action)
        continue
      }

      if (action.type === 'rename_node') {
        if (await renameCanvasNode(action)) applied++
        continue
      }

      if (action.type === 'delete_node') {
        if (await deleteCanvasNode(action)) applied++
        continue
      }

      if (action.type === 'auto_layout_canvas') {
        const moved = await autoLayoutCanvas()
        if (moved > 0) applied++
        continue
      }

      if (action.type === 'submit_calculation_book_draft') {
        const nextDraftId = await submitCalculationBookDraft(action.title?.trim() || 'AI 生成计算书草稿')
        if (nextDraftId) currentDraftId = nextDraftId
        applied++
        continue
      }

      if (action.type === 'audit_calculation_book_draft') {
        await auditCurrentDraft(currentDraftId)
        applied++
        continue
      }

      if (action.type === 'sync_calculation_book_draft') {
        await syncCurrentDraft(currentDraftId)
        applied++
        continue
      }

      if (action.type === 'submit_audit_sync_calculation_book') {
        const nextDraftId = await submitAuditAndSyncCalculationBook(action.title?.trim() || 'AI 生成计算书草稿')
        if (nextDraftId) currentDraftId = nextDraftId
        applied++
        continue
      }

      if (action.type === 'apply_calculation_template') {
        await applyCalculationTemplate(action.code || 'pump-power-latex')
        applied++
        continue
      }

      if (action.type === 'publish_calculation_template') {
        await publishCurrentCalculationTemplate(
          action.name?.trim() || 'AI 发布计算书模板',
          action.description?.trim(),
          action.discipline?.trim() || 'custom',
          Array.isArray(action.tags) && action.tags.length > 0 ? action.tags : ['AI编排', '自定义模板']
        )
        applied++
        continue
      }

      if (action.type === 'pythonize_canvas') {
        await runMergeAssistant()
        applied++
        continue
      }

      if (action.type === 'convert_selected_formula_to_python') {
        const converted = await convertSelectedFormulaToPython()
        if (converted) applied++
        continue
      }

      if (action.type === 'convert_all_formulas_to_python') {
        const converted = await convertAllFormulaNodesToPython()
        if (converted.length > 0) applied++
        continue
      }

      if (action.type === 'pythonize_and_publish_operator') {
        await pythonizeCanvasAndPublishOperator()
        applied++
        continue
      }

      if (action.type === 'pythonize_publish_audit_operator') {
        await pythonizePublishAndAuditOperator()
        applied++
        continue
      }

      if (action.type === 'publish_selected_python_operator') {
        await publishSelectedPythonOperator()
        applied++
        continue
      }

      if (action.type === 'audit_selected_platform_operator') {
        await auditSelectedPlatformOperator()
        applied++
        continue
      }

      if (action.type === 'audit_canvas') {
        await runCanvasAudit()
        applied++
        continue
      }

      if (action.type === 'set_node_variable') {
        const target = findTargetNode(action.nodeId, action.label)
        const variableName = action.variableName?.trim()
        if (target && variableName) {
          target.variableName = variableName
          target.outputAliases = {
            ...target.outputAliases,
            value: [variableName],
          }
          await api.area.update('node', target.id)
          await autoConnectFields(api.editor)
          triggerExecute()
          applied++
        }
        continue
      }

      if (action.type === 'update_field_input_node') {
        const target = findTargetNode(action.nodeId, action.label)
        if (target instanceof FieldInputNode) {
          if (typeof action.name === 'string' && action.name.trim()) target.label = action.name.trim()
          if (typeof action.fieldKey === 'string' && action.fieldKey.trim()) target.fieldKey = normalizePythonKey(action.fieldKey.trim(), target.fieldKey)
          if (typeof action.fieldLabel === 'string' && action.fieldLabel.trim()) target.fieldLabel = action.fieldLabel.trim()
          if (typeof action.unit === 'string') target.unit = action.unit.trim()
          if (typeof action.discipline === 'string') target.discipline = action.discipline.trim()
          if (typeof action.description === 'string') target.description = action.description.trim()
          if (typeof action.value === 'number' && Number.isFinite(action.value)) target.control.setValue(action.value)
          target.syncFieldMetadata()
          await api.area.update('node', target.id)
          await autoConnectFields(api.editor)
          triggerExecute()
          applied++
        }
        continue
      }

      if (action.type === 'update_python_node') {
        const target = findTargetNode(action.nodeId, action.label)
        if (target instanceof PythonScriptNode) {
          target.label = action.name?.trim() || target.label
          if (action.code) target.code = action.code
          target.inputConfigs = normalizePorts(action.inputs, target.inputConfigs)
          target.outputConfigs = normalizePorts(action.outputs, target.outputConfigs)
          target.rebuildPorts()
          await api.area.update('node', target.id)
          applied++
        }
        continue
      }

      if (action.type === 'update_formula_node') {
        const target = findTargetNode(action.nodeId, action.label)
        if (target instanceof FormulaCellNode) {
          const inputs = normalizeFormulaPorts(action.inputs, target.inputConfigs)
          const outputKey = normalizePythonKey(action.outputKey || target.outputKey, target.outputKey)
          await target.removeInvalidConnections(inputs.map((cfg) => cfg.key), [outputKey])
          target.label = action.name?.trim() || target.label
          if (action.latex) target.latexFormula = action.latex
          if (action.expression) target.expression = action.expression
          target.inputConfigs = inputs
          target.outputKey = outputKey
          target.outputLabel = action.outputLabel?.trim() || target.outputLabel || outputKey
          target.rebuildPorts()
          await api.area.update('node', target.id)
          applied++
        }
        continue
      }

      if (action.type === 'update_report_node') {
        const target = findTargetNode(action.nodeId, action.label)
        if (isTemplateReportNode(target)) {
          const inputs = normalizeReportPorts(action.inputs, target.inputConfigs)
          const outputs = target instanceof BookSectionNode || target instanceof FieldTableNode ? [target.outputKey] : []
          await target.removeInvalidConnections(inputs.map((cfg) => cfg.key), outputs)
          target.label = action.name?.trim() || target.label
          if ('template' in target && typeof action.template === 'string') target.template = action.template
          target.inputConfigs = inputs
          target.rebuildPorts()
          await api.area.update('node', target.id)
          applied++
        }
        continue
      }

      if (action.type === 'add_operator_node') {
        await addPlatformOperator(action.code || 'pump_power', action.name)
        applied++
        continue
      }

      if (action.type === 'add_platform_field_inputs') {
        const fieldKeys = Array.isArray(action.fields) && action.fields.length > 0 ? action.fields : ['rho', 'Q', 'H', 'eta']
        for (const fieldKey of fieldKeys) {
          const field = platformFields.find((item) => item.key === fieldKey)
          if (field) {
            await addPlatformFieldInput(field, applied)
            applied++
          }
        }
        continue
      }

      if (action.type === 'build_delivery_scaffold') {
        const created = await buildDeliveryScaffold(action.fields, action.title)
        applied += created
        continue
      }

      let node: GHNode | null = null
      if (action.type === 'add_python_node') {
        const pythonNode = new PythonScriptNode()
        pythonNode.label = action.name?.trim() || 'Python Script'
        pythonNode.code = action.code || pythonNode.code
        pythonNode.inputConfigs = normalizePorts(action.inputs, pythonNode.inputConfigs)
        pythonNode.outputConfigs = normalizePorts(action.outputs, pythonNode.outputConfigs)
        pythonNode.rebuildPorts()
        node = pythonNode
      }

      if (action.type === 'add_formula_node') {
        const formulaNode = new FormulaCellNode()
        formulaNode.label = action.name?.trim() || 'Formula Cell'
        if (action.latex) formulaNode.latexFormula = action.latex
        if (action.expression) formulaNode.expression = action.expression
        formulaNode.inputConfigs = normalizeFormulaPorts(action.inputs, formulaNode.inputConfigs)
        formulaNode.outputKey = normalizePythonKey(action.outputKey || formulaNode.outputKey, formulaNode.outputKey)
        formulaNode.outputLabel = action.outputLabel?.trim() || formulaNode.outputKey
        formulaNode.rebuildPorts()
        node = formulaNode
      }

      if (action.type === 'add_report_node') {
        const reportNode = new ReportNode()
        reportNode.label = action.name?.trim() || 'Report'
        if (typeof action.template === 'string') reportNode.template = action.template
        reportNode.inputConfigs = normalizeReportPorts(action.inputs, reportNode.inputConfigs)
        reportNode.rebuildPorts()
        node = reportNode
      }

      if (action.type === 'add_book_section') {
        const sectionNode = new BookSectionNode()
        const sectionKey = normalizePythonKey(action.outputKey || `section${nextBookSectionIndex++}`, 'section')
        sectionNode.label = action.name?.trim() || 'Book Section'
        if (typeof action.template === 'string') sectionNode.template = action.template
        sectionNode.inputConfigs = normalizeReportPorts(action.inputs, sectionNode.inputConfigs)
        sectionNode.outputKey = sectionKey
        sectionNode.outputLabel = action.outputLabel?.trim() || sectionNode.outputKey
        sectionNode.outputAliases = {
          ...sectionNode.outputAliases,
          [sectionNode.outputKey]: [sectionNode.outputKey, sectionNode.outputLabel, sectionNode.label],
        }
        sectionNode.rebuildPorts()
        node = sectionNode
      }

      if (action.type === 'add_book_assembler') {
        const assemblerNode = new BookAssemblerNode()
        assemblerNode.label = action.name?.trim() || 'Book Assembler'
        if (typeof action.template === 'string') assemblerNode.template = action.template
        assemblerNode.inputConfigs = normalizeReportPorts(action.inputs, assemblerNode.inputConfigs)
        assemblerNode.rebuildPorts()
        node = assemblerNode
      }

      if (action.type === 'add_field_table_node') {
        const tableNode = new FieldTableNode()
        tableNode.label = action.name?.trim() || '字段参数表'
        const inputConfigs = Array.isArray(action.inputs) && action.inputs.length > 0
          ? action.inputs.map((input) => ({
              key: input.key,
              label: input.label || input.key,
              unit: input.unit,
              description: input.description,
            })).filter((input) => input.key)
          : (Array.isArray(action.fields) && action.fields.length > 0 ? action.fields : ['rho', 'Q', 'H', 'eta'])
              .map((key) => {
                const field = platformFields.find((item) => item.key === key)
                return {
                  key,
                  label: field?.label || key,
                  unit: field?.unit || '',
                  description: field?.description || '',
                }
              })
        tableNode.inputConfigs = inputConfigs.length > 0 ? inputConfigs : tableNode.inputConfigs
        if (action.outputKey) tableNode.outputKey = action.outputKey
        if (action.outputLabel) tableNode.outputLabel = action.outputLabel
        tableNode.rebuildPorts()
        node = tableNode
      }

      if (action.type === 'add_resource_node') {
        if (action.resourceType === 'dictionary') {
          node = new DictionaryLookupNode(action.code || 'pipe_material', action.key || '碳钢')
        } else if (action.resourceType === 'table') {
          node = new TableLookupNode(action.code || 'water_density')
        } else if (action.resourceType === 'coolprop') {
          node = new CoolPropNode(action.code || 'Water')
        } else if (action.resourceType === 'project_context') {
          node = new ProjectContextNode()
        } else if (action.resourceType === 'platform_return') {
          node = new PlatformReturnNode()
        } else if (action.resourceType === 'dev_assistant') {
          node = new DevAssistantBridgeNode(action.code || action.name || 'Cline / opencode / NextChat')
        }
        if (node && action.name?.trim()) node.label = action.name.trim()
      }

      if (!node) continue
      await addNodeAtCenter(node, applied)
      applied++
    }

    if (applied > 0) {
      await autoConnectFields(api.editor)
      triggerExecute()
      setWorkflowNotice(`已应用 ${applied} 个 AI 画布操作。可以继续让助手补字段、接资源、封装 Python 算子。`)
    }
  }

  async function addPlatformDictionary(code: string) {
    const resource = platformDictionaries.find((item) => item.code === code)
    await addNodeAtCenter(new DictionaryLookupNode(code), 0)
    triggerExecute()
    setWorkflowNotice(`已从平台数据字典添加「${resource?.name || code}」。`)
  }

  async function addPlatformTable(code: string) {
    const resource = platformTables.find((item) => item.code === code)
    await addNodeAtCenter(new TableLookupNode(code), 0)
    triggerExecute()
    setWorkflowNotice(`已从工程数据表添加「${resource?.name || code}」。`)
  }

  async function buildDeliveryScaffold(fields?: string[], title?: string) {
    if (!api) return 0
    const fieldKeys = Array.isArray(fields) && fields.length > 0 ? fields : ['rho', 'Q', 'H', 'eta']
    const fieldConfigs = fieldKeys.map((key) => {
      const field = platformFields.find((item) => item.key === key)
      return {
        key,
        label: field?.label || key,
        unit: field?.unit || '',
        description: field?.description || '',
        defaultValue: field?.defaultValue ?? 0,
        discipline: field?.discipline || 'custom',
      }
    })

    const projectNode = new ProjectContextNode()
    projectNode.label = '项目上下文'
    await addNodeAtCenter(projectNode, 0)

    for (const [index, field] of fieldConfigs.entries()) {
      const node = new FieldInputNode(field.key, field.label, field.defaultValue, field.unit, field.discipline, field.description)
      node.label = `${field.label} ${field.key}`
      await addNodeAtCenter(node, index + 1)
    }

    const fieldTable = new FieldTableNode()
    fieldTable.label = '参数表'
    fieldTable.inputConfigs = fieldConfigs.map((field) => ({
      key: field.key,
      label: field.label,
      unit: field.unit,
      description: field.description,
    }))
    fieldTable.outputKey = 'parameterTable'
    fieldTable.outputLabel = '参数表'
    fieldTable.rebuildPorts()
    await addNodeAtCenter(fieldTable, fieldConfigs.length + 1)

    const overviewSection = new BookSectionNode()
    overviewSection.label = '项目概况章节'
    overviewSection.outputKey = 'projectOverview'
    overviewSection.outputLabel = '项目概况'
    overviewSection.inputConfigs = [
      { key: 'projectName', label: '项目名称' },
      { key: 'wbsCode', label: 'WBS' },
      { key: 'calculationBookId', label: '计算书编号' },
      { key: 'returnTargets', label: '回传目标' },
    ]
    overviewSection.template = '## 项目概况\n\n- 项目：{projectName}\n- WBS：{wbsCode}\n- 计算书编号：{calculationBookId}\n- 回传目标：{returnTargets}'
    overviewSection.rebuildPorts()
    await addNodeAtCenter(overviewSection, fieldConfigs.length + 2)

    const calculationSection = new BookSectionNode()
    calculationSection.label = '计算过程章节'
    calculationSection.outputKey = 'calculationProcess'
    calculationSection.outputLabel = '计算过程'
    calculationSection.inputConfigs = []
    calculationSection.template = '## 计算过程\n\n请连接公式电池、Python 电池或平台算子输出，补充公式、过程结果和校核结论。'
    calculationSection.rebuildPorts()
    await addNodeAtCenter(calculationSection, fieldConfigs.length + 3)

    const assembler = new BookAssemblerNode()
    assembler.label = title?.trim() || '计算书装配器'
    assembler.inputConfigs = [
      { key: 'projectOverview', label: '项目概况' },
      { key: 'parameterTable', label: '参数表' },
      { key: 'calculationProcess', label: '计算过程' },
    ]
    assembler.template = '# 工程计算书\n\n{projectOverview}\n\n{parameterTable}\n\n{calculationProcess}'
    assembler.rebuildPorts()
    await addNodeAtCenter(assembler, fieldConfigs.length + 4)

    const returnNode = new PlatformReturnNode()
    returnNode.label = '平台成果回传'
    await addNodeAtCenter(returnNode, fieldConfigs.length + 5)

    await autoConnectFields(api.editor)
    await autoLayoutCanvas()
    triggerExecute()
    setWorkflowNotice(`已生成交付骨架：${fieldConfigs.map((field) => field.key).join(' / ')} 字段、参数表、计算书装配器和平台回传节点。`)
    return fieldConfigs.length + 6
  }

  async function addProjectContextNode() {
    await addNodeAtCenter(new ProjectContextNode(), 0)
    triggerExecute()
    setWorkflowNotice('已添加项目上下文电池，可连接到计算书章节、Report 或平台回传节点。')
  }

  async function addPlatformOperator(code: string, name?: string) {
    try {
      const operator = await getPlatformOperator(code)
      const node = new PythonScriptNode()
      node.label = name?.trim() || operator.name
      node.code = operator.sourceCode
      node.inputConfigs = operator.inputs.map((key) => ({ key, label: key, type: 'number' }))
      node.outputConfigs = operator.outputs.map((key) => ({ key, label: key, type: 'number' }))
      node.platformOperator = {
        code: operator.code,
        name: operator.name,
        version: operator.version,
        status: operator.status,
        description: operator.description,
        testCase: operator.testCase,
      }
      node.rebuildPorts()
      node.display = `${operator.name}\n${operator.language} ${operator.version}\n${operator.status}`
      await addNodeAtCenter(node, 0)
      triggerExecute()
      setWorkflowNotice(`已从平台算子引擎添加 Python 电池「${operator.name}」。`)
    } catch (error) {
      setWorkflowNotice(`平台算子添加失败：${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async function runExternalCalculationBook() {
    if (!api || platformLoading) return
    setPlatformLoading(true)
    setPlatformRun('')

    try {
      const graph = serializeGraph(api)
      const inputs = Object.fromEntries(
        (api.editor.getNodes() as GHNode[])
          .filter((node) => node.variableName && node.lastOutputs)
          .map((node) => [node.variableName as string, node.lastOutputs?.value ?? node.lastOutputs])
      )
      const response = await runPlatformCalculationBook(graph, inputs)
      setPlatformRun(response.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    } catch (error) {
      setPlatformRun(`计算书外部调用失败：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setPlatformLoading(false)
    }
  }

  async function publishCurrentCalculationTemplate(
    name = '自定义可视化计算书模板',
    description?: string,
    discipline = 'custom',
    tags: string[] = ['AI编排', '自定义模板']
  ) {
    if (!api || platformLoading) return null
    setPlatformLoading(true)
    setPlatformRun('')

    try {
      const audit = await runCanvasAudit({ switchTab: false })
      const blockingItems = audit?.items.filter((item) => item.level === 'error') || []
      if (blockingItems.length > 0) {
        setPlatformRun(`模板发布前检查未通过：\n${blockingItems.map((item) => `- ${item.title}：${item.detail}`).join('\n')}`)
        return null
      }

      const graph = serializeGraph(api)
      const template = await publishCalculationBookTemplate({
        name,
        description: description || `由当前画布发布，评分 ${audit?.score ?? '-'}，可作为复杂计算书电池组模板复用。`,
        discipline,
        tags,
        graph,
      })
      setCalculationTemplates((items) => [template, ...items.filter((item) => item.code !== template.code)])
      setPlatformRun(`已发布计算书模板：${template.name}\n编码：${template.code}\n节点：${template.nodeCount}\n连线：${template.connectionCount}\n标签：${template.tags.join(' / ')}`)
      setWorkflowNotice(`当前画布已沉淀为平台计算书模板「${template.name}」，后续可一键套用。`)
      return template.code
    } catch (error) {
      setPlatformRun(`发布计算书模板失败：${error instanceof Error ? error.message : String(error)}`)
      return null
    } finally {
      setPlatformLoading(false)
    }
  }

  function collectPlatformResults() {
    if (!api) return { report: '', results: {}, traceCount: 0 }
    const nodes = api.editor.getNodes() as GHNode[]
    const reportNode = nodes.find((node) => node instanceof BookAssemblerNode && typeof node.display === 'string') ||
      nodes.find((node) => node instanceof ReportNode && typeof node.display === 'string')
    const report = typeof reportNode?.display === 'string'
      ? reportNode.display
      : nodes
          .filter((node) => node.resultDisplay)
          .map((node) => `${node.label}\n${node.resultDisplay}`)
          .join('\n\n')
    const values: Record<string, unknown> = {}
    const trace = getTraceRows()
    for (const row of trace) {
      if (!(row.fieldKey in values)) values[row.fieldKey] = row.value
    }
    const results = {
      ...values,
      __trace: trace,
      __report: {
        sourceNodeId: reportNode?.id,
        sourceNodeLabel: reportNode?.label,
        length: report.length,
      },
      __generatedAt: new Date().toISOString(),
    }
    return { report, results, traceCount: trace.length }
  }

  function exportCalculationBookMarkdown() {
    if (!api) return
    const { report, results, traceCount } = collectPlatformResults()
    const resultMap = results as Record<string, unknown>
    const generatedAt = typeof resultMap.__generatedAt === 'string' ? resultMap.__generatedAt : new Date().toISOString()
    const trace = Array.isArray(resultMap.__trace) ? resultMap.__trace as ReturnType<typeof getTraceRows> : []
    const title = platformContext?.calculationBookId || 'visual-calculation-book'
    const fieldLines = Object.entries(resultMap)
      .filter(([key]) => !key.startsWith('__'))
      .map(([key, value]) => `| ${key.replace(/\|/g, '\\|')} | ${formatTraceValue(value).replace(/\|/g, '\\|')} |`)
    const traceLines = trace.map((row) => [
      row.fieldKey,
      row.nodeLabel,
      row.outputLabel,
      formatTraceValue(row.value),
      Object.entries(row.inputs).map(([key, value]) => `${key}=${formatTraceValue(value)}`).join(', ') || '-',
    ].map((value) => String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ')))

    const markdown = [
      report.trim() || '# 计算书\n\n当前画布尚未生成 Report 或 Book Assembler 正文。',
      '',
      '---',
      '',
      '## 交付元数据',
      '',
      `- 生成时间：${generatedAt}`,
      `- 项目：${platformContext?.projectName || '-'}`,
      `- WBS：${platformContext?.wbsCode || '-'}`,
      `- 结构化字段：${fieldLines.length}`,
      `- 溯源条目：${traceCount}`,
      '',
      '## 结构化结果',
      '',
      fieldLines.length > 0 ? '| 字段 | 数值 |\n|---|---|\n' + fieldLines.join('\n') : '暂无结构化结果。',
      '',
      '## 字段溯源',
      '',
      traceLines.length > 0
        ? '| 字段 | 来源电池 | 输出端口 | 数值 | 输入 |\n|---|---|---|---:|---|\n' + traceLines.map((row) => `| ${row.join(' | ')} |`).join('\n')
        : '暂无字段溯源。请先执行画布。',
      '',
    ].join('\n')

    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${safeFileName(title)}_${new Date().toISOString().slice(0, 10)}.md`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(link.href)
    setPlatformRun(`已导出 Markdown 计算书：${link.download}\n结构化字段：${fieldLines.length}\n溯源条目：${traceCount}`)
  }

  async function submitCalculationBookDraft(title = '泵计算书草稿') {
    if (!api || platformLoading) return null
    setPlatformLoading(true)
    setPlatformRun('')

    try {
      const audit = await runCanvasAudit({ switchTab: false })
      const blockingItems = audit?.items.filter((item) => item.level === 'error') || []
      if (blockingItems.length > 0) {
        setPlatformRun(`发布前检查未通过，已阻止回传：\n${blockingItems.map((item) => `- ${item.title}：${item.detail}`).join('\n')}`)
        return null
      }

      const { report, results, traceCount } = collectPlatformResults()
      const draft = await createCalculationBookDraft({
        title,
        report,
        graph: serializeGraph(api),
        results,
        wbsCode: platformContext?.wbsCode,
      })
      setDraftId(draft.id)
      setPlatformDrafts((drafts) => [draft, ...drafts.filter((item) => item.id !== draft.id)])
      setPlatformRun(`已生成计算书草稿：${draft.title}\n版本：v${draft.version}\n状态：${draft.status}\nWBS：${draft.wbsCode}\n结构化字段：${draft.resultKeys?.filter((key) => !key.startsWith('__')).length || 0}\n字段预览：${formatResultPreview(draft.resultPreview)}\n溯源条目：${traceCount}\n下一步：${draft.nextActions?.join(' / ') || '待审核'}`)
      return draft.id
    } catch (error) {
      setPlatformRun(`提交计算书草稿失败：${error instanceof Error ? error.message : String(error)}`)
      return null
    } finally {
      setPlatformLoading(false)
    }
  }

  async function auditCurrentDraft(id = draftId) {
    if (!id || platformLoading) return
    setPlatformLoading(true)

    try {
      const draft = await auditCalculationBookDraft(id)
      setPlatformDrafts((drafts) => drafts.map((item) => item.id === draft.id ? draft : item))
      setPlatformRun(`AI 审核完成：${draft.audit?.status || draft.status}\n评分：${draft.audit?.score ?? '-'}\n建议：\n${draft.audit?.suggestions.map((item) => `- ${item}`).join('\n') || '- 无'}`)
    } catch (error) {
      setPlatformRun(`AI 审核失败：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setPlatformLoading(false)
    }
  }

  async function syncCurrentDraft(id = draftId) {
    if (!id || platformLoading) return
    setPlatformLoading(true)

    try {
      const draft = await syncCalculationBookDraft(id)
      setPlatformDrafts((drafts) => drafts.map((item) => item.id === draft.id ? draft : item))
      setPlatformRun(`平台同步完成：${draft.status}\n进度计划：${draft.syncStatus?.progressPlan || '-'}\n文控回写：${draft.syncStatus?.documentControl || '-'}\n时间：${draft.syncStatus?.syncedAt || '-'}`)
    } catch (error) {
      setPlatformRun(`平台同步失败：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setPlatformLoading(false)
    }
  }

  async function submitAuditAndSyncCalculationBook(title = '泵计算书草稿') {
    if (!api || platformLoading) return null
    setPlatformLoading(true)
    setPlatformRun('')

    try {
      const audit = await runCanvasAudit({ switchTab: false })
      const blockingItems = audit?.items.filter((item) => item.level === 'error') || []
      if (blockingItems.length > 0) {
        setPlatformRun(`回传闭环检查未通过：\n${blockingItems.map((item) => `- ${item.title}：${item.detail}`).join('\n')}`)
        return null
      }

      const { report, results, traceCount } = collectPlatformResults()
      const draft = await createCalculationBookDraft({
        title,
        report,
        graph: serializeGraph(api),
        results,
        wbsCode: platformContext?.wbsCode,
      })
      const audited = await auditCalculationBookDraft(draft.id)
      const synced = await syncCalculationBookDraft(draft.id)
      setDraftId(synced.id)
      setPlatformDrafts((drafts) => [synced, ...drafts.filter((item) => item.id !== synced.id)])
      setPlatformRun([
        `计算书闭环完成：${synced.title}`,
        `版本：v${synced.version}`,
        `状态：${synced.status}`,
        `WBS：${synced.wbsCode}`,
        `结构化字段：${synced.resultKeys?.filter((key) => !key.startsWith('__')).length || 0}`,
        `字段预览：${formatResultPreview(synced.resultPreview)}`,
        `溯源条目：${traceCount}`,
        `审核：${audited.audit?.status || audited.status} · ${audited.audit?.score ?? '-'} 分`,
        `进度计划：${synced.syncStatus?.progressPlan || '-'}`,
        `文控回写：${synced.syncStatus?.documentControl || '-'}`,
      ].join('\n'))
      setWorkflowNotice(`已回传、审核并同步计算书草稿「${synced.title}」。`)
      return synced.id
    } catch (error) {
      setPlatformRun(`计算书闭环失败：${error instanceof Error ? error.message : String(error)}`)
      return null
    } finally {
      setPlatformLoading(false)
    }
  }

  const selectedNode = describeSelectedNode()
  const latestActions = getLatestAiActions()
  const latestActionSummary = summarizeAiActions(latestActions)
  const selectedInputRows = getPortRows(stats.selected, 'input')
  const selectedOutputRows = getPortRows(stats.selected, 'output')
  const fieldRows = getFieldRows()
  const traceRows = getTraceRows()
  const executionDebugRows = getExecutionDebugRows()
  const selectedPython = stats.selected instanceof PythonScriptNode ? stats.selected : undefined
  const selectedFieldInput = stats.selected instanceof FieldInputNode ? stats.selected : undefined
  const selectedOperator = stats.selected instanceof PythonScriptNode ? stats.selected.platformOperator : undefined
  const selectedFormula = stats.selected instanceof FormulaCellNode ? stats.selected : undefined
  const assistantContext = getAssistantCanvasContext()
  const deliveryChecklist = getDeliveryChecklist()
  const aiWorkflowPrompts = [
    {
      label: '章节化模板',
      prompt: '从复杂泵功率章节化计算书模板开始，请只返回可应用动作。',
    },
    {
      label: '交付骨架',
      prompt: '从零生成一套工程计算书交付骨架：项目上下文、平台字段输入、字段参数表、计算过程章节、计算书装配器和平台回传，请只返回可应用动作。',
    },
    {
      label: '修复审查项',
      prompt: '检查当前画布发布前健康度，并尽量生成修复 warning 和 error 的可应用动作。',
    },
    {
      label: '原生 Python 化',
      prompt: '把当前画布计算链转换为原生 Python 内核，并发布为平台算子后立即审核，请只返回可应用动作。',
    },
    {
      label: '公式全转 Python',
      prompt: '把当前画布中的所有 Formula Cell 或公式电池都转换为原生 Python 电池，并保留上下游连线，请只返回可应用动作。',
    },
    {
      label: '回传闭环',
      prompt: '把当前画布成果回传成计算书草稿，触发平台 AI 审核，并同步进度计划和文控，请只返回可应用动作。',
    },
    {
      label: '字段连线',
      prompt: '根据当前画布摘要，补齐同名变量/字段之间的连接；如果需要明确连接端口，请输出 connect_nodes 动作。',
    },
    {
      label: '整理布局',
      prompt: '按输入、计算、章节装配、平台回传的顺序整理当前画布布局，请只返回可应用动作。',
    },
  ]

  return (
    <div className="app">
      <Toolbar
        api={api}
        containerRef={containerRef}
        stats={{ nodes: stats.nodes, edges: stats.edges, status: stats.status }}
        onMerge={runMergeAssistant}
        onSplit={runSplitAssistant}
        onAutoConnect={() => void runFieldAutoConnect()}
        onDuplicate={() => void duplicateSelectedNodes()}
        onDelete={() => void deleteSelectedNode()}
        onExpand={() => void expandSelectedMergedGraph()}
        history={{
          canUndo: historyState.undo > 0,
          canRedo: historyState.redo > 0,
          undoCount: historyState.undo,
          redoCount: historyState.redo,
          onUndo: () => void undoCanvas(),
          onRedo: () => void redoCanvas(),
          onCapture: captureCanvasHistoryNow,
        }}
      />
      {(pyLoading || pyError) && (
        <div className={`py-loading-bar ${pyError ? 'error' : ''}`}>
          {pyLoading && <span>正在加载 Python 运行时 Pyodide，首次加载可能需要 10 到 30 秒。</span>}
          {pyError && (
            <span>
              Python 加载失败：{pyError}
              <button
                className="py-retry-btn"
                onClick={() => {
                  resetPyodide()
                  setPyLoading(true)
                  setPyError('')
                  setPyRetry((r) => r + 1)
                }}
              >
                Retry
              </button>
            </span>
          )}
        </div>
      )}
      <div
        ref={containerRef}
        className="editor-container"
        onDoubleClick={openQuickAdd}
      />
      <aside className="ai-inspector">
        <div className="inspector-tabs">
          <button className={activeTab === 'properties' ? 'active' : ''} onClick={() => setActiveTab('properties')}>
            节点属性
          </button>
          <button className={activeTab === 'assistant' ? 'active' : ''} onClick={() => setActiveTab('assistant')}>
            AI 助手
          </button>
          <button className={activeTab === 'results' ? 'active' : ''} onClick={() => setActiveTab('results')}>
            输出结果
          </button>
        </div>

        {activeTab === 'properties' && (
          <div className="inspector-card">
            {selectedNode ? (
              <>
                <div className="inspector-kicker">{selectedNode.category} 电池</div>
                <h2>{selectedNode.title}</h2>
                <div className="property-grid">
                  <span>输入端口</span><strong>{selectedNode.inputs}</strong>
                  <span>输出端口</span><strong>{selectedNode.outputs}</strong>
                  <span>运行状态</span><strong>{stats.status}</strong>
                </div>
                <div className="field-editor">
                  <label htmlFor="field-name-input">节点字段名</label>
                  <div className="field-editor-row">
                    <input
                      id="field-name-input"
                      value={fieldDraft}
                      placeholder="例如 rho、Q、P_shaft"
                      onChange={(e) => setFieldDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void applySelectedFieldName()
                      }}
                    />
                    <button onClick={() => void applySelectedFieldName()}>应用</button>
                  </div>
                  <button className="field-connect-btn" onClick={() => void runFieldAutoConnect()}>
                    按字段自动连接
                  </button>
                  <button className="field-connect-btn" onClick={() => void duplicateSelectedNodes()}>
                    复制当前节点
                  </button>
                  <button className="field-connect-btn" onClick={() => void deleteSelectedNode()}>
                    删除当前节点
                  </button>
                  {Boolean(selectedPython?.mergedGraph) && (
                    <button className="field-connect-btn" onClick={() => void expandSelectedMergedGraph()}>
                      展开来源子图
                    </button>
                  )}
                </div>
                {selectedFormula && (
                  <div className="formula-config-panel">
                    <div className="inspector-kicker">LaTeX 公式电池</div>
                    <label htmlFor="formula-title-input">标题</label>
                    <input
                      id="formula-title-input"
                      value={formulaDraft.title}
                      onChange={(e) => setFormulaDraft((draft) => ({ ...draft, title: e.target.value }))}
                    />
                    <label htmlFor="formula-latex-input">LaTeX</label>
                    <textarea
                      id="formula-latex-input"
                      value={formulaDraft.latex}
                      spellCheck={false}
                      onChange={(e) => setFormulaDraft((draft) => ({ ...draft, latex: e.target.value }))}
                    />
                    <label htmlFor="formula-expression-input">Python 表达式</label>
                    <textarea
                      id="formula-expression-input"
                      value={formulaDraft.expression}
                      spellCheck={false}
                      onChange={(e) => setFormulaDraft((draft) => ({ ...draft, expression: e.target.value }))}
                    />
                    <label htmlFor="formula-inputs-input">输入变量</label>
                    <input
                      id="formula-inputs-input"
                      value={formulaDraft.inputs}
                      placeholder="rho, Q, H, eta"
                      onChange={(e) => setFormulaDraft((draft) => ({ ...draft, inputs: e.target.value }))}
                    />
                    <div className="formula-config-grid">
                      <label htmlFor="formula-output-key-input">输出 key</label>
                      <label htmlFor="formula-output-label-input">输出显示</label>
                      <input
                        id="formula-output-key-input"
                        value={formulaDraft.outputKey}
                        onChange={(e) => setFormulaDraft((draft) => ({ ...draft, outputKey: e.target.value }))}
                      />
                      <input
                        id="formula-output-label-input"
                        value={formulaDraft.outputLabel}
                        onChange={(e) => setFormulaDraft((draft) => ({ ...draft, outputLabel: e.target.value }))}
                      />
                    </div>
                    <button onClick={() => void applySelectedFormulaConfig()}>更新公式电池</button>
                    <button className="field-connect-btn" onClick={() => void convertSelectedFormulaToPython()}>
                      转为原生 Python 电池
                    </button>
                  </div>
                )}
                <div className="port-field-panel">
                  <h3>输入字段</h3>
                  {selectedInputRows.length === 0 && <p>无输入端口</p>}
                  {selectedInputRows.map((row) => (
                    <div key={row.key} className="port-field-row">
                      <span>{row.label}</span>
                      <small>{[row.key, ...row.aliases].join(' / ')}</small>
                    </div>
                  ))}
                  <h3>输出字段</h3>
                  {selectedOutputRows.length === 0 && <p>无输出端口</p>}
                  {selectedOutputRows.map((row) => (
                    <div key={row.key} className="port-field-row">
                      <span>{row.label}</span>
                      <small>{[row.key, ...row.aliases].join(' / ')}</small>
                    </div>
                  ))}
                </div>
                {selectedFieldInput && (
                  <div className="field-input-config-panel">
                    <div className="inspector-kicker">平台字段定义</div>
                    <h3>{selectedFieldInput.fieldLabel}</h3>
                    <label>
                      字段 Key
                      <input
                        value={fieldInputDraft.fieldKey}
                        onChange={(e) => setFieldInputDraft((draft) => ({ ...draft, fieldKey: e.target.value }))}
                        placeholder="rho"
                      />
                    </label>
                    <label>
                      字段名称
                      <input
                        value={fieldInputDraft.fieldLabel}
                        onChange={(e) => setFieldInputDraft((draft) => ({ ...draft, fieldLabel: e.target.value }))}
                        placeholder="流体密度"
                      />
                    </label>
                    <div className="formula-config-grid">
                      <label>
                        单位
                        <input
                          value={fieldInputDraft.unit}
                          onChange={(e) => setFieldInputDraft((draft) => ({ ...draft, unit: e.target.value }))}
                          placeholder="kg/m3"
                        />
                      </label>
                      <label>
                        当前值
                        <input
                          type="number"
                          value={fieldInputDraft.value}
                          onChange={(e) => setFieldInputDraft((draft) => ({ ...draft, value: e.target.value }))}
                          placeholder="1000"
                        />
                      </label>
                    </div>
                    <label>
                      专业
                      <input
                        value={fieldInputDraft.discipline}
                        onChange={(e) => setFieldInputDraft((draft) => ({ ...draft, discipline: e.target.value }))}
                        placeholder="给排水 / 工艺 / 结构"
                      />
                    </label>
                    <label>
                      说明
                      <textarea
                        value={fieldInputDraft.description}
                        onChange={(e) => setFieldInputDraft((draft) => ({ ...draft, description: e.target.value }))}
                        placeholder="该字段在平台字段库或计算书中的含义"
                      />
                    </label>
                    <button onClick={() => void applySelectedFieldInputConfig()}>
                      保存字段定义
                    </button>
                    <div className="operator-test-grid">
                      <span>当前变量</span><small>{selectedFieldInput.fieldKey}</small>
                      <span>端口标题</span><small>{selectedFieldInput.unit ? `${selectedFieldInput.fieldLabel} (${selectedFieldInput.unit})` : selectedFieldInput.fieldLabel}</small>
                      <span>自动连线</span><small>匹配同名输入参数后可生成虚线连接</small>
                    </div>
                  </div>
                )}
                {selectedPython && (
                  <div className="operator-publish-panel">
                    <div className="inspector-kicker">自定义 Python 电池</div>
                    <h3>{selectedOperator ? '已关联平台算子' : '发布为平台算子'}</h3>
                    <p>
                      输入 {selectedPython.inputConfigs.map((cfg) => cfg.key).join(' / ') || '-'}，
                      输出 {selectedPython.outputConfigs.map((cfg) => cfg.key).join(' / ') || '-'}
                    </p>
                    {selectedPython.testCase && (
                      <div className="operator-test-grid">
                        <span>本地测试</span>
                        <small>{selectedPython.testStatus ? `${selectedPython.testStatus.status} · ${selectedPython.testStatus.summary}` : '已保存，等待执行'}</small>
                        <span>测试输入</span>
                        <small>{Object.entries(selectedPython.testCase.inputs).map(([key, value]) => `${key}=${value}`).join(', ')}</small>
                        <span>期望输出</span>
                        <small>{Object.entries(selectedPython.testCase.expected).map(([key, value]) => `${key}=${value}`).join(', ')}</small>
                      </div>
                    )}
                    <button disabled={platformLoading} onClick={() => void publishSelectedPythonOperator()}>
                      {platformLoading ? '正在发布...' : selectedOperator ? '发布新版本草稿' : '发布到平台算子库'}
                    </button>
                  </div>
                )}
                {selectedPython?.mergedGraph && (
                  <div className="operator-detail-panel">
                    <div className="inspector-kicker">电池组边界</div>
                    <h3>{selectedPython.mergedGraphLabel || selectedPython.label}</h3>
                    <div className="operator-test-grid">
                      <span>输入端口</span>
                      <small>{selectedPython.inputConfigs.map((cfg) => cfg.key).join(' / ') || '-'}</small>
                      <span>输出端口</span>
                      <small>{selectedPython.outputConfigs.map((cfg) => cfg.key).join(' / ') || '-'}</small>
                      <span>恢复能力</span>
                      <small>{selectedPython.mergedBoundary ? '可拆分并重接外部连线' : '仅保留来源快照'}</small>
                    </div>
                    <button className="field-connect-btn" onClick={() => void runSplitAssistant()}>
                      拆分恢复来源子图
                    </button>
                  </div>
                )}
                {selectedOperator && (
                  <div className="operator-detail-panel">
                    <div className="inspector-kicker">平台算子</div>
                    <h3>{selectedOperator.name}</h3>
                    <div className="property-grid compact">
                      <span>编码</span><strong>{selectedOperator.code}</strong>
                      <span>版本</span><strong>{selectedOperator.version}</strong>
                      <span>状态</span><strong>{selectedOperator.status}</strong>
                    </div>
                    {selectedOperator.description && <p>{selectedOperator.description}</p>}
                    <button className="field-connect-btn" disabled={platformLoading} onClick={() => void auditSelectedPlatformOperator()}>
                      {platformLoading ? '正在审核...' : '提交平台审核'}
                    </button>
                    {selectedOperator.audit && (
                      <div className="operator-test-grid">
                        <span>审核状态</span>
                        <small>{selectedOperator.audit.status} · {selectedOperator.audit.score} 分</small>
                        <span>审核建议</span>
                        <small>{selectedOperator.audit.suggestions.join(' / ')}</small>
                      </div>
                    )}
                    {selectedOperator.testCase && (
                      <>
                        <div className="operator-test-grid">
                          <span>测试输入</span>
                          <small>{Object.entries(selectedOperator.testCase.inputs).map(([key, value]) => `${key}=${value}`).join(', ')}</small>
                          <span>期望输出</span>
                          <small>{Object.entries(selectedOperator.testCase.expected).map(([key, value]) => `${key}=${value}`).join(', ')}</small>
                        </div>
                        <button className="field-connect-btn" onClick={() => void addOperatorTestInputs()}>
                          生成测试输入并连接
                        </button>
                      </>
                    )}
                  </div>
                )}
                <pre className="node-result-preview">{selectedNode.display}</pre>
              </>
            ) : (
              <div className="empty-inspector">请选择画布上的节点，查看端口、结果和公式来源。</div>
            )}
          </div>
        )}

        {activeTab === 'assistant' && (
          <div className="assistant-panel">
            <div className="assistant-status">
              <span>AI 工作台</span>
              <strong>DeepSeek Flash</strong>
            </div>
            <div className="assistant-message">{workflowNotice}</div>
            <div className="assistant-workflows">
              <div className="assistant-workflows-title">
                <span>AI 工作流</span>
                <small>生成动作预案，确认后再应用到画布</small>
              </div>
              <div className="assistant-workflow-grid">
                {aiWorkflowPrompts.map((item) => (
                  <button
                    key={item.label}
                    disabled={aiLoading}
                    onClick={() => void sendAiText(item.prompt)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="assistant-context-panel">
              <div className="assistant-context-title">
                <span>当前上下文</span>
                <button disabled={!api} onClick={appendAssistantContextToInput}>附加到提问</button>
              </div>
              <div className="assistant-context-grid">
                <span>画布</span>
                <strong>{assistantContext.nodes} 电池 / {assistantContext.connections} 连接</strong>
                <span>选中</span>
                <strong>{assistantContext.selected ? assistantContext.selected.label : '无'}</strong>
                <span>字段</span>
                <strong>{assistantContext.fields.length || 0} 个可追踪输出</strong>
                <span>公式</span>
                <strong>{assistantContext.formulaNodes.length ? `${assistantContext.formulaNodes.length} 个待 Python 化` : '已 Python-first'}</strong>
                <span>缺口</span>
                <strong>{assistantContext.unresolvedInputs.length ? `${assistantContext.unresolvedInputs.length} 个未连接输入` : '无阻断输入'}</strong>
              </div>
              {assistantContext.selected && (
                <div className="assistant-context-selected">
                  <small>ID</small>
                  <code>{assistantContext.selected.id}</code>
                  <small>端口</small>
                  <code>
                    IN {assistantContext.selected.inputs.join('/') || '-'} · OUT {assistantContext.selected.outputs.join('/') || '-'}
                  </code>
                </div>
              )}
              <div className="assistant-context-list">
                {(assistantContext.fields.length > 0 ? assistantContext.fields.slice(0, 5) : []).map((row) => (
                  <small key={`${row.node}:${row.output}:${row.field}`}>{row.field} {'->'} {row.node}.{row.output}</small>
                ))}
                {assistantContext.fields.length === 0 && <small>暂无字段映射，建议先给输入或关键输出设置变量名。</small>}
              </div>
            </div>
            <div className="assistant-chat">
              {aiMessages.map((message, index) => (
                <div key={index} className={`assistant-bubble ${message.role}`}>
                  {message.content}
                </div>
              ))}
              {aiLoading && <div className="assistant-bubble assistant">正在思考当前画布...</div>}
              {aiError && <div className="assistant-error">{aiError}</div>}
            </div>
            {latestActions.length > 0 && (
              <div className="assistant-action-preview">
                <div className="assistant-action-preview-title">
                  <span>将执行 {latestActions.length} 个画布操作</span>
                  <small>应用前可先核对动作类型和目标</small>
                </div>
                <div className="assistant-action-summary">
                  <span>新增 {latestActionSummary.creates}</span>
                  <span>更新 {latestActionSummary.updates}</span>
                  <span>连线 {latestActionSummary.links}</span>
                  <span>平台 {latestActionSummary.platform}</span>
                  <span className={latestActionSummary.risky > 0 ? 'danger' : ''}>风险 {latestActionSummary.risky}</span>
                </div>
                {latestActionSummary.nodeTargets.length > 0 && (
                  <div className="assistant-action-targets">
                    <small>目标：{latestActionSummary.nodeTargets.join(' / ')}</small>
                  </div>
                )}
                <div className="assistant-action-list">
                  {latestActions.map((action, index) => {
                    const actionInfo = describeAiAction(action)
                    const actionTone = getAiActionTone(action)
                    return (
                      <div key={`${action.type}:${index}`} className={`assistant-action-card ${actionTone}`}>
                        <strong>{index + 1}. {actionInfo.title}</strong>
                        <small>{actionInfo.detail}</small>
                      </div>
                    )
                  })}
                </div>
                <button className="assistant-apply" disabled={!api} onClick={() => void applyAiActions()}>
                  应用 AI 生成的画布操作
                </button>
              </div>
            )}
            <div className="assistant-compose">
              <textarea
                value={aiInput}
                placeholder="例如：帮我生成一个 Python 电池，计算管道压降，输入 Q、D、L、rho、mu，输出 dP。"
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void sendAiMessage()
                }}
              />
              <button disabled={aiLoading || !aiInput.trim()} onClick={() => void sendAiMessage()}>
                发送
              </button>
            </div>
            <div className="assistant-actions">
              <button onClick={() => void runMergeAssistant()}>合并/Python化</button>
              <button onClick={() => void convertAllFormulaNodesToPython()}>公式全转 Python</button>
              <button onClick={() => void pythonizeCanvasAndPublishOperator()}>Python化并发布</button>
              <button onClick={() => void pythonizePublishAndAuditOperator()}>Python化发布并审核</button>
              <button onClick={() => void submitAuditAndSyncCalculationBook('AI 编排计算书草稿')}>回传审核同步</button>
              <button onClick={() => void runSplitAssistant()}>拆分选中节点</button>
              <button onClick={() => void autoLayoutCanvas()}>整理布局</button>
              <button onClick={() => void runCanvasAudit()}>检查画布</button>
            </div>
            <div className="assistant-checklist">
              <span>平台设计重点</span>
              <p>公式可读、变量可追溯、节点可封装、领域逻辑可拆分。</p>
            </div>
          </div>
        )}

        {activeTab === 'results' && (
          <div className="inspector-card">
            <div className="inspector-kicker">Graph 运行概况</div>
            <h2>当前画布</h2>
            <div className="property-grid">
              <span>节点数</span><strong>{stats.nodes}</strong>
              <span>连线数</span><strong>{stats.edges}</strong>
              <span>状态</span><strong>{stats.status}</strong>
            </div>
            <div className="delivery-checklist">
              <div className="inspector-kicker">交付清单</div>
              {deliveryChecklist.map((item) => (
                <div key={item.label} className={`delivery-check ${item.ready ? 'ready' : 'missing'}`}>
                  <span>{item.ready ? '✓' : '!'}</span>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </div>
              ))}
            </div>
            <div className="canvas-audit-panel">
              <div className="draft-history-title">
                <div>
                  <div className="inspector-kicker">发布前健康检查</div>
                  <h3>{canvasAudit ? `${canvasAudit.score} 分 · ${canvasAudit.status === 'ready' ? '可回传' : '需修复'}` : '尚未检查'}</h3>
                </div>
                <button onClick={() => void runCanvasAudit()}>立即检查</button>
              </div>
              {canvasAudit ? (
                <>
                  <small>检查时间：{canvasAudit.checkedAt}</small>
                  <div className="audit-items">
                    {canvasAudit.items.map((item, index) => (
                      <div key={`${item.title}:${index}`} className={`audit-item ${item.level}`}>
                        <span>{item.title}</span>
                        <small>{item.detail}</small>
                      </div>
                    ))}
                  </div>
                  <button className="audit-fix-btn" disabled={aiLoading} onClick={() => void askAiToFixAudit()}>
                    {aiLoading ? 'AI 正在处理...' : '让 AI 修复审查项'}
                  </button>
                </>
              ) : (
                <p>检查字段连接、Report 缺值、平台回传路径和 Python 算子沉淀状态。</p>
              )}
            </div>
            <div className="field-registry">
              <div className="inspector-kicker">字段清单</div>
              {fieldRows.length === 0 && <p>暂无已命名字段。选中节点后可在属性栏设置字段名。</p>}
              {fieldRows.slice(0, 12).map((row) => (
                <div key={`${row.node.id}:${row.outputKey}`} className="field-registry-row">
                  <span>{row.fieldNames.join(' / ')}</span>
                  <small>{row.node.label} · {row.label}</small>
                </div>
              ))}
            </div>
            <div className="field-registry">
              <div className="inspector-kicker">执行调试摘要</div>
              {executionDebugRows.length === 0 && <p>暂无节点。</p>}
              {executionDebugRows.slice(0, 12).map((row) => (
                <div key={row.id} className={`debug-registry-row ${row.status}`}>
                  <span>{row.label}</span>
                  <small>{row.category} · 输入 {row.inputs} · 输出 {row.outputs}</small>
                  <small>{row.summary.split('\n').slice(0, 2).join(' / ')}</small>
                </div>
              ))}
            </div>
            <div className="field-registry">
              <div className="inspector-kicker">字段溯源</div>
              {traceRows.length === 0 && <p>暂无执行溯源。先执行画布后可查看字段来源、输入和输出。</p>}
              {traceRows.slice(0, 12).map((row) => (
                <div key={`${row.nodeId}:${row.outputKey}`} className="trace-registry-row">
                  <span>{row.fieldKey}</span>
                  <small>{row.nodeLabel} · {row.outputLabel} = {formatTraceValue(row.value)}</small>
                  <small>输入 {Object.entries(row.inputs).map(([key, value]) => `${key}=${formatTraceValue(value)}`).join(', ') || '-'}</small>
                </div>
              ))}
            </div>
            <div className="field-registry">
              <div className="inspector-kicker">平台字段库</div>
              {platformFields.slice(0, 8).map((field, index) => (
                <button key={field.key} className="field-registry-action" onClick={() => void addPlatformFieldInput(field, index)}>
                  <span>{field.key} · {field.label}</span>
                  <small>{field.defaultValue} {field.unit} · {field.description}</small>
                </button>
              ))}
            </div>
            <div className="field-registry">
              <div className="inspector-kicker">平台知识资源</div>
              <div className="component-search-row">
                <input
                  value={componentQuery}
                  placeholder="搜索组件、规范、计算说明"
                  onChange={(event) => setComponentQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void searchPlatformComponents()
                  }}
                />
                <button onClick={() => void searchPlatformComponents()}>搜索</button>
              </div>
              {componentSearchStatus && <p>{componentSearchStatus}</p>}
              {componentResults.slice(0, 6).map((item) => (
                <button key={item.id} className="field-registry-action" onClick={appendComponentResourcesToInput}>
                  <span>{item.category} · {item.name}</span>
                  <small>{item.path}</small>
                  <small>{item.summary || '暂无摘要'}</small>
                </button>
              ))}
              {componentResults.length > 0 && (
                <button className="field-connect-btn" onClick={appendComponentResourcesToInput}>
                  附加资源给 AI
                </button>
              )}
            </div>
            <button className="execute-inline" onClick={() => triggerExecute()}>执行当前 Graph</button>
            <button className="execute-inline secondary" disabled={!api || platformLoading} onClick={() => void runExternalCalculationBook()}>
              {platformLoading ? '正在调用平台...' : '作为计算书 API 调用'}
            </button>
            <button className="execute-inline secondary" disabled={!api || platformLoading} onClick={() => void submitCalculationBookDraft()}>
              生成计算书草稿并回传
            </button>
            <button className="execute-inline secondary" disabled={!api || platformLoading} onClick={() => void submitAuditAndSyncCalculationBook('当前画布计算书草稿')}>
              回传、AI审核并同步
            </button>
            <button className="execute-inline secondary" disabled={!api} onClick={exportCalculationBookMarkdown}>
              导出 Markdown 计算书
            </button>
            <button className="execute-inline secondary" disabled={!api || platformLoading} onClick={() => void publishCurrentCalculationTemplate('当前画布计算书模板')}>
              保存为平台计算书模板
            </button>
            <button className="execute-inline secondary" disabled={!draftId || platformLoading} onClick={() => void auditCurrentDraft()}>
              AI 审核当前草稿
            </button>
            <button className="execute-inline secondary" disabled={!draftId || platformLoading} onClick={() => void syncCurrentDraft()}>
              同步到进度与文控
            </button>
            {platformContext && (
              <div className="platform-context">
                <span>{platformContext.projectName}</span>
                <strong>{platformContext.wbsCode}</strong>
                <small>回传：{platformContext.documentControl.returnTargets.join(' / ')}</small>
              </div>
            )}
            {platformRun && <pre className="node-result-preview">{platformRun}</pre>}
            <div className="draft-history">
              <div className="draft-history-title">
                <div>
                  <div className="inspector-kicker">平台回传历史</div>
                  <h3>最近计算书草稿</h3>
                </div>
                <button onClick={() => void refreshPlatformDrafts()}>刷新</button>
              </div>
              {platformDrafts.length === 0 && <p>暂无回传草稿。</p>}
              {platformDrafts.slice(0, 5).map((draft) => (
                <button
                  key={draft.id}
                  className={draft.id === draftId ? 'active' : ''}
                  onClick={() => setDraftId(draft.id)}
                >
                  <span>{draft.title}</span>
                  <small>v{draft.version} · {draft.status} · {draft.wbsCode}</small>
                  <small>结构化 {draft.structuredResultCount ?? '-'} · 溯源 {draft.traceCount ?? '-'}</small>
                  {draft.audit && <small>审核 {draft.audit.status} · {draft.audit.score}</small>}
                  {draft.resultKeys && draft.resultKeys.filter((key) => !key.startsWith('__')).length > 0 && (
                    <small>字段 {draft.resultKeys.filter((key) => !key.startsWith('__')).join(' / ')}</small>
                  )}
                  {draft.resultPreview && draft.resultPreview.length > 0 && (
                    <small>预览 {draft.resultPreview.map((item) => `${item.key}=${formatTraceValue(item.value)}`).join(' / ')}</small>
                  )}
                  {draft.syncStatus && <small>{draft.syncStatus.documentControl}</small>}
                </button>
              ))}
            </div>
            <div className="draft-history">
              <div className="draft-history-title">
                <div>
                  <div className="inspector-kicker">电池回传回执</div>
                  <h3>最近平台回执</h3>
                </div>
                <button onClick={() => void refreshPlatformDrafts()}>刷新</button>
              </div>
              {platformReceipts.length === 0 && <p>暂无电池级回传回执。</p>}
              {platformReceipts.slice(0, 5).map((receipt) => (
                <button key={receipt.receiptId}>
                  <span>{receipt.title}</span>
                  <small>{receipt.receiptId} · graph {receipt.graphAttached ? 'yes' : 'no'}</small>
                  <small>结构化 {receipt.structuredResultCount ?? '-'} · 溯源 {receipt.traceCount ?? '-'}</small>
                  {receipt.resultKeys.filter((key) => !key.startsWith('__')).length > 0 && (
                    <small>字段 {receipt.resultKeys.filter((key) => !key.startsWith('__')).join(' / ')}</small>
                  )}
                  {receipt.resultPreview && receipt.resultPreview.length > 0 && (
                    <small>预览 {receipt.resultPreview.map((item) => `${item.key}=${formatTraceValue(item.value)}`).join(' / ')}</small>
                  )}
                  <small>{receipt.returnedTo.join(' / ')}</small>
                </button>
              ))}
            </div>
            <div className="platform-resource-panel">
              <div className="inspector-kicker">平台资源库</div>
              <h3>项目上下文</h3>
              <button onClick={() => void addProjectContextNode()}>
                <span>项目上下文</span>
                <small>项目 / WBS / 计算书编号 / 文控回传目标</small>
              </button>
              <h3>计算书模板</h3>
              {calculationTemplates.map((item) => (
                <button key={item.code} onClick={() => void applyCalculationTemplate(item.code)}>
                  <span>{item.name}</span>
                  <small>{item.discipline} · {item.nodeCount} 节点 · {item.connectionCount} 连线</small>
                  <small>{item.description}</small>
                </button>
              ))}
              <h3>数据字典</h3>
              {platformDictionaries.map((item) => (
                <button key={item.code} onClick={() => void addPlatformDictionary(item.code)}>
                  <span>{item.name}</span>
                  <small>{item.code} · {item.size ?? 0} 项</small>
                </button>
              ))}
              <h3>工程数据表</h3>
              {platformTables.map((item) => (
                <button key={item.code} onClick={() => void addPlatformTable(item.code)}>
                  <span>{item.name}</span>
                  <small>{item.code} · {item.axis || 'x'} · {item.unit || '-'}</small>
                </button>
              ))}
              <h3>算子引擎</h3>
              {platformOperators.map((item) => (
                <button key={item.code} className="operator-chip" onClick={() => void addPlatformOperator(item.code)}>
                  <span>{item.name}</span>
                  <small>{item.language} · {item.version} · {item.status}</small>
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>
      {quickAdd && (
        <div className="gh-quick-add" style={{ left: quickAdd.x, top: quickAdd.y }}>
          <input
            autoFocus
            value={quickAdd.query}
            placeholder="Search components..."
            onChange={(e) => setQuickAdd({ ...quickAdd, query: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setQuickAdd(null)
              if (e.key === 'Enter' && filteredQuickItems[0]) {
                void addQuickNode(filteredQuickItems[0].factory)
              }
            }}
          />
          <div className="gh-quick-add-list">
            {filteredQuickItems.map((item) => (
              <button key={`${item.category}:${item.label}`} onClick={() => void addQuickNode(item.factory)}>
                <span>{item.label}</span>
                <small>{item.category}</small>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
