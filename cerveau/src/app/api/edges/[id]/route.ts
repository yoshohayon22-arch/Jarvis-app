import { deleteEdge } from "@/lib/repo";
import { ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  deleteEdge(id);
  return ok({ deleted: true });
}
