import { ClassicPreset } from 'rete'
import { GHNode, getSocket } from './base'
import type { Vec3 } from '../types'

export class RotateNode extends GHNode {
  category = 'Transform'

  constructor() {
    super('Rotate')
    this.addInput('geometry', new ClassicPreset.Input(getSocket('point'), 'Geometry'))
    this.addInput('center', new ClassicPreset.Input(getSocket('point'), 'Center'))
    this.addInput('angle', new ClassicPreset.Input(getSocket('number'), 'Angle'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('point'), 'Result'))
  }

  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const g = (inputs.geometry as Vec3) ?? { x: 0, y: 0, z: 0 }
    const c = (inputs.center as Vec3) ?? { x: 0, y: 0, z: 0 }
    const angle = (inputs.angle as number) ?? 0
    const dx = g.x - c.x
    const dy = g.y - c.y
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    return {
      result: {
        x: c.x + dx * cos - dy * sin,
        y: c.y + dx * sin + dy * cos,
        z: g.z,
      }
    }
  }
}

export class ScaleNode extends GHNode {
  category = 'Transform'

  constructor() {
    super('Scale')
    this.addInput('geometry', new ClassicPreset.Input(getSocket('point'), 'Geometry'))
    this.addInput('center', new ClassicPreset.Input(getSocket('point'), 'Center'))
    this.addInput('factor', new ClassicPreset.Input(getSocket('number'), 'Factor'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('point'), 'Result'))
  }

  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const g = (inputs.geometry as Vec3) ?? { x: 0, y: 0, z: 0 }
    const c = (inputs.center as Vec3) ?? { x: 0, y: 0, z: 0 }
    const f = (inputs.factor as number) ?? 1
    return {
      result: {
        x: c.x + (g.x - c.x) * f,
        y: c.y + (g.y - c.y) * f,
        z: c.z + (g.z - c.z) * f,
      }
    }
  }
}

export class MirrorNode extends GHNode {
  category = 'Transform'

  constructor() {
    super('Mirror')
    this.addInput('geometry', new ClassicPreset.Input(getSocket('point'), 'Geometry'))
    this.addInput('plane', new ClassicPreset.Input(getSocket('point'), 'Plane'))
    this.addInput('normal', new ClassicPreset.Input(getSocket('point'), 'Normal'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('point'), 'Result'))
  }

  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const g = (inputs.geometry as Vec3) ?? { x: 0, y: 0, z: 0 }
    const p = (inputs.plane as Vec3) ?? { x: 0, y: 0, z: 0 }
    const n = (inputs.normal as Vec3) ?? { x: 0, y: 0, z: 1 }
    const nLen = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z) || 1
    const nx = n.x / nLen
    const ny = n.y / nLen
    const nz = n.z / nLen
    const dx = g.x - p.x
    const dy = g.y - p.y
    const dz = g.z - p.z
    const dot = dx * nx + dy * ny + dz * nz
    return {
      result: {
        x: g.x - 2 * dot * nx,
        y: g.y - 2 * dot * ny,
        z: g.z - 2 * dot * nz,
      }
    }
  }
}
