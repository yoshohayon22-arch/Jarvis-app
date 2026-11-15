/**
 * Appels Open-Meteo pour Genève, faits depuis le navigateur.
 *
 * Pourquoi pas depuis le serveur ? Open-Meteo est gratuit et sans clé, mais limite
 * les requêtes par adresse IP. Les serveurs partagés (Netlify, Vercel…) dépassent
 * régulièrement ce quota (« Daily API request limit exceeded »), alors que ton navigateur
 * a son propre quota. Aucune clé n'est en jeu : rien de secret ne passe côté client.
 */
import type { AirQuality, DailyPoint, Forecast } from "./types";

const GENEVA = "latitude=46.2044&longitude=6.1432&timezone=Europe%2FZurich";
const FORECAST = "https://api.open-meteo.com/v1/forecast";
const AIR = "https://air-quality-api.open-meteo.com/v1/air-quality";
const DAILY_FIELDS =
  "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max,sunrise,sunset";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = (await res.json().catch(() => null)) as (T & { error?: boolean; reason?: string }) | null;
  if (!res.ok || !data || data.error) throw new Error(data?.reason ?? `Open-Meteo a répondu ${res.status}`);
  return data;
}

interface DailyBlock {
  time: string[];
  weather_code: (number | null)[];
  temperature_2m_max: (number | null)[];
  temperature_2m_min: (number | null)[];
  precipitation_sum: (number | null)[];
  precipitation_probability_max: (number | null)[];
  wind_gusts_10m_max: (number | null)[];
  sunrise: string[];
  sunset: string[];
}

interface ForecastResponse {
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    precipitation: number;
    weather_code: number;
    is_day: number;
    wind_speed_10m: number;
    wind_gusts_10m: number;
    wind_direction_10m: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    precipitation_probability: (number | null)[];
    precipitation: number[];
    weather_code: number[];
    wind_speed_10m: number[];
    wind_gusts_10m: number[];
    is_day: number[];
  };
  daily: DailyBlock;
}

function dailyPoint(block: DailyBlock, i: number, model: DailyPoint["model"]): DailyPoint | null {
  const code = block.weather_code[i];
  const max = block.temperature_2m_max[i];
  const min = block.temperature_2m_min[i];
  if (code == null || max == null || min == null) return null;
  return {
    date: block.time[i],
    code,
    max,
    min,
    precipitation: block.precipitation_sum[i] ?? 0,
    precipitationProbability: block.precipitation_probability_max[i],
    gusts: block.wind_gusts_10m_max[i] ?? 0,
    sunrise: block.sunrise[i].slice(11, 16),
    sunset: block.sunset[i].slice(11, 16),
    model,
  };
}

/**
 * Prévisions : modèle MétéoSuisse ICON-CH (1–2 km) pour maintenant, les 24 h et les 5 premiers jours ;
 * le modèle européen ECMWF complète les jours que ICON-CH ne couvre pas (au-delà de 120 h).
 */
export async function fetchForecast(): Promise<Forecast> {
  const [ch, ecmwf] = await Promise.all([
    getJson<ForecastResponse>(
      `${FORECAST}?${GENEVA}&models=meteoswiss_icon_seamless` +
        "&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,is_day,wind_speed_10m,wind_gusts_10m,wind_direction_10m" +
        "&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,is_day" +
        `&daily=${DAILY_FIELDS}&forecast_days=7&forecast_hours=24`,
    ),
    // Si ECMWF échoue, on garde simplement les jours MétéoSuisse.
    getJson<{ daily: DailyBlock }>(`${FORECAST}?${GENEVA}&models=ecmwf_ifs025&daily=${DAILY_FIELDS}&forecast_days=7`).catch(
      () => null,
    ),
  ]);

  const daily: DailyPoint[] = [];
  ch.daily.time.forEach((date, i) => {
    const point =
      dailyPoint(ch.daily, i, "MétéoSuisse ICON-CH") ??
      (ecmwf && ecmwf.daily.time[i] === date ? dailyPoint(ecmwf.daily, i, "ECMWF IFS") : null);
    if (point) daily.push(point);
  });

  const c = ch.current;
  return {
    current: {
      time: c.time.slice(11, 16),
      temperature: c.temperature_2m,
      apparent: c.apparent_temperature,
      humidity: c.relative_humidity_2m,
      precipitation: c.precipitation,
      code: c.weather_code,
      isDay: c.is_day === 1,
      wind: c.wind_speed_10m,
      gusts: c.wind_gusts_10m,
      windDirection: c.wind_direction_10m,
    },
    hourly: ch.hourly.time.map((iso, i) => ({
      iso,
      time: iso.slice(11, 16),
      temperature: ch.hourly.temperature_2m[i],
      precipitationProbability: ch.hourly.precipitation_probability[i],
      precipitation: ch.hourly.precipitation[i],
      code: ch.hourly.weather_code[i],
      isDay: ch.hourly.is_day[i] === 1,
      wind: ch.hourly.wind_speed_10m[i],
      gusts: ch.hourly.wind_gusts_10m[i],
    })),
    daily,
    fetchedAt: new Date().toISOString(),
  };
}

/** Qualité de l'air et indice UV (modèle européen CAMS ; les modèles ICON-CH et ECMWF ne fournissent pas l'UV). */
export async function fetchAirQuality(): Promise<AirQuality> {
  const data = await getJson<{
    current: { european_aqi: number; pm10: number; pm2_5: number; nitrogen_dioxide: number; ozone: number; uv_index: number | null };
    hourly: { uv_index: (number | null)[] };
  }>(`${AIR}?${GENEVA}&current=european_aqi,pm10,pm2_5,nitrogen_dioxide,ozone,uv_index&hourly=uv_index&forecast_hours=24`);
  const uvValues = data.hourly.uv_index.filter((v): v is number => v != null);
  return {
    aqi: data.current.european_aqi,
    pm10: data.current.pm10,
    pm25: data.current.pm2_5,
    no2: data.current.nitrogen_dioxide,
    ozone: data.current.ozone,
    uv: data.current.uv_index,
    uvMax: uvValues.length ? Math.max(...uvValues) : null,
    fetchedAt: new Date().toISOString(),
  };
}
