"use client";

/**
 * Onglet Mail : boîte de réception Gmail en lecture seule, recherche, lecture d'un message et brouillon de réponse.
 * Règles : aucun mail n'est jamais envoyé ni supprimé ; un brouillon n'est enregistré dans Gmail qu'après un clic explicite.
 */
import { ExternalLink, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonGrid } from "@/components/ui/skeleton-card";
import { SourceNote } from "@/components/ui/source-note";
import { areaClass, Field, inputClass } from "@/components/perso/form";
import { formatDateTime } from "@/lib/format";
import type { MailList, MailMessage, MailRow } from "@/lib/mail/types";
import { cn } from "@/lib/utils";

type ListState = { status: "chargement" } | { status: "deconnecte" } | { status: "erreur"; message: string; credentials: boolean } | { status: "ok"; data: MailList };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init).catch(() => {
    throw new Error("Le serveur est injoignable. Vérifie ta connexion.");
  });
  const body = (await res.json().catch(() => null)) as (T & { erreur?: string }) | null;
  if (!res.ok || !body) throw Object.assign(new Error(body?.erreur ?? `Le serveur a répondu ${res.status}.`), { body });
  return body;
}

function ConnectCard({ onDone, notice }: { onDone: () => void; notice?: string }) {
  const [adresse, setAdresse] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <section className="card flex max-w-2xl flex-col gap-4 p-5">
      <h2 className="text-lg">Connecter ma boîte Gmail</h2>
      {notice ? (
        <p role="alert" className="rounded-control border border-border bg-accent-soft px-3 py-2 text-sm">
          {notice}
        </p>
      ) : null}
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
        <li>
          Ouvre{" "}
          <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
            myaccount.google.com/apppasswords
          </a>{" "}
          (connecté à ton compte Google). Si Google dit que ce réglage n&apos;est pas disponible, active d&apos;abord la « validation en deux étapes » dans la sécurité de ton compte.
        </li>
        <li>Donne un nom, par exemple « Dashboard », puis appuie sur « Créer ».</li>
        <li>Google affiche un mot de passe de 16 lettres : copie-le et colle-le ci-dessous.</li>
      </ol>
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          setError("");
          try {
            await api("/api/mail/connexion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ adresse, motDePasse }) });
            setMotDePasse("");
            onDone();
          } catch (err) {
            setError(err instanceof Error ? err.message : "La connexion a échoué.");
          } finally {
            setPending(false);
          }
        }}
      >
        <Field label="Adresse Gmail" htmlFor="m-adresse">
          <input id="m-adresse" type="email" autoComplete="email" className={inputClass} value={adresse} onChange={(e) => setAdresse(e.target.value)} required />
        </Field>
        <Field label="Mot de passe d'application (16 lettres)" htmlFor="m-mdp">
          <input id="m-mdp" type="password" autoComplete="off" className={inputClass} value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} required />
        </Field>
        {error ? (
          <p role="alert" className="text-sm font-semibold">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="primary" disabled={pending} className="self-start">
          {pending ? "Vérification auprès de Gmail…" : "Connecter"}
        </Button>
      </form>
      <p className="text-xs text-text-2">
        Ce mot de passe n&apos;est pas ton mot de passe Google : il ne donne accès qu&apos;au courrier et tu peux le révoquer à tout moment sur la même page Google. Il est chiffré et gardé dans un cookie que seul le serveur du Dashboard peut lire, sur cet appareil
        uniquement. Le Dashboard lit tes mails et prépare des brouillons ; il n&apos;envoie et ne supprime jamais rien.
      </p>
    </section>
  );
}

function MessagePanel({ row, onClose }: { row: MailRow; onClose: () => void }) {
  const [message, setMessage] = useState<MailMessage | null>(null);
  const [error, setError] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<MailMessage>(`/api/mail/message?uid=${row.uid}`)
      .then((m) => !cancelled && setMessage(m))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Lecture impossible."));
    return () => {
      cancelled = true;
    };
  }, [row.uid]);

  async function saveDraft() {
    if (!message || !reply?.trim()) return;
    setSaving(true);
    setStatus("");
    try {
      await api("/api/mail/brouillon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ a: message.email, objet: /^re\s*:/i.test(message.subject) ? message.subject : `Re: ${message.subject}`, texte: reply, enReponseA: message.messageId, references: message.references }),
      });
      setStatus("Brouillon enregistré dans Gmail (dossier Brouillons). Il n'a pas été envoyé : relis-le et envoie-le depuis Gmail.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "L'enregistrement a échoué.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card flex flex-col gap-4 p-5" aria-label={`Message : ${row.subject}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-lg">{row.subject}</h2>
          <p className="text-sm text-text-2">
            {row.from}
            {row.email ? ` · ${row.email}` : ""}
            {row.date ? ` · ${formatDateTime(new Date(row.date))}` : ""}
          </p>
        </div>
        <Button onClick={onClose}>Fermer</Button>
      </div>
      {error ? (
        <EmptyState title="Message indisponible" reason={error} />
      ) : !message ? (
        <div className="skeleton h-40" aria-hidden />
      ) : (
        <>
          {message.text ? (
            <div className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap break-words rounded-control bg-surface-2 p-3 text-sm">{message.text}</div>
          ) : (
            <EmptyState title="Pas de texte" reason="Ce message ne contient pas de version texte lisible (images ou mise en page seulement). Ouvre-le dans Gmail." />
          )}
          {message.truncated ? <p className="text-xs text-text-2">Message très long : seul le début est affiché.</p> : null}
          {reply === null ? (
            <Button className="self-start" disabled={!message.email} onClick={() => setReply("")}>
              Écrire un brouillon de réponse
            </Button>
          ) : (
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <Field label={`Brouillon de réponse à ${message.email}`} htmlFor="m-reponse">
                <textarea id="m-reponse" className={areaClass} rows={8} maxLength={50000} value={reply} onChange={(e) => setReply(e.target.value)} autoFocus />
              </Field>
              <Button variant="primary" className="self-start" disabled={saving || !reply.trim()} onClick={saveDraft}>
                {saving ? "Enregistrement…" : "Enregistrer comme brouillon dans Gmail"}
              </Button>
            </div>
          )}
          <p role="status" className="text-sm">
            {status}
          </p>
        </>
      )}
    </section>
  );
}

