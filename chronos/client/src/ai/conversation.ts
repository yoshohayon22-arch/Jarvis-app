import { DIALOGUE_LIMITS, type DialogueReply } from "@chronos/shared";

export interface Turn {
  speaker: "player" | "npc";
  text: string;
}

export interface ReplyEffects {
  /** Opinion change actually applied (after the per-conversation cap). */
  opinionDelta: number;
  /** Secret text revealed this turn, if any. */
  secret: string | null;
  callGuard: boolean;
  end: boolean;
}

/**
 * One conversation with a key character. Holds the history and enforces the
 * game-side limits on what a reply may change — the model proposes, this decides.
 */
export class Conversation {
  readonly turns: Turn[] = [];
  private opinionMoved = 0;
  private readonly revealed = new Set<number>();

  constructor(
    readonly characterId: string,
    private readonly secrets: readonly string[],
  ) {}

  /** History to send with the next request (bounded). */
  history(): Turn[] {
    return this.turns.slice(-DIALOGUE_LIMITS.historyTurns * 2);
  }

  addPlayer(text: string): void {
    this.turns.push({ speaker: "player", text });
  }

  /**
   * Records the reply and computes its effects.
   * @param opinion the character's current opinion of the player (gates secrets)
   * @param trusted false for local fallback lines, which never change anything
   */
  apply(reply: DialogueReply, opinion: number, trusted: boolean): ReplyEffects {
    this.turns.push({ speaker: "npc", text: reply.line });
    const L = DIALOGUE_LIMITS;
    let delta = 0;
    if (trusted) {
      const want = Math.max(-L.relationshipDeltaMax, Math.min(L.relationshipDeltaMax, Math.round(reply.relationshipDelta) || 0));
      const room = want > 0 ? L.relationshipPerConversation - this.opinionMoved : -L.relationshipPerConversation - this.opinionMoved;
      delta = want > 0 ? Math.max(0, Math.min(want, room)) : Math.min(0, Math.max(want, room));
      this.opinionMoved += delta;
    }
    let secret: string | null = null;
    const i = reply.revealSecret;
    if (trusted && opinion >= L.secretTrust && Number.isInteger(i) && i >= 0 && i < this.secrets.length && !this.revealed.has(i)) {
      this.revealed.add(i);
      secret = this.secrets[i] as string;
    }
    return { opinionDelta: delta, secret, callGuard: trusted && reply.intent === "call_guard", end: reply.intent === "end" || reply.intent === "call_guard" };
  }
}
