export interface EffectDef {
  primitive: "timeScaleZone" | "freezeTargets" | "rewindLocal" | "timeLoop" | "grab" | "shove" | "invisibility";
  radius?: number;
  scale?: number;
  maxTargets?: number;
  window?: number;
  range?: number;
  loops?: number;
  throwSpeed?: number;
  distance?: number;
  /** Telekinesis on people: not allowed (undefined), set down gently, or thrown. */
  people?: "gentle" | "violent";
  stillDrainFactor?: number;
  theftMultiplier?: number;
}

export interface AbilityDef {
  id: string;
  name: string;
  /** KeyboardEvent.code that triggers it (base and standalone abilities). */
  key?: string;
  path: "base" | "hero" | "dark";
  cost?: number;
  cooldown?: number;
  duration?: number;
  drainPerSecond?: number;
  description: string;
  effects?: EffectDef[];
  /** Act committed on the target (crimes); otherwise only the power's generic witness act applies. */
  act?: string;
  /** For branch upgrades: id of the base ability this one modifies. */
  upgrades?: string;
  unlock?: { heroActs?: number; darkActs?: number };
  /** Fields overriding the upgraded ability once unlocked. */
  set?: Partial<Pick<AbilityDef, "cost" | "cooldown" | "duration" | "drainPerSecond" | "effects">>;
}

export interface PowerDef {
  id: string;
  name: string;
  enabled: boolean;
  vfx?: string;
  witnessAct?: string;
  planned?: string;
  description?: string;
  abilities: AbilityDef[];
}

export interface PowersData {
  energy: { max: number; regenPerSecond: number; regenRestingBonus: number };
  powers: PowerDef[];
}

/** Visual cue emitted by the engine; the renderer turns each into its dedicated effect. */
export interface PowerFx {
  kind: "zone" | "freeze" | "rewind" | "loop" | "grab" | "throw" | "shove" | "cloak" | "uncloak";
  vfx: string;
  x: number;
  z: number;
  radius?: number;
  /** Seconds. */
  duration?: number;
}

export type CastFailure = "unknown" | "disabled" | "locked" | "cooldown" | "energy" | "no_target";

export interface CastResult {
  ok: boolean;
  reason?: CastFailure;
  ability?: AbilityDef;
}
