import { processFile } from "@/lib/files";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (!files.length) return fail(new Error("Aucun fichier reçu"));
    const results = [];
    for (const f of files) {
      try {
        results.push({ name: f.name, ...(await processFile(Buffer.from(await f.arrayBuffer()), f.name, "depot")) });
      } catch (e) {
        results.push({ name: f.name, error: e instanceof Error ? e.message : String(e) });
      }
    }
    return ok({ results });
  } catch (e) {
    return fail(e, 500);
  }
}
