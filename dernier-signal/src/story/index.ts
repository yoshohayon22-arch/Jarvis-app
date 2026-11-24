// Index de toutes les zones (journaux, hologrammes, indices, objectifs).
import { LOGS as L1, HOLOS as H1, CLUES as C1, OBJECTIVES as O1, MISSION_NAMES as M1, ROOMS as R1 } from './zone1';
import { LOGS2, HOLOS2, CLUES2, OBJECTIVES2, MISSION_NAMES2, ROOMS2 } from './zone2';
export type { LogEntry, HoloEntry, Clue } from './zone1';

export const LOGS = { ...L1, ...LOGS2 };
export const HOLOS = { ...H1, ...HOLOS2 };
export const CLUES = { ...C1, ...CLUES2 };
export const OBJECTIVES = { ...O1, ...OBJECTIVES2 };
export const MISSION_NAMES: Record<string, string> = { ...M1, ...MISSION_NAMES2 };
export const ROOMS: Record<string, string> = { ...R1, ...ROOMS2 };
export type ObjectiveKey = keyof typeof OBJECTIVES;
