/**
 * Onglets YouTube et Musique de la version artefact.
 * - YouTube : nouvelles vidéos des chaînes suivies (flux publics de YouTube, lus via Firecrawl).
 * - Musique : tes liens Spotify. Une page d'artefact ne peut pas intégrer de lecteur : chaque lien s'ouvre dans Spotify.
 */
import { parseSpotifyUrl, SPOTIFY_KINDS, type SpotifyKind } from "@/lib/spotify";
import { channelFeedUrl, channelIdFromHtml, channelLookup, CHANNEL_ID, parseChannelFeed, type Video } from "@/lib/youtube/parse";
import { cachedLoad, DataError, readUrl } from "./data";
import { h, icon } from "./dom";
import { liveList, str } from "./store";
import { deleteZone, gate, runner, textInput } from "./ui";
import { card, dateTime, emptyState, skeleton, sourceNote } from "./views";

// ---------- YouTube ----------
interface Channel {
  id: string;
  name: string;
}
const channels = liveList<Channel>("youtube", "chaines", (id, d) => (CHANNEL_ID.test(id) ? { id, name: str(d.name, 120) || "Chaîne YouTube" } : null));

const loadChannel = (id: string, force: boolean) => cachedLoad(`youtube-${id}`, 30 * 60 * 1000, async () => parseChannelFeed(await readUrl(channelFeedUrl(id)), id), force);

export function youtubeView(root: HTMLElement): void {
  channels.start();
  const status = h("p", { class: "note", role: "status" });
  const run = runner(status);
  const body = h("div", { class: "stack" });
  const chips = h("div", { class: "stack" });
  const videosSlot = h("div", { class: "stack" });
  root.append(body);
  let loadedFor = "";

  const input = textInput({ maxlength: 300, placeholder: "Lien de la chaîne ou @nom" });
  input.id = "y-chaine";
  const addBtn: HTMLButtonElement = h("button", { class: "btn primary", type: "submit", "aria-label": "Ajouter la chaîne" }, icon("plus"), h("span", { class: "btn-label" }, "Ajouter"));
  const form = h(
    "form",
    {
      class: "search-row",
      onsubmit: async (e: Event) => {
        e.preventDefault();
        const lookup = channelLookup(input.value);
        if (!lookup) return void (status.textContent = "Colle le lien d'une chaîne YouTube ou son nom commençant par @.");
        addBtn.disabled = true;
        status.textContent = "Recherche de la chaîne…";
        try {
          // Un nom « @… » oblige à lire la page de la chaîne (volumineuse) pour y relever son identifiant.
          const id = "id" in lookup ? lookup.id : channelIdFromHtml(await readUrl(lookup.page));
          if (!id) status.textContent = "Chaîne introuvable. Vérifie le nom, ou colle le lien complet de la chaîne.";
          else if (channels.items.some((c) => c.id === id)) status.textContent = "Cette chaîne est déjà dans ta liste.";
          else {
            const { data } = await loadChannel(id, false);
            input.value = "";
            await run(channels.save({ id, name: data.name }), `Chaîne « ${data.name} » ajoutée.`);
          }
        } catch (err) {
          status.textContent = err instanceof DataError ? `Lecture impossible : ${err.message}.` : "Lecture de YouTube impossible pour le moment.";
        }
        addBtn.disabled = false;
      },
    },
    h("label", { class: "sr-only", for: "y-chaine" }, "Lien ou nom de la chaîne"),
    input,
    addBtn,
  );

  async function loadVideos(force: boolean): Promise<void> {
    const list = [...channels.items];
    if (!list.length) return videosSlot.replaceChildren();
    if (!videosSlot.firstChild) videosSlot.replaceChildren(h("div", { class: "grid" }, skeleton(), skeleton(), skeleton()));
    const results = await Promise.allSettled(list.map((c) => loadChannel(c.id, force)));
    if (!root.isConnected) return;
    const videos: Video[] = results.flatMap((r) => (r.status === "fulfilled" ? r.value.data.videos : [])).sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
    const failed = list.filter((_, i) => results[i].status === "rejected");
    const at = Math.min(...results.flatMap((r) => (r.status === "fulfilled" ? [r.value.at] : [])), Date.now());
    const nodes: (Node | null)[] = [
      h(
        "div",
        { class: "toolbar" },
        h("h2", { class: "section-title" }, "Nouvelles vidéos"),
        h("button", { class: "btn", type: "button", "aria-label": "Actualiser", onclick: () => void loadVideos(true) }, icon("refresh-cw"), h("span", { class: "btn-label" }, "Actualiser")),
      ),
      videos.length
        ? h(
            "div",
            { class: "grid" },
            ...videos.slice(0, 36).map((v) =>
              h(
                "article",
                { class: "card article" },
                h("p", { class: "meta" }, h("strong", null, v.channelName), v.publishedAt ? h("time", { datetime: v.publishedAt }, dateTime(v.publishedAt)) : null),
                h("h2", null, h("a", { href: v.url, target: "_blank", rel: "noopener noreferrer" }, v.title)),
                h("p", { class: "note read" }, icon("external-link", "ic ic-xs"), "Regarder sur YouTube"),
              ),
            ),
          )
        : h("div", { class: "card" }, emptyState(failed.length === list.length ? "Données indisponibles" : "Aucune vidéo", failed.length === list.length ? "Les flux de YouTube n'ont pas pu être lus. Réessaie dans un instant." : "Les flux de ces chaînes ne contiennent aucune vidéo pour le moment.")),
      failed.length && failed.length < list.length ? h("p", { class: "note" }, `Indisponibles pour le moment : ${failed.map((c) => c.name).join(", ")}.`) : null,
      sourceNote("flux publics de YouTube, 15 dernières vidéos par chaîne (lus via Firecrawl)", at),
    ];
    videosSlot.replaceChildren(...nodes.filter((n): n is Node => n !== null));
  }

  let built = false;
  function render(): void {
    if (!gate(channels, body, "YouTube")) return void (built = false);
    if (!built) {
      built = true;
      body.replaceChildren(
        card("Mes chaînes", [form, chips, status, h("p", { class: "note" }, "Chaque chaîne = 1 lecture Firecrawl par demi-heure. Ajouter une chaîne par son nom « @… » en coûte une de plus.")]),
        videosSlot,
        h("p", { class: "note" }, "Source : tes chaînes, enregistrées dans l'espace privé de cette page."),
      );
    }
    const sorted = [...channels.items].sort((a, b) => a.name.localeCompare(b.name));
    chips.replaceChildren(
      sorted.length
        ? h(
            "ul",
            { class: "expenses" },
            ...sorted.map((c) =>
              h(
                "li",
                null,
                h("a", { class: "grow-2 expense-title", href: `https://www.youtube.com/channel/${c.id}`, target: "_blank", rel: "noopener noreferrer" }, c.name),
                deleteZone("Retirer", "Retirer cette chaîne ?", () => void run(channels.remove(c.id), `Chaîne « ${c.name} » retirée.`)),
              ),
            ),
          )
        : emptyState("Pas encore de données", "Aucune chaîne suivie. Colle le lien d'une chaîne YouTube (ou son nom commençant par @) pour voir ses nouvelles vidéos ici."),
    );
    // On ne relit les flux que si la liste des chaînes a changé.
    const key = sorted.map((c) => c.id).join(",");
    if (key !== loadedFor) {
      loadedFor = key;
      void loadVideos(false);
    }
  }
  const stop = channels.onChange(() => (root.isConnected ? render() : stop()));
  render();
}

