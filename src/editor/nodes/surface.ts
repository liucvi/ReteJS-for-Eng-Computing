import { ClassicPreset } from 'rete'
import { GHNode, getSocket } from './base'
import type { Vec3 } from '../types'

export type PlaneData = {
  origin: Vec3
  xAxis: Vec3
  yAxis: Vec3
}

export type SurfaceData = {
  type: 'extrude' | 'revolve' | 'loft'
  data: Record<string, unknown>
}

export class PlaneNode extends GHNode {
  category = 'Surface'
  xControl: ClassicPreset.InputControl<'number'>
  yControl: ClassicPreset.InputControl<'number'>
  zControl: ClassicPreset.InputControl<'number'>

  constructor() {
    super('Plane')
    this.xControl = new ClassicPreset.InputControl('number', { initial: 0 })
    this.yControl = new ClassicPreset.InputControl('number', { initial: 0 })
    this.zControl = new ClassicPreset.InputControl('number', { initial: 0 })
    this.addOutput('plane', new ClassicPreset.Output(getSocket('point'), 'Plane'))
    this.addControl('x', this.xControl)
    this.addControl('y', this.yControl)
    this.addControl('z', this.zControl)
  }

  execute(): Record<string, unknown> {
    const origin = { x: this.xControl.value || 0, y: this.yControl.value || 0, z: this.zControl.value || 0 }
    return {
      plane: {
        origin,
        xAxis: { x: 1, y: 0, z: 0 },
        yAxis: { x: 0, y: 1, z: 0 },
      } as PlaneData
    }
  }
}

export class PlaneOriginNode extends GHNode {
  category = 'Surface'

  constructor() {
    super('Plane Origin')
    this.addInput('plane', new ClassicPreset.Input(getSocket('point'), 'Plane'))
    this.addOutput('origin', new ClassicPreset.Output(getSocket('point'), 'Origin'))
    this.addOutput('xAxis', new ClassicPreset.Output(getSocket('point'), 'X Axis'))
    this.addOutput('yAxis', new ClassicPreset.Output(getSocket('point'), 'Y Axis'))
    this.addOutput('zAxis', new ClassicPreset.Output(getSocket('point'), 'Z Axis'))
  }

  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const plane = (inputs.plane as PlaneData) ?? { origin: { x: 0, y: 0, z: 0 }, xAxis: { x: 1, y: 0, z: 0 }, yAxis: { x: 0, y: 1, z: 0 } }
    const zAxis = {
      x: plane.xAxis.y * plane.yAxis.z - plane.xAxis.z * plane.yAxis.y,
      y: plane.xAxis.z * plane.yAxis.x - plane.xAxis.x * plane.yAxis.z,
      z: plane.xAxis.x * plane.yAxis.y - plane.xAxis.y * plane.yAxis.x,
    }
    return { origin: plane.origin, xAxis: plane.xAxis, yAxis: plane.yAxis, zAxis }
  }
}

export class ExtrudeNode extends GHNode {
  category = 'Surface'

  constructor() {
    super('Extrude')
    this.addInput('base', new ClassicPreset.Input(getSocket('line'), 'Base'))
    this.addInput('direction', new ClassicPreset.Input(getSocket('point'), 'Direction'))
    this.addOutput('surface', new ClassicPreset.Output(getSocket('line'), 'Surface'))
  }

  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const base = (inputs.base as { vertices: Vec3[] }) ?? { vertices: [] }
    const dir = (inputs.direction as Vec3) ?? { x: 0, y: 0, z: 1 }
    return {
      surface: {
        type: 'extrude',
        data: { base: base.vertices || [base], direction: dir },
      } as SurfaceData
    }
  }
}

export class RevolveNode extends GHNode {
  category = 'Surface'

  constructor() {
    super('Revolve')
    this.addInput('profile', new ClassicPreset.Input(getSocket('line'), 'Profile'))
    this.addInput('axis', new ClassicPreset.Input(getSocket('point'), 'Axis'))
    this.addInput('angle', new ClassicPreset.Input(getSocket('number'), 'Angle'))
    this.addOutput('surface', new ClassicPreset.Output(getSocket('line'), 'Surface'))
  }

  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const profile = (inputs.profile as { vertices: Vec3[] }) ?? { vertices: [] }
    const axis = (inputs.axis as Vec3) ?? { x: 0, y: 0, z: 1 }
    const angle = (inputs.angle as number) ?? Math.PI * 2
    return {
      surface: {
        type: 'revolve',
        data: { profile: profile.vertices || [profile], axis, angle },
      } as SurfaceData
    }
  }
}
