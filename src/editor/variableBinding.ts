import { ClassicPreset } from 'rete'
import type { NodeEditor } from 'rete'
import type { GHNode, Schemes } from './nodes/base'

export async function autoConnectFields(editor: NodeEditor<Schemes>) {
  const nodes = editor.getNodes() as GHNode[]
  let created = 0

  const existing = editor.getConnections()
  const occupiedInputs = new Set(
    existing.map((conn) => `${conn.target}:${String(conn.targetInput)}`)
  )
  const existingPairs = new Set(
    existing.map((conn) => [
      conn.source,
      String(conn.sourceOutput),
      conn.target,
      String(conn.targetInput),
    ].join(':'))
  )

  for (const target of nodes) {
    for (const [inputKey, input] of Object.entries(target.inputs)) {
      if (!input) continue
      const inputId = `${target.id}:${inputKey}`
      if (occupiedInputs.has(inputId)) continue

      const inputNames = getInputFieldNames(target, inputKey)
      if (inputNames.length === 0) continue

      const sourceMatch = findSourceForInput(nodes, target.id, inputKey, inputNames)
      if (!sourceMatch) continue

      const pairKey = [
        sourceMatch.node.id,
        sourceMatch.outputKey,
        target.id,
        inputKey,
      ].join(':')
      if (existingPairs.has(pairKey)) continue

      const connection = new ClassicPreset.Connection(
        sourceMatch.node,
        sourceMatch.outputKey,
        target,
        inputKey
      ) as Schemes['Connection']
      connection.isAutoVariable = true
      connection.variableName = sourceMatch.fieldName
      await editor.addConnection(connection)
      existingPairs.add(pairKey)
      occupiedInputs.add(inputId)
      created++
    }
  }

  return created
}

function findSourceForInput(nodes: GHNode[], targetId: string, inputKey: string, inputNames: string[]) {
  const keyWanted = normalizeFieldName(inputKey)
  const directWanted = new Set(inputNames.map(normalizeFieldName))
  const wanted = expandFieldNames(inputNames)

  const keyMatch = findSourceByMatcher(nodes, targetId, (names) =>
    names.find((name) => normalizeFieldName(name) === keyWanted)
  )
  if (keyMatch) return keyMatch

  const directMatch = findSourceByMatcher(nodes, targetId, (names) =>
    names.find((name) => directWanted.has(normalizeFieldName(name)))
  )
  if (directMatch) return directMatch

  return findSourceByMatcher(nodes, targetId, (names) =>
    names.find((name) => hasFieldMatch(wanted, name))
  )
}

function findSourceByMatcher(
  nodes: GHNode[],
  targetId: string,
  matcher: (names: string[]) => string | undefined
) {
  for (const node of nodes) {
    if (node.id === targetId) continue

    for (const outputKey of Object.keys(node.outputs)) {
      const match = matcher(getOutputFieldNames(node, outputKey))
      if (match) return { node, outputKey, fieldName: match }
    }
  }

  return null
}

function getInputFieldNames(node: GHNode, inputKey: string) {
  const input = node.inputs[inputKey]
  const label = input ? (input as { label?: string }).label : ''
  return compact([
    inputKey,
    label,
    ...(node.inputAliases?.[inputKey] || []),
  ])
}

function getOutputFieldNames(node: GHNode, outputKey: string) {
  const output = node.outputs[outputKey]
  const label = output ? (output as { label?: string }).label : ''
  const isValueOutput = outputKey === 'value' || outputKey === 'result'
  return compact([
    outputKey,
    label,
    ...(isValueOutput && node.variableName ? [node.variableName] : []),
    ...(node.outputAliases?.[outputKey] || []),
  ])
}

function compact(values: Array<string | undefined>) {
  return values
    .map((value) => String(value || '').trim())
    .filter(Boolean)
}

function expandFieldNames(values: string[]) {
  const names = new Set<string>()
  for (const value of values) {
    for (const name of fieldNameVariants(value)) {
      names.add(name)
    }
  }
  return names
}

function hasFieldMatch(wanted: Set<string>, candidate: string) {
  return fieldNameVariants(candidate).some((name) => wanted.has(name))
}

function fieldNameVariants(value: string) {
  const normalized = normalizeFieldName(value)
  const withoutUnitSuffix = normalized.replace(/(?:kgm3|percent|m3s|kw|pa|m2|ms|w)$/g, '')
  return Array.from(new Set([
    normalized,
    withoutUnitSuffix,
    normalized.replace(/^p/, 'power'),
    normalized.replace(/^power/, 'p'),
  ].filter(Boolean)))
}

export function normalizeFieldName(value: string) {
  return value
    .replace(/ρ/g, 'rho')
    .replace(/μ/g, 'mu')
    .replace(/η/g, 'eta')
    .replace(/λ/g, 'lambda')
    .replace(/Δ/g, 'delta')
    .replace(/[₀-₉]/g, (digit) => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(digit)))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}
