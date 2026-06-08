import { ClassicPreset } from 'rete'
import { GHNode, getSocket } from './base'

/* ─────────── 基础四则运算 ─────────── */

export class AdditionNode extends GHNode {
  category = 'Math'
  constructor() {
    super('Addition')
    this.addInput('a', new ClassicPreset.Input(getSocket('number'), 'A'))
    this.addInput('b', new ClassicPreset.Input(getSocket('number'), 'B'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('number'), 'Result'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const a = (inputs.a as number) ?? 0
    const b = (inputs.b as number) ?? 0
    return { result: a + b }
  }
}

export class SubtractionNode extends GHNode {
  category = 'Math'
  constructor() {
    super('Subtraction')
    this.addInput('a', new ClassicPreset.Input(getSocket('number'), 'A'))
    this.addInput('b', new ClassicPreset.Input(getSocket('number'), 'B'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('number'), 'Result'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const a = (inputs.a as number) ?? 0
    const b = (inputs.b as number) ?? 0
    return { result: a - b }
  }
}

export class MultiplicationNode extends GHNode {
  category = 'Math'
  constructor() {
    super('Multiplication')
    this.addInput('a', new ClassicPreset.Input(getSocket('number'), 'A'))
    this.addInput('b', new ClassicPreset.Input(getSocket('number'), 'B'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('number'), 'Result'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const a = (inputs.a as number) ?? 1
    const b = (inputs.b as number) ?? 1
    return { result: a * b }
  }
}

export class DivisionNode extends GHNode {
  category = 'Math'
  constructor() {
    super('Division')
    this.addInput('a', new ClassicPreset.Input(getSocket('number'), 'A'))
    this.addInput('b', new ClassicPreset.Input(getSocket('number'), 'B'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('number'), 'Result'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const a = (inputs.a as number) ?? 0
    const b = (inputs.b as number) ?? 1
    return { result: b === 0 ? 0 : a / b }
  }
}

export class NegativeNode extends GHNode {
  category = 'Math'
  constructor() {
    super('Negative')
    this.addInput('x', new ClassicPreset.Input(getSocket('number'), 'X'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('number'), 'Result'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { result: -((inputs.x as number) ?? 0) }
  }
}

export class PowerNode extends GHNode {
  category = 'Math'
  constructor() {
    super('Power')
    this.addInput('base', new ClassicPreset.Input(getSocket('number'), 'Base'))
    this.addInput('exp', new ClassicPreset.Input(getSocket('number'), 'Exponent'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('number'), 'Result'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const base = (inputs.base as number) ?? 0
    const exp = (inputs.exp as number) ?? 1
    return { result: Math.pow(base, exp) }
  }
}

/* ─────────── 整数运算 ─────────── */

export class AbsoluteNode extends GHNode {
  category = 'Math'
  constructor() {
    super('Absolute')
    this.addInput('x', new ClassicPreset.Input(getSocket('number'), 'X'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('number'), 'Result'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { result: Math.abs((inputs.x as number) ?? 0) }
  }
}

export class IntegerDivisionNode extends GHNode {
  category = 'Math'
  constructor() {
    super('Integer Division')
    this.addInput('a', new ClassicPreset.Input(getSocket('number'), 'A'))
    this.addInput('b', new ClassicPreset.Input(getSocket('number'), 'B'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('number'), 'Result'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const a = (inputs.a as number) ?? 0
    const b = (inputs.b as number) ?? 1
    return { result: b === 0 ? 0 : Math.trunc(a / b) }
  }
}

export class FactorialNode extends GHNode {
  category = 'Math'
  constructor() {
    super('Factorial')
    this.addInput('n', new ClassicPreset.Input(getSocket('number'), 'N'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('number'), 'Result'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    let n = Math.round((inputs.n as number) ?? 0)
    if (n < 0) n = 0
    let res = 1
    for (let i = 2; i <= n; i++) res *= i
    return { result: res }
  }
}

export class ModulusNode extends GHNode {
  category = 'Math'
  constructor() {
    super('Modulus')
    this.addInput('a', new ClassicPreset.Input(getSocket('number'), 'A'))
    this.addInput('b', new ClassicPreset.Input(getSocket('number'), 'B'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('number'), 'Result'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const a = (inputs.a as number) ?? 0
    const b = (inputs.b as number) ?? 1
    return { result: b === 0 ? 0 : a % b }
  }
}

/* ─────────── 三角函数 ─────────── */

export class SineNode extends GHNode {
  category = 'Math'
  constructor() {
    super('Sine')
    this.addInput('x', new ClassicPreset.Input(getSocket('number'), 'X'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('number'), 'Result'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { result: Math.sin((inputs.x as number) ?? 0) }
  }
}

export class CosineNode extends GHNode {
  category = 'Math'
  constructor() {
    super('Cosine')
    this.addInput('x', new ClassicPreset.Input(getSocket('number'), 'X'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('number'), 'Result'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { result: Math.cos((inputs.x as number) ?? 0) }
  }
}

export class TangentNode extends GHNode {
  category = 'Math'
  constructor() {
    super('Tangent')
    this.addInput('x', new ClassicPreset.Input(getSocket('number'), 'X'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('number'), 'Result'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { result: Math.tan((inputs.x as number) ?? 0) }
  }
}

/* ─────────── 取整 ─────────── */

export class FloorNode extends GHNode {
  category = 'Math'
  constructor() {
    super('Floor')
    this.addInput('x', new ClassicPreset.Input(getSocket('number'), 'X'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('number'), 'Result'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { result: Math.floor((inputs.x as number) ?? 0) }
  }
}

export class CeilingNode extends GHNode {
  category = 'Math'
  constructor() {
    super('Ceiling')
    this.addInput('x', new ClassicPreset.Input(getSocket('number'), 'X'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('number'), 'Result'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { result: Math.ceil((inputs.x as number) ?? 0) }
  }
}

export class RoundNode extends GHNode {
  category = 'Math'
  constructor() {
    super('Round')
    this.addInput('x', new ClassicPreset.Input(getSocket('number'), 'X'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('number'), 'Result'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { result: Math.round((inputs.x as number) ?? 0) }
  }
}

/* ─────────── 极值/平均 ─────────── */

export class MaximumNode extends GHNode {
  category = 'Math'
  constructor() {
    super('Maximum')
    this.addInput('a', new ClassicPreset.Input(getSocket('number'), 'A'))
    this.addInput('b', new ClassicPreset.Input(getSocket('number'), 'B'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('number'), 'Result'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { result: Math.max((inputs.a as number) ?? 0, (inputs.b as number) ?? 0) }
  }
}

export class MinimumNode extends GHNode {
  category = 'Math'
  constructor() {
    super('Minimum')
    this.addInput('a', new ClassicPreset.Input(getSocket('number'), 'A'))
    this.addInput('b', new ClassicPreset.Input(getSocket('number'), 'B'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('number'), 'Result'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { result: Math.min((inputs.a as number) ?? 0, (inputs.b as number) ?? 0) }
  }
}

export class AverageNode extends GHNode {
  category = 'Math'
  constructor() {
    super('Average')
    this.addInput('a', new ClassicPreset.Input(getSocket('number'), 'A'))
    this.addInput('b', new ClassicPreset.Input(getSocket('number'), 'B'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('number'), 'Result'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const a = (inputs.a as number) ?? 0
    const b = (inputs.b as number) ?? 0
    return { result: (a + b) / 2 }
  }
}

/* ─────────── Mass 运算 ─────────── */

export class MassAdditionNode extends GHNode {
  category = 'Math'
  constructor() {
    super('Mass Addition')
    this.addInput('list', new ClassicPreset.Input(getSocket('number'), 'List'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('number'), 'Result'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const list = (inputs.list as number[]) ?? []
    return { result: list.reduce((s, v) => s + (v as number), 0) }
  }
}

export class MassMultiplicationNode extends GHNode {
  category = 'Math'
  constructor() {
    super('Mass Multiplication')
    this.addInput('list', new ClassicPreset.Input(getSocket('number'), 'List'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('number'), 'Result'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const list = (inputs.list as number[]) ?? []
    return { result: list.reduce((s, v) => s * (v as number), 1) }
  }
}

export class RelativeDifferencesNode extends GHNode {
  category = 'Math'
  constructor() {
    super('Relative Differences')
    this.addInput('list', new ClassicPreset.Input(getSocket('number'), 'List'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('number'), 'Result'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const list = (inputs.list as number[]) ?? []
    if (list.length < 2) return { result: 0 }
    const diffs = list.slice(1).map((v, i) => Math.abs((v as number) - (list[i] as number)))
    return { result: diffs.reduce((s, v) => s + v, 0) / diffs.length }
  }
}

/* ─────────── 比较运算 ─────────── */

export class LargerThanNode extends GHNode {
  category = 'Math'
  constructor() {
    super('Larger Than')
    this.addInput('a', new ClassicPreset.Input(getSocket('number'), 'A'))
    this.addInput('b', new ClassicPreset.Input(getSocket('number'), 'B'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('number'), 'Result'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { result: ((inputs.a as number) ?? 0) > ((inputs.b as number) ?? 0) ? 1 : 0 }
  }
}

export class SmallerThanNode extends GHNode {
  category = 'Math'
  constructor() {
    super('Smaller Than')
    this.addInput('a', new ClassicPreset.Input(getSocket('number'), 'A'))
    this.addInput('b', new ClassicPreset.Input(getSocket('number'), 'B'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('number'), 'Result'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { result: ((inputs.a as number) ?? 0) < ((inputs.b as number) ?? 0) ? 1 : 0 }
  }
}

export class EqualityNode extends GHNode {
  category = 'Math'
  constructor() {
    super('Equality')
    this.addInput('a', new ClassicPreset.Input(getSocket('number'), 'A'))
    this.addInput('b', new ClassicPreset.Input(getSocket('number'), 'B'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('number'), 'Result'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { result: ((inputs.a as number) ?? 0) === ((inputs.b as number) ?? 0) ? 1 : 0 }
  }
}

export class SimilarityNode extends GHNode {
  category = 'Math'
  constructor() {
    super('Similarity')
    this.addInput('a', new ClassicPreset.Input(getSocket('number'), 'A'))
    this.addInput('b', new ClassicPreset.Input(getSocket('number'), 'B'))
    this.addInput('tol', new ClassicPreset.Input(getSocket('number'), 'Tolerance'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('number'), 'Result'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const a = (inputs.a as number) ?? 0
    const b = (inputs.b as number) ?? 0
    const tol = (inputs.tol as number) ?? 0.001
    return { result: Math.abs(a - b) <= tol ? 1 : 0 }
  }
}

/* ─────────── 逻辑门 ─────────── */

function toBool(v: unknown): boolean {
  return (v as number) !== 0
}

export class GateAndNode extends GHNode {
  category = 'Math'
  constructor() {
    super('Gate And')
    this.addInput('a', new ClassicPreset.Input(getSocket('number'), 'A'))
    this.addInput('b', new ClassicPreset.Input(getSocket('number'), 'B'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('number'), 'Result'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { result: toBool(inputs.a) && toBool(inputs.b) ? 1 : 0 }
  }
}

export class GateOrNode extends GHNode {
  category = 'Math'
  constructor() {
    super('Gate Or')
    this.addInput('a', new ClassicPreset.Input(getSocket('number'), 'A'))
    this.addInput('b', new ClassicPreset.Input(getSocket('number'), 'B'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('number'), 'Result'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { result: toBool(inputs.a) || toBool(inputs.b) ? 1 : 0 }
  }
}

export class GateNotNode extends GHNode {
  category = 'Math'
  constructor() {
    super('Gate Not')
    this.addInput('a', new ClassicPreset.Input(getSocket('number'), 'A'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('number'), 'Result'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { result: toBool(inputs.a) ? 0 : 1 }
  }
}

export class GateXorNode extends GHNode {
  category = 'Math'
  constructor() {
    super('Gate Xor')
    this.addInput('a', new ClassicPreset.Input(getSocket('number'), 'A'))
    this.addInput('b', new ClassicPreset.Input(getSocket('number'), 'B'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('number'), 'Result'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const a = toBool(inputs.a)
    const b = toBool(inputs.b)
    return { result: (a && !b) || (!a && b) ? 1 : 0 }
  }
}

export class GateMajorityNode extends GHNode {
  category = 'Math'
  constructor() {
    super('Gate Majority')
    this.addInput('a', new ClassicPreset.Input(getSocket('number'), 'A'))
    this.addInput('b', new ClassicPreset.Input(getSocket('number'), 'B'))
    this.addInput('c', new ClassicPreset.Input(getSocket('number'), 'C'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('number'), 'Result'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const count = [inputs.a, inputs.b, inputs.c].filter(toBool).length
    return { result: count >= 2 ? 1 : 0 }
  }
}

export class GateNandNode extends GHNode {
  category = 'Math'
  constructor() {
    super('Gate Nand')
    this.addInput('a', new ClassicPreset.Input(getSocket('number'), 'A'))
    this.addInput('b', new ClassicPreset.Input(getSocket('number'), 'B'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('number'), 'Result'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { result: toBool(inputs.a) && toBool(inputs.b) ? 0 : 1 }
  }
}

export class GateNorNode extends GHNode {
  category = 'Math'
  constructor() {
    super('Gate Nor')
    this.addInput('a', new ClassicPreset.Input(getSocket('number'), 'A'))
    this.addInput('b', new ClassicPreset.Input(getSocket('number'), 'B'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('number'), 'Result'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    return { result: toBool(inputs.a) || toBool(inputs.b) ? 0 : 1 }
  }
}

export class GateXnorNode extends GHNode {
  category = 'Math'
  constructor() {
    super('Gate Xnor')
    this.addInput('a', new ClassicPreset.Input(getSocket('number'), 'A'))
    this.addInput('b', new ClassicPreset.Input(getSocket('number'), 'B'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('number'), 'Result'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const a = toBool(inputs.a)
    const b = toBool(inputs.b)
    return { result: (a && b) || (!a && !b) ? 1 : 0 }
  }
}

/* ─────────── 其他实用工具 ─────────── */

export class RemapNode extends GHNode {
  category = 'Math'
  constructor() {
    super('Remap')
    this.addInput('value', new ClassicPreset.Input(getSocket('number'), 'Value'))
    this.addInput('source', new ClassicPreset.Input(getSocket('number'), 'Source'))
    this.addInput('target', new ClassicPreset.Input(getSocket('number'), 'Target'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('number'), 'Result'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const value = (inputs.value as number) ?? 0
    const source = (inputs.source as { min: number; max: number }) ?? { min: 0, max: 1 }
    const target = (inputs.target as { min: number; max: number }) ?? { min: 0, max: 1 }
    const t = source.max === source.min ? 0 : (value - source.min) / (source.max - source.min)
    return { result: target.min + t * (target.max - target.min) }
  }
}

export class ExpressionNode extends GHNode {
  category = 'Math'
  control: ClassicPreset.InputControl<'text'>
  constructor(initial = 'x + y') {
    super('Expression')
    this.control = new ClassicPreset.InputControl('text', { initial })
    this.addInput('x', new ClassicPreset.Input(getSocket('number'), 'X'))
    this.addInput('y', new ClassicPreset.Input(getSocket('number'), 'Y'))
    this.addInput('z', new ClassicPreset.Input(getSocket('number'), 'Z'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('number'), 'Result'))
    this.addControl('expr', this.control)
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const x = (inputs.x as number) ?? 0
    const y = (inputs.y as number) ?? 0
    const z = (inputs.z as number) ?? 0
    try {
      const fn = new Function('x', 'y', 'z', `return (${this.control.value || '0'})`)
      return { result: Number(fn(x, y, z)) || 0 }
    } catch {
      return { result: 0 }
    }
  }
}

/* ─────────── Sets（列表）── 保留在此处以便注册 ─────────── */

export class RangeNode extends GHNode {
  category = 'Sets'
  constructor() {
    super('Range')
    this.addInput('start', new ClassicPreset.Input(getSocket('number'), 'Start'))
    this.addInput('end', new ClassicPreset.Input(getSocket('number'), 'End'))
    this.addInput('step', new ClassicPreset.Input(getSocket('number'), 'Step'))
    this.addOutput('list', new ClassicPreset.Output(getSocket('number'), 'List'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const start = (inputs.start as number) ?? 0
    const end = (inputs.end as number) ?? 10
    const step = (inputs.step as number) ?? 1
    const list: number[] = []
    for (let i = start; i < end; i += step) list.push(i)
    return { list }
  }
}

export class SeriesNode extends GHNode {
  category = 'Sets'
  constructor() {
    super('Series')
    this.addInput('start', new ClassicPreset.Input(getSocket('number'), 'Start'))
    this.addInput('step', new ClassicPreset.Input(getSocket('number'), 'Step'))
    this.addInput('count', new ClassicPreset.Input(getSocket('number'), 'Count'))
    this.addOutput('list', new ClassicPreset.Output(getSocket('number'), 'List'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const start = (inputs.start as number) ?? 0
    const step = (inputs.step as number) ?? 1
    const count = Math.max(0, Math.round((inputs.count as number) ?? 10))
    const list: number[] = []
    for (let i = 0; i < count; i++) list.push(start + i * step)
    return { list }
  }
}
