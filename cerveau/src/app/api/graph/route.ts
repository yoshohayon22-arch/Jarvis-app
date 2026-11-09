import { getGraph } from "@/lib/repo";
import { fail, graphVersion, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    return ok({ ...getGraph(), version: graphVersion() });
  } catch (e) {
    return fail(e, 500);
  }
}
