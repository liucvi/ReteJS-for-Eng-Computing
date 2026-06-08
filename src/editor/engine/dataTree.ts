/**
 * Grasshopper-style Data Tree
 * Path = [i, j, k, ...]  e.g., [0,0], [0,1]
 * Each path holds a list of values
 */

export type Path = number[]

export class DataTree<T> {
  branches = new Map<string, T[]>()

  private key(path: Path): string {
    return path.join(';')
  }

  setBranch(path: Path, data: T[]): void {
    this.branches.set(this.key(path), data)
  }

  getBranch(path: Path): T[] {
    return this.branches.get(this.key(path)) ?? []
  }

  getAllPaths(): Path[] {
    const paths: Path[] = []
    for (const key of this.branches.keys()) {
      paths.push(key.split(';').map(Number))
    }
    return paths.sort(comparePath)
  }

  getAllValues(): T[] {
    const out: T[] = []
    for (const vals of this.branches.values()) {
      out.push(...vals)
    }
    return out
  }

  clone(): DataTree<T> {
    const dt = new DataTree<T>()
    for (const [k, v] of this.branches) {
      dt.branches.set(k, [...v])
    }
    return dt
  }

  flatten(): DataTree<T> {
    const dt = new DataTree<T>()
    const all = this.getAllValues()
    if (all.length > 0) dt.setBranch([], all)
    return dt
  }

  graft(index = 0): DataTree<T> {
    const dt = new DataTree<T>()
    for (const path of this.getAllPaths()) {
      const values = this.getBranch(path)
      for (let i = 0; i < values.length; i++) {
        const newPath = [...path.slice(0, index), i, ...path.slice(index)]
        dt.setBranch(newPath, [values[i]])
      }
    }
    return dt
  }

  simplify(): DataTree<T> {
    const dt = new DataTree<T>()
    for (const path of this.getAllPaths()) {
      const simplified = simplifyPath(path)
      const existing = dt.getBranch(simplified)
      dt.setBranch(simplified, [...existing, ...this.getBranch(path)])
    }
    return dt
  }

  /** String representation like GH Panel */
  toString(): string {
    const lines: string[] = []
    for (const path of this.getAllPaths()) {
      const key = path.length === 0 ? '{}' : `{${path.join(';')}}`
      const values = this.getBranch(path)
      for (let i = 0; i < values.length; i++) {
        const v = values[i]
        lines.push(`${key}[${i}] = ${formatVal(v)}`)
      }
    }
    return lines.join('\n')
  }
}

function formatVal(v: unknown): string {
  if (typeof v === 'number') return v.toFixed(6).replace(/\.?0+$/, '')
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return `[${v.map(formatVal).join(', ')}]`
  if (v && typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function comparePath(a: Path, b: Path): number {
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0
    const bv = b[i] ?? 0
    if (av !== bv) return av - bv
  }
  return 0
}

function simplifyPath(path: Path): Path {
  // Remove trailing zeros, but keep at least one element
  const result = [...path]
  while (result.length > 1 && result[result.length - 1] === 0) {
    result.pop()
  }
  return result
}

/* ═══════ List Matching Strategies ═══════ */

export type MatchMode = 'longest' | 'shortest' | 'cross'

export function matchLists<T, U>(
  a: T[],
  b: U[],
  mode: MatchMode
): [T, U][] {
  if (mode === 'cross') {
    const out: [T, U][] = []
    for (const av of a) {
      for (const bv of b) out.push([av, bv])
    }
    return out
  }

  const len = mode === 'longest'
    ? Math.max(a.length, b.length)
    : Math.min(a.length, b.length)

  const out: [T, U][] = []
  for (let i = 0; i < len; i++) {
    out.push([
      i < a.length ? a[i] : a[a.length - 1],
      i < b.length ? b[i] : b[b.length - 1],
    ])
  }
  return out
}

export function matchDataTrees<T, U>(
  da: DataTree<T>,
  db: DataTree<U>,
  mode: MatchMode
): DataTree<[T, U]> {
  const result = new DataTree<[T, U]>()

  if (mode === 'cross') {
    const pa = da.getAllPaths()
    const pb = db.getAllPaths()
    for (const pathA of pa) {
      for (const pathB of pb) {
        const va = da.getBranch(pathA)
        const vb = db.getBranch(pathB)
        for (const av of va) {
          for (const bv of vb) {
            const path = [...pathA, ...pathB]
            const existing = result.getBranch(path)
            result.setBranch(path, [...existing, [av, bv]])
          }
        }
      }
    }
    return result
  }

  // longest / shortest - match by path
  const allPaths = new Set<string>()
  for (const p of da.getAllPaths()) allPaths.add(p.join(';'))
  for (const p of db.getAllPaths()) allPaths.add(p.join(';'))

  for (const key of allPaths) {
    const path = key.split(';').map(Number)
    const va = da.getBranch(path)
    const vb = db.getBranch(path)
    const len = mode === 'longest' ? Math.max(va.length, vb.length) : Math.min(va.length, vb.length)
    const pairs: [T, U][] = []
    for (let i = 0; i < len; i++) {
      pairs.push([
        i < va.length ? va[i] : va[va.length - 1],
        i < vb.length ? vb[i] : vb[vb.length - 1],
      ])
    }
    result.setBranch(path, pairs)
  }

  return result
}
