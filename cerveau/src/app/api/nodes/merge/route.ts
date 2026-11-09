import { getNodeDetail, mergeNodes } from "@/lib/repo";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { from, into } = (await req.json()) as { from?: string; into?: string };
    if (!from || !into) return fail(new Error("Il faut deux neurones à fusionner"));
    mergeNodes(from, into);
    return ok(getNodeDetail(into));
  } catch (e) {
    return fail(e);
  }
}
