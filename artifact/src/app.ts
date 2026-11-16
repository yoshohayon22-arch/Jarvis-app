/**
 * Dashboard — version artefact (une seule page, sans serveur).
 * Navigation par onglets, 4 thèmes, palette Ctrl/Cmd + K ; les données en direct passent par le connecteur Firecrawl.
 */
import { clear, h, icon, store } from "./dom";
import { DEFAULT_FAVORITES, getTab, TABS, type ArtifactTab } from "./tabs";
import { meteoView, newsView, plannedView } from "./views";
import { openAsk } from "./assistant";
import { budgetView } from "./budget";
import { cerveauView } from "./cerveau";
import { filmsView } from "./films";
import { musiqueView, youtubeView } from "./loisirs";
import { matchsView, realMadridView } from "./foot";
import { foldNotes } from "./layout";
import { cultureView } from "./culture";
import { etudesView } from "./etudes";
import { projetsView } from "./projets";
import { mailView } from "./mail";
import { calendarView, coursView, studyView } from "./views-juif";

type Theme = "nuit" | "glass" | "brutal" | "dessine";
const THEMES: [Theme, string][] = [
  ["nuit", "Nuit"],
  ["glass", "Glassmorphism"],
  ["brutal", "Brutaliste"],
  ["dessine", "Dessiné à la main"],
];
const MAX_FAVORITES = 4;

const state = {
  theme: (store.get<Theme>("dash-theme") ?? "nuit") as Theme,
  favorites: store.get<string[]>("dash-favoris") ?? DEFAULT_FAVORITES,
  hidden: store.get<string[]>("dash-masques") ?? [],
};
if (!THEMES.some(([id]) => id === state.theme)) state.theme = "nuit";
state.favorites = state.favorites.filter((id) => getTab(id)).slice(0, MAX_FAVORITES);
state.hidden = state.hidden.filter((id) => getTab(id));

const root = document.documentElement;
const app = document.getElementById("app") as HTMLElement;
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- Thème ----------
function applyTheme(theme: Theme, origin?: { x: number; y: number }): void {
  const apply = () => {
    state.theme = theme;
    root.setAttribute("data-dash", theme);
    store.set("dash-theme", theme);
    renderChrome();
  };
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
  if (!origin || !doc.startViewTransition || reducedMotion()) return apply();
  // Révélation circulaire depuis le bouton (View Transitions API), si le navigateur la propose.
  try {
    const radius = Math.hypot(Math.max(origin.x, innerWidth - origin.x), Math.max(origin.y, innerHeight - origin.y));
    doc
      .startViewTransition(apply)
      .ready.then(() =>
        root.animate(
          { clipPath: [`circle(0px at ${origin.x}px ${origin.y}px)`, `circle(${radius}px at ${origin.x}px ${origin.y}px)`] },
          { duration: theme === "brutal" ? 260 : 420, easing: theme === "brutal" ? "steps(4, end)" : "cubic-bezier(0.22, 1, 0.36, 1)", pseudoElement: "::view-transition-new(root)" },
        ),
      )
      .catch(() => {});
  } catch {
    apply();
  }
}

