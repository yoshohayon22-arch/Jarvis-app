import { deleteNode, getNodeDetail, updateNode, type NodePatch } from "@/lib/repo";
import { fail, ok } from "@/lib/http";
import { NODE_TYPES } from "@/lib/types";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const detail = getNodeDetail(decodeURIComponent(id));
  return detail ? ok(detail) : fail(new Error("Neurone introuvable"), 404);
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    const patch: NodePatch = {};
    if (typeof body.title === "string") {
      if (!body.title.trim()) return fail(new Error("Le titre ne peut pas être vide"));
      patch.title = body.title;
    }
    if (typeof body.summary === "string") patch.summary = body.summary;
    if (typeof body.type === "string" && (NODE_TYPES as readonly string[]).includes(body.type)) patch.type = body.type as NodePatch["type"];
    if (Array.isArray(body.tags)) patch.tags = body.tags.map(String);
    if ("url" in body) patch.url = body.url ? String(body.url) : null;
    if ("amount" in body) patch.amount = body.amount === null || body.amount === "" ? null : Number(body.amount);
    if ("currency" in body) patch.currency = body.currency ? String(body.currency).toUpperCase() : null;
    if ("direction" in body) patch.direction = body.direction === "rentree" ? "rentree" : body.direction === "depense" ? "depense" : null;
    if ("category" in body) patch.category = body.category ? String(body.category) : null;
    if ("occurred_at" in body) patch.occurred_at = body.occurred_at ? String(body.occurred_at) : null;
    updateNode(decodeURIComponent(id), patch, { userEdit: true });
    return ok(getNodeDetail(decodeURIComponent(id)));
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  deleteNode(decodeURIComponent(id));
  return ok({ deleted: true });
}
