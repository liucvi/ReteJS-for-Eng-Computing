import { ClassicPreset } from 'rete'
import { GHNode, getSocket } from './base'

export class ListItemNode extends GHNode {
  category = 'Sets'
  indexControl: ClassicPreset.InputControl<'number'>

  constructor() {
    super('List Item')
    this.indexControl = new ClassicPreset.InputControl('number', { initial: 0 })
    this.addInput('list', new ClassicPreset.Input(getSocket('number'), 'List'))
    this.addOutput('item', new ClassicPreset.Output(getSocket('number'), 'Item'))
    this.addOutput('index', new ClassicPreset.Output(getSocket('number'), 'Index'))
    this.addControl('i', this.indexControl)
  }

  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const list = (inputs.list as number[]) ?? []
    const i = Math.round(this.indexControl.value || 0)
    const idx = Math.max(0, Math.min(list.length - 1, i))
    return { item: list[idx] ?? 0, index: idx }
  }
}

export class ListLengthNode extends GHNode {
  category = 'Sets'

  constructor() {
    super('List Length')
    this.addInput('list', new ClassicPreset.Input(getSocket('number'), 'List'))
    this.addOutput('length', new ClassicPreset.Output(getSocket('number'), 'Length'))
  }

  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const list = (inputs.list as number[]) ?? []
    return { length: list.length }
  }
}

export class CullPatternNode extends GHNode {
  category = 'Sets'

  constructor() {
    super('Cull Pattern')
    this.addInput('list', new ClassicPreset.Input(getSocket('number'), 'List'))
    this.addInput('pattern', new ClassicPreset.Input(getSocket('number'), 'Pattern'))
    this.addOutput('result', new ClassicPreset.Output(getSocket('number'), 'Result'))
  }

  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const list = (inputs.list as number[]) ?? []
    const pattern = (inputs.pattern as number[]) ?? []
    const result = list.filter((_, i) => !!pattern[i % pattern.length])
    return { result }
  }
}

export class RepeatDataNode extends GHNode {
  category = 'Sets'
  countControl: ClassicPreset.InputControl<'number'>

  constructor() {
    super('Repeat Data')
    this.countControl = new ClassicPreset.InputControl('number', { initial: 5 })
    this.addInput('data', new ClassicPreset.Input(getSocket('number'), 'Data'))
    this.addOutput('list', new ClassicPreset.Output(getSocket('number'), 'List'))
    this.addControl('count', this.countControl)
  }

  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const data = (inputs.data as number) ?? 0
    const count = Math.max(0, Math.round(this.countControl.value || 5))
    return { list: Array(count).fill(data) }
  }
}

export class FlattenTreeNode extends GHNode {
  category = 'Sets'

  constructor() {
    super('Flatten Tree')
    this.addInput('tree', new ClassicPreset.Input(getSocket('number'), 'Tree'))
    this.addOutput('list', new ClassicPreset.Output(getSocket('number'), 'List'))
  }

  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const tree = (inputs.tree as number[][]) ?? []
    return { list: tree.flat() }
  }
}

export class GraftTreeNode extends GHNode {
  category = 'Sets'

  constructor() {
    super('Graft Tree')
    this.addInput('list', new ClassicPreset.Input(getSocket('number'), 'List'))
    this.addOutput('tree', new ClassicPreset.Output(getSocket('number'), 'Tree'))
  }

  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const list = (inputs.list as number[]) ?? []
    return { tree: list.map((item) => [item]) }
  }
}
