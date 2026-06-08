import { ClassicPreset } from 'rete'
import { GHNode, getSocket } from './base'
import { getPyodide } from '../pyodide'

export type FormulaPortConfig = {
  key: string
  label: string
}

export class FormulaCellNode extends GHNode {
  category = 'Formula'
  latexFormula = 'P=\\frac{\\rho gQH}{\\eta}'
  expression = 'rho * 9.81 * Q * H / max(eta / 100, 1e-9)'
  inputConfigs: FormulaPortConfig[] = [
    { key: 'rho', label: 'rho' },
    { key: 'Q', label: 'Q' },
    { key: 'H', label: 'H' },
    { key: 'eta', label: 'eta' },
  ]
  outputKey = 'P'
  outputLabel = 'P'

  constructor() {
    super('Formula Cell')
    this.width = 220
    this.height = 120
    this.rebuildPorts()
  }

  rebuildPorts() {
    for (const key of Object.keys(this.inputs)) {
      this.removeInput(key)
    }
    for (const key of Object.keys(this.outputs)) {
      this.removeOutput(key)
    }
    for (const cfg of this.inputConfigs) {
      this.addInput(cfg.key, new ClassicPreset.Input(getSocket('number'), cfg.label))
    }
    this.addOutput(this.outputKey, new ClassicPreset.Output(getSocket('number'), this.outputLabel))
    this.inputAliases = Object.fromEntries(
      this.inputConfigs.map((cfg) => [cfg.key, [cfg.key, cfg.label]])
    )
    this.outputAliases = {
      [this.outputKey]: [this.outputKey, this.outputLabel],
    }
  }

  async execute(inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
    const py = getPyodide()
    if (!py) {
      this.display = 'Python not loaded'
      return { [this.outputKey]: 0 }
    }

    try {
      await py.runPythonAsync('import math')
      for (const cfg of this.inputConfigs) {
        const value = inputs[cfg.key]
        py.globals.set(cfg.key, value === undefined || value === null ? 0 : Number(value) || 0)
      }
      py.globals.set('__formula_expression__', this.expression)
      await py.runPythonAsync([
        '__formula_safe__ = {',
        '  "abs": abs, "max": max, "min": min, "pow": pow,',
        '  "round": round, "float": float, "int": int,',
        '}',
        '__formula_value__ = eval(__formula_expression__, {"__builtins__": {}}, {**math.__dict__, **__formula_safe__, **globals()})',
      ].join('\n'))
      const value = py.globals.get('__formula_value__')
      const result = typeof value === 'number' ? value : Number(value) || 0
      this.display = `${this.outputLabel} = ${result}`
      return { [this.outputKey]: result }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.display = `Formula error\n${message}`
      return { [this.outputKey]: 0 }
    }
  }
}
