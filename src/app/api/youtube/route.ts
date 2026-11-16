/** Vidéos récentes des chaînes suivies. Paramètre : ids (identifiants de chaînes séparés par des virgules, 30 au plus). */
import type { NextRequest } from "next/server";
import { CHANNEL_ID, loadChannel } from "@/lib/youtube/load";

export async function GET(request: NextRequest) {
  const ids = [...new Set((request.nextUrl.searchParams.get("ids") ?? "").split(",").filter((id) => CHANNEL_ID.test(id)))].slice(0, 30);
  const results = await Promise.allSettled(ids.map((id) => loadChannel(id)));
  return Response.json({
    channels: ids.map((id, i) => {
      const r = results[i];
      return r.status === "fulfilled" ? { id, ok: true, name: r.value.name, count: r.value.videos.length } : { id, ok: false, error: r.reason instanceof Error ? r.reason.message : "lecture impossible" };
    }),
    videos: results.flatMap((r) => (r.status === "fulfilled" ? r.value.videos : [])).sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")),
    fetchedAt: new Date().toISOString(),
  });
}
