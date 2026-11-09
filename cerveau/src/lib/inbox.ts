// Surveillance du dossier inbox/ : chaque fichier déposé est analysé puis rangé dans inbox/traites/.
import fs from "node:fs";
import path from "node:path";
import { INBOX_DIR } from "./db";
import { processFile, SUPPORTED_EXT } from "./files";

const DONE_DIR = () => path.join(INBOX_DIR, "traites");
const ERR_DIR = () => path.join(INBOX_DIR, "erreurs");
const IGNORED = new Set(["lisezmoi.txt", ".ds_store", "thumbs.db", "desktop.ini"]);

declare global {
  var __cerveauInbox: { running: boolean; timer?: NodeJS.Timeout; watcher?: fs.FSWatcher } | undefined;
}
const state = () => (globalThis.__cerveauInbox ??= { running: false });

function moveTo(dir: string, file: string) {
  fs.mkdirSync(dir, { recursive: true });
  let dest = path.join(dir, path.basename(file));
  if (fs.existsSync(dest)) {
    const ext = path.extname(dest);
    dest = path.join(dir, `${path.basename(dest, ext)}-${Date.now()}${ext}`);
  }
  fs.renameSync(file, dest);
}

export function pendingInboxFiles(): string[] {
  if (!fs.existsSync(INBOX_DIR)) return [];
  return fs
    .readdirSync(INBOX_DIR, { withFileTypes: true })
    .filter((e) => e.isFile() && !e.name.startsWith(".") && !IGNORED.has(e.name.toLowerCase()))
    .map((e) => path.join(INBOX_DIR, e.name));
}

/** Analyse tous les fichiers en attente. Renvoie le nombre de fichiers traités. */
export async function scanInbox(): Promise<{ processed: number; errors: string[] }> {
  const s = state();
  if (s.running) return { processed: 0, errors: [] };
  s.running = true;
  const errors: string[] = [];
  let processed = 0;
  try {
    for (const file of pendingInboxFiles()) {
      const name = path.basename(file);
      // Attendre que le fichier ait fini d'être copié (taille stable).
      const size1 = fs.statSync(file).size;
      await new Promise((r) => setTimeout(r, 800));
      if (!fs.existsSync(file) || fs.statSync(file).size !== size1) continue;
      if (!SUPPORTED_EXT.includes(path.extname(name).toLowerCase())) {
        errors.push(`${name} : format non pris en charge`);
        moveTo(ERR_DIR(), file);
        continue;
      }
      try {
        const res = await processFile(fs.readFileSync(file), name, "inbox");
        if (res.message && res.fallback) errors.push(`${name} : ${res.message}`);
        moveTo(DONE_DIR(), file);
        processed++;
        console.log(`[cerveau] inbox : ${name} → ${res.created.length} neurone(s)`);
      } catch (e) {
        errors.push(`${name} : ${e instanceof Error ? e.message : String(e)}`);
        moveTo(ERR_DIR(), file);
      }
    }
  } finally {
    s.running = false;
  }
  return { processed, errors };
}

export function startInboxWatcher() {
  const s = state();
  if (s.timer) return;
  fs.mkdirSync(INBOX_DIR, { recursive: true });
  const tick = () => scanInbox().catch((e) => console.error("[cerveau] inbox :", e));
  s.timer = setInterval(tick, 10_000);
  try {
    let t: NodeJS.Timeout | undefined;
    s.watcher = fs.watch(INBOX_DIR, () => {
      clearTimeout(t);
      t = setTimeout(tick, 1500);
    });
  } catch {
    /* fs.watch indisponible : le minuteur suffit */
  }
  setTimeout(tick, 2000);
  console.log(`[cerveau] surveillance du dossier ${INBOX_DIR}`);
}
