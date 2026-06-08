import { ClassicPreset } from 'rete'
import { GHNode, getSocket } from './base'

/* ═══════════════════════════════════════════════════════════════
   流体力学公式节点库
   ═══════════════════════════════════════════════════════════════ */

/** 伯努利方程 */
export class BernoulliNode extends GHNode {
  category = 'Fluid'
  constructor() {
    super('Bernoulli')
    this.addInput('p1', new ClassicPreset.Input(getSocket('number'), 'P₁ (Pa)'))
    this.addInput('v1', new ClassicPreset.Input(getSocket('number'), 'v₁ (m/s)'))
    this.addInput('z1', new ClassicPreset.Input(getSocket('number'), 'z₁ (m)'))
    this.addInput('v2', new ClassicPreset.Input(getSocket('number'), 'v₂ (m/s)'))
    this.addInput('z2', new ClassicPreset.Input(getSocket('number'), 'z₂ (m)'))
    this.addInput('rho', new ClassicPreset.Input(getSocket('number'), 'ρ (kg/m³)'))
    this.addInput('g', new ClassicPreset.Input(getSocket('number'), 'g (m/s²)'))
    this.addOutput('p2', new ClassicPreset.Output(getSocket('number'), 'P₂ (Pa)'))
    this.addOutput('head', new ClassicPreset.Output(getSocket('number'), 'Head (m)'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const p1 = (inputs.p1 as number) ?? 101325
    const v1 = (inputs.v1 as number) ?? 0
    const z1 = (inputs.z1 as number) ?? 0
    const v2 = (inputs.v2 as number) ?? 0
    const z2 = (inputs.z2 as number) ?? 0
    const rho = (inputs.rho as number) ?? 1000
    const g = (inputs.g as number) ?? 9.81
    const p2 = p1 + 0.5 * rho * (v1 * v1 - v2 * v2) + rho * g * (z1 - z2)
    return { p2, head: p2 / (rho * g) }
  }
}

/** 连续性方程 */
export class ContinuityNode extends GHNode {
  category = 'Fluid'
  constructor() {
    super('Continuity')
    this.addInput('a1', new ClassicPreset.Input(getSocket('number'), 'A₁ (m²)'))
    this.addInput('v1', new ClassicPreset.Input(getSocket('number'), 'v₁ (m/s)'))
    this.addInput('a2', new ClassicPreset.Input(getSocket('number'), 'A₂ (m²)'))
    this.addOutput('v2', new ClassicPreset.Output(getSocket('number'), 'v₂ (m/s)'))
    this.addOutput('q', new ClassicPreset.Output(getSocket('number'), 'Q (m³/s)'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const a1 = (inputs.a1 as number) ?? 1
    const v1 = (inputs.v1 as number) ?? 1
    const a2 = (inputs.a2 as number) ?? 1
    const q = a1 * v1
    return { v2: a2 === 0 ? 0 : q / a2, q }
  }
}

/** 雷诺数 */
export class ReynoldsNumberNode extends GHNode {
  category = 'Fluid'
  constructor() {
    super('Reynolds')
    this.addInput('rho', new ClassicPreset.Input(getSocket('number'), 'ρ (kg/m³)'))
    this.addInput('v', new ClassicPreset.Input(getSocket('number'), 'v (m/s)'))
    this.addInput('d', new ClassicPreset.Input(getSocket('number'), 'D (m)'))
    this.addInput('mu', new ClassicPreset.Input(getSocket('number'), 'μ (Pa·s)'))
    this.addOutput('re', new ClassicPreset.Output(getSocket('number'), 'Re'))
    this.addOutput('state', new ClassicPreset.Output(getSocket('number'), 'State'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const rho = (inputs.rho as number) ?? 1000
    const v = (inputs.v as number) ?? 1
    const d = (inputs.d as number) ?? 0.1
    const mu = (inputs.mu as number) ?? 0.001
    const re = mu === 0 ? 0 : (rho * v * d) / mu
    let state = 0
    if (re < 2300) state = 1
    else if (re < 4000) state = 2
    else state = 3
    return { re, state }
  }
}

/** 达西-魏斯巴赫方程 */
export class DarcyWeisbachNode extends GHNode {
  category = 'Fluid'
  constructor() {
    super('Darcy-Weisbach')
    this.addInput('f', new ClassicPreset.Input(getSocket('number'), 'f'))
    this.addInput('l', new ClassicPreset.Input(getSocket('number'), 'L (m)'))
    this.addInput('d', new ClassicPreset.Input(getSocket('number'), 'D (m)'))
    this.addInput('rho', new ClassicPreset.Input(getSocket('number'), 'ρ (kg/m³)'))
    this.addInput('v', new ClassicPreset.Input(getSocket('number'), 'v (m/s)'))
    this.addOutput('dp', new ClassicPreset.Output(getSocket('number'), 'ΔP (Pa)'))
    this.addOutput('hloss', new ClassicPreset.Output(getSocket('number'), 'h_loss (m)'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const f = (inputs.f as number) ?? 0.02
    const l = (inputs.l as number) ?? 10
    const d = (inputs.d as number) ?? 0.1
    const rho = (inputs.rho as number) ?? 1000
    const v = (inputs.v as number) ?? 1
    const g = 9.81
    const dp = f * (l / d) * (rho * v * v / 2)
    return { dp, hloss: dp / (rho * g) }
  }
}

/** 局部阻力 */
export class LocalResistanceNode extends GHNode {
  category = 'Fluid'
  constructor() {
    super('Local Resistance')
    this.addInput('ksi', new ClassicPreset.Input(getSocket('number'), 'Σξ'))
    this.addInput('rho', new ClassicPreset.Input(getSocket('number'), 'ρ (kg/m³)'))
    this.addInput('v', new ClassicPreset.Input(getSocket('number'), 'v (m/s)'))
    this.addOutput('dp', new ClassicPreset.Output(getSocket('number'), 'ΔP (Pa)'))
    this.addOutput('hloss', new ClassicPreset.Output(getSocket('number'), 'h (m)'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const ksi = (inputs.ksi as number) ?? 0
    const rho = (inputs.rho as number) ?? 1000
    const v = (inputs.v as number) ?? 0
    const g = 9.81
    const dp = ksi * (rho * v * v / 2)
    return { dp, hloss: dp / (rho * g) }
  }
}

/** 管道截面积 */
export class PipeAreaNode extends GHNode {
  category = 'Fluid'
  constructor() {
    super('Pipe Area')
    this.addInput('d', new ClassicPreset.Input(getSocket('number'), 'D (m)'))
    this.addOutput('a', new ClassicPreset.Output(getSocket('number'), 'A (m²)'))
    this.addOutput('perimeter', new ClassicPreset.Output(getSocket('number'), 'Perimeter (m)'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const d = (inputs.d as number) ?? 0.1
    const r = d / 2
    return { a: Math.PI * r * r, perimeter: Math.PI * d }
  }
}

/** 流速计算 v = 4Q/(πD²) */
export class VelocityNode extends GHNode {
  category = 'Fluid'
  constructor() {
    super('Velocity')
    this.addInput('q', new ClassicPreset.Input(getSocket('number'), 'Q (m³/s)'))
    this.addInput('d', new ClassicPreset.Input(getSocket('number'), 'D (m)'))
    this.addOutput('v', new ClassicPreset.Output(getSocket('number'), 'v (m/s)'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const q = (inputs.q as number) ?? 0
    const d = (inputs.d as number) ?? 0.1
    const a = Math.PI * d * d / 4
    return { v: a === 0 ? 0 : q / a }
  }
}

/** 摩擦因子计算器 (Swamee-Jain) */
export class FrictionFactorNode extends GHNode {
  category = 'Fluid'
  constructor() {
    super('Friction Factor')
    this.addInput('re', new ClassicPreset.Input(getSocket('number'), 'Re'))
    this.addInput('e', new ClassicPreset.Input(getSocket('number'), 'ε (mm)'))
    this.addInput('d', new ClassicPreset.Input(getSocket('number'), 'D (m)'))
    this.addOutput('f', new ClassicPreset.Output(getSocket('number'), 'f'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const re = (inputs.re as number) ?? 10000
    const e = (inputs.e as number) ?? 0.045
    const d = (inputs.d as number) ?? 0.1
    const epsilon = (e / 1000) / d
    if (re < 2300) return { f: 64 / re }
    const term = Math.log10(epsilon / 3.7 + 5.74 / Math.pow(re, 0.9))
    return { f: 0.25 / (term * term) }
  }
}

/** 水泵功率计算 */
export class PumpPowerNode extends GHNode {
  category = 'Fluid'
  constructor() {
    super('Pump Power')
    this.addInput('rho', new ClassicPreset.Input(getSocket('number'), 'ρ (kg/m³)'))
    this.addInput('q', new ClassicPreset.Input(getSocket('number'), 'Q (m³/s)'))
    this.addInput('h', new ClassicPreset.Input(getSocket('number'), 'H (m)'))
    this.addInput('eta', new ClassicPreset.Input(getSocket('number'), 'η (%)'))
    this.addOutput('pe', new ClassicPreset.Output(getSocket('number'), 'P_e (W)'))
    this.addOutput('pshaft', new ClassicPreset.Output(getSocket('number'), 'P_shaft (W)'))
    this.addOutput('pshaft_kw', new ClassicPreset.Output(getSocket('number'), 'P_shaft (kW)'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const rho = (inputs.rho as number) ?? 1000
    const q = (inputs.q as number) ?? 0
    const h = (inputs.h as number) ?? 0
    const eta = Math.max(1, (inputs.eta as number) ?? 75) / 100
    const pe = rho * 9.81 * q * h
    const pshaft = eta === 0 ? 0 : pe / eta
    return { pe, pshaft, pshaft_kw: pshaft / 1000 }
  }
}

/** NPSH 汽蚀余量计算 */
export class NPSHNode extends GHNode {
  category = 'Fluid'
  constructor() {
    super('NPSH')
    this.addInput('patm', new ClassicPreset.Input(getSocket('number'), 'P_atm (Pa)'))
    this.addInput('pv', new ClassicPreset.Input(getSocket('number'), 'P_v (Pa)'))
    this.addInput('zs', new ClassicPreset.Input(getSocket('number'), 'Z_s (m)'))
    this.addInput('hs', new ClassicPreset.Input(getSocket('number'), 'h_s (m)'))
    this.addInput('rho', new ClassicPreset.Input(getSocket('number'), 'ρ (kg/m³)'))
    this.addInput('g', new ClassicPreset.Input(getSocket('number'), 'g (m/s²)'))
    this.addOutput('npsha', new ClassicPreset.Output(getSocket('number'), 'NPSH_a (m)'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const patm = (inputs.patm as number) ?? 101325
    const pv = (inputs.pv as number) ?? 2338
    const zs = (inputs.zs as number) ?? 0
    const hs = (inputs.hs as number) ?? 0
    const rho = (inputs.rho as number) ?? 1000
    const g = (inputs.g as number) ?? 9.81
    const rho_g = rho * g
    const npsha = rho_g === 0 ? 0 : (patm / rho_g) - zs - hs - (pv / rho_g)
    return { npsha: Math.max(0, npsha) }
  }
}

/** 总扬程计算 */
export class TotalHeadNode extends GHNode {
  category = 'Fluid'
  constructor() {
    super('Total Head')
    this.addInput('h1f', new ClassicPreset.Input(getSocket('number'), 'h₁_f (m)'))
    this.addInput('h1l', new ClassicPreset.Input(getSocket('number'), 'h₁_l (m)'))
    this.addInput('h2f', new ClassicPreset.Input(getSocket('number'), 'h₂_f (m)'))
    this.addInput('h2l', new ClassicPreset.Input(getSocket('number'), 'h₂_l (m)'))
    this.addInput('dz', new ClassicPreset.Input(getSocket('number'), 'Δz (m)'))
    this.addInput('rho', new ClassicPreset.Input(getSocket('number'), 'ρ (kg/m³)'))
    this.addInput('g', new ClassicPreset.Input(getSocket('number'), 'g (m/s²)'))
    this.addOutput('h1', new ClassicPreset.Output(getSocket('number'), 'h₁ (m)'))
    this.addOutput('h2', new ClassicPreset.Output(getSocket('number'), 'h₂ (m)'))
    this.addOutput('hloss', new ClassicPreset.Output(getSocket('number'), 'H_loss (m)'))
    this.addOutput('hreq', new ClassicPreset.Output(getSocket('number'), 'H_req (m)'))
    this.addOutput('dptotal', new ClassicPreset.Output(getSocket('number'), 'ΔP_total (Pa)'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const h1f = (inputs.h1f as number) ?? 0
    const h1l = (inputs.h1l as number) ?? 0
    const h2f = (inputs.h2f as number) ?? 0
    const h2l = (inputs.h2l as number) ?? 0
    const dz = (inputs.dz as number) ?? 0
    const rho = (inputs.rho as number) ?? 1000
    const g = (inputs.g as number) ?? 9.81
    const h1 = h1f + h1l
    const h2 = h2f + h2l
    const hloss = h1 + h2
    const hreq = hloss + dz
    return { h1, h2, hloss, hreq, dptotal: hreq * rho * g }
  }
}

/** 托里拆利定律 */
export class TorricelliNode extends GHNode {
  category = 'Fluid'
  constructor() {
    super('Torricelli')
    this.addInput('g', new ClassicPreset.Input(getSocket('number'), 'g (m/s²)'))
    this.addInput('h', new ClassicPreset.Input(getSocket('number'), 'h (m)'))
    this.addOutput('v', new ClassicPreset.Output(getSocket('number'), 'v (m/s)'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const g = (inputs.g as number) ?? 9.81
    const h = (inputs.h as number) ?? 1
    return { v: Math.sqrt(2 * g * h) }
  }
}

/** 泊肃叶定律 */
export class PoiseuilleNode extends GHNode {
  category = 'Fluid'
  constructor() {
    super('Poiseuille')
    this.addInput('r', new ClassicPreset.Input(getSocket('number'), 'R (m)'))
    this.addInput('dp', new ClassicPreset.Input(getSocket('number'), 'ΔP (Pa)'))
    this.addInput('mu', new ClassicPreset.Input(getSocket('number'), 'μ (Pa·s)'))
    this.addInput('l', new ClassicPreset.Input(getSocket('number'), 'L (m)'))
    this.addOutput('q', new ClassicPreset.Output(getSocket('number'), 'Q (m³/s)'))
    this.addOutput('vmax', new ClassicPreset.Output(getSocket('number'), 'v_max (m/s)'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const r = (inputs.r as number) ?? 0.05
    const dp = (inputs.dp as number) ?? 1000
    const mu = (inputs.mu as number) ?? 0.001
    const l = (inputs.l as number) ?? 10
    const q = mu === 0 ? 0 : (Math.PI * Math.pow(r, 4) * dp) / (8 * mu * l)
    const vmax = mu === 0 ? 0 : (dp * r * r) / (4 * mu * l)
    return { q, vmax }
  }
}

/** 阿基米德浮力 */
export class ArchimedesNode extends GHNode {
  category = 'Fluid'
  constructor() {
    super('Archimedes')
    this.addInput('rho', new ClassicPreset.Input(getSocket('number'), 'ρ (kg/m³)'))
    this.addInput('v', new ClassicPreset.Input(getSocket('number'), 'V (m³)'))
    this.addInput('g', new ClassicPreset.Input(getSocket('number'), 'g (m/s²)'))
    this.addOutput('fb', new ClassicPreset.Output(getSocket('number'), 'Fb (N)'))
  }
  execute(inputs: Record<string, unknown>): Record<string, unknown> {
    const rho = (inputs.rho as number) ?? 1000
    const v = (inputs.v as number) ?? 1
    const g = (inputs.g as number) ?? 9.81
    return { fb: rho * v * g }
  }
}
