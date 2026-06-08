import { useState, useRef, useEffect } from 'react'
import { nodeCategories } from '../nodeRegistry'
import type { GHNode } from '../nodes/base'
import type { Schemes } from '../nodes/base'
import type { NodeEditor } from 'rete'
import type { AreaPlugin } from 'rete-area-plugin'
import type { ReactArea2D } from 'rete-react-plugin'
import type { ContextMenuExtra } from 'rete-context-menu-plugin'
import type { MinimapExtra } from 'rete-minimap-plugin'
import { createProject, getProject, listProjects, updateProject } from '../projectApi'
import type { ProjectSummary } from '../projectApi'
import { loadGraph, serializeGraph, type SavedGraph } from '../graphPersistence'
import { triggerExecute } from '../engineEvents'

export type EditorAPI = {
  editor: NodeEditor<Schemes>
  area: AreaPlugin<Schemes, ReactArea2D<Schemes> | ContextMenuExtra | MinimapExtra>
}

type ToolbarProps = {
  api: EditorAPI | null
  containerRef: React.RefObject<HTMLDivElement | null>
  stats: {
    nodes: number
    edges: number
    status: string
  }
  onMerge: () => void
  onSplit: () => void
  onAutoConnect: () => void
  onDuplicate: () => void
  onDelete: () => void
  onExpand: () => void
  history?: {
    canUndo: boolean
    canRedo: boolean
    undoCount: number
    redoCount: number
    onUndo: () => void
    onRedo: () => void
    onCapture: () => void
  }
}

export function Toolbar({ api, containerRef, stats, onMerge, onSplit, onAutoConnect, onDuplicate, onDelete, onExpand, history }: ToolbarProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [currentProject, setCurrentProject] = useState<ProjectSummary | null>(null)
  const [status, setStatus] = useState('')
  const toolbarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setActiveCategory(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function addNode(factory: () => GHNode) {
    if (!api || !containerRef.current) return
    const node = factory()
    node.setGraphContext(api.editor, api.area)
    await api.editor.addNode(node)

    const rect = containerRef.current.getBoundingClientRect()
    const t = api.area.area.transform
    const cx = rect.width / 2
    const cy = rect.height / 2
    const worldX = (cx - t.x) / t.k - (node.width || 160) / 2
    const worldY = (cy - t.y) / t.k - (node.height || 60) / 2

    await api.area.translate(node.id, { x: worldX, y: worldY })
    await api.area.update('node', node.id)
    setActiveCategory(null)
    triggerExecute()
    window.setTimeout(() => history?.onCapture(), 150)
  }

  async function saveProject() {
    if (!api) return
    const fallbackName = currentProject?.name || 'Untitled Project'
    const name = window.prompt('Project name', fallbackName)
    if (!name) return

    setStatus('Saving...')
    try {
      const graph = serializeGraph(api)
      const saved = currentProject
        ? await updateProject(currentProject.id, name, graph)
        : await createProject(name, graph)
      setCurrentProject(saved)
      setStatus(`Saved: ${saved.name}`)
    } catch (error) {
      setStatus('Save failed')
      window.alert(error instanceof Error ? error.message : String(error))
    }
  }

  async function openProject() {
    if (!api) return

    setStatus('Loading projects...')
    try {
      const projects = await listProjects()
      if (projects.length === 0) {
        setStatus('No projects')
        window.alert('No saved projects found.')
        return
      }

      const menu = projects
        .map((project, index) => `${index + 1}. ${project.name} (${new Date(project.updatedAt).toLocaleString()})`)
        .join('\n')
      const selected = window.prompt(`Open project:\n${menu}\n\nEnter number`, '1')
      if (!selected) {
        setStatus('')
        return
      }

      const index = Number(selected) - 1
      const summary = projects[index]
      if (!summary) {
        setStatus('Invalid selection')
        return
      }

      const project = await getProject(summary.id)
      await loadGraph(api, project.graphJson as SavedGraph)
      setCurrentProject(project)
      setStatus(`Opened: ${project.name}`)
    } catch (error) {
      setStatus('Open failed')
      window.alert(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <div ref={toolbarRef} className="gh-toolbar">
      <div className="workspace-title">
        <span>工作区</span>
        <h1>泵计算书</h1>
        <p>添加电池、连线编排，并执行当前 Graph。</p>
      </div>
      <div className="gh-project-actions">
        <button className="gh-project-btn primary" disabled={!api} onClick={() => window.location.reload()}>
          新建画布
        </button>
        <button className="gh-project-btn" disabled={!api} onClick={() => void saveProject()}>
          保存
        </button>
        <button className="gh-project-btn" disabled={!api} onClick={() => void openProject()}>
          打开
        </button>
      </div>
      <span className="gh-project-status">{status || currentProject?.name || 'Local canvas'}</span>

      <div className="battery-actions">
        <button onClick={() => triggerExecute()} disabled={!api}>执行计算</button>
        <div className="history-actions">
          <button onClick={history?.onUndo} disabled={!api || !history?.canUndo}>撤销 {history?.undoCount || ''}</button>
          <button onClick={history?.onRedo} disabled={!api || !history?.canRedo}>重做 {history?.redoCount || ''}</button>
        </div>
        <button onClick={onAutoConnect} disabled={!api}>自动连接字段</button>
        <button onClick={onDuplicate} disabled={!api}>复制节点</button>
        <button onClick={onDelete} disabled={!api}>删除节点</button>
        <button onClick={onExpand} disabled={!api}>展开来源</button>
        <button onClick={onMerge} disabled={!api}>合并/Python化</button>
        <button onClick={onSplit} disabled={!api}>拆分节点</button>
      </div>

      <div className="battery-library">
        {nodeCategories.map((cat) => (
          <div
            key={cat.name}
            className={`gh-toolbar-category ${activeCategory === cat.name ? 'active' : ''}`}
            onMouseEnter={() => setActiveCategory(cat.name)}
          >
            <button className="gh-toolbar-btn">+ {cat.name}</button>
            {activeCategory === cat.name && (
              <div className="gh-toolbar-panel">
                {cat.items.slice(0, 9).map((item) => (
                  <button
                    key={item.label}
                    className="gh-toolbar-item"
                    onClick={() => void addNode(item.factory)}
                  >
                    <span className="gh-item-icon">◆</span>
                    <span className="gh-item-label">{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="graph-metrics">
        <div><span>图协议</span><strong>0.1.0</strong></div>
        <div><span>节点数</span><strong>{stats.nodes}</strong></div>
        <div><span>边数</span><strong>{stats.edges}</strong></div>
        <div><span>运行状态</span><strong>{stats.status}</strong></div>
      </div>
    </div>
  )
}
