import type { DialogueReply, FactionId } from "@chronos/shared";

type Mood = "hostile" | "wary" | "neutral" | "friendly";

export interface FallbackData {
  greeting: Record<Mood, string[]>;
  topics: { keywords: string[]; lines: string[] }[];
  default: Record<Mood, string[]>;
  barks: Record<FactionId, string[]>;
}

export const moodOf = (opinion: number): Mood => (opinion <= -40 ? "hostile" : opinion <= -12 ? "wary" : opinion >= 25 ? "friendly" : "neutral");

const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Local reply used when the AI cannot answer (no key, budget reached, network
 * or validation error). Picks a line from the pack by topic keywords and mood.
 * `roll` is a number in [0, 1) so the caller controls randomness.
 */
export function localReply(data: FallbackData, playerText: string, opinion: number, firstTurn: boolean, roll: number): DialogueReply {
  const mood = moodOf(opinion);
  const text = normalize(playerText);
  const pick = (lines: string[]) => lines[Math.floor(roll * lines.length) % lines.length] ?? "…";
  let line: string;
  const topic = mood === "hostile" ? undefined : data.topics.find((t) => t.keywords.some((k) => text.includes(normalize(k))));
  if (topic) line = pick(topic.lines);
  else if (firstTurn && /\b(bonjour|salut|bonsoir|hola|coucou)\b/.test(text)) line = pick(data.greeting[mood]);
  else line = pick(data.default[mood]);
  return {
    line,
    emotion: mood === "hostile" ? "angry" : mood === "wary" ? "wary" : mood === "friendly" ? "friendly" : "neutral",
    intent: mood === "hostile" ? "refuse" : topic ? "inform" : "chat",
    relationshipDelta: 0,
    revealSecret: -1,
  };
}

/** One-liner for extras, who never use AI. */
export function bark(data: FallbackData, faction: FactionId, opinion: number, roll: number): string {
  const mood = moodOf(opinion);
  const lines = mood === "hostile" || mood === "wary" ? data.greeting[mood] : data.barks[faction];
  return lines[Math.floor(roll * lines.length) % lines.length] ?? "…";
}
