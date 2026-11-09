import { upsertEdge } from "@/lib/repo";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { source, target, label } = (await req.json()) as { source?: string; target?: string; label?: string };
    const id = source && target ? upsertEdge(source, target, label || "lié à") : null;
    return id ? ok({ id }) : fail(new Error("Lien impossible"));
  } catch (e) {
    return fail(e);
  }
}
