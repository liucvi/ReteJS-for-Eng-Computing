const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export type ProjectSummary = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export type ProjectRecord = ProjectSummary & {
  graphJson: unknown
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Request failed: ${res.status}`)
  }

  if (res.status === 204) return undefined as T
  return await res.json() as T
}

export function listProjects(): Promise<ProjectSummary[]> {
  return request<ProjectSummary[]>('/api/projects')
}

export function getProject(id: string): Promise<ProjectRecord> {
  return request<ProjectRecord>(`/api/projects/${id}`)
}

export function createProject(name: string, graphJson: unknown): Promise<ProjectRecord> {
  return request<ProjectRecord>('/api/projects', {
    method: 'POST',
    body: JSON.stringify({ name, graphJson }),
  })
}

export function updateProject(id: string, name: string, graphJson: unknown): Promise<ProjectRecord> {
  return request<ProjectRecord>(`/api/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name, graphJson }),
  })
}

export type AiChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type AiChatResponse = {
  content: string
  model?: string
  usage?: unknown
}

export function chatWithAssistant(messages: AiChatMessage[], canvas: unknown): Promise<AiChatResponse> {
  return request<AiChatResponse>('/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ messages, canvas }),
  })
}

export type PlatformProjectContext = {
  projectId: string
  projectName: string
  calculationBookId: string
  wbsCode: string
  documentControl: {
    enabled: boolean
    returnTargets: string[]
  }
}

export type PlatformResourceSummary = {
  code: string
  name: string
  unit?: string
  axis?: string
  size?: number
}

export type PlatformFieldDefinition = {
  key: string
  label: string
  unit: string
  defaultValue: number
  discipline: string
  description: string
}

export type CalculationBookTemplateSummary = {
  code: string
  name: string
  discipline: string
  description: string
  tags: string[]
  nodeCount: number
  connectionCount: number
}

export type CalculationBookTemplateDetail = Omit<CalculationBookTemplateSummary, 'nodeCount' | 'connectionCount'> & {
  graph: unknown
}

export type PlatformOperatorSummary = {
  code: string
  name: string
  language: string
  version: string
  inputs: string[]
  outputs: string[]
  status: string
  description?: string
  hasSource?: boolean
  hasTestCase?: boolean
}

export type PlatformOperatorDetail = PlatformOperatorSummary & {
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
}

export type PlatformRunResponse = {
  ok: boolean
  mode: string
  html: string
  inputs: unknown
  graphReceived: boolean
}

export type CalculationBookDraft = {
  id: string
  title: string
  version: number
  status: string
  wbsCode: string
  reportPreview: string
  graphAttached: boolean
  createdAt: string
  resultKeys?: string[]
  resultPreview?: Array<{ key: string; value: unknown }>
  structuredResultCount?: number
  traceCount?: number
  nextActions?: string[]
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
}

export type PlatformResultReceipt = {
  receiptId: string
  title: string
  reportPreview: string
  graphAttached: boolean
  resultKeys: string[]
  resultPreview?: Array<{ key: string; value: unknown }>
  structuredResultCount?: number
  traceCount?: number
  returnedTo: string[]
  createdAt: string
}

export type ComponentFileSummary = {
  id: string
  path: string
  name: string
  category: string
  summary: string
  updatedAt: string
}

export function getPlatformProjectContext(): Promise<PlatformProjectContext> {
  return request<PlatformProjectContext>('/api/platform/project-context')
}

export function listPlatformFields(): Promise<PlatformFieldDefinition[]> {
  return request<PlatformFieldDefinition[]>('/api/platform/fields')
}

export function listPlatformDictionaries(): Promise<PlatformResourceSummary[]> {
  return request<PlatformResourceSummary[]>('/api/platform/resources/dictionaries')
}

export function listCalculationBookTemplates(): Promise<CalculationBookTemplateSummary[]> {
  return request<CalculationBookTemplateSummary[]>('/api/platform/calculation-book-templates')
}

export function getCalculationBookTemplate(code: string): Promise<CalculationBookTemplateDetail> {
  return request<CalculationBookTemplateDetail>(`/api/platform/calculation-book-templates/${encodeURIComponent(code)}`)
}

export function publishCalculationBookTemplate(payload: {
  name: string
  description?: string
  discipline?: string
  tags?: string[]
  graph: unknown
}): Promise<CalculationBookTemplateSummary> {
  return request<CalculationBookTemplateSummary>('/api/platform/calculation-book-templates', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function listPlatformTables(): Promise<PlatformResourceSummary[]> {
  return request<PlatformResourceSummary[]>('/api/platform/resources/tables')
}

export function listPlatformOperators(): Promise<PlatformOperatorSummary[]> {
  return request<PlatformOperatorSummary[]>('/api/platform/resources/operators')
}

export function getPlatformOperator(code: string): Promise<PlatformOperatorDetail> {
  return request<PlatformOperatorDetail>(`/api/platform/resources/operators/${encodeURIComponent(code)}`)
}

export function publishPlatformOperator(payload: {
  name: string
  code?: string
  sourceCode: string
  inputs: string[]
  outputs: string[]
  description?: string
  testCase?: {
    inputs: Record<string, number>
    expected: Record<string, number>
  }
}): Promise<PlatformOperatorDetail> {
  return request<PlatformOperatorDetail>('/api/platform/resources/operators', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function auditPlatformOperator(code: string): Promise<PlatformOperatorDetail> {
  return request<PlatformOperatorDetail>(`/api/platform/resources/operators/${encodeURIComponent(code)}/audit`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function runPlatformCalculationBook(graph: unknown, inputs: unknown): Promise<PlatformRunResponse> {
  return request<PlatformRunResponse>('/api/platform/calculation-books/run', {
    method: 'POST',
    body: JSON.stringify({ graph, inputs }),
  })
}

export function listPlatformResultReceipts(): Promise<PlatformResultReceipt[]> {
  return request<PlatformResultReceipt[]>('/api/platform/results/receipts')
}

export function createCalculationBookDraft(payload: {
  title: string
  report: string
  graph: unknown
  results: unknown
  wbsCode?: string
}): Promise<CalculationBookDraft> {
  return request<CalculationBookDraft>('/api/platform/calculation-books/drafts', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function listCalculationBookDrafts(): Promise<CalculationBookDraft[]> {
  return request<CalculationBookDraft[]>('/api/platform/calculation-books/drafts')
}

export function auditCalculationBookDraft(id: string): Promise<CalculationBookDraft> {
  return request<CalculationBookDraft>(`/api/platform/calculation-books/drafts/${encodeURIComponent(id)}/audit`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function syncCalculationBookDraft(id: string): Promise<CalculationBookDraft> {
  return request<CalculationBookDraft>(`/api/platform/calculation-books/drafts/${encodeURIComponent(id)}/sync`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function searchComponentFiles(query: string): Promise<ComponentFileSummary[]> {
  return request<ComponentFileSummary[]>(`/api/components/search?q=${encodeURIComponent(query)}`)
}
