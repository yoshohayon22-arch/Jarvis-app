import { capture } from "@/lib/extract";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { text?: string; kind?: string };
    if (!body.text?.trim()) return fail(new Error("Écris quelque chose à ranger."));
    return ok(await capture(body.text, body.kind === "dictee" ? "dictee" : "saisie"));
  } catch (e) {
    return fail(e, 500);
  }
}
