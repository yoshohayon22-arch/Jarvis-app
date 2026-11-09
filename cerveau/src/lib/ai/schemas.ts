import { z } from "zod";
import { EXTRACTABLE_TYPES } from "../types";

// NB : pas de min/max/regex — le schéma doit rester compatible avec la sortie structurée stricte.

export const ExtractedNeuron = z.object({
  ref: z.string().describe("Identifiant local unique dans cette réponse : n1, n2, …"),
  existing_id: z
    .string()
    .nullable()
    .describe("id d'un neurone EXISTANT de la liste si c'est la même entité, sinon null"),
  type: z.enum(EXTRACTABLE_TYPES as [string, ...string[]]),
  titre: z.string().describe("Titre court (1 à 6 mots), sans article inutile"),
  resume: z.string().describe("1 à 2 phrases factuelles en français, uniquement ce que dit la source"),
  tags: z.array(z.string()).describe("2 à 5 tags en minuscules"),
  montant: z.number().nullable().describe("Montant positif si type=argent, sinon null"),
  devise: z.string().nullable().describe("Code ISO (CHF, EUR, USD…) si type=argent, sinon null"),
  sens: z.enum(["depense", "rentree"]).nullable().describe("Pour type=argent : depense ou rentree"),
  categorie: z.string().nullable().describe("Pour type=argent : catégorie courte (restaurant, transport, salaire…)"),
  date: z.string().nullable().describe("Date AAAA-MM-JJ si la source en donne une (ou « hier », etc.), sinon null"),
});

export const ExtractedLink = z.object({
  de: z.string().describe("ref (n1…) ou id existant"),
  vers: z.string().describe("ref (n1…) ou id existant"),
  label: z.string().describe("Relation courte en français : « travaille chez », « a parlé de », « concerne »…"),
});

export const ExtractionSchema = z.object({
  neurones: z.array(ExtractedNeuron),
  liens: z.array(ExtractedLink),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

/** Pour un fichier : on ajoute le neurone « document » qui représente le fichier lui-même. */
export const FileExtractionSchema = z.object({
  document: z.object({
    titre: z.string().describe("Titre court et parlant pour ce fichier"),
    resume: z.string().describe("Ce que contient le fichier, en 2 à 4 phrases"),
    tags: z.array(z.string()),
    texte_cle: z.string().describe("Texte important lu dans le fichier (max ~800 caractères), pour garder la source"),
  }),
  neurones: z.array(ExtractedNeuron),
  liens: z.array(ExtractedLink).describe("Utilise la ref spéciale « doc » pour désigner le fichier lui-même"),
});
export type FileExtraction = z.infer<typeof FileExtractionSchema>;

export const AnswerSchema = z.object({
  reponse: z.string().describe("Réponse en français, citant les neurones avec [id]"),
  neurones_cites: z.array(z.string()).describe("ids des neurones réellement utilisés"),
  sait: z.boolean().describe("false si les données ne permettent pas de répondre"),
});

export const ForgottenSchema = z.object({
  phrase: z.string().describe("Une phrase (max 30 mots), tutoiement, motivante et concrète"),
});
