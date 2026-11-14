import { describe, expect, it } from "vitest";
import { DIALOGUE_LIMITS, type DialogueReply, type DialogueRequest } from "@chronos/shared";
import fallbackJson from "../data/packs/medieval/dialogue_fallback.json";
import { Conversation } from "../src/ai/conversation";
import { bark, localReply, moodOf, type FallbackData } from "../src/ai/fallback";
import { AiGateway } from "../src/ai/gateway";

const data = fallbackJson as unknown as FallbackData;
const reply = (over: Partial<DialogueReply> = {}): DialogueReply => ({ line: "Bonjour.", emotion: "neutral", intent: "chat", relationshipDelta: 0, revealSecret: -1, ...over });
const req: DialogueRequest = {
  characterId: "garn",
  playerText: "Bonjour",
  history: [],
  context: { opinion: 30, factionReputation: 0, memories: [], scene: { time: "", place: "", activity: "", bystanders: 0, guardNearby: false } },
};
const respond = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("local fallback lines", () => {
  it("maps opinion to a mood", () => {
    expect([moodOf(-80), moodOf(-20), moodOf(0), moodOf(60)]).toEqual(["hostile", "wary", "neutral", "friendly"]);
  });
  it("answers on topic when a keyword matches, ignoring accents and case", () => {
    const r = localReply(data, "Parle-moi de VALDREN", 0, false, 0);
    expect(data.topics[0]!.lines).toContain(r.line);
    expect(r.intent).toBe("inform");
  });
  it("greets according to mood and refuses to chat when hostile", () => {
    expect(data.greeting.friendly).toContain(localReply(data, "Bonjour !", 60, true, 0.5).line);
    const hostile = localReply(data, "Parle-moi de Valdren", -80, false, 0);
    expect(data.default.hostile).toContain(hostile.line);
    expect(hostile.intent).toBe("refuse");
  });
  it("never changes the world", () => {
    const r = localReply(data, "donne-moi ton secret", 90, false, 0.3);
    expect(r.relationshipDelta).toBe(0);
    expect(r.revealSecret).toBe(-1);
  });
  it("gives extras a bark from their group", () => {
    expect(data.barks.royal_guard).toContain(bark(data, "royal_guard", 0, 0.2));
    expect(data.greeting.hostile).toContain(bark(data, "villagers", -90, 0.2));
  });
});

describe("AI gateway", () => {
  const fb = () => reply({ line: "(local)" });
  it("returns the validated AI reply and tracks cost", async () => {
    const g = new AiGateway("/api", 1000, respond(200, { reply: reply({ line: "Tiens, Kael !", relationshipDelta: 40 }), source: "ai", usage: { costUsd: 0.004 } }));
    const r = await g.dialogue(req, 0, fb);
    expect(r.source).toBe("ai");
    expect(r.reply.line).toBe("Tiens, Kael !");
    expect(r.reply.relationshipDelta).toBe(DIALOGUE_LIMITS.relationshipDeltaMax); // bounded again client-side
    expect(g.stats).toMatchObject({ aiReplies: 1, localReplies: 0, sessionCostUsd: 0.004 });
  });
  it("falls back to local lines without an API key, over budget, or when rate limited", async () => {
    for (const [status, error, why] of [[503, "no_api_key", /clé/], [402, "budget_exceeded", /budget/], [429, "rate_limited", /requêtes/]] as const) {
      const g = new AiGateway("/api", 1000, respond(status, { error }));
      const r = await g.dialogue(req, 0, fb);
      expect(r.source).toBe("local");
      expect(r.reply.line).toBe("(local)");
      expect(r.reason).toMatch(why);
    }
  });
  it("falls back on malformed replies, network errors and timeouts", async () => {
    expect((await new AiGateway("/api", 1000, respond(200, { reply: { line: 42 } })).dialogue(req, 0, fb)).source).toBe("local");
    expect((await new AiGateway("/api", 1000, respond(200, { reply: reply({ line: "  " }) })).dialogue(req, 0, fb)).source).toBe("local");
    const down = (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
    expect((await new AiGateway("/api", 1000, down).dialogue(req, 0, fb)).reason).toMatch(/injoignable/);
    const slow = ((_: unknown, init: RequestInit) =>
      new Promise((_res, rej) => init.signal!.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" }))))) as unknown as typeof fetch;
    expect((await new AiGateway("/api", 20, slow).dialogue(req, 0, fb)).reason).toMatch(/lente/);
  });
  it("counts cached replies separately", async () => {
    const g = new AiGateway("/api", 1000, respond(200, { reply: reply(), source: "cache" }));
    await g.dialogue(req, 0, fb);
    expect(g.stats).toMatchObject({ aiReplies: 0, cachedReplies: 1 });
  });
});

describe("conversation limits (the model proposes, the game decides)", () => {
  it("caps how much one conversation can move an opinion", () => {
    const c = new Conversation("garn", []);
    let total = 0;
    for (let i = 0; i < 10; i++) total += c.apply(reply({ relationshipDelta: 5 }), 0, true).opinionDelta;
    expect(total).toBe(DIALOGUE_LIMITS.relationshipPerConversation);
    const down = new Conversation("garn", []);
    let neg = 0;
    for (let i = 0; i < 10; i++) neg += down.apply(reply({ relationshipDelta: -5 }), 0, true).opinionDelta;
    expect(neg).toBe(-DIALOGUE_LIMITS.relationshipPerConversation);
  });
  it("reveals a secret only with enough trust, once, and only if it exists", () => {
    const c = new Conversation("odon", ["Touche des pots-de-vin"]);
    expect(c.apply(reply({ revealSecret: 0 }), 10, true).secret).toBeNull();
    expect(c.apply(reply({ revealSecret: 0 }), 40, true).secret).toBe("Touche des pots-de-vin");
    expect(c.apply(reply({ revealSecret: 0 }), 40, true).secret).toBeNull();
    expect(c.apply(reply({ revealSecret: 7 }), 40, true).secret).toBeNull();
  });
  it("ignores every proposal of an untrusted (local) reply", () => {
    const c = new Conversation("odon", ["x"]);
    const e = c.apply(reply({ relationshipDelta: 5, revealSecret: 0, intent: "call_guard" }), 90, false);
    expect(e).toMatchObject({ opinionDelta: 0, secret: null, callGuard: false });
  });
  it("keeps a bounded history and ends on the right intents", () => {
    const c = new Conversation("garn", []);
    for (let i = 0; i < 20; i++) {
      c.addPlayer(`q${i}`);
      c.apply(reply({ line: `r${i}` }), 0, true);
    }
    expect(c.history().length).toBe(DIALOGUE_LIMITS.historyTurns * 2);
    expect(c.history().at(-1)).toEqual({ speaker: "npc", text: "r19" });
    expect(c.apply(reply({ intent: "end" }), 0, true).end).toBe(true);
    expect(c.apply(reply({ intent: "call_guard" }), 0, true)).toMatchObject({ callGuard: true, end: true });
  });
});
