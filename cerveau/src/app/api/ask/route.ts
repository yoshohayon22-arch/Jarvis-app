import { ask } from "@/lib/ask";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const { question } = (await req.json()) as { question?: string };
    if (!question?.trim()) return fail(new Error("Pose une question."));
    return ok(await ask(question));
  } catch (e) {
    return fail(e, 500);
  }
}
