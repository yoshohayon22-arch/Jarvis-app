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

/** 95 → « 1 h 35 », 40 → « 40 min ». */
export function formatDuration(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`
}
