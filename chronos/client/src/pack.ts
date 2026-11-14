import type { PackManifest, WorldLayout } from "@chronos/shared";
import manifest from "../data/packs/medieval/pack.json";
import layout from "../data/packs/medieval/layout.json";

export interface LoadedPack {
  manifest: PackManifest;
  layout: WorldLayout;
}

/** V1 ships one era pack, bundled at build time. Later packs can be fetched lazily. */
export function loadDefaultPack(): LoadedPack {
  return { manifest: manifest as PackManifest, layout: layout as WorldLayout };
}
