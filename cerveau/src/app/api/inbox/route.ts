import { scanInbox } from "@/lib/inbox";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  try {
    return ok(await scanInbox());
  } catch (e) {
    return fail(e, 500);
  }
}
