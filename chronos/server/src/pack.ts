import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CharacterDef } from "@chronos/shared";

export interface ServerPack {
  lore: string;
  characters: Map<string, CharacterDef>;
}

/** The proxy loads character sheets itself: the browser only names a character, it cannot rewrite one. */
export function loadPack(dir: string): ServerPack {
  const lore = readFileSync(join(dir, "lore.md"), "utf8");
  const { characters } = JSON.parse(readFileSync(join(dir, "characters.json"), "utf8")) as { characters: CharacterDef[] };
  return { lore, characters: new Map(characters.map((c) => [c.id, c])) };
}
