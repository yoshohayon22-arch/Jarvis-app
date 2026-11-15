/** Fonctions d'affichage (format suisse romand). */

/** « 2026-03-30 » → « 30 mars 2026 ». */
export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('fr-CH', opts)
}

/** 72.5 → « 72,5 kg ». */
export function formatKg(kg: number): string {
  return `${(Math.round(kg * 10) / 10).toLocaleString('fr-CH')} kg`
}

/** 12.5 → « CHF 12.50 » (en Suisse, on écrit les francs avec un point). */
export function formatChf(chf: number): string {
  return `CHF ${chf.toFixed(2)}`
}
