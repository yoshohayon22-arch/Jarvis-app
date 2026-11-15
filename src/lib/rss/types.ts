import type { NewsGroup } from "./sources";

export interface Article {
  id: string;
  sourceId: string;
  sourceName: string;
  group: NewsGroup;
  lang: "fr" | "en" | "es";
  paywall: boolean;
  title: string;
  link: string;
  summary: string;
  publishedAt: string | null;
}

export interface SourceStatus {
  id: string;
  name: string;
  group: NewsGroup;
  ok: boolean;
  /** Nombre d'articles récents retenus. */
  count: number;
  error?: string;
}

export interface NewsPayload {
  articles: Article[];
  sources: SourceStatus[];
  fetchedAt: string;
}
