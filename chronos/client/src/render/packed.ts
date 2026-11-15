/**
 * Packed assets: for hosts that only serve web file types (no .glb/.exr), the
 * binary models and HDRIs are shipped as base64 inside JSON files and decoded
 * here. Enabled at build time with VITE_PACKED=1; a normal build never uses this.
 */
export const PACKED = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_PACKED === "1";

const files = new Map<string, ArrayBuffer>();
let loading: Promise<void> | null = null;

function decode(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

/** Downloads every pack once. `root` is the assets folder URL. */
export function loadPacks(root: string, onProgress?: (done: number, total: number) => void): Promise<void> {
  loading ??= (async () => {
    const index = (await (await fetch(`${root}packs/index.json`)).json()) as { packs: string[] };
    let done = 0;
    await Promise.all(
      index.packs.map(async (name) => {
        const pack = (await (await fetch(`${root}packs/${name}`)).json()) as { files: Record<string, string> };
        for (const [path, b64] of Object.entries(pack.files)) files.set(path, decode(b64));
        onProgress?.(++done, index.packs.length);
      }),
    );
  })();
  return loading;
}

/** The bytes of a packed file (path relative to the assets folder), or null. */
export function packedFile(path: string): ArrayBuffer | null {
  return files.get(path) ?? null;
}
