/**
 * Formats suisses : dates jj.mm.aaaa, heures 24 h, fuseau Europe/Zurich, montants en CHF.
 */
const TZ = "Europe/Zurich";

const dateFmt = new Intl.DateTimeFormat("fr-CH", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("fr-CH", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const longDateFmt = new Intl.DateTimeFormat("fr-CH", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const chfFmt = new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF" });

/** 15.11.2026 */
export const formatDate = (d: Date) => dateFmt.format(d);
/** 18:05 */
export const formatTime = (d: Date) => timeFmt.format(d);
/** 15.11.2026 à 18:05 */
export const formatDateTime = (d: Date) => `${dateFmt.format(d)} à ${timeFmt.format(d)}`;
/** dimanche 15 novembre */
export const formatLongDate = (d: Date) => longDateFmt.format(d);
/** Montant en francs suisses. */
export const formatCHF = (amount: number) => chfFmt.format(amount);
