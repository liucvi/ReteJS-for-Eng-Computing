import { ClassicPreset } from 'rete'
import { GHNode, getSocket } from './base'
import type { Vec3, LineData } from '../types'

export class LineSDLNode extends GHNode {
  category = 'Curve'

  constructor() {
    super('Line SDL')
    this.addInput('start', new ClassicPreset.Input(getSocket('point'), 'Start'))
    this.addInput('direction', new ClassicPreset.Input(getSocket('point'), 'Direction'))
    this.addInput('length', new ClassicPreset.Input(getSocket('number'), 'Length'))
    this.addOutput('line', new ClassicPreset.Output(getSocket('line'), 'Line'))
  }

  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const start = (inputs.start as Vec3) ?? { x: 0, y: 0, z: 0 }
    const dir = (inputs.direction as Vec3) ?? { x: 1, y: 0, z: 0 }
    const len = (inputs.length as number) ?? 1
    const dLen = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z) || 1
    const end = {
      x: start.x + (dir.x / dLen) * len,
      y: start.y + (dir.y / dLen) * len,
      z: start.z + (dir.z / dLen) * len,
    }
    return { line: { start, end } }
  }
}

export class CircleNode extends GHNode {
  category = 'Curve'
  radiusControl: ClassicPreset.InputControl<'number'>

  constructor() {
    super('Circle')
    this.radiusControl = new ClassicPreset.InputControl('number', { initial: 1 })
    this.addInput('plane', new ClassicPreset.Input(getSocket('point'), 'Plane'))
    this.addOutput('circle', new ClassicPreset.Output(getSocket('line'), 'Circle'))
    this.addControl('radius', this.radiusControl)
  }

  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const center = (inputs.plane as Vec3) ?? { x: 0, y: 0, z: 0 }
    const r = this.radiusControl.value || 1
    const segments = 32
    const points: Vec3[] = []
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      points.push({ x: center.x + Math.cos(angle) * r, y: center.y + Math.sin(angle) * r, z: center.z })
    }
    return { circle: points }
  }
}

export class ArcNode extends GHNode {
  category = 'Curve'
  angleControl: ClassicPreset.InputControl<'number'>

  constructor() {
    super('Arc')
    this.angleControl = new ClassicPreset.InputControl('number', { initial: Math.PI })
    this.addInput('plane', new ClassicPreset.Input(getSocket('point'), 'Plane'))
    this.addInput('radius', new ClassicPreset.Input(getSocket('number'), 'Radius'))
    this.addOutput('arc', new ClassicPreset.Output(getSocket('line'), 'Arc'))
    this.addControl('angle', this.angleControl)
  }

  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const center = (inputs.plane as Vec3) ?? { x: 0, y: 0, z: 0 }
    const r = (inputs.radius as number) ?? 1
    const angle = this.angleControl.value || Math.PI
    const segments = 32
    const points: Vec3[] = []
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * angle
      points.push({ x: center.x + Math.cos(a) * r, y: center.y + Math.sin(a) * r, z: center.z })
    }
    return { arc: points }
  }
}

export class PolyLineNode extends GHNode {
  category = 'Curve'

  constructor() {
    super('PolyLine')
    this.addInput('vertices', new ClassicPreset.Input(getSocket('point'), 'Vertices'))
    this.addInput('closed', new ClassicPreset.Input(getSocket('number'), 'Closed'))
    this.addOutput('polyline', new ClassicPreset.Output(getSocket('line'), 'PolyLine'))
  }

  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const vertices = (inputs.vertices as Vec3[]) ?? []
    const closed = (inputs.closed as number) ?? 0
    return { polyline: { vertices, closed: !!closed } }
  }
}

export class DivideCurveNode extends GHNode {
  category = 'Curve'
  countControl: ClassicPreset.InputControl<'number'>

  constructor() {
    super('Divide Curve')
    this.countControl = new ClassicPreset.InputControl('number', { initial: 10 })
    this.addInput('curve', new ClassicPreset.Input(getSocket('line'), 'Curve'))
    this.addOutput('points', new ClassicPreset.Output(getSocket('point'), 'Points'))
    this.addOutput('tangent', new ClassicPreset.Output(getSocket('point'), 'Tangent'))
    this.addControl('count', this.countControl)
  }

  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const curve = (inputs.curve as LineData) ?? { start: { x: 0, y: 0, z: 0 }, end: { x: 1, y: 1, z: 0 } }
    const count = Math.max(2, Math.round(this.countControl.value || 10))
    const points: Vec3[] = []
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1)
      points.push({
        x: curve.start.x + (curve.end.x - curve.start.x) * t,
        y: curve.start.y + (curve.end.y - curve.start.y) * t,
        z: curve.start.z + (curve.end.z - curve.start.z) * t,
      })
    }
    const tangent = {
      x: curve.end.x - curve.start.x,
      y: curve.end.y - curve.start.y,
      z: curve.end.z - curve.start.z,
    }
    return { points, tangent }
  }
}

export class ExplodeNode extends GHNode {
  category = 'Curve'

  constructor() {
    super('Explode')
    this.addInput('curve', new ClassicPreset.Input(getSocket('line'), 'Curve'))
    this.addOutput('start', new ClassicPreset.Output(getSocket('point'), 'Start'))
    this.addOutput('end', new ClassicPreset.Output(getSocket('point'), 'End'))
    this.addOutput('length', new ClassicPreset.Output(getSocket('number'), 'Length'))
  }

  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const curve = (inputs.curve as LineData) ?? { start: { x: 0, y: 0, z: 0 }, end: { x: 1, y: 1, z: 0 } }
    const dx = curve.end.x - curve.start.x
    const dy = curve.end.y - curve.start.y
    const dz = curve.end.z - curve.start.z
    return {
      start: curve.start,
      end: curve.end,
      length: Math.sqrt(dx * dx + dy * dy + dz * dz)
    }
  }
}