// ---------- Navigation ----------
const visibleTabs = () => TABS.filter((t) => !state.hidden.includes(t.id));
const currentId = () => {
  const id = location.hash.replace(/^#/, "");
  return id === "reglages" || getTab(id) ? id : (state.favorites.find((f) => !state.hidden.includes(f)) ?? visibleTabs()[0]?.id ?? "reglages");
};
const go = (id: string) => {
  if (location.hash === `#${id}`) renderAll();
  else location.hash = id;
};

function navLink(tab: { id: string; label: string; icon: string }, active: boolean, cls: string, label = tab.label): HTMLElement {
  return h("a", { href: `#${tab.id}`, class: `${cls}${active ? " active" : ""}`, "aria-current": active ? "page" : null }, icon(tab.icon), h("span", null, label));
}

const sidebar = h("aside", { class: "sidebar", "aria-label": "Navigation principale" });
const header = h("header", { class: "topbar" });
const main = h("main", { class: "main", id: "contenu" });
const bottom = h("nav", { class: "bottombar", "aria-label": "Onglets favoris" });

function renderChrome(): void {
  const active = currentId();
  const tab = getTab(active);

  // Barre latérale (ordinateur) : onglets groupés.
  const groups = new Map<string, ArtifactTab[]>();
  for (const t of visibleTabs()) groups.set(t.group, [...(groups.get(t.group) ?? []), t]);
  sidebar.replaceChildren(
    h("p", { class: "brand" }, "Dashboard"),
    h(
      "nav",
      { class: "side-scroll" },
      ...[...groups].map(([group, tabs]) => h("div", null, h("p", { class: "group-label" }, group), ...tabs.map((t) => navLink(t, t.id === active, "side-link")))),
    ),
    h("div", { class: "side-foot" }, navLink({ id: "reglages", label: "Réglages", icon: "settings" }, active === "reglages", "side-link")),
  );

  // En-tête.
  const themeBtn: HTMLButtonElement = h("button", { class: "icon-btn boxed", type: "button", "aria-label": "Changer de thème", "aria-haspopup": "menu", onclick: () => openThemeMenu(themeBtn) }, icon("palette"));
  // Plein écran : proposé seulement là où le navigateur le permet (ordinateur ; pas sur iPhone).
  const full = Boolean(document.fullscreenElement);
  const fullBtn = document.fullscreenEnabled
    ? h("button", { class: "icon-btn boxed wide-only-flex", type: "button", "aria-label": full ? "Quitter le plein écran (touche F)" : "Plein écran (touche F)", title: full ? "Quitter le plein écran (F)" : "Plein écran (F)", "aria-pressed": String(full), onclick: toggleFullscreen }, icon(full ? "minimize" : "maximize"))
    : null;
  // « Demander à Claude » : une question sur ce que l'onglet affiche.
  const askBtn: HTMLButtonElement | null = tab ? h("button", { class: "icon-btn boxed ask-btn", type: "button", "aria-label": `Demander à Claude à propos de ${tab.label}`, title: "Demander à Claude", onclick: () => openAsk(tab.id, tab.label, main, askBtn as HTMLButtonElement) }, icon("sparkles")) : null;
  header.replaceChildren(
    h("h1", null, active === "reglages" ? "Réglages" : (tab?.label ?? "Dashboard")),
    h("button", { class: "search-btn boxed", type: "button", "aria-label": "Rechercher (Ctrl + K)", onclick: openPalette }, icon("search"), h("span", { class: "wide-only" }, "Rechercher…"), h("kbd", { class: "wide-only" }, "Ctrl K")),
    ...(askBtn ? [askBtn] : []),
    themeBtn,
    ...(fullBtn ? [fullBtn] : []),
    h("a", { class: "icon-btn boxed narrow-only", href: "#reglages", "aria-label": "Réglages" }, icon("settings")),
  );

  // Barre du bas (téléphone) : favoris + « Plus ».
  const favorites = state.favorites.map(getTab).filter((t): t is ArtifactTab => Boolean(t) && !state.hidden.includes(t!.id));
  const inMore = !favorites.some((f) => f.id === active);
  bottom.replaceChildren(
    ...favorites.map((t) => navLink(t, t.id === active, "bottom-link", t.short)),
    h("button", { class: `bottom-link${inMore ? " active" : ""}`, type: "button", "aria-haspopup": "dialog", onclick: openMore }, icon("ellipsis"), h("span", null, "Plus")),
  );
}

let lastIndex = -1;
function renderView(): void {
  const id = currentId();
  const tab = getTab(id);
  const index = visibleTabs().findIndex((t) => t.id === id);
  const dir = lastIndex >= 0 && index >= 0 ? Math.sign(index - lastIndex) : 0;
  lastIndex = index;

  const view = h("div", { class: "view", style: `--dir:${dir}` });
  clear(main);
  main.append(view);
  if (id === "reglages") settingsView(view);
  else if (id === "mail") mailView(view);
  else if (id === "budget") budgetView(view);
  else if (id === "cerveau") cerveauView(view);
  else if (id === "films") filmsView(view);
  else if (id === "youtube") youtubeView(view);
  else if (id === "musique") musiqueView(view);
  else if (id === "matchs-tv") matchsView(view);
  else if (id === "projets") projetsView(view);
  else if (id === "etudes") etudesView(view);
  else if (id === "meteo") meteoView(view);
  else if (id === "la-une") newsView(view, "une");
  else if (id === "foot") newsView(view, "foot");
  else if (id === "veille-ia") newsView(view, "ia");
  else if (id === "culture-g") cultureView(view);
  else if (id === "real-madrid") realMadridView(view);
  else if (id === "calendrier") calendarView(view);
  else if (id === "paracha" || id === "tehilim" || id === "halakha" || id === "rambam") studyView(view, id);
  else if (id === "cours") coursView(view);
  else if (tab) plannedView(view, tab);
  // Les réglages gardent leurs explications visibles ; ailleurs, sources et précisions se replient derrière un « i ».
  if (id !== "reglages") foldNotes(view);
  window.scrollTo(0, 0);
}

function renderAll(): void {
  renderChrome();
  renderView();
}

// ---------- Fenêtres : menu thème, « Plus », palette ----------
function overlay(content: HTMLElement, cls: string, onClose?: () => void): () => void {
  const previous = document.activeElement as HTMLElement | null;
  const close = () => {
    layer.classList.remove("open");
    document.removeEventListener("keydown", onKey, true);
    setTimeout(() => layer.remove(), 180);
    onClose?.();
    previous?.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    }
  };
  const layer: HTMLDivElement = h("div", { class: `overlay ${cls}`, onclick: (e: Event) => e.target === layer && close() }, content);
  document.body.append(layer);
  document.addEventListener("keydown", onKey, true);
  requestAnimationFrame(() => layer.classList.add("open"));
  return close;
}

