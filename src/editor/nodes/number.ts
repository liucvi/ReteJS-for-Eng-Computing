import { ClassicPreset } from 'rete'
import { GHNode, getSocket } from './base'
import { NumberControl, SliderControl, ToggleControl } from '../controls'

export class NumberNode extends GHNode {
  category = 'Params'
  control: NumberControl

  constructor(initial = 0, min = -100, max = 100, variableName = '') {
    super('Number')

    this.control = new NumberControl(initial, min, max)
    this.variableName = variableName
    this.outputAliases = { value: variableName ? [variableName] : [] }

    this.addOutput('value', new ClassicPreset.Output(getSocket('number'), 'Number'))
    this.addControl('value', this.control)
  }

  execute(): Record<string, unknown> {
    const value = this.control.value
    this.display = this.variableName ? `${this.variableName} = ${formatResult(value)}` : formatResult(value)
    return { value }
  }
}

export class FieldInputNode extends GHNode {
  category = 'Params'
  control: NumberControl
  fieldKey: string
  fieldLabel: string
  unit: string
  discipline: string
  description: string

  constructor(
    fieldKey = 'field',
    fieldLabel = '平台字段',
    initial = 0,
    unit = '',
    discipline = '',
    description = ''
  ) {
    super('Field Input')

    this.control = new NumberControl(initial, -100000000, 100000000)
    this.fieldKey = fieldKey
    this.fieldLabel = fieldLabel
    this.unit = unit
    this.discipline = discipline
    this.description = description

    this.addOutput('value', new ClassicPreset.Output(getSocket('number'), unit ? `${fieldLabel} (${unit})` : fieldLabel))
    this.addOutput('key', new ClassicPreset.Output(getSocket('generic'), 'Field Key'))
    this.addOutput('label', new ClassicPreset.Output(getSocket('generic'), 'Label'))
    this.addOutput('unit', new ClassicPreset.Output(getSocket('generic'), 'Unit'))
    this.addOutput('description', new ClassicPreset.Output(getSocket('generic'), 'Description'))
    this.addControl('value', this.control)
    this.syncFieldMetadata()
  }

  syncFieldMetadata() {
    this.variableName = this.fieldKey
    this.outputAliases = {
      value: [this.fieldKey, this.fieldLabel],
      key: [this.fieldKey, 'fieldKey'],
      label: [this.fieldLabel, 'fieldLabel'],
      unit: [this.unit],
      description: [this.description],
    }
    const valueOutput = this.outputs.value as ClassicPreset.Output<ClassicPreset.Socket> | undefined
    if (valueOutput) valueOutput.label = this.unit ? `${this.fieldLabel} (${this.unit})` : this.fieldLabel
  }

  execute(): Record<string, unknown> {
    const value = this.control.value
    this.syncFieldMetadata()
    this.display = [
      `${this.fieldKey} = ${formatResult(value)}${this.unit ? ` ${this.unit}` : ''}`,
      this.fieldLabel,
      this.description,
    ].filter(Boolean).join('\n')
    return {
      value,
      key: this.fieldKey,
      label: this.fieldLabel,
      unit: this.unit,
      description: this.description,
      discipline: this.discipline,
    }
  }
}

export class SliderNode extends GHNode {
  category = 'Params'
  control: SliderControl

  constructor(initial = 50, min = 0, max = 100) {
    super('Slider')

    this.control = new SliderControl(initial, min, max, 1)

    this.addOutput('value', new ClassicPreset.Output(getSocket('number'), 'Number'))
    this.addControl('value', this.control)
  }

  execute(): Record<string, unknown> {
    return { value: this.control.value }
  }
}

export class IntegerNode extends GHNode {
  category = 'Params'
  control: NumberControl

  constructor(initial = 0) {
    super('Integer')

    this.control = new NumberControl(initial, -1000000, 1000000, 1)

    this.addOutput('value', new ClassicPreset.Output(getSocket('number'), 'Integer'))
    this.addControl('value', this.control)
  }

  execute(): Record<string, unknown> {
    return { value: Math.round(this.control.value || 0) }
  }
}

export class BooleanNode extends GHNode {
  category = 'Params'
  control: ToggleControl

  constructor(initial = false) {
    super('Boolean')

    this.control = new ToggleControl(initial)

    this.addOutput('value', new ClassicPreset.Output(getSocket('number'), 'Boolean'))
    this.addControl('toggle', this.control)
  }

  execute(): Record<string, unknown> {
    return { value: this.control.value ? 1 : 0 }
  }
}

export class DomainNode extends GHNode {
  category = 'Params'
  minControl: ClassicPreset.InputControl<'number'>
  maxControl: ClassicPreset.InputControl<'number'>

  constructor(min = 0, max = 1) {
    super('Domain')

    this.minControl = new ClassicPreset.InputControl('number', { initial: min })
    this.maxControl = new ClassicPreset.InputControl('number', { initial: max })

    this.addOutput('domain', new ClassicPreset.Output(getSocket('number'), 'Domain'))
    this.addControl('min', this.minControl)
    this.addControl('max', this.maxControl)
  }

  execute(): Record<string, unknown> {
    return { domain: { min: this.minControl.value, max: this.maxControl.value } }
  }
}

function formatResult(value: number): string {
  if (Math.abs(value) >= 10000 || (Math.abs(value) < 0.001 && value !== 0)) {
    return value.toExponential(4)
  }
  return value.toFixed(4).replace(/\.?0+$/, '')
}
