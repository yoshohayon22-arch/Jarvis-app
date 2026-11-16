/** Structure commune des onglets : sous-sections, notes repliées, pastilles d'équipe. */
import { h, icon, store } from "./dom";

export interface Section {
  id: string;
  label: string;
  /** Contenu de la section (construit une fois, affiché quand elle est choisie). */
  nodes: (Node | null)[];
}

/**
 * Sous-sections d'un onglet : une rangée de boutons, une seule section visible à la fois.
 * Le choix est mémorisé sur l'appareil (clé `key`).
 */
export function sections(key: string, list: Section[]): HTMLElement {
  const saved = store.get<string>(`dash-section:${key}`);
  let current = list.some((s) => s.id === saved) ? (saved as string) : list[0].id;
  const tabs = list.map((s) => h("button", { class: "seg", type: "button", role: "tab", id: `seg-${key}-${s.id}`, "aria-controls": `pan-${key}-${s.id}` }, s.label));
  const panels = list.map((s) => h("div", { class: "stack", role: "tabpanel", id: `pan-${key}-${s.id}`, "aria-labelledby": `seg-${key}-${s.id}`, tabindex: 0 }, ...s.nodes));
  // Pastille de sélection : elle glisse d'un bouton à l'autre (animation sur transform uniquement).
  const pill = h("span", { class: "seg-pill", "aria-hidden": "true" });
  const bar = h("div", { class: "segs", role: "tablist", "data-no-swipe": "" }, pill, ...tabs);
  let placed = false;
  const movePill = (animate: boolean) => {
    const tab = tabs[list.findIndex((s) => s.id === current)];
    if (!tab || !tab.offsetWidth) return;
    const from = pill.getBoundingClientRect();
    pill.style.width = `${tab.offsetWidth}px`;
    pill.style.transform = `translateX(${tab.offsetLeft}px)`;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (animate && placed && !reduced && from.width) {
      const to = pill.getBoundingClientRect();
      const brutal = document.documentElement.getAttribute("data-dash") === "brutal";
      pill.animate([{ transform: `translateX(${tab.offsetLeft + from.left - to.left}px) scaleX(${from.width / to.width})` }, { transform: `translateX(${tab.offsetLeft}px) scaleX(1)` }], { duration: brutal ? 160 : 380, easing: brutal ? "steps(3, end)" : "cubic-bezier(0.34, 1.3, 0.64, 1)" });
    }
    placed = true;
  };
  // La rangée n'a pas de taille tant qu'elle n'est pas affichée : on place la pastille dès qu'elle en a une.
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => movePill(false)).observe(bar);

  const show = (id: string, focus = false) => {
    const changed = id !== current;
    current = id;
    store.set(`dash-section:${key}`, id);
    list.forEach((s, i) => {
      const on = s.id === id;
      tabs[i].classList.toggle("on", on);
      tabs[i].setAttribute("aria-selected", String(on));
      tabs[i].tabIndex = on ? 0 : -1;
      panels[i].hidden = !on;
      if (on && focus) tabs[i].focus();
    });
    movePill(changed);
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => show(list[i].id));
    tab.addEventListener("keydown", (e) => {
      const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      show(list[(i + step + list.length) % list.length].id, true);
    });
  });
  show(current);
  return h("div", { class: "stack" }, bar, ...panels);
}

/**
 * Replie les mentions de source et les précisions (paragraphes « .note » sans rôle) :
 * celles d'une carte derrière un bouton « i » en bas de la carte, les autres en bas de page.
 * Les notes restent dans la page (masquées) ; le bloc replié en affiche une copie tenue à jour.
 */
export function foldNotes(view: HTMLElement): void {
  const selector = "p.note:not([role]):not(.error):not(.keep)";
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(rebuild);
  });
  const watch = () => observer.observe(view, { childList: true, subtree: true, characterData: true });

  const details = (cls: string) => h("details", { class: `info ${cls}` }, h("summary", null, icon("info", "ic ic-sm"), "Sources et précisions"), h("div", { class: "info-body" }));
  function fill(box: HTMLElement, notes: Element[]): void {
    const body = box.querySelector(".info-body") as HTMLElement;
    body.replaceChildren(
      ...notes.map((n) => {
        const copy = n.cloneNode(true) as HTMLElement;
        copy.classList.remove("folded", "note");
        copy.classList.add("info-line");
        return copy;
      }),
    );
  }

  function rebuild(): void {
    scheduled = false;
    if (!view.isConnected) return observer.disconnect();
    observer.disconnect();
    const groups = new Map<Element, Element[]>();
    for (const note of view.querySelectorAll(selector)) {
      if (note.closest(".info")) continue;
      note.classList.add("folded");
      const owner = note.closest(".card") ?? view;
      groups.set(owner, [...(groups.get(owner) ?? []), note]);
    }
    for (const box of view.querySelectorAll(".info")) {
      const owner = box.classList.contains("page-info") ? view : box.parentElement;
      if (!owner || !groups.has(owner)) box.remove();
    }
    for (const [owner, notes] of groups) {
      const isPage = owner === view;
      let box = [...owner.children].find((c) => c.classList.contains("info")) as HTMLElement | undefined;
      if (!box) {
        box = details(isPage ? "page-info" : "card-info");
        owner.append(box);
      } else if (owner.lastElementChild !== box) owner.append(box);
      fill(box, notes);
    }
    watch();
  }
  watch();
  rebuild();
}

/** Pastille d'équipe : son sigle sur sa couleur quand la source la donne (les écussons ne peuvent pas s'afficher dans un artefact). */
export function teamBadge(abbr: string, color?: string): HTMLElement {
  const hex = color && /^[0-9a-f]{6}$/i.test(color) ? color : "";
  // Texte noir ou blanc selon la luminosité du fond, pour rester lisible.
  const light = hex ? (parseInt(hex.slice(0, 2), 16) * 299 + parseInt(hex.slice(2, 4), 16) * 587 + parseInt(hex.slice(4, 6), 16) * 114) / 1000 > 150 : false;
  return h("span", { class: "badge", "aria-hidden": "true", style: hex ? `background:#${hex};color:${light ? "#111" : "#fff"};border-color:transparent` : "" }, (abbr || "?").slice(0, 3).toUpperCase());
}