function openThemeMenu(button: HTMLElement): void {
  const rect = button.getBoundingClientRect();
  const origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  const menu = h("div", { class: "card menu", role: "menu", "aria-label": "Thème", style: `top:${rect.bottom + 8}px;right:${Math.max(12, innerWidth - rect.right)}px` });
  const close = overlay(menu, "clear");
  menu.append(
    h("p", { class: "group-label" }, "Thème"),
    ...THEMES.map(([id, label]) =>
      h(
        "button",
        {
          class: "menu-item",
          type: "button",
          role: "menuitemradio",
          "aria-checked": String(state.theme === id),
          onclick: () => {
            close();
            applyTheme(id, origin);
          },
        },
        h("span", null, label),
        state.theme === id ? icon("check") : null,
      ),
    ),
  );
  (menu.querySelector("button") as HTMLElement | null)?.focus();
}

function openMore(): void {
  const active = currentId();
  const groups = new Map<string, ArtifactTab[]>();
  for (const t of visibleTabs()) groups.set(t.group, [...(groups.get(t.group) ?? []), t]);
  const sheet = h("div", { class: "card sheet", role: "dialog", "aria-modal": "true", "aria-label": "Tous les onglets" });
  const close = overlay(sheet, "bottom");
  const closeBtn = h("button", { class: "icon-btn", type: "button", "aria-label": "Fermer", onclick: close }, icon("x"));
  sheet.append(
    h("div", { class: "card-head" }, h("h2", null, "Tous les onglets"), closeBtn),
    ...[...groups].map(([group, tabs]) =>
      h(
        "section",
        null,
        h("p", { class: "group-label" }, group),
        h("div", { class: "tiles" }, ...tabs.map((t) => h("a", { href: `#${t.id}`, class: `tile${t.id === active ? " active" : ""}`, onclick: close }, icon(t.icon), t.label))),
      ),
    ),
    h("a", { href: "#reglages", class: "side-link", onclick: close }, icon("settings"), h("span", null, "Réglages")),
  );
  closeBtn.focus();
}

