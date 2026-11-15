import { type FeedItem } from "./parse";

/**
 * Anthropic ne publie pas de flux RSS : on lit la page publique https://www.anthropic.com/news.
 * Lecture volontairement stricte : un article n'est retenu que si son lien interne contient un titre ;
 * la date n'est gardée que si elle se trouve dans le même bloc que le titre (sinon : pas de date, plutôt qu'une date fausse).
 */
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function toIso(text: string): string | null {
  const m = text.trim().match(/^([A-Za-z]{3})[a-z]*\.? (\d{1,2}), (\d{4})$/);
  const month = m ? MONTHS.indexOf(m[1].toLowerCase()) : -1;
  if (!m || month < 0) return null;
  // Midi UTC : le jour affiché reste le bon quel que soit le fuseau.
  return new Date(Date.UTC(Number(m[3]), month, Number(m[2]), 12)).toISOString();
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#x27": "'", "#39": "'", nbsp: " " };
const clean = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x27|#39|amp|lt|gt|quot|nbsp);/g, (_, k: string) => ENTITIES[k])
    .replace(/\s+/g, " ")
    .trim();

export function parseAnthropicNews(html: string, maxItems = 15): FeedItem[] {
  const page = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/gi, "");
  // Tout lien interne qui contient un titre : les annonces vivent sous /news/, mais aussi à la racine (nouveaux modèles) ou sous /research/.
  const anchors = /<a\b[^>]*href="(?:https:\/\/www\.anthropic\.com)?(\/[a-z0-9-]+(?:\/[a-z0-9-]+)?)"[^>]*>([\s\S]*?)<\/a>/gi;
  const found = new Map<string, FeedItem>();
  for (let m = anchors.exec(page); m; m = anchors.exec(page)) {
    const [, path, inner] = m;
    const link = `https://www.anthropic.com${path}`;
    const heading = inner.match(/<h[2-4]\b[^>]*>([\s\S]*?)<\/h[2-4]>/i);
    const paragraph = inner.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
    const item = found.get(link);
    if (heading && !item) {
      const title = clean(heading[1]);
      if (!title) continue;
      // Bloc qui contient le titre : de la dernière ouverture <li>/<article> à la prochaine fermeture.
      const start = Math.max(page.lastIndexOf("<li", m.index), page.lastIndexOf("<article", m.index));
      const ends = [page.indexOf("</li>", m.index), page.indexOf("</article>", m.index)].filter((i) => i >= 0);
      const block = start >= 0 && ends.length ? page.slice(start, Math.min(...ends)) : "";
      const time = block.match(/<time\b[^>]*>([^<]+)<\/time>/i);
      found.set(link, { title: title.slice(0, 200), link, summary: paragraph ? clean(paragraph[1]).slice(0, 240) : "", publishedAt: time ? toIso(time[1]) : null });
    } else if (paragraph && item && !item.summary) {
      const summary = clean(paragraph[1]);
      item.summary = summary.length > 240 ? `${summary.slice(0, 239)}…` : summary;
    }
  }
  return [...found.values()].slice(0, maxItems);
}
