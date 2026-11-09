import { searchNodes } from "@/lib/repo";
import { ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return ok(searchNodes(q, 15).map((n) => ({ id: n.id, title: n.title, type: n.type })));
}
