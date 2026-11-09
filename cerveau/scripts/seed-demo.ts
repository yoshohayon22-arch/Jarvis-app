/**
 * 15 entrées d'exemple (déjà « extraites », aucun appel IA) pour voir la carte vivante :
 * dates étalées sur 3 mois → certains neurones brillent, d'autres ont pâli ; dépenses du mois pour la vue Argent.
 *
 *   npm run seed:demo            ajoute les exemples (une seule fois)
 *   npm run seed:demo -- --remove   retire tous les exemples
 */
import { db, kvGet, kvSet } from "../src/lib/db";
import { applyExtraction } from "../src/lib/extract";
import { createSource } from "../src/lib/repo";
import type { Extraction } from "../src/lib/ai/schemas";

type N = Partial<Extraction["neurones"][number]> & Pick<Extraction["neurones"][number], "ref" | "type" | "titre">;
const n = (x: N): Extraction["neurones"][number] => ({
  existing_id: null,
  resume: "",
  tags: ["exemple"],
  montant: null,
  devise: null,
  sens: null,
  categorie: null,
  date: null,
  ...x,
});
const money = (ref: string, titre: string, montant: number, categorie: string, sens: "depense" | "rentree" = "depense") =>
  n({ ref, type: "argent", titre, montant, devise: "CHF", sens, categorie, resume: titre });

const ENTRIES: { daysAgo: number; text: string; neurones: Extraction["neurones"]; liens: Extraction["liens"] }[] = [
  {
    daysAgo: 2,
    text: "Mevy m'a parlé d'un club belge qui cherche un stage en janvier",
    neurones: [
      n({ ref: "n1", type: "organisation", titre: "Club belge (stage janvier)", resume: "Club belge qui cherche un stage en janvier, signalé par Mevy." }),
      n({ ref: "n2", type: "tache", titre: "Proposer un stage au club belge", resume: "Proposer l'offre de stage de MCI au club belge pour janvier." }),
    ],
    liens: [
      { de: "mevy-azaria", vers: "n1", label: "a parlé de" },
      { de: "n2", vers: "n1", label: "concerne" },
      { de: "n2", vers: "mci-sport", label: "pour" },
    ],
  },
  { daysAgo: 0, text: "payé 40 CHF de resto", neurones: [money("n1", "Resto", 40, "restaurant")], liens: [] },
  {
    daysAgo: 5,
    text: "idée : coffrets de vin pour Noël",
    neurones: [n({ ref: "n1", type: "idee", titre: "Coffrets de vin pour Noël", resume: "Vendre des coffrets de vin pour Noël.", tags: ["exemple", "vin", "noël"] })],
    liens: [
      { de: "n1", vers: "global-shopping", label: "pour" },
      { de: "n1", vers: "site-vin", label: "à vendre sur" },
    ],
  },
  { daysAgo: 10, text: "Abonnement CFF demi-tarif 185 CHF", neurones: [money("n1", "Demi-tarif CFF", 185, "transport")], liens: [] },
  {
    daysAgo: 3,
    text: "Reçu 600 CHF de MCI Sport pour le stage",
    neurones: [money("n1", "Paie stage MCI", 600, "salaire", "rentree")],
    liens: [{ de: "n1", vers: "mci-sport", label: "versé par" }],
  },
  { daysAgo: 1, text: "Courses Migros 62.40 CHF", neurones: [money("n1", "Courses Migros", 62.4, "alimentation")], liens: [] },
  { daysAgo: 6, text: "Netflix 18.90 CHF", neurones: [money("n1", "Netflix", 18.9, "abonnements")], liens: [] },
  {
    daysAgo: 1,
    text: "Tâche : envoyer le planning du stage Marbella au Standard avant vendredi",
    neurones: [n({ ref: "n1", type: "tache", titre: "Envoyer le planning Marbella", resume: "Envoyer le planning du stage de Marbella au Standard avant vendredi." })],
    liens: [
      { de: "n1", vers: "stage-standard", label: "pour" },
      { de: "n1", vers: "standard-liege", label: "à envoyer à" },
    ],
  },
  {
    daysAgo: 45,
    text: "Idée : une version de Quizzly pour réviser la maturité",
    neurones: [n({ ref: "n1", type: "idee", titre: "Quizzly Maturité", resume: "Une version de Quizzly dédiée aux révisions de la maturité fédérale." })],
    liens: [
      { de: "n1", vers: "quizzly", label: "variante de" },
      { de: "n1", vers: "maturite", label: "cible" },
    ],
  },
  {
    daysAgo: 30,
    text: "Daniel Ohayon veut ajouter une page dégustation sur le site de vin",
    neurones: [n({ ref: "n1", type: "tache", titre: "Page dégustation du site vin", resume: "Ajouter une page dégustation sur le site de vin, demandé par Daniel." })],
    liens: [
      { de: "daniel-ohayon", vers: "n1", label: "a demandé" },
      { de: "n1", vers: "site-vin", label: "pour" },
    ],
  },
  {
    daysAgo: 4,
    text: "Note : Léa doit pouvoir lire les neurones du Cerveau",
    neurones: [n({ ref: "n1", type: "note", titre: "Brancher Léa sur le Cerveau", resume: "Léa doit pouvoir lire les neurones du Cerveau." })],
    liens: [
      { de: "n1", vers: "lea", label: "concerne" },
      { de: "n1", vers: "cerveau", label: "concerne" },
    ],
  },
  {
    daysAgo: 60,
    text: "Café avec un recruteur du Servette FC aux Eaux-Vives",
    neurones: [n({ ref: "n1", type: "organisation", titre: "Servette FC", resume: "Café avec un de leurs recruteurs aux Eaux-Vives." })],
    liens: [
      { de: "n1", vers: "eaux-vives", label: "rencontre à" },
      { de: "recherche-emploi", vers: "n1", label: "contact" },
    ],
  },
  {
    daysAgo: 90,
    text: "Idée : un podcast sur les coulisses des agences de sport",
    neurones: [n({ ref: "n1", type: "idee", titre: "Podcast coulisses agences sport", resume: "Podcast sur les coulisses des agences de sport." })],
    liens: [{ de: "n1", vers: "mci-sport", label: "inspiré par" }],
  },
  {
    daysAgo: 2,
    text: "Dîner d'équipe MCI 35 CHF",
    neurones: [money("n1", "Dîner d'équipe MCI", 35, "restaurant")],
    liens: [{ de: "n1", vers: "mci-sport", label: "avec" }],
  },
  {
    daysAgo: 40,
    text: "Projet : refaire mon portfolio avec mes jeux (Manager V3, Football Legends)",
    neurones: [n({ ref: "n1", type: "projet", titre: "Portfolio de mes jeux", resume: "Refaire mon portfolio en mettant en avant mes jeux." })],
    liens: [
      { de: "n1", vers: "manager-v3", label: "présente" },
      { de: "n1", vers: "football-legends", label: "présente" },
      { de: "n1", vers: "cv", label: "complète" },
    ],
  },
];

