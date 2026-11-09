"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, fmtMoney } from "@/lib/api";
import type { MoneySummary } from "@/lib/types";

function shiftMonth(m: string, delta: number) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}
const monthLabel = (m: string) =>
  new Date(`${m}-15T12:00:00Z`).toLocaleDateString("fr-CH", { month: "long", year: "numeric" });

export default function MoneyView() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<MoneySummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    api<MoneySummary>(`/api/money?month=${month}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [month]);

  return (
    <main className="min-h-dvh px-4 pb-16 pt-safe md:px-8">
      <div className="holo-grid pointer-events-none fixed inset-0" />
      <div className="relative mx-auto max-w-3xl">
        <header className="flex items-center gap-3 py-4">
          <Link href="/" className="glass rounded-full px-3 py-1.5 text-sm text-cyan-200">
            ← Carte
          </Link>
          <h1 className="font-display text-lg font-black tracking-[0.25em] text-emerald-200" style={{ textShadow: "0 0 14px rgba(52,211,153,.6)" }}>
            ARGENT
          </h1>
        </header>

        <div className="glass mb-5 flex items-center justify-between rounded-2xl px-2 py-2">
          <button onClick={() => setMonth((m) => shiftMonth(m, -1))} className="rounded-full px-3 py-1 text-lg text-muted hover:text-ink" aria-label="Mois précédent">
            ‹
          </button>
          <span className="font-display text-sm capitalize tracking-widest text-ink">{monthLabel(month)}</span>
          <button onClick={() => setMonth((m) => shiftMonth(m, 1))} className="rounded-full px-3 py-1 text-lg text-muted hover:text-ink" aria-label="Mois suivant">
            ›
          </button>
        </div>

        {error && <p className="text-sm text-rose-300">{error}</p>}
        {data && data.currencies.length === 0 && (
          <div className="glass rounded-2xl p-6 text-center text-sm text-muted">
            Aucun mouvement ce mois-ci. Écris par exemple « payé 40 CHF de resto » sur la carte.
          </div>
        )}

        {data?.currencies.map((c) => {
          const max = Math.max(1, ...c.categories.map((k) => Math.max(k.depenses, k.rentrees)));
          return (
            <section key={c.currency} className="mb-6 rise">
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <Stat label="Dépenses" value={fmtNum(c.depenses)} currency={c.currency} color="#fda4af" />
                <Stat label="Rentrées" value={fmtNum(c.rentrees)} currency={c.currency} color="#6ee7b7" />
                <Stat label="Solde" value={fmtNum(c.solde)} currency={c.currency} color={c.solde >= 0 ? "#6ee7b7" : "#fda4af"} />
              </div>
              <div className="glass mt-3 rounded-2xl p-4">
                <h2 className="mb-3 font-display text-[11px] uppercase tracking-[0.2em] text-cyan-200/70">Par catégorie · {c.currency}</h2>
                <ul className="space-y-2.5">
                  {c.categories.map((k) => (
                    <li key={k.category}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="capitalize">{k.category}</span>
                        <span className="tabular-nums text-muted">
                          {k.depenses > 0 && <span className="text-rose-200">−{fmtMoney(k.depenses, c.currency)}</span>}
                          {k.rentrees > 0 && <span className="ml-2 text-emerald-200">+{fmtMoney(k.rentrees, c.currency)}</span>}
                        </span>
                      </div>
                      <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-white/5">
                        {k.depenses > 0 && (
                          <div className="h-full rounded-full bg-rose-300/80 shadow-[0_0_10px_rgba(253,164,175,.6)]" style={{ width: `${(k.depenses / max) * 100}%` }} />
                        )}
                        {k.rentrees > 0 && (
                          <div className="h-full rounded-full bg-emerald-300/80 shadow-[0_0_10px_rgba(110,231,183,.6)]" style={{ width: `${(k.rentrees / max) * 100}%` }} />
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          );
        })}

        {data && data.items.length > 0 && (
          <section className="glass rounded-2xl p-4">
            <h2 className="mb-3 font-display text-[11px] uppercase tracking-[0.2em] text-cyan-200/70">Mouvements</h2>
            <ul className="divide-y divide-white/5">
              {data.items.map((it) => (
                <li key={it.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-12 shrink-0 text-[11px] text-muted">{it.date.slice(8, 10)}.{it.date.slice(5, 7)}</span>
                  <span className="flex-1 truncate">
                    {it.title} <span className="text-[11px] text-muted">· {it.category}</span>
                  </span>
                  <span className={`tabular-nums ${it.direction === "rentree" ? "text-emerald-300" : "text-rose-200"}`}>
                    {it.direction === "rentree" ? "+" : "−"}
                    {fmtMoney(it.amount, it.currency)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}

const fmtNum = (n: number) => new Intl.NumberFormat("fr-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

function Stat({ label, value, currency, color }: { label: string; value: string; currency: string; color: string }) {
  return (
    <div className="glass rounded-2xl p-3 sm:p-4">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted sm:text-[11px]">
        {label} <span className="normal-case tracking-normal opacity-70">{currency}</span>
      </p>
      <p className="mt-1 truncate font-display text-base font-bold tabular-nums sm:text-xl" style={{ color, textShadow: `0 0 14px ${color}66` }}>
        {value}
      </p>
    </div>
  );
}
