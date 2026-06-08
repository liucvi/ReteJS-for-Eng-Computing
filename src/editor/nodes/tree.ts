import { ClassicPreset } from 'rete'
import { GHNode, getSocket } from './base'
import { DataTree, matchDataTrees } from '../engine/dataTree'

function toTree(v: unknown): DataTree<number> {
  const t = new DataTree<number>()
  if (v instanceof DataTree) return v as DataTree<number>
  if (Array.isArray(v)) {
    t.setBranch([], v as number[])
    return t
  }
  t.setBranch([], [v as number])
  return t
}

function fromTree(t: DataTree<number>): unknown {
  const paths = t.getAllPaths()
  if (paths.length === 1 && paths[0].length === 0) {
    const vals = t.getBranch([])
    return vals.length === 1 ? vals[0] : vals
  }
  return t
}

/** Flatten Tree - 拍平所有路径 */
export class FlattenTreeNode extends GHNode {
  category = 'Sets'
  constructor() {
    super('Flatten Tree')
    this.addInput('tree', new ClassicPreset.Input(getSocket('number'), 'Tree'))
    this.addOutput('tree', new ClassicPreset.Output(getSocket('number'), 'Tree'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const t = toTree(inputs.tree)
    return { tree: fromTree(t.flatten()) }
  }
}

/** Graft Tree - 嫁接，提升一级 */
export class GraftTreeNode extends GHNode {
  category = 'Sets'
  constructor() {
    super('Graft Tree')
    this.addInput('tree', new ClassicPreset.Input(getSocket('number'), 'Tree'))
    this.addOutput('tree', new ClassicPreset.Output(getSocket('number'), 'Tree'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const t = toTree(inputs.tree)
    return { tree: fromTree(t.graft()) }
  }
}

/** Simplify Tree - 简化路径 */
export class SimplifyTreeNode extends GHNode {
  category = 'Sets'
  constructor() {
    super('Simplify Tree')
    this.addInput('tree', new ClassicPreset.Input(getSocket('number'), 'Tree'))
    this.addOutput('tree', new ClassicPreset.Output(getSocket('number'), 'Tree'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const t = toTree(inputs.tree)
    return { tree: fromTree(t.simplify()) }
  }
}

/** Cross Reference - 笛卡尔积交叉引用 */
export class CrossReferenceNode extends GHNode {
  category = 'Sets'
  constructor() {
    super('Cross Reference')
    this.addInput('a', new ClassicPreset.Input(getSocket('number'), 'A'))
    this.addInput('b', new ClassicPreset.Input(getSocket('number'), 'B'))
    this.addOutput('tree', new ClassicPreset.Output(getSocket('number'), 'Tree'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const ta = toTree(inputs.a)
    const tb = toTree(inputs.b)
    const result = matchDataTrees(ta, tb, 'cross')
    const outTree = new DataTree<number>()
    for (const path of result.getAllPaths()) {
      const pairs = result.getBranch(path)
      outTree.setBranch(path, pairs.map((p) => (p[0] as number) + (p[1] as number)))
    }
    return { tree: fromTree(outTree) }
  }
}

/** Longest List - 按最长列表匹配两个输入 */
export class LongestListNode extends GHNode {
  category = 'Sets'
  constructor() {
    super('Longest List')
    this.addInput('a', new ClassicPreset.Input(getSocket('number'), 'A'))
    this.addInput('b', new ClassicPreset.Input(getSocket('number'), 'B'))
    this.addOutput('a', new ClassicPreset.Output(getSocket('number'), 'A'))
    this.addOutput('b', new ClassicPreset.Output(getSocket('number'), 'B'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const a = (inputs.a as number[]) ?? [inputs.a as number]
    const b = (inputs.b as number[]) ?? [inputs.b as number]
    const len = Math.max(a.length, b.length)
    const ra: number[] = []
    const rb: number[] = []
    for (let i = 0; i < len; i++) {
      ra.push(i < a.length ? a[i] : a[a.length - 1])
      rb.push(i < b.length ? b[i] : b[b.length - 1])
    }
    return { a: ra, b: rb }
  }
}

/** Shortest List - 按最短列表匹配两个输入 */
export class ShortestListNode extends GHNode {
  category = 'Sets'
  constructor() {
    super('Shortest List')
    this.addInput('a', new ClassicPreset.Input(getSocket('number'), 'A'))
    this.addInput('b', new ClassicPreset.Input(getSocket('number'), 'B'))
    this.addOutput('a', new ClassicPreset.Output(getSocket('number'), 'A'))
    this.addOutput('b', new ClassicPreset.Output(getSocket('number'), 'B'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const a = (inputs.a as number[]) ?? [inputs.a as number]
    const b = (inputs.b as number[]) ?? [inputs.b as number]
    const len = Math.min(a.length, b.length)
    return { a: a.slice(0, len), b: b.slice(0, len) }
  }
}

/** Tree Statistics - 显示树结构统计信息 */
export class TreeStatsNode extends GHNode {
  category = 'Sets'
  constructor() {
    super('Tree Stats')
    this.addInput('tree', new ClassicPreset.Input(getSocket('number'), 'Tree'))
    this.addOutput('paths', new ClassicPreset.Output(getSocket('number'), 'Paths'))
    this.addOutput('count', new ClassicPreset.Output(getSocket('number'), 'Count'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const t = toTree(inputs.tree)
    const paths = t.getAllPaths()
    this.display = `Branches: ${paths.length}\nTotal items: ${t.getAllValues().length}\n\n${t.toString()}`
    return { paths: paths.length, count: t.getAllValues().length }
  }
}
