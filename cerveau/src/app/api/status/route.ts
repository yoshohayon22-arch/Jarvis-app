import { aiAvailable, isMock, MODEL } from "@/lib/ai/client";
import { fail, graphVersion, ok } from "@/lib/http";
import { pendingInboxFiles } from "@/lib/inbox";
import { listFiles } from "@/lib/repo";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    return ok({
      version: graphVersion(),
      ai: aiAvailable(),
      mock: isMock(),
      model: MODEL,
      inboxPending: pendingInboxFiles().length,
      files: listFiles(8).map((f) => ({ id: f.id, name: f.original_name, status: f.status, error: f.error, created_at: f.created_at })),
    });
  } catch (e) {
    return fail(e, 500);
  }
}