// ---------- Musique ----------
interface Lien {
  id: string;
  kind: SpotifyKind;
  title: string;
}
const liens = liveList<Lien>("musique", "liens", (id, d) => (/^[A-Za-z0-9]{22}$/.test(id) && String(d.kind) in SPOTIFY_KINDS ? { id, kind: d.kind as SpotifyKind, title: str(d.title, 160) || "Sans nom" } : null));

export function musiqueView(root: HTMLElement): void {
  liens.start();
  const status = h("p", { class: "note", role: "status" });
  const run = runner(status);
  const body = h("div", { class: "stack" });
  const listSlot = h("div", { class: "stack" });
  root.append(body);

  const link = textInput({ maxlength: 300, placeholder: "Lien Spotify (playlist, album, artiste…)" });
  link.id = "mu-lien";
  const name = textInput({ maxlength: 160, placeholder: "Nom à afficher (ex. : Ma playlist du matin)" });
  name.id = "mu-nom";
  const form = h(
    "form",
    {
      class: "stack",
      onsubmit: (e: Event) => {
        e.preventDefault();
        const found = parseSpotifyUrl(link.value);
        if (!found) return void (status.textContent = "Lien non reconnu. Dans Spotify : « … » → Partager → Copier le lien, puis colle-le ici.");
        if (liens.items.some((l) => l.id === found.id)) return void (status.textContent = "Ce lien est déjà dans ta liste.");
        const title = name.value.trim() || `${SPOTIFY_KINDS[found.kind]} Spotify`;
        link.value = "";
        name.value = "";
        void run(liens.save({ ...found, title }), `« ${title} » ajouté.`);
      },
    },
    h("div", { class: "form-field" }, h("label", { class: "label", for: "mu-lien" }, "Lien Spotify"), link),
    h("div", { class: "form-field" }, h("label", { class: "label", for: "mu-nom" }, "Nom"), name),
    h("div", { class: "actions" }, h("button", { class: "btn primary", type: "submit" }, icon("plus"), "Ajouter")),
  );

  let built = false;
  function render(): void {
    if (!gate(liens, body, "Musique")) return void (built = false);
    if (!built) {
      built = true;
      body.replaceChildren(
        h("div", { class: "grid two" }, card("Ma musique", [listSlot]), card("Ajouter un lien", [form, status])),
        h("div", { class: "card" }, emptyState("Pas de lecteur dans l'artefact", "Une page d'artefact n'a pas le droit d'intégrer le lecteur de Spotify : chaque lien s'ouvre dans l'application Spotify. Le lecteur intégré est prévu sur le site.")),
        h("p", { class: "note" }, "Source : tes liens, enregistrés dans l'espace privé de cette page."),
      );
    }
    const sorted = [...liens.items].sort((a, b) => a.title.localeCompare(b.title));
    listSlot.replaceChildren(
      sorted.length
        ? h(
            "ul",
            { class: "expenses" },
            ...sorted.map((l) =>
              h(
                "li",
                null,
                h("div", { class: "grow-2" }, h("a", { class: "expense-title", href: `https://open.spotify.com/${l.kind}/${l.id}`, target: "_blank", rel: "noopener noreferrer" }, l.title, icon("external-link", "ic ic-xs")), h("p", { class: "meta" }, h("span", { class: "pill" }, SPOTIFY_KINDS[l.kind]))),
                deleteZone("Retirer", "Retirer ce lien ?", () => void run(liens.remove(l.id), `« ${l.title} » retiré.`)),
              ),
            ),
          )
        : emptyState("Pas encore de données", "Aucune musique enregistrée. Dans Spotify, ouvre une playlist ou un album, puis « … » → Partager → Copier le lien."),
    );
  }
  const stop = liens.onChange(() => (root.isConnected ? render() : stop()));
  render();
}
