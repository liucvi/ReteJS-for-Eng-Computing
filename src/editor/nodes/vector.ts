import { ClassicPreset } from 'rete'
import { GHNode, getSocket } from './base'
import type { Vec3 } from '../types'

export class VectorNode extends GHNode {
  category = 'Vector'
  xControl: ClassicPreset.InputControl<'number'>
  yControl: ClassicPreset.InputControl<'number'>
  zControl: ClassicPreset.InputControl<'number'>

  constructor() {
    super('Vector XYZ')
    this.xControl = new ClassicPreset.InputControl('number', { initial: 1 })
    this.yControl = new ClassicPreset.InputControl('number', { initial: 0 })
    this.zControl = new ClassicPreset.InputControl('number', { initial: 0 })

    this.addOutput('vector', new ClassicPreset.Output(getSocket('point'), 'Vector'))
    this.addControl('x', this.xControl)
    this.addControl('y', this.yControl)
    this.addControl('z', this.zControl)
  }

  execute(): Record<string, unknown> {
    return { vector: { x: this.xControl.value || 0, y: this.yControl.value || 0, z: this.zControl.value || 0 } }
  }
}

export class UnitVectorNode extends GHNode {
  category = 'Vector'

  constructor() {
    super('Unit Vector')
    this.addInput('vector', new ClassicPreset.Input(getSocket('point'), 'Vector'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('point'), 'Unit'))
  }

  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const v = (inputs.vector as Vec3) ?? { x: 1, y: 0, z: 0 }
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1
    return { result: { x: v.x / len, y: v.y / len, z: v.z / len } }
  }
}

export class VectorLengthNode extends GHNode {
  category = 'Vector'

  constructor() {
    super('Vector Length')
    this.addInput('vector', new ClassicPreset.Input(getSocket('point'), 'Vector'))
    this.addOutput('length', new ClassicPreset.Output(getSocket('number'), 'Length'))
  }

  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const v = (inputs.vector as Vec3) ?? { x: 0, y: 0, z: 0 }
    return { length: Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) }
  }
}

export class CrossProductNode extends GHNode {
  category = 'Vector'

  constructor() {
    super('Cross Product')
    this.addInput('a', new ClassicPreset.Input(getSocket('point'), 'A'))
    this.addInput('b', new ClassicPreset.Input(getSocket('point'), 'B'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('point'), 'Result'))
  }

  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const a = (inputs.a as Vec3) ?? { x: 0, y: 0, z: 0 }
    const b = (inputs.b as Vec3) ?? { x: 0, y: 0, z: 0 }
    return {
      result: {
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x,
      }
    }
  }
}

export class DotProductNode extends GHNode {
  category = 'Vector'

  constructor() {
    super('Dot Product')
    this.addInput('a', new ClassicPreset.Input(getSocket('point'), 'A'))
    this.addInput('b', new ClassicPreset.Input(getSocket('point'), 'B'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('number'), 'Result'))
  }

  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const a = (inputs.a as Vec3) ?? { x: 0, y: 0, z: 0 }
    const b = (inputs.b as Vec3) ?? { x: 0, y: 0, z: 0 }
    return { result: a.x * b.x + a.y * b.y + a.z * b.z }
  }
}

export class MoveNode extends GHNode {
  category = 'Vector'

  constructor() {
    super('Move')
    this.addInput('geometry', new ClassicPreset.Input(getSocket('point'), 'Geometry'))
    this.addInput('motion', new ClassicPreset.Input(getSocket('point'), 'Motion'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('point'), 'Result'))
  }

  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const g = (inputs.geometry as Vec3) ?? { x: 0, y: 0, z: 0 }
    const m = (inputs.motion as Vec3) ?? { x: 0, y: 0, z: 0 }
    return { result: { x: g.x + m.x, y: g.y + m.y, z: g.z + m.z } }
  }
}