export function MailView() {
  const [state, setState] = useState<ListState>({ status: "chargement" });
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [open, setOpen] = useState<MailRow | null>(null);
  const [tick, setTick] = useState(0);
  const requestKey = `${query}|${unreadOnly}|${tick}`;
  const [doneKey, setDoneKey] = useState("");
  const loading = doneKey !== requestKey;

  const load = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (unreadOnly) params.set("nonlus", "1");
    api<MailList | { connected: false }>(`/api/mail?${params}`)
      .then((data) => !cancelled && setState(data.connected ? { status: "ok", data } : { status: "deconnecte" }))
      .catch((e: unknown) => {
        if (cancelled) return;
        const body = (e as { body?: { identifiants?: boolean } }).body;
        setState({ status: "erreur", message: e instanceof Error ? e.message : "Lecture impossible.", credentials: Boolean(body?.identifiants) });
      })
      .finally(() => !cancelled && setDoneKey(requestKey));
    return () => {
      cancelled = true;
    };
  }, [query, unreadOnly, tick, requestKey]);

  async function disconnect() {
    await api("/api/mail/connexion", { method: "DELETE" }).catch(() => null);
    setOpen(null);
    setState({ status: "deconnecte" });
  }

  if (state.status === "chargement") return <SkeletonGrid count={3} />;
  if (state.status === "deconnecte") return <ConnectCard onDone={load} />;
  if (state.status === "erreur" && state.credentials) return <ConnectCard onDone={load} notice={`${state.message} Le mot de passe d'application a peut-être été révoqué : crées-en un nouveau.`} />;

  const data = state.status === "ok" ? state.data : null;
  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(input.trim());
        }}
      >
        <label htmlFor="m-recherche" className="sr-only">
          Chercher dans mes mails
        </label>
        <input id="m-recherche" type="search" className={inputClass} maxLength={300} placeholder="Chercher (mots, from:nom, has:attachment…)" value={input} onChange={(e) => setInput(e.target.value)} />
        <Button type="submit" variant="primary" aria-label="Chercher">
          <Search aria-hidden />
          <span className="hidden sm:inline">Chercher</span>
        </Button>
        <Button type="button" aria-label="Actualiser" disabled={loading} onClick={load}>
          <RefreshCw aria-hidden />
        </Button>
      </form>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrer">
        {[
          [false, "Tous"],
          [true, "Non lus"],
        ].map(([value, label]) => (
          <button
            key={String(label)}
            type="button"
            aria-pressed={unreadOnly === value}
            onClick={() => setUnreadOnly(Boolean(value))}
            className={cn("min-h-11 rounded-full border-[length:var(--border-width)] px-4 text-sm", unreadOnly === value ? "border-accent bg-accent-soft font-semibold text-text" : "border-border bg-surface text-text-2")}
          >
            {label}
          </button>
        ))}
        {query ? (
          <Button variant="ghost" onClick={() => (setQuery(""), setInput(""))}>
            Effacer la recherche
          </Button>
        ) : null}
      </div>

      {open ? <MessagePanel key={open.uid} row={open} onClose={() => setOpen(null)} /> : null}

      {state.status === "erreur" ? (
        <div className="card flex flex-col gap-3 p-5">
          <EmptyState title="Données indisponibles" reason={state.message} />
          <Button className="self-start" onClick={load}>
            Réessayer
          </Button>
        </div>
      ) : data && !data.mails.length ? (
        <div className="card p-5">
          <EmptyState title="Aucun mail" reason={query || unreadOnly ? "Aucun message ne correspond à ces filtres." : "La boîte de réception est vide."} />
        </div>
      ) : data ? (
        <ul className="flex flex-col gap-2.5">
          {data.mails.map((m) => (
            <li key={m.uid} className={cn("card flex flex-col gap-1 px-4 py-3", open?.uid === m.uid && "border-accent")}>
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-text-2">
                {m.unread ? <span aria-hidden className="size-2 rounded-full bg-accent" /> : null}
                <strong className="text-text">{m.from}</strong>
                {m.unread ? <span className="sr-only">Non lu</span> : null}
                {m.date ? <time dateTime={m.date}>{formatDateTime(new Date(m.date))}</time> : null}
              </p>
              <button type="button" className={cn("min-h-11 self-start break-words text-left font-heading text-base hover:underline", m.unread && "font-bold")} onClick={() => (setOpen(m), window.scrollTo({ top: 0 }))}>
                {m.subject}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {data ? (
        <div className="flex flex-col gap-2">
          {data.total > data.mails.length ? <p className="text-xs text-text-2">Les {data.mails.length} plus récents sur {data.total} messages. Affine avec la recherche pour en voir d&apos;autres.</p> : null}
          <SourceNote source={`boîte de réception de ${data.account} (Gmail, lecture seule)`} updatedAt={new Date(data.fetchedAt)} />
          <p className="text-xs text-text-2">Ouvrir un message ici ne le marque pas comme lu dans Gmail. Résumés et tri automatique (Claude) : dans la version artefact.</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <a href="https://mail.google.com/" target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden />
                Ouvrir Gmail
              </a>
            </Button>
            <Button onClick={disconnect}>Déconnecter la boîte mail de cet appareil</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
