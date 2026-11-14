import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import { ChronosApp } from "./app.js";
import { Budget } from "./budget.js";
import { SERVER_DIR, loadConfig } from "./config.js";
import { AnthropicLlm, MockLlm, type DialogueLlm } from "./llm.js";
import { loadPack } from "./pack.js";

const config = loadConfig();
const pack = loadPack(config.packDir);
const hasKey = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const llm: DialogueLlm | null = process.env.CHRONOS_MOCK === "1" ? new MockLlm() : hasKey ? new AnthropicLlm() : null;
const app = new ChronosApp(config, pack, llm, new Budget(config.budget.dailyLimitUsd, resolve(SERVER_DIR, ".data/budget.json")));

/** Configured origins, plus any port on this machine (the proxy only listens on 127.0.0.1). */
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const originAllowed = (origin: string) => config.allowedOrigins.includes(origin) || LOCAL_ORIGIN.test(origin);

function send(res: ServerResponse, origin: string | undefined, status: number, body: unknown): void {
  const headers: Record<string, string> = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
  if (origin && originAllowed(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
    headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage, max: number): Promise<unknown> {
  return new Promise((resolveBody, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > max) {
        reject(new Error("too_large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("bad_json"));
      }
    });
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin;
  const url = (req.url ?? "").split("?")[0];
  try {
    if (req.method === "OPTIONS") return send(res, origin, 204, {});
    // Browsers from other sites may not use this proxy.
    if (origin && !originAllowed(origin)) return send(res, origin, 403, { error: "origin_not_allowed" });
    if (req.method === "GET" && url === "/api/health") return send(res, origin, 200, { ok: true });
    if (req.method === "GET" && url === "/api/budget") return send(res, origin, 200, app.status());
    if (req.method === "POST" && (url === "/api/dialogue" || url === "/api/mission")) {
      let body: unknown;
      try {
        body = await readBody(req, config.maxBodyBytes);
      } catch (e) {
        return send(res, origin, (e as Error).message === "too_large" ? 413 : 400, { error: (e as Error).message });
      }
      const client = req.socket.remoteAddress ?? "local";
      const r = url === "/api/mission" ? await app.mission(body, client) : await app.dialogue(body, client);
      return send(res, origin, r.status, r.body);
    }
    return send(res, origin, 404, { error: "not_found" });
  } catch {
    return send(res, origin, 500, { error: "internal_error" });
  }
});

server.listen(config.port, "127.0.0.1", () => {
  const mode = llm ? (llm.kind === "mock" ? "SIMULATION (CHRONOS_MOCK=1, aucun appel réel)" : `IA réelle — modèle ${config.routes.dialogue.model}`) : "SANS CLÉ : le jeu utilisera ses répliques locales";
  console.log(`[chronos] proxy sur http://127.0.0.1:${config.port} — ${mode}`);
  console.log(`[chronos] budget journalier : ${config.budget.dailyLimitUsd} $`);
});
