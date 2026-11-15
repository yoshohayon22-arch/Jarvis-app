/** Données de l'onglet Culture G (source : Wikipédia en français). */
export interface WikiPage {
  title: string;
  description: string;
  extract: string;
  url: string;
}

export interface CulturePayload {
  /** aaaa-mm-jj (jour civil à Genève). */
  date: string;
  onThisDay: { year: number | null; text: string; page: WikiPage | null }[];
  featured: WikiPage | null;
  mostRead: WikiPage[];
  fetchedAt: string;
}
