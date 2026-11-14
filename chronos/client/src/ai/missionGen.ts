import { MISSION_LIMITS, type MissionIntent, type MissionProposal, type MissionRequest } from "@chronos/shared";
import type { MissionDraft } from "./gateway";

/** What the generator needs from the missions runtime (kept small so it can be tested alone). */
export interface MissionHost {
  request(intent: MissionIntent, giverId: string, attempt: number, previousErrors: string[]): MissionRequest;
  validate(proposal: unknown, intent: MissionIntent, giverId: string): string[];
  fromTemplate(intent: MissionIntent, giverId: string): MissionProposal | null;
}

export interface GeneratedMission {
  proposal: MissionProposal;
  source: "ai" | "mock" | "template";
  /** How many times the model was asked. */
  attempts: number;
  /** Why earlier drafts were refused (for the debug panel). */
  rejections: string[][];
  /** Why the local template was used, if it was. */
  fallbackReason: string | null;
  costUsd: number;
}

/**
 * The whole chain: ask the model → validate with the game's rules → ask again
 * with the errors (limited) → local template. The model only ever proposes.
 * Returns null only if not even a template fits (nobody available to cast).
 */
export async function generateMission(
  host: MissionHost,
  ask: (req: MissionRequest) => Promise<MissionDraft>,
  intent: MissionIntent,
  giverId: string,
): Promise<GeneratedMission | null> {
  const rejections: string[][] = [];
  let attempts = 0;
  let costUsd = 0;
  let fallbackReason: string | null = null;
  let errors: string[] = [];
  for (let attempt = 0; attempt <= MISSION_LIMITS.regenerations; attempt++) {
    const draft = await ask(host.request(intent, giverId, attempt, errors));
    if (!draft.ok) {
      // No proxy, no key, no budget: asking again would not help.
      fallbackReason = draft.reason;
      break;
    }
    attempts++;
    costUsd += draft.costUsd;
    errors = host.validate(draft.mission, intent, giverId);
    if (errors.length === 0) return { proposal: draft.mission as MissionProposal, source: draft.source, attempts, rejections, fallbackReason: null, costUsd };
    rejections.push(errors);
    fallbackReason = `${attempts} proposition${attempts > 1 ? "s" : ""} refusée${attempts > 1 ? "s" : ""} par les règles du jeu`;
  }
  const proposal = host.fromTemplate(intent, giverId);
  if (!proposal) return null;
  return { proposal, source: "template", attempts, rejections, fallbackReason, costUsd };
}
