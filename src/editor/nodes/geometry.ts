import { ClassicPreset } from 'rete'
import { GHNode, getSocket } from './base'
import type { Vec3, LineData } from '../types'

export class PointNode extends GHNode {
  category = 'Vector'
  xControl: ClassicPreset.InputControl<'number'>
  yControl: ClassicPreset.InputControl<'number'>
  zControl: ClassicPreset.InputControl<'number'>

  constructor() {
    super('Point')

    this.xControl = new ClassicPreset.InputControl('number', { initial: 0 })
    this.yControl = new ClassicPreset.InputControl('number', { initial: 0 })
    this.zControl = new ClassicPreset.InputControl('number', { initial: 0 })

    const xInput = new ClassicPreset.Input(getSocket('number'), 'X')
    const yInput = new ClassicPreset.Input(getSocket('number'), 'Y')
    const zInput = new ClassicPreset.Input(getSocket('number'), 'Z')

    xInput.addControl(this.xControl)
    yInput.addControl(this.yControl)
    zInput.addControl(this.zControl)

    this.addInput('x', xInput)
    this.addInput('y', yInput)
    this.addInput('z', zInput)

    this.addOutput('point', new ClassicPreset.Output(getSocket('point'), 'Point'))
  }

  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const x = (inputs.x as number) ?? this.xControl.value
    const y = (inputs.y as number) ?? this.yControl.value
    const z = (inputs.z as number) ?? this.zControl.value
    const point: Vec3 = { x, y, z }
    return { point }
  }
}

export class LineNode extends GHNode {
  category = 'Curve'

  constructor() {
    super('Line')

    this.addInput('start', new ClassicPreset.Input(getSocket('point'), 'Start'))
    this.addInput('end', new ClassicPreset.Input(getSocket('point'), 'End'))
    this.addOutput('line', new ClassicPreset.Output(getSocket('line'), 'Line'))
  }

  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const start = (inputs.start as Vec3) ?? { x: 0, y: 0, z: 0 }
    const end = (inputs.end as Vec3) ?? { x: 1, y: 1, z: 0 }
    const line: LineData = { start, end }
    return { line }
  }
}

export class DeconstructPointNode extends GHNode {
  category = 'Vector'

  constructor() {
    super('Deconstruct Point')

    this.addInput('point', new ClassicPreset.Input(getSocket('point'), 'Point'))
    this.addOutput('x', new ClassicPreset.Output(getSocket('number'), 'X'))
    this.addOutput('y', new ClassicPreset.Output(getSocket('number'), 'Y'))
    this.addOutput('z', new ClassicPreset.Output(getSocket('number'), 'Z'))
  }

  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const p = (inputs.point as Vec3) ?? { x: 0, y: 0, z: 0 }
    return { x: p.x, y: p.y, z: p.z }
  }
}

export class DistanceNode extends GHNode {
  category = 'Vector'

  constructor() {
    super('Distance')

    this.addInput('a', new ClassicPreset.Input(getSocket('point'), 'A'))
    this.addInput('b', new ClassicPreset.Input(getSocket('point'), 'B'))
    this.addOutput('distance', new ClassicPreset.Output(getSocket('number'), 'Distance'))
  }

  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const a = (inputs.a as Vec3) ?? { x: 0, y: 0, z: 0 }
    const b = (inputs.b as Vec3) ?? { x: 0, y: 0, z: 0 }
    const dx = a.x - b.x
    const dy = a.y - b.y
    const dz = a.z - b.z
    return { distance: Math.sqrt(dx * dx + dy * dy + dz * dz) }
  }
}
