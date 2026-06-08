import { useState, useEffect } from 'react'
import { Presets } from 'rete-react-plugin'
import type { RenderEmit } from 'rete-react-plugin'
import katex from 'katex'
import type { Schemes } from '../nodes/base'
import { PythonEditor } from './PythonEditor'
import { ReportEditor } from './ReportEditor'
import { HelpModal } from './HelpModal'
import { StickyNote } from './StickyNote'
import type { PythonScriptNode } from '../nodes/python'
import type { BookAssemblerNode, BookSectionNode, ReportNode } from '../nodes/report'
import { helpEvents } from '../helpEvents'

const { RefSocket, RefControl } = Presets.classic

const formulaByLabel: Record<string, string> = {
  Addition: 'a+b',
  Subtraction: 'a-b',
  Multiplication: 'a\\cdot b',
  Division: '\\frac{a}{b}',
  Power: 'x^n',
  'Pipe Area': 'A=\\frac{\\pi D^2}{4}',
  Velocity: 'u=\\frac{Q}{A}',
  'Reynolds Number': 'Re=\\frac{\\rho uD}{\\mu}',
  'Friction Factor': 'f=\\frac{0.25}{\\left[\\log_{10}\\left(\\frac{\\epsilon}{3.7D}+\\frac{5.74}{Re^{0.9}}\\right)\\right]^2}',
  'Darcy-Weisbach': '\\Delta P=f\\frac{L}{D}\\frac{\\rho u^2}{2}',
  'Local Resistance': '\\Delta P=\\xi\\frac{\\rho u^2}{2}',
  'Total Head': 'H=\\Delta Z+h_1+h_2',
  'Pump Power': 'P=\\frac{\\rho gQH}{\\eta}',
  NPSH: 'NPSH_a=\\frac{P_a-P_v}{\\rho g}-Z_s-h_s',
}

function expressionToLatex(expression: string) {
  return expression
    .replace(/\*/g, '\\cdot ')
    .replace(/\brho\b/g, '\\rho')
    .replace(/\bmu\b/g, '\\mu')
    .replace(/\beta\b/g, '\\eta')
    .replace(/\blambda\b/g, '\\lambda')
}

function getFormulaPreview(data: Schemes['Node']) {
  const formulaNode = data as Schemes['Node'] & { latexFormula?: unknown }
  if (typeof formulaNode.latexFormula === 'string' && formulaNode.latexFormula.trim()) {
    return formulaNode.latexFormula
  }
  const expressionControl = data.controls.expr as { value?: unknown } | undefined
  if (typeof expressionControl?.value === 'string') return expressionToLatex(expressionControl.value)
  return formulaByLabel[data.label]
}

function renderFormula(formula: string) {
  try {
    return katex.renderToString(formula, {
      throwOnError: false,
      displayMode: false,
    })
  } catch {
    return formula
  }
}

function renderResultLabel(label: string) {
  const unitMatch = label.match(/^(.+?)\s*(\(.+\))$/)
  const symbol = unitMatch ? unitMatch[1].trim() : label
  const unit = unitMatch ? unitMatch[2] : ''
  const parts = symbol.split('_')

  if (parts.length === 1) {
    return (
      <>
        {symbol}
        {unit && <span className="result-unit"> {unit}</span>}
      </>
    )
  }

  return (
    <>
      {parts[0]}
      <sub>{parts.slice(1).join('_')}</sub>
      {unit && <span className="result-unit"> {unit}</span>}
    </>
  )
}

function renderInlineResult(result: string) {
  return result.split('\n').map((line) => {
    const [label, ...valueParts] = line.split('=')
    const value = valueParts.join('=').trim()
    return {
      label: label.trim(),
      value,
      raw: line,
    }
  })
}

