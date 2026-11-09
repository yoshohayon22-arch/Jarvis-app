import { forgottenOfTheDay } from "@/lib/forgotten";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const refresh = new URL(req.url).searchParams.get("refresh") === "1";
    return ok(await forgottenOfTheDay({ refresh }));
  } catch (e) {
    return fail(e, 500);
  }
}
