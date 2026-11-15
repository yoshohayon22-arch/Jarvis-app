/** Types des données météo, déjà mises en forme pour l'affichage. */

export type WeatherKind = "clair" | "peu-nuageux" | "nuageux" | "brouillard" | "bruine" | "pluie" | "neige" | "averses" | "orage";

export interface CurrentWeather {
  /** Heure locale (Europe/Zurich) de la mesure, ex. « 19:30 ». */
  time: string;
  temperature: number;
  apparent: number;
  humidity: number;
  precipitation: number;
  code: number;
  isDay: boolean;
  wind: number;
  gusts: number;
  windDirection: number;
}

export interface HourlyPoint {
  /** « 19:00 » */
  time: string;
  /** Date ISO locale complète, sert de clé. */
  iso: string;
  temperature: number;
  precipitationProbability: number | null;
  precipitation: number;
  code: number;
  isDay: boolean;
  wind: number;
  gusts: number;
}

export interface DailyPoint {
  /** « 2026-11-15 » */
  date: string;
  code: number;
  max: number;
  min: number;
  precipitation: number;
  precipitationProbability: number | null;
  gusts: number;
  sunrise: string;
  sunset: string;
  /** Modèle d'où vient cette journée. */
  model: "MétéoSuisse ICON-CH" | "ECMWF IFS";
}

export interface Forecast {
  current: CurrentWeather;
  hourly: HourlyPoint[];
  daily: DailyPoint[];
  fetchedAt: string;
}

export interface AirQuality {
  aqi: number;
  pm10: number;
  pm25: number;
  no2: number;
  ozone: number;
  /** Indice UV actuel et maximum des prochaines 24 h (modèle CAMS). */
  uv: number | null;
  uvMax: number | null;
  fetchedAt: string;
}

export interface WeatherAlert {
  id: string;
  headline: string;
  description: string;
  instruction: string | null;
  /** 2 = jaune, 3 = orange, 4 = rouge. */
  level: number;
  levelLabel: string;
  areas: string[];
  onset: string | null;
  expires: string | null;
  url: string | null;
}

export interface AlertsPayload {
  /** Alertes qui concernent Genève. */
  geneva: WeatherAlert[];
  /** Nombre d'alertes en cours ailleurs en Suisse. */
  elsewhere: number;
  fetchedAt: string;
}
