import { useState } from 'react'
import { triggerExecute } from '../engineEvents'
import { BookSectionNode, type BookAssemblerNode, type ReportNode, type ReportPortConfig } from '../nodes/report'

type TemplateNode = ReportNode | BookSectionNode | BookAssemblerNode
type Tab = 'template' | 'inputs' | 'output'

export function ReportEditor({ node, onClose }: { node: TemplateNode; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('template')
  const [template, setTemplate] = useState(node.template)
  const [inputs, setInputs] = useState<ReportPortConfig[]>([...node.inputConfigs])
  const [outputKey, setOutputKey] = useState(node instanceof BookSectionNode ? node.outputKey : '')
  const [outputLabel, setOutputLabel] = useState(node instanceof BookSectionNode ? node.outputLabel : '')
  const isSection = node instanceof BookSectionNode

  async function save() {
    const nextInputs = inputs.filter((p) => p.key.trim() && p.label.trim())
    const nextOutputs = isSection && outputKey.trim() ? [outputKey.trim()] : []
    await node.removeInvalidConnections(nextInputs.map((p) => p.key), nextOutputs)
    node.template = template
    node.inputConfigs = nextInputs
    if (isSection) {
      node.outputKey = outputKey.trim() || 'section'
      node.outputLabel = outputLabel.trim() || node.outputKey
    }
    node.rebuildPorts()
    await node.refreshNodeView()
    onClose()
    triggerExecute()
  }

  function addInput() {
    const used = new Set(inputs.map((p) => p.key))
    let i = 1
    while (used.has(`p${i}`)) i++
    setInputs([...inputs, { key: `p${i}`, label: `Param ${i}` }])
  }

  function removeInput(idx: number) {
    setInputs(inputs.filter((_, i) => i !== idx))
  }

  function updateInput(idx: number, patch: Partial<ReportPortConfig>) {
    setInputs(inputs.map((p, i) => (i === idx ? { ...p, ...patch } : p)))
  }

  return (
    <div className="py-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="py-modal-content" style={{ width: 700, height: 550 }}>
        <div className="py-modal-header">
          <h3>{isSection ? 'Book Section Editor' : node.label === 'Book Assembler' ? 'Book Assembler Editor' : 'Report Editor'}</h3>
          <button className="py-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="py-modal-tabs">
          {(['template', 'inputs', ...(isSection ? ['output' as const] : [])] as Tab[]).map((t) => (
            <button key={t} className={`py-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="py-modal-body">
          {tab === 'template' && (
            <>
              <p className="py-modal-hint">
                Use {'{key}'} placeholders for inputs. Available: {inputs.map((p) => `{${p.key}}`).join(', ') || 'none'}
              </p>
              <textarea
                className="py-code-area"
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                spellCheck={false}
                placeholder={`=== 计算书 ===\n参数 D = {d}\n结果 Re = {re}`}
              />
            </>
          )}

          {tab === 'inputs' && (
            <div className="py-port-list">
              {inputs.map((p, i) => (
                <div key={i} className="py-port-row">
                  <input
                    value={p.key}
                    onChange={(e) => updateInput(i, { key: e.target.value })}
                    placeholder="key"
                  />
                  <input
                    value={p.label}
                    onChange={(e) => updateInput(i, { label: e.target.value })}
                    placeholder="label"
                  />
                  <button onClick={() => removeInput(i)}>Remove</button>
                </div>
              ))}
              <button className="py-add-btn" onClick={addInput}>+ Add Input</button>
            </div>
          )}

          {tab === 'output' && isSection && (
            <div className="py-port-list">
              <p className="py-modal-hint">
                Section output key should match the assembler input, for example section1 or section2.
              </p>
              <div className="py-port-row">
                <input
                  value={outputKey}
                  onChange={(e) => setOutputKey(e.target.value)}
                  placeholder="section1"
                />
                <input
                  value={outputLabel}
                  onChange={(e) => setOutputLabel(e.target.value)}
                  placeholder="Section 1"
                />
              </div>
            </div>
          )}
        </div>

        <div className="py-modal-footer">
          <button className="py-btn-save" onClick={save}>Save & Run</button>
          <button className="py-btn-cancel" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
