// Fichiers (dossier inbox + glisser-déposer) → copie locale, miniature, analyse IA (vision / PDF / Word) → neurones.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { FILES_DIR, db } from "./db";
import { aiAvailable, structuredCall, AIError } from "./ai/client";
import { EXTRACTION_SYSTEM, FILE_EXTRACTION_ADDENDUM } from "./ai/prompts";
import { FileExtractionSchema } from "./ai/schemas";
import { applyExtraction, formatCandidates, mockExtraction, todayFr } from "./extract";
import {
  candidateNodes,
  createSource,
  findFileBySha,
  getFile,
  insertFile,
  insertNode,
  linkSource,
  setFileStatus,
  updateNode,
} from "./repo";
import type { CaptureResult } from "./types";

const IMAGE_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};
const OTHER_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
  ".md": "text/markdown",
};
export const SUPPORTED_EXT = [...Object.keys(IMAGE_EXT), ...Object.keys(OTHER_EXT)];

export function mimeFor(name: string): string | null {
  const ext = path.extname(name).toLowerCase();
  return IMAGE_EXT[ext] ?? OTHER_EXT[ext] ?? null;
}
export const isImage = (mime: string) => mime.startsWith("image/");

export function filePath(stored: string) {
  return path.join(FILES_DIR, stored);
}
export function thumbPath(id: string) {
  return path.join(FILES_DIR, `${id}.thumb.webp`);
}

async function extractPlainText(buf: Buffer, mime: string): Promise<string> {
  if (mime === "application/pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await extractText(pdf, { mergePages: true });
    return String(text);
  }
  if (mime.includes("wordprocessingml")) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return value;
  }
  if (mime.startsWith("text/")) return buf.toString("utf8");
  return "";
}

/** Image redimensionnée (≤ 1568 px, JPEG) pour l'IA + miniature 480 px pour l'interface. */
async function prepareImage(buf: Buffer, id: string): Promise<{ data: string; media: "image/jpeg" }> {
  const sharp = (await import("sharp")).default;
  await sharp(buf).rotate().resize(480, 480, { fit: "inside", withoutEnlargement: true }).webp({ quality: 78 }).toFile(thumbPath(id));
  const out = await sharp(buf)
    .rotate()
    .resize(1568, 1568, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 85 })
    .toBuffer();
  return { data: out.toString("base64"), media: "image/jpeg" };
}

export interface FileResult extends CaptureResult {
  fileId: string;
  docNodeId: string | null;
  duplicate?: boolean;
}

export async function processFile(buf: Buffer, originalName: string, kind: "inbox" | "depot"): Promise<FileResult> {
  const mime = mimeFor(originalName);
  if (!mime) throw new Error(`Format non pris en charge : ${path.extname(originalName) || originalName} (PDF, DOCX, PNG, JPG, WEBP, GIF, TXT, MD)`);
  if (buf.length > 30 * 1024 * 1024) throw new Error("Fichier trop lourd (max 30 Mo)");

  const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
  const already = findFileBySha(sha256);
  if (already && already.status === "traite") {
    return { fileId: already.id, docNodeId: null, sourceId: "", created: [], updated: [], edges: [], fallback: false, duplicate: true, message: "Fichier déjà analysé." };
  }

  let fileId = already?.id;
  if (!fileId) {
    fileId = `f_${sha256.slice(0, 16)}`;
    const stored = `${fileId}${path.extname(originalName).toLowerCase()}`;
    fs.writeFileSync(filePath(stored), buf);
    insertFile({ id: fileId, original_name: originalName, stored_name: stored, mime, size: buf.length, sha256 });
  }

  // Neurone « document » qui représente le fichier lui-même.
  const prev = db().prepare("SELECT id FROM nodes WHERE file_id = ? AND type = 'document'").get(fileId) as { id: string } | undefined;
  const docNodeId = prev?.id ?? insertNode({
    type: "document",
    title: path.basename(originalName, path.extname(originalName)).slice(0, 80),
    summary: "",
    url: `/api/files/${fileId}`,
    file_id: fileId,
    origin: kind,
    tags: ["fichier"],
  });

  try {
    let plain = "";
    const blocks: Anthropic.Beta.BetaContentBlockParam[] = [];
    if (isImage(mime)) {
      const img = await prepareImage(buf, fileId);
      blocks.push({ type: "image", source: { type: "base64", media_type: img.media, data: img.data } });
    } else if (mime === "application/pdf") {
      plain = await extractPlainText(buf, mime).catch(() => "");
      blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: buf.toString("base64") } });
    } else {
      plain = await extractPlainText(buf, mime);
      blocks.push({ type: "text", text: `Contenu du fichier :\n"""\n${plain.slice(0, 60_000)}\n"""` });
    }

    const candidates = candidateNodes(`${originalName} ${plain.slice(0, 4000)}`);
    let result;
    let fallback = false;
    let message: string | undefined;

    if (aiAvailable()) {
      const ex = await structuredCall({
        schema: FileExtractionSchema,
        system: EXTRACTION_SYSTEM + FILE_EXTRACTION_ADDENDUM,
        effort: "medium",
        maxTokens: 12000,
        content: [
          ...blocks,
          {
            type: "text",
            text: `Date du jour : ${todayFr()}
Nom du fichier : ${originalName}

Neurones existants (id | type | titre | tags) :
${formatCandidates(candidates)}

Range ce fichier dans le cerveau.`,
          },
        ],
      });
      updateNode(docNodeId, { title: ex.document.titre || undefined, summary: ex.document.resume, tags: ["fichier", ...ex.document.tags] });
      const sourceId = createSource(ex.document.texte_cle || plain.slice(0, 4000) || `[${originalName}]`, kind, fileId);
      linkSource(docNodeId, sourceId);
      result = { sourceId, ...applyExtraction(ex, { sourceId, origin: kind, docNodeId, fileId }) };
    } else {
      fallback = true;
      message = plain ? "Pas d'IA : texte gardé, rangement simplifié." : "Pas d'IA : fichier gardé sans analyse.";
      const sourceId = createSource(plain.slice(0, 4000) || `[${originalName}]`, kind, fileId);
      linkSource(docNodeId, sourceId);
      if (plain.trim()) {
        updateNode(docNodeId, { summary: plain.trim().slice(0, 300) });
        const ex = mockExtraction(plain.slice(0, 2000), candidates);
        // En mode simplifié, on ne garde que les liens vers l'existant, rattachés au document.
        const liens = ex.liens.map((l) => ({ ...l, de: "doc" }));
        result = { sourceId, ...applyExtraction({ neurones: [], liens }, { sourceId, origin: kind, docNodeId, fileId }) };
      } else {
        result = { sourceId, created: [], updated: [], edges: [] };
      }
    }
    setFileStatus(fileId, "traite");
    return { ...result, created: [docNodeId, ...result.created], fileId, docNodeId: docNodeId, fallback, message };
  } catch (e) {
    const msg = e instanceof AIError || e instanceof Error ? e.message : String(e);
    setFileStatus(fileId, "erreur", msg);
    updateNode(docNodeId, { summary: `Analyse impossible : ${msg}` }, { touch: false });
    return { fileId, docNodeId, sourceId: "", created: [docNodeId], updated: [], edges: [], fallback: true, message: `Fichier gardé, analyse impossible : ${msg}` };
  }
}

export function fileForDisplay(id: string) {
  const f = getFile(id);
  if (!f) return null;
  return { file: f, path: filePath(f.stored_name), thumb: fs.existsSync(thumbPath(id)) ? thumbPath(id) : null };
}
