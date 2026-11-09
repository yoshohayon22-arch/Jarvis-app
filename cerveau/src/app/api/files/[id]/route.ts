import fs from "node:fs";
import { fileForDisplay } from "@/lib/files";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const f = fileForDisplay(id);
  if (!f || !fs.existsSync(f.path)) return new Response("Fichier introuvable", { status: 404 });
  const wantThumb = new URL(req.url).searchParams.get("thumb") === "1";
  const p = wantThumb && f.thumb ? f.thumb : f.path;
  const type = wantThumb && f.thumb ? "image/webp" : f.file.mime;
  return new Response(new Uint8Array(fs.readFileSync(p)), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(f.file.original_name)}`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