export function CustomNode({ data, emit }: { data: Schemes['Node']; emit: RenderEmit<Schemes> }) {
  const { id, label, selected, inputs, outputs, controls, display, category } = data
  const [showEditor, setShowEditor] = useState(false)
  const [helpAnchor, setHelpAnchor] = useState<{ x: number; y: number } | null>(null)
  const [resultAnchor, setResultAnchor] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const listener = (targetId: string) => {
      if (targetId === id) setHelpAnchor({ x: window.innerWidth / 2 - 180, y: 72 })
    }
    helpEvents.onShowHelp(listener)
    return () => helpEvents.offShowHelp(listener)
  }, [id])

  const categoryAccent: Record<string, string> = {
    Params: '#888',
    Math: '#666',
    Vector: '#5a7',
    Curve: '#57a',
    Surface: '#a5a',
    Transform: '#a75',
    Sets: '#aaa',
    Script: '#f5a623',
    Formula: '#0b7d75',
    Fluid: '#4a90e2',
  }
  const accent = categoryAccent[category] || '#666'

  const isPythonNode = category === 'Script' && 'code' in data && 'inputConfigs' in data
  const isReportNode = category === 'Report' || ('template' in data && 'inputConfigs' in data)
  const hasEditor = isPythonNode || isReportNode
  const formulaPreview = getFormulaPreview(data)
  const nodeKind = formulaPreview ? '公式电池' : category === 'Fluid' ? '领域电池' : category === 'Params' ? '输入电池' : '节点电池'
  const variableName = (data as Schemes['Node']).variableName
  const inlineResult = data.resultDisplay || data.display

  return (
    <>
      <div
        className={`gh-node ${selected ? 'selected' : ''}`}
        data-testid="node"
        data-node-id={id}
        style={{ borderTopColor: accent }}
        onDoubleClick={(e) => {
          e.stopPropagation()
          if (hasEditor) setShowEditor(true)
        }}
      >
        <div className="gh-node-header">
          <span>
            <span className="gh-node-kind">{nodeKind}</span>
            <span className="gh-node-title">{label}</span>
            {variableName && <span className="field-badge">字段 {variableName}</span>}
          </span>
          <div className="gh-node-actions">
            {(data as Schemes['Node'] & { helpMarkdown?: string }).helpMarkdown && (
              <button
                className="gh-help-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  setHelpAnchor({ x: rect.right + 8, y: rect.top })
                }}
                title="Help"
              >
                ?
              </button>
            )}
            {hasEditor && (
              <button
                className="gh-edit-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowEditor(true)
                }}
                title="Edit"
              >
                ✎
              </button>
            )}
            <button
              className={`gh-preview-btn ${resultAnchor ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                setResultAnchor((current) => (
                  current ? null : { x: rect.right + 8, y: rect.top }
                ))
              }}
              title="Result"
            >
              {resultAnchor ? '●' : '○'}
            </button>
          </div>
        </div>

        {formulaPreview && (
          <div
            className="formula-preview"
            dangerouslySetInnerHTML={{ __html: renderFormula(formulaPreview) }}
          />
        )}

        <div className="gh-node-body">
          <div className="gh-ports gh-inputs">
            {Object.entries(inputs).map(([key, input]) => {
              if (!input) return null
              return (
                <div className="gh-port-row" key={key}>
                  <RefSocket
                    name="input-socket"
                    side="input"
                    emit={emit}
                    socketKey={key}
                    nodeId={id}
                    payload={input.socket}
                  />
                  <span className="gh-port-label">{input.label || key}</span>
                  {input.control && (
                    <div className="gh-port-control">
                      <RefControl
                        name="input-control"
                        emit={emit}
                        payload={input.control}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {Object.keys(controls).length > 0 && (
            <div className="gh-center">
              {Object.entries(controls).map(([key, ctrl]) => (
                <div key={key} className="gh-control">
                  <RefControl
                    name="control"
                    emit={emit}
                    payload={ctrl}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="gh-ports gh-outputs">
            {Object.entries(outputs).map(([key, output]) => {
              if (!output) return null
              return (
                <div className="gh-port-row" key={key}>
                  <span className="gh-port-label">{output.label || key}</span>
                  <RefSocket
                    name="output-socket"
                    side="output"
                    emit={emit}
                    socketKey={key}
                    nodeId={id}
                    payload={output.socket}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {inlineResult && (
          <div className="inline-result">
            {renderInlineResult(inlineResult).map((line) => (
              <div className="inline-result-row" key={line.raw}>
                <span className="inline-result-label">{renderResultLabel(line.label)}</span>
                <span className="inline-result-equals">=</span>
                <span className="inline-result-value">{line.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showEditor && isPythonNode && (
        <PythonEditor
          node={data as PythonScriptNode}
          onClose={() => setShowEditor(false)}
        />
      )}
      {showEditor && isReportNode && (
        <ReportEditor
          node={data as ReportNode | BookSectionNode | BookAssemblerNode}
          onClose={() => setShowEditor(false)}
        />
      )}
      {helpAnchor && (
        <HelpModal
          title={`${label} — 帮助`}
          markdown={(data as Schemes['Node'] & { helpMarkdown?: string }).helpMarkdown || ''}
          anchor={helpAnchor}
          onClose={() => setHelpAnchor(null)}
        />
      )}
      {resultAnchor && (
        <StickyNote
          title={`${label} — Result`}
          anchor={resultAnchor}
          onClose={() => {
            setResultAnchor(null)
          }}
        >
          <pre className="gh-result-note">{display ?? '(No result yet.)'}</pre>
        </StickyNote>
      )}
    </>
  )
}