function openPalette(): void {
  if (document.querySelector(".palette")) return;
  type Command = { label: string; icon: string; hint?: string; run: () => void };
  const commands: Command[] = [
    ...TABS.map((t) => ({ label: t.label, icon: t.icon, hint: state.hidden.includes(t.id) ? "masqué" : undefined, run: () => go(t.id) })),
    ...THEMES.map(([id, label]) => ({ label: `Thème ${label}`, icon: "palette", hint: state.theme === id ? "actif" : undefined, run: () => applyTheme(id, { x: innerWidth / 2, y: 0 }) })),
    { label: "Réglages", icon: "settings", run: () => go("reglages") },
  ];
  const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  let matches = commands;
  let selected = 0;
  const list = h("ul", { class: "palette-list", role: "listbox", id: "palette-liste" });
  const input = h("input", { class: "palette-input", type: "text", id: "palette-recherche", placeholder: "Aller à un onglet, changer de thème…", "aria-label": "Rechercher une commande", "aria-controls": "palette-liste", autocomplete: "off" });
  const box = h("div", { class: "card palette", role: "dialog", "aria-modal": "true", "aria-label": "Palette de commandes" }, input, list);
  const close = overlay(box, "top");
  const run = (c: Command | undefined) => {
    if (!c) return;
    close();
    c.run();
  };
  const render = () => {
    list.replaceChildren(
      ...(matches.length
        ? matches.map((c, i) =>
            h("li", { role: "option", "aria-selected": String(i === selected), class: i === selected ? "sel" : "", onclick: () => run(c), onmousemove: () => i !== selected && ((selected = i), render()) }, icon(c.icon), h("span", null, c.label), c.hint ? h("span", { class: "muted small" }, c.hint) : null),
          )
        : [h("li", { class: "muted none" }, "Aucun résultat.")]),
    );
    list.querySelector(".sel")?.scrollIntoView({ block: "nearest" });
  };
  input.addEventListener("input", () => {
    const q = normalize(input.value.trim());
    matches = q ? commands.filter((c) => normalize(c.label).includes(q)) : commands;
    selected = 0;
    render();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      selected = (selected + (e.key === "ArrowDown" ? 1 : -1) + matches.length) % Math.max(1, matches.length);
      render();
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(matches[selected]);
    }
  });
  render();
  input.focus();
}

// ---------- Réglages ----------
function settingsView(view: HTMLElement): void {
  const swatches: Record<Theme, string[]> = {
    nuit: ["#0B0E14", "#151A23", "#F5C451"],
    glass: ["#43308C", "#0C6E7E", "#9BE7FF"],
    brutal: ["#F2F0E6", "#FFFFFF", "#FF4A1C"],
    dessine: ["#FBF7EE", "#FFF3B0", "#C7402A"],
  };
  const save = () => {
    store.set("dash-favoris", state.favorites);
    store.set("dash-masques", state.hidden);
    renderAll();
  };
  const toggleFavorite = (id: string) => {
    const on = state.favorites.includes(id);
    if (!on && state.favorites.length >= MAX_FAVORITES) return;
    state.favorites = on ? state.favorites.filter((x) => x !== id) : [...state.favorites, id];
    save();
  };
  const toggleHidden = (id: string) => {
    const on = state.hidden.includes(id);
    state.hidden = on ? state.hidden.filter((x) => x !== id) : [...state.hidden, id];
    if (!on) state.favorites = state.favorites.filter((x) => x !== id);
    save();
  };

  view.append(
    h(
      "div",
      { class: "grid two" },
      h(
        "section",
        { class: "card" },
        h("div", { class: "card-head" }, h("h2", null, "Thème")),
        h(
          "div",
          { class: "theme-grid", role: "radiogroup", "aria-label": "Thème" },
          ...THEMES.map(([id, label]) =>
            h(
              "button",
              { class: `theme-choice${state.theme === id ? " on" : ""}`, type: "button", role: "radio", "aria-checked": String(state.theme === id), onclick: (e: Event) => applyTheme(id, { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY }) },
              h("span", { class: "swatches", "aria-hidden": "true" }, ...swatches[id].map((c) => h("span", { style: `background:${c}` }))),
              label,
            ),
          ),
        ),
        h("p", { class: "note" }, "Mémorisé sur cet appareil. Les animations suivent le réglage « Réduire les animations » de ton appareil."),
      ),
      h(
        "section",
        { class: "card" },
        h("div", { class: "card-head" }, h("h2", null, "Onglets")),
        h("p", { class: "muted" }, `Choisis jusqu'à ${MAX_FAVORITES} favoris pour la barre du bas sur téléphone (${state.favorites.length}/${MAX_FAVORITES}) et masque les onglets inutiles.`),
        h(
          "ul",
          { class: "tab-list" },
          ...TABS.map((t) => {
            const fav = state.favorites.includes(t.id);
            const hidden = state.hidden.includes(t.id);
            return h(
              "li",
              { class: hidden ? "dim" : "" },
              icon(t.icon),
              h("span", { class: "grow" }, t.label),
              h(
                "button",
                { class: `icon-btn${fav ? " fav" : ""}`, type: "button", "aria-pressed": String(fav), disabled: hidden || (!fav && state.favorites.length >= MAX_FAVORITES), "aria-label": fav ? `Retirer ${t.label} des favoris` : `Ajouter ${t.label} aux favoris`, onclick: () => toggleFavorite(t.id) },
                icon("star"),
              ),
              h("button", { class: "icon-btn", type: "button", "aria-pressed": String(hidden), "aria-label": hidden ? `Afficher ${t.label}` : `Masquer ${t.label}`, onclick: () => toggleHidden(t.id) }, icon(hidden ? "eye-off" : "eye")),
            );
          }),
        ),
      ),
      h(
        "section",
        { class: "card" },
        h("div", { class: "card-head" }, h("h2", null, "Données et connecteurs")),
        h("p", { class: "muted" }, "Cette page ne peut pas appeler Internet elle-même. Elle passe par tes connecteurs Claude, avec ton accord à la première utilisation :"),
        h(
          "ul",
          { class: "bullets muted" },
          h("li", null, "Firecrawl lit la météo, les journaux, Hebcal et Sefaria. Chaque lecture consomme un crédit ; les réponses sont gardées de 15 minutes à plusieurs heures."),
          h("li", null, "Gmail lit tes mails, enregistre des brouillons et pose des libellés, uniquement quand tu le demandes. Rien n'est jamais envoyé ni supprimé."),
          h("li", null, "Claude résume, trie et rédige sur ton propre compte : chaque demande compte dans ton usage."),
        ),
      ),
    ),
  );
}

