import { NextResponse } from "next/server";
import { AIError } from "./ai/client";
import { db } from "./db";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(e: unknown, status = 400) {
  const message = e instanceof Error ? e.message : String(e);
  if (!(e instanceof AIError)) console.error("[cerveau]", e);
  return NextResponse.json({ error: message }, { status: e instanceof AIError ? 502 : status });
}

export function graphVersion(): string {
  const r = db()
    .prepare(
      "SELECT (SELECT IFNULL(MAX(last_activity_at),'') FROM nodes) AS a, (SELECT COUNT(*) FROM nodes) AS b, (SELECT COUNT(*) FROM edges) AS c, (SELECT IFNULL(MAX(last_activity_at),'') FROM edges) AS d",
    )
    .get() as { a: string; b: number; c: number; d: string };
  return `${r.a}|${r.b}|${r.c}|${r.d}`;
}
