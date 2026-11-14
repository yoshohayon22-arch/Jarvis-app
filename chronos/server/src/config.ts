import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface RouteConfig {
  model: string;
  /** Hard cap on output tokens (thinking included). */
  maxTokens: number;
  effort: "low" | "medium" | "high" | "xhigh" | "max";
  cacheTtlSeconds: number;
}

export interface Price {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface ServerConfig {
  port: number;
  allowedOrigins: string[];
  packDir: string;
  routes: { dialogue: RouteConfig };
  budget: { dailyLimitUsd: number };
  rateLimit: { perMinute: number };
  maxBodyBytes: number;
  requestTimeoutMs: number;
  pricesPerMTok: Record<string, Price>;
}

export const SERVER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Loads config.json; environment variables override the few settings worth tuning per run. */
export function loadConfig(path = resolve(SERVER_DIR, "config.json")): ServerConfig {
  const cfg = JSON.parse(readFileSync(path, "utf8")) as ServerConfig;
  if (process.env.PORT) cfg.port = Number(process.env.PORT);
  if (process.env.CHRONOS_DIALOGUE_MODEL) cfg.routes.dialogue.model = process.env.CHRONOS_DIALOGUE_MODEL;
  if (process.env.CHRONOS_DAILY_LIMIT_USD) cfg.budget.dailyLimitUsd = Number(process.env.CHRONOS_DAILY_LIMIT_USD);
  cfg.packDir = resolve(SERVER_DIR, cfg.packDir);
  return cfg;
}
