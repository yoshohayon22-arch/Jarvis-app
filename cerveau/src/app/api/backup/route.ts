import { exportAll, importAll, type BrainExport } from "@/lib/repo";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export function GET() {
  const data = exportAll();
  const name = `cerveau-${data.exported_at.slice(0, 10)}.json`;
  return new Response(JSON.stringify(data, null, 1), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"` },
  });
}

export async function POST(req: Request) {
  try {
    const mode = new URL(req.url).searchParams.get("mode") === "remplacer" ? "remplacer" : "fusion";
    const data = (await req.json()) as BrainExport;
    return ok({ mode, ...importAll(data, mode) });
  } catch (e) {
    return fail(e);
  }
}
