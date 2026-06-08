import { useState } from 'react'
import { triggerExecute } from '../engineEvents'
import { validatePythonSafety, type PythonScriptNode, type PythonTestCase, type PyPortConfig } from '../nodes/python'

type Tab = 'code' | 'inputs' | 'outputs' | 'test'

export function PythonEditor({ node, onClose }: { node: PythonScriptNode; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('code')
  const [code, setCode] = useState(node.code)
  const [inputs, setInputs] = useState<PyPortConfig[]>([...node.inputConfigs])
  const [outputs, setOutputs] = useState<PyPortConfig[]>([...node.outputConfigs])
  const [testInputs, setTestInputs] = useState<Record<string, string>>(
    Object.fromEntries(inputs.map((input) => [input.key, String(node.testCase?.inputs[input.key] ?? '')]))
  )
  const [testExpected, setTestExpected] = useState<Record<string, string>>(
    Object.fromEntries(outputs.map((output) => [output.key, String(node.testCase?.expected[output.key] ?? '')]))
  )
  const safetyIssues = validatePythonSafety(code)

  async function save() {
    if (safetyIssues.length > 0) return

    const nextInputs = inputs.filter((p) => p.key.trim())
    const nextOutputs = outputs.filter((p) => p.key.trim())
    await node.removeInvalidConnections(
      nextInputs.map((p) => p.key),
      nextOutputs.map((p) => p.key)
    )
    node.code = code
    node.inputConfigs = nextInputs
    node.outputConfigs = nextOutputs
    node.testCase = buildTestCase(nextInputs, nextOutputs)
    node.testStatus = node.testCase
      ? { status: 'not-run', summary: '测试用例已保存，等待执行自检。' }
      : undefined
    node.rebuildPorts()
    await node.refreshNodeView()
    onClose()
    triggerExecute()
  }

  function addPort(list: PyPortConfig[], setList: (l: PyPortConfig[]) => void) {
    const used = new Set(list.map((p) => p.key))
    let i = 1
    while (used.has(`p${i}`)) i++
    setList([...list, { key: `p${i}`, label: `p${i}`, type: 'number' }])
  }

  function removePort(list: PyPortConfig[], setList: (l: PyPortConfig[]) => void, idx: number) {
    setList(list.filter((_, i) => i !== idx))
  }

  function updatePort(list: PyPortConfig[], setList: (l: PyPortConfig[]) => void, idx: number, patch: Partial<PyPortConfig>) {
    const previousKey = list[idx]?.key
    const next = list.map((p, i) => (i === idx ? { ...p, ...patch } : p))
    setList(next)
    if (patch.key && previousKey && previousKey !== patch.key) {
      setTestInputs((current) => ({ ...current, [patch.key as string]: current[previousKey] ?? '' }))
      setTestExpected((current) => ({ ...current, [patch.key as string]: current[previousKey] ?? '' }))
    }
  }

  function buildTestCase(nextInputs: PyPortConfig[], nextOutputs: PyPortConfig[]): PythonTestCase | undefined {
    const parsedInputs: Record<string, number> = {}
    const parsedExpected: Record<string, number> = {}

    for (const input of nextInputs) {
      const raw = testInputs[input.key]
      if (raw === undefined || raw.trim() === '') return undefined
      const value = Number(raw)
      if (!Number.isFinite(value)) return undefined
      parsedInputs[input.key] = value
    }

    for (const output of nextOutputs) {
      const raw = testExpected[output.key]
      if (raw === undefined || raw.trim() === '') return undefined
      const value = Number(raw)
      if (!Number.isFinite(value)) return undefined
      parsedExpected[output.key] = value
    }

    return { inputs: parsedInputs, expected: parsedExpected }
  }

  function updateTestValue(
    kind: 'input' | 'expected',
    key: string,
    value: string
  ) {
    const setter = kind === 'input' ? setTestInputs : setTestExpected
    setter((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="py-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="py-modal-content">
        <div className="py-modal-header">
          <h3>Python Script Editor</h3>
          <button className="py-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="py-modal-tabs">
          {(['code', 'inputs', 'outputs', 'test'] as Tab[]).map((t) => (
            <button
              key={t}
              className={`py-tab ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="py-modal-body">
          {tab === 'code' && (
            <>
              <p className="py-modal-hint">
                Inputs: {inputs.map((p) => p.key).join(', ')}<br/>
                Outputs: {outputs.map((p) => p.key).join(', ')}
              </p>
              {safetyIssues.length > 0 ? (
                <div className="py-safety-warning">
                  <strong>Python 沙箱已阻止保存</strong>
                  {safetyIssues.map((issue) => (
                    <span key={`${issue.token}:${issue.reason}`}>{issue.token}: {issue.reason}</span>
                  ))}
                </div>
              ) : (
                <div className="py-safety-ok">沙箱检查通过：未发现文件、网络或系统命令访问。</div>
              )}
              <textarea
                className="py-code-area"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                spellCheck={false}
              />
            </>
          )}

          {tab === 'inputs' && (
            <div className="py-port-list">
              {inputs.map((p, i) => (
                <div key={i} className="py-port-row">
                  <input
                    value={p.key}
                    onChange={(e) => updatePort(inputs, setInputs, i, { key: e.target.value, label: e.target.value })}
                    placeholder="name"
                  />
                  <button onClick={() => removePort(inputs, setInputs, i)}>Remove</button>
                </div>
              ))}
              <button className="py-add-btn" onClick={() => addPort(inputs, setInputs)}>+ Add Input</button>
            </div>
          )}

          {tab === 'outputs' && (
            <div className="py-port-list">
              {outputs.map((p, i) => (
                <div key={i} className="py-port-row">
                  <input
                    value={p.key}
                    onChange={(e) => updatePort(outputs, setOutputs, i, { key: e.target.value, label: e.target.value })}
                    placeholder="name"
                  />
                  <button onClick={() => removePort(outputs, setOutputs, i)}>Remove</button>
                </div>
              ))}
              <button className="py-add-btn" onClick={() => addPort(outputs, setOutputs)}>+ Add Output</button>
            </div>
          )}

          {tab === 'test' && (
            <div className="py-port-list">
              <p className="py-modal-hint">
                填完整输入和期望输出后，发布平台算子会优先使用这组测试用例。
              </p>
              <div className="py-test-section">
                <h4>测试输入</h4>
                {inputs.map((p) => (
                  <div key={p.key} className="py-port-row">
                    <span>{p.key}</span>
                    <input
                      value={testInputs[p.key] ?? ''}
                      onChange={(e) => updateTestValue('input', p.key, e.target.value)}
                      placeholder="number"
                    />
                  </div>
                ))}
              </div>
              <div className="py-test-section">
                <h4>期望输出</h4>
                {outputs.map((p) => (
                  <div key={p.key} className="py-port-row">
                    <span>{p.key}</span>
                    <input
                      value={testExpected[p.key] ?? ''}
                      onChange={(e) => updateTestValue('expected', p.key, e.target.value)}
                      placeholder="number"
                    />
                  </div>
                ))}
              </div>
              {node.testStatus && (
                <div className={`py-test-status ${node.testStatus.status}`}>
                  {node.testStatus.summary}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="py-modal-footer">
          <button className="py-btn-save" disabled={safetyIssues.length > 0} onClick={save}>Save & Run</button>
          <button className="py-btn-cancel" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
