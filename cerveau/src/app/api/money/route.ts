import { moneySummary } from "@/lib/repo";
import { ok } from "@/lib/http";
import { currentMonth } from "@/lib/text";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const m = new URL(req.url).searchParams.get("month");
  return ok(moneySummary(m && /^\d{4}-\d{2}$/.test(m) ? m : currentMonth()));
}
