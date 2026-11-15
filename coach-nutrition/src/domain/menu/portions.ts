/**
 * Ajustement des portions d'une journée pour coller aux calories et aux macros visées.
 *
 * Problème : on a n plats (n = 3 à 5), chacun avec ses kcal / protéines / lipides / glucides
 * par portion. On cherche le nombre de portions x_i de chaque plat (entre une borne basse et
 * une borne haute) qui minimise l'écart relatif aux cibles :
 *
 *   E(x) = Σ_k w_k · ((Σ_i x_i·a_ik − T_k) / T_k)²  +  λ · Σ_i ((x_i − x0_i) / x0_i)²
 *
 * Le second terme garde chaque plat proche de sa part « naturelle » de la journée
 * (petit-déjeuner ≈ 25 %, etc.) pour éviter des portions absurdes.
 * C'est un problème quadratique convexe sous contraintes de bornes : on le résout par
 * descente par coordonnées (chaque variable a une solution exacte, qu'on borne).
 */

export interface MacroVector {
  kcal: number
  protein: number
  fat: number
  carbs: number
}

export interface PortionProblem {
  /** Valeurs pour UNE portion de chaque plat. */
  items: MacroVector[]
  /** Portions « naturelles » (part de la journée), utilisées comme point d'ancrage. */
  anchors: number[]
  min: number[]
  max: number[]
  target: MacroVector
}

const KEYS = ['kcal', 'protein', 'fat', 'carbs'] as const

/** Poids de chaque critère : les calories comptent le plus, puis les protéines. */
export const WEIGHTS: Record<(typeof KEYS)[number], number> = { kcal: 4, protein: 3, fat: 1, carbs: 1 }
export const ANCHOR_WEIGHT = 0.03

export function totals(items: MacroVector[], x: number[]): MacroVector {
  const t = { kcal: 0, protein: 0, fat: 0, carbs: 0 }
  items.forEach((it, i) => {
    for (const k of KEYS) t[k] += it[k] * x[i]
  })
  return t
}

/** Écart relatif (−0,03 = 3 % en dessous). */
export function relativeError(value: number, target: number): number {
  return target > 0 ? (value - target) / target : 0
}

export function objective(p: PortionProblem, x: number[]): number {
  const t = totals(p.items, x)
  let e = 0
  for (const k of KEYS) e += WEIGHTS[k] * relativeError(t[k], p.target[k]) ** 2
  x.forEach((xi, i) => {
    e += ANCHOR_WEIGHT * ((xi - p.anchors[i]) / p.anchors[i]) ** 2
  })
  return e
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Résout le problème et renvoie les portions optimales (non arrondies). */
export function optimizePortions(p: PortionProblem, sweeps = 40): number[] {
  const x = p.anchors.map((a, i) => clamp(a, p.min[i], p.max[i]))
  for (let s = 0; s < sweeps; s++) {
    for (let i = 0; i < x.length; i++) {
      // Reste r_k = contribution des autres plats − cible.
      const t = totals(p.items, x)
      let num = 0
      let den = 0
      for (const k of KEYS) {
        const T2 = p.target[k] ** 2 || 1
        const a = p.items[i][k]
        const r = t[k] - a * x[i] - p.target[k]
        num += (-WEIGHTS[k] * a * r) / T2
        den += (WEIGHTS[k] * a * a) / T2
      }
      const x0 = p.anchors[i]
      num += ANCHOR_WEIGHT / x0
      den += ANCHOR_WEIGHT / (x0 * x0)
      x[i] = clamp(num / den, p.min[i], p.max[i])
    }
  }
  return x
}

/**
 * Arrondit les portions au dixième (affichage « 1,3 portion »), puis corrige par petits pas
 * si l'arrondi a fait sortir les calories de la marge tolérée.
 */
export function roundPortions(p: PortionProblem, x: number[], tolerance: number, step = 0.1): number[] {
  const r = x.map((v, i) => clamp(Math.round(v / step) * step, p.min[i], p.max[i]))
  const fix = (v: number) => Math.round(v * 100) / 100
  for (let guard = 0; guard < 30; guard++) {
    const err = relativeError(totals(p.items, r).kcal, p.target.kcal)
    if (Math.abs(err) <= tolerance) break
    // On ajuste le plat qui déplace le plus les calories, dans le bon sens et dans ses bornes.
    const dir = err > 0 ? -1 : 1
    let best = -1
    for (let i = 0; i < r.length; i++) {
      const next = r[i] + dir * step
      if (next < p.min[i] - 1e-9 || next > p.max[i] + 1e-9) continue
      if (best === -1 || p.items[i].kcal > p.items[best].kcal) best = i
    }
    if (best === -1) break
    r[best] = fix(r[best] + dir * step)
  }
  return r.map(fix)
}
