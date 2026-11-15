import type { WeatherKind } from "./types";

/** Codes météo WMO (utilisés par Open-Meteo) → libellé français + famille d'icône. */
const WMO: Record<number, [string, WeatherKind]> = {
  0: ["Ciel dégagé", "clair"],
  1: ["Plutôt dégagé", "peu-nuageux"],
  2: ["Partiellement nuageux", "peu-nuageux"],
  3: ["Couvert", "nuageux"],
  45: ["Brouillard", "brouillard"],
  48: ["Brouillard givrant", "brouillard"],
  51: ["Bruine légère", "bruine"],
  53: ["Bruine", "bruine"],
  55: ["Bruine dense", "bruine"],
  56: ["Bruine verglaçante", "bruine"],
  57: ["Bruine verglaçante dense", "bruine"],
  61: ["Pluie faible", "pluie"],
  63: ["Pluie", "pluie"],
  65: ["Pluie forte", "pluie"],
  66: ["Pluie verglaçante", "pluie"],
  67: ["Pluie verglaçante forte", "pluie"],
  71: ["Neige faible", "neige"],
  73: ["Neige", "neige"],
  75: ["Neige forte", "neige"],
  77: ["Grains de neige", "neige"],
  80: ["Averses faibles", "averses"],
  81: ["Averses", "averses"],
  82: ["Averses violentes", "averses"],
  85: ["Averses de neige", "neige"],
  86: ["Fortes averses de neige", "neige"],
  95: ["Orage", "orage"],
  96: ["Orage avec grêle", "orage"],
  99: ["Orage violent avec grêle", "orage"],
};

export function describeWeather(code: number): { label: string; kind: WeatherKind } {
  const entry = WMO[code];
  return entry ? { label: entry[0], kind: entry[1] } : { label: "Conditions inconnues", kind: "nuageux" };
}

const DIRECTIONS = ["nord", "nord-est", "est", "sud-est", "sud", "sud-ouest", "ouest", "nord-ouest"];
/** 221° → « sud-ouest » (direction d'où vient le vent). */
export const windDirectionLabel = (deg: number) => DIRECTIONS[Math.round(deg / 45) % 8];

/** Indice européen de qualité de l'air (EAQI) → libellé. */
export function aqiLabel(aqi: number): string {
  if (aqi <= 20) return "Bon";
  if (aqi <= 40) return "Correct";
  if (aqi <= 60) return "Moyen";
  if (aqi <= 80) return "Médiocre";
  if (aqi <= 100) return "Mauvais";
  return "Très mauvais";
}

export function uvLabel(uv: number): string {
  if (uv < 3) return "faible";
  if (uv < 6) return "modéré";
  if (uv < 8) return "élevé";
  if (uv < 11) return "très élevé";
  return "extrême";
}
