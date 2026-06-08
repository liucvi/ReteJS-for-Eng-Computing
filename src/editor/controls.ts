import { ClassicPreset } from 'rete'

/** Numeric input control */
export class NumberControl extends ClassicPreset.Control {
  value = 0
  min = -100
  max = 100
  step = 0.01

  constructor(initial = 0, min = -100, max = 100, step = 0.01) {
    super()
    this.value = initial
    this.min = min
    this.max = max
    this.step = step
  }

  setValue(v: number) {
    this.value = Math.max(this.min, Math.min(this.max, Number.isFinite(v) ? v : 0))
  }
}

/** Grasshopper-style slider control */
export class SliderControl extends NumberControl {}

/** Toggle switch control */
export class ToggleControl extends ClassicPreset.Control {
  value = false
  constructor(initial = false) {
    super()
    this.value = initial
  }
  setValue(v: boolean) {
    this.value = v
  }
}

/** Colour picker control */
export class ColourControl extends ClassicPreset.Control {
  value = '#4a90e2'
  constructor(initial = '#4a90e2') {
    super()
    this.value = initial
  }
  setValue(v: string) {
    this.value = v
  }
}

/** Value list (dropdown) control */
export class ValueListControl extends ClassicPreset.Control {
  value = ''
  options: string[]
  constructor(options: string[], initial = '') {
    super()
    this.options = options
    this.value = initial || options[0] || ''
  }
  setValue(v: string) {
    this.value = v
  }
}

/** Domain (min-max) slider control */
export class DomainSliderControl extends ClassicPreset.Control {
  min = 0
  max = 1
  absMin = 0
  absMax = 100
  constructor(min = 0, max = 1, absMin = 0, absMax = 100) {
    super()
    this.min = min
    this.max = max
    this.absMin = absMin
    this.absMax = absMax
  }
  setMin(v: number) {
    this.min = Math.max(this.absMin, Math.min(v, this.max))
  }
  setMax(v: number) {
    this.max = Math.min(this.absMax, Math.max(v, this.min))
  }
}

/** Button control */
export class ButtonControl extends ClassicPreset.Control {
  label = 'Run'
  clicks = 0
  constructor(label = 'Run') {
    super()
    this.label = label
  }
  click() {
    this.clicks++
  }
}
