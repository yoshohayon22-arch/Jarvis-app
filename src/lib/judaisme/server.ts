import "server-only";

import { cached } from "@/lib/server-cache";
import { createJudaism, type JsonGet } from "./core";

/** Version serveur des lecteurs Hebcal / Sefaria : appels directs avec délai maximal, cache en mémoire. */
const get: JsonGet = async <T>(url: string): Promise<T> => {
  const source = url.includes("sefaria") ? "Sefaria" : "Hebcal";
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) }).catch((e: unknown) => {
    throw new Error(e instanceof Error && e.name === "TimeoutError" ? `${source} n'a pas répondu en 15 secondes` : `${source} est injoignable`);
  });
  if (!res.ok) throw new Error(`${source} a répondu ${res.status}`);
  return (await res.json()) as T;
};

export const { getCalendar, loadStudy } = createJudaism(get, cached);