function remove() {
  const d = db();
  const ids = (d.prepare("SELECT id FROM nodes WHERE origin = 'demo'").all() as { id: string }[]).map((r) => r.id);
  d.transaction(() => {
    for (const id of ids) {
      d.prepare("DELETE FROM nodes_fts WHERE node_id = ?").run(id);
      d.prepare("DELETE FROM nodes WHERE id = ?").run(id);
    }
    d.prepare("DELETE FROM sources WHERE kind = 'demo'").run();
  })();
  kvSet("demo_seeded", "");
  console.log(`${ids.length} neurones d'exemple retirés.`);
}

function seed() {
  if (kvGet("demo_seeded") === "1") {
    console.log("Les exemples sont déjà là (npm run seed:demo -- --remove pour les retirer).");
    return;
  }
  const d = db();
  // Les liens d'exemple vers des neurones absents (seed différent) sont simplement ignorés.
  let created = 0;
  for (const e of ENTRIES) {
    const at = new Date(Date.now() - e.daysAgo * 86_400_000 - Math.random() * 3_600_000).toISOString();
    const neurones = e.neurones.map((x) => (x.type === "argent" ? { ...x, date: at.slice(0, 10) } : x));
    const sourceId = createSource(e.text, "demo", null, at);
    const r = applyExtraction({ neurones, liens: e.liens }, { sourceId, origin: "demo" });
    for (const id of r.created) d.prepare("UPDATE nodes SET created_at = ?, last_activity_at = ? WHERE id = ?").run(at, at, id);
    for (const id of r.edges) d.prepare("UPDATE edges SET created_at = ?, last_activity_at = ? WHERE id = ? AND id NOT LIKE 'seed_%'").run(at, at, id);
    created += r.created.length;
  }
  kvSet("demo_seeded", "1");
  console.log(`${ENTRIES.length} entrées d'exemple ajoutées (${created} neurones, tag « exemple »).`);
}

if (process.argv.includes("--remove")) remove();
else seed();
