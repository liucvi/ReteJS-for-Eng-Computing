export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface LineData {
  start: Vec3
  end: Vec3
}

export type SocketType = 'number' | 'point' | 'line' | 'any'

export type DataValue = number | Vec3 | LineData | number[] | Vec3[] | LineData[] | null

export interface InputPort {
  key: string
  label: string
  socket: SocketType
  defaultValue?: DataValue
}

export interface OutputPort {
  key: string
  label: string
  socket: SocketType
}

export interface NodeParameter {
  key: string
  label: string
  type: 'slider' | 'vector' | 'toggle' | 'number'
  min?: number
  max?: number
  step?: number
  defaultValue: number | Vec3 | boolean
}