// ---------- Démarrage ----------
root.setAttribute("data-dash", state.theme);
app.append(
  h("a", { href: "#contenu", class: "skip" }, "Aller au contenu"),
  h("div", { class: "glass-backdrop", "aria-hidden": "true" }, h("span"), h("span"), h("span")),
  h("div", { class: "layout" }, sidebar, h("div", { class: "column" }, header, main)),
  bottom,
);
window.addEventListener("hashchange", renderAll);

// ---------- Plein écran ----------
/** Petit message temporaire en bas de l'écran (annoncé aux lecteurs d'écran). */
function toast(message: string): void {
  document.querySelector(".toast")?.remove();
  const el = h("p", { class: "toast", role: "status" }, message);
  document.body.append(el);
  setTimeout(() => el.remove(), 5000);
}

function toggleFullscreen(): void {
  if (document.fullscreenElement) return void document.exitFullscreen().catch(() => undefined);
  // Certaines vues (application mobile, aperçu intégré) refusent le plein écran : on l'explique au lieu de ne rien faire.
  root.requestFullscreen().catch(() => toast("Plein écran refusé dans cette vue. Ouvre le Dashboard dans son propre onglet du navigateur, puis réessaie."));
}
document.addEventListener("fullscreenchange", () => {
  renderChrome();
  if (document.fullscreenElement) toast("Plein écran activé. Touche F ou Échap pour en sortir.");
});
window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    openPalette();
  }
  // Touche F seule (hors saisie de texte) : plein écran.
  const target = e.target as HTMLElement | null;
  const typing = target?.closest("input, textarea, select, [contenteditable]");
  if (e.key.toLowerCase() === "f" && !e.metaKey && !e.ctrlKey && !e.altKey && !typing && document.fullscreenEnabled && !document.querySelector(".overlay")) {
    e.preventDefault();
    toggleFullscreen();
  }
});

// Swipe horizontal entre onglets (téléphone).
let touch: { x: number; y: number; t: number } | null = null;
main.addEventListener("touchstart", (e) => (touch = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }), { passive: true });
main.addEventListener(
  "touchend",
  (e) => {
    const start = touch;
    touch = null;
    if (!start || (e.target as HTMLElement).closest(".chips, .hours, .table-wrap, .hebrew")) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8 || Date.now() - start.t > 600) return;
    const tabs = visibleTabs();
    const next = tabs[tabs.findIndex((t) => t.id === currentId()) + (dx < 0 ? 1 : -1)];
    if (next) go(next.id);
  },
  { passive: true },
);

renderAll();
