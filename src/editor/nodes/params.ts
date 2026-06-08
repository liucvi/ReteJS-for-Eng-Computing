import { ClassicPreset } from 'rete'
import { GHNode, getSocket } from './base'
import { ToggleControl, ColourControl, ValueListControl, DomainSliderControl, ButtonControl } from '../controls'

export class ToggleNode extends GHNode {
  category = 'Params'
  control: ToggleControl

  constructor(initial = false) {
    super('Toggle')
    this.control = new ToggleControl(initial)
    this.addOutput('value', new ClassicPreset.Output(getSocket('number'), 'Value'))
    this.addControl('toggle', this.control)
  }

  execute(): Record<string, unknown> {
    return { value: this.control.value ? 1 : 0 }
  }
}

export class ColourNode extends GHNode {
  category = 'Params'
  control: ColourControl

  constructor(initial = '#4a90e2') {
    super('Colour')
    this.control = new ColourControl(initial)
    this.addOutput('colour', new ClassicPreset.Output(getSocket('number'), 'Colour'))
    this.addControl('colour', this.control)
  }

  execute(): Record<string, unknown> {
    const hex = this.control.value.replace('#', '')
    const r = parseInt(hex.slice(0, 2), 16) / 255
    const g = parseInt(hex.slice(2, 4), 16) / 255
    const b = parseInt(hex.slice(4, 6), 16) / 255
    return { colour: { r, g, b, hex: this.control.value } }
  }
}

export class ValueListNode extends GHNode {
  category = 'Params'
  control: ValueListControl

  constructor(options: string[] = ['A', 'B', 'C'], initial = '') {
    super('Value List')
    this.control = new ValueListControl(options, initial)
    this.addOutput('value', new ClassicPreset.Output(getSocket('number'), 'Value'))
    this.addOutput('index', new ClassicPreset.Output(getSocket('number'), 'Index'))
    this.addControl('list', this.control)
  }

  execute(): Record<string, unknown> {
    const idx = this.control.options.indexOf(this.control.value)
    return { value: this.control.value, index: idx }
  }
}

export class DomainSliderNode extends GHNode {
  category = 'Params'
  control: DomainSliderControl

  constructor(min = 0, max = 100) {
    super('Domain Slider')
    this.control = new DomainSliderControl(min, max, 0, 100)
    this.addOutput('domain', new ClassicPreset.Output(getSocket('number'), 'Domain'))
    this.addControl('domain', this.control)
  }

  execute(): Record<string, unknown> {
    return { domain: { min: this.control.min, max: this.control.max } }
  }
}

export class ButtonNode extends GHNode {
  category = 'Params'
  control: ButtonControl

  constructor(label = 'Run') {
    super('Button')
    this.control = new ButtonControl(label)
    this.addOutput('click', new ClassicPreset.Output(getSocket('number'), 'Click'))
    this.addControl('button', this.control)
  }

  execute(): Record<string, unknown> {
    return { click: this.control.clicks }
  }
}
