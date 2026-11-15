/** Briques d'interface partagées par les onglets « à saisie » (projets, études…). */
import { h } from "./dom";
import { sampleMessage, samplePromise } from "./mail";
import type { LiveList } from "./store";
import { card, emptyState, skeleton } from "./views";

export function field(label: string, control: HTMLElement, id: string, cls = "form-field"): HTMLElement {
  control.id = id;
  return h("div", { class: cls }, h("label", { class: "label", for: id }, label), control);
}

export const textInput = (attrs: Record<string, string | number | boolean> = {}) => h("input", { class: "field", type: "text", autocomplete: "off", ...attrs });
export const textArea = (rows: number, attrs: Record<string, string | number | boolean> = {}) => h("textarea", { class: "draft", rows, ...attrs });
export function select(options: [string, string][], selected: string): HTMLSelectElement {
  return h("select", { class: "field" }, ...options.map(([value, label]) => h("option", { value, selected: value === selected }, label)));
}

/** Affiche l'attente ou l'indisponibilité du stockage. Renvoie vrai quand la liste est prête à être affichée. */
export function gate(list: LiveList<{ id: string }>, body: HTMLElement, title: string): boolean {
  if (list.status === "indisponible") {
    body.replaceChildren(card(title, [emptyState("Pas encore de données", list.reason)]));
    return false;
  }
  if (list.status === "attente") {
    body.replaceChildren(list.stale ? card(title, [emptyState("Le stockage ne répond pas encore", "La page continue d'essayer ; tes données apparaîtront dès qu'il répondra.")]) : h("div", { class: "grid" }, skeleton(), skeleton()));
    return false;
  }
  return true;
}

/** Exécute une écriture et annonce le résultat (ou la raison de l'échec) dans la zone d'état. */
export function runner(status: HTMLElement): (action: Promise<void>, done: string) => Promise<boolean> {
  return async (action, done) => {
    try {
      await action;
      status.textContent = done;
      return true;
    } catch (e) {
      status.textContent = e instanceof Error ? e.message : "L'enregistrement a échoué.";
      return false;
    }
  };
}

/** Demande un texte à Claude et l'écrit au fur et à mesure dans `out`. Renvoie le texte final, ou null en cas d'échec (le message est affiché). */
export async function askClaude(prompt: string, out: HTMLElement | HTMLTextAreaElement, info: HTMLElement, options: Record<string, unknown> = {}): Promise<string | null> {
  const sample = await samplePromise;
  if (!sample) {
    info.textContent = "Claude n'est pas disponible dans cette vue.";
    return null;
  }
  const put = (text: string) => ("value" in out ? (out.value = text) : (out.textContent = text));
  info.textContent = "Claude réfléchit…";
  try {
    const result = await sample(prompt, { ...options, onText: ({ text }: { text: string }) => put(text) });
    put(result.text);
    info.textContent = result.truncated ? "Réponse coupée (trop longue) : relance la demande si besoin." : "Proposition de Claude : relis-la avant de t'y fier.";
    return result.text;
  } catch (e) {
    info.textContent = sampleMessage(e);
    return null;
  }
}

const relative = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
/** « dans 12 jours », « hier »… pour une date aaaa-mm-jj (calculée sur les jours civils à Genève). */
export function daysFromToday(date: string): { days: number; label: string } {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" }).format(new Date());
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  return { days, label: relative.format(days, "day") };
}
export const dayLabel = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)}`;

/** Bouton de suppression avec confirmation sur place (la suppression est définitive). */
export function deleteZone(label: string, question: string, onYes: () => void): HTMLElement {
  const zone = h("div", { class: "actions" });
  const idle = () =>
    zone.replaceChildren(
      h(
        "button",
        {
          class: "btn",
          type: "button",
          onclick: () => {
            const no = h("button", { class: "btn", type: "button", onclick: idle }, "Non, garder");
            zone.replaceChildren(h("span", { class: "small-2" }, question), h("button", { class: "btn primary", type: "button", onclick: onYes }, "Oui, supprimer"), no);
            no.focus();
          },
        },
        label,
      ),
    );
  idle();
  return zone;
}
