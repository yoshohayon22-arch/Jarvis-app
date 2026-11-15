/**
 * Carte « Mon suivi » de l'accueil : mini-courbe de la moyenne sur 7 jours (4 dernières semaines)
 * et chiffres clés. Dessinée en SVG simple pour garder l'accueil léger (pas de bibliothèque de graphiques).
 */
import { Link } from 'react-router-dom'
import { ArrowRight, LineChart } from 'lucide-react'
import { Card } from '../../components/ui'
import { recentSummary, weeklyTrend } from '../../domain/tracking'
import { todayIso } from '../../domain/nutrition'
import type { WeighIn } from '../../domain/types'
import { formatDate, formatKg } from '../../lib/format'

const W = 320
const H = 120
const PAD = { top: 12, right: 12, bottom: 22, left: 36 }
const AVG = '#07964f'
const TARGET = '#d95c06'
const AXIS = '#52645b'

export function TrendCard({ weighIns, targetKg, className = '' }: { weighIns: WeighIn[]; targetKg: number; className?: string }) {
  const today = todayIso()
  const { points, changeKg } = recentSummary(weighIns, today)
  const perWeek = weeklyTrend(weighIns, today)

  return (
    <Card aria-labelledby="trend-title" className={className}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 id="trend-title" className="flex items-center gap-2 text-lg font-bold">
          <LineChart size={20} aria-hidden="true" className="text-brand-600" /> Mon suivi
        </h2>
        <Link to="/suivi" className="flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
          Détails <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
      {points.length < 2 ? (
        <p className="text-muted">La courbe des 4 dernières semaines apparaîtra dès ta deuxième pesée.</p>
      ) : (
        <>
          <Sparkline points={points} targetKg={targetKg} />
          <dl className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
            <div>
              <dt className="text-xs text-muted">Moyenne 7 j</dt>
              <dd className="font-bold text-brand-700">{formatKg(points[points.length - 1].avg7)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Sur 4 semaines</dt>
              <dd className="font-bold">{changeKg === null ? '—' : `${changeKg > 0 ? '+' : changeKg < 0 ? '−' : ''}${formatKg(Math.abs(changeKg))}`}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Par semaine</dt>
              <dd className="font-bold">{perWeek === null ? '—' : `${perWeek > 0 ? '+' : perWeek < 0 ? '−' : ''}${formatKg(Math.abs(perWeek))}`}</dd>
            </div>
          </dl>
        </>
      )}
    </Card>
  )
}

function Sparkline({ points, targetKg }: { points: { date: string; avg7: number }[]; targetKg: number }) {
  const t = points.map((p) => Date.parse(`${p.date}T12:00:00`))
  const ys = points.map((p) => p.avg7)
  // L'objectif n'est inclus dans l'échelle que s'il est proche : sinon la courbe serait écrasée.
  const showTarget = Math.abs(targetKg - ys[ys.length - 1]) <= 4
  const lo = Math.floor(Math.min(...ys, ...(showTarget ? [targetKg] : [])) - 0.3)
  const hi = Math.ceil(Math.max(...ys, ...(showTarget ? [targetKg] : [])) + 0.3)
  const x = (v: number) => PAD.left + ((v - t[0]) / Math.max(1, t[t.length - 1] - t[0])) * (W - PAD.left - PAD.right)
  const y = (v: number) => PAD.top + ((hi - v) / Math.max(0.1, hi - lo)) * (H - PAD.top - PAD.bottom)
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(t[i]).toFixed(1)},${y(p.avg7).toFixed(1)}`).join(' ')
  const last = points[points.length - 1]
  const label = `Moyenne sur 7 jours du ${formatDate(points[0].date, { day: 'numeric', month: 'long' })} au ${formatDate(last.date, { day: 'numeric', month: 'long' })} : de ${formatKg(points[0].avg7)} à ${formatKg(last.avg7)}.`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label}>
      {[lo, hi].map((v) => (
        <g key={v}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="#e8edea" strokeWidth="1" />
          <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill={AXIS}>
            {v} kg
          </text>
        </g>
      ))}
      {showTarget && (
        <g>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(targetKg)} y2={y(targetKg)} stroke={TARGET} strokeWidth="1.5" />
          <text x={W - PAD.right} y={y(targetKg) - 4} textAnchor="end" fontSize="10" fill={AXIS}>
            Objectif
          </text>
        </g>
      )}
      <path d={path} pathLength={1} className="draw" fill="none" stroke={AVG} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(t[t.length - 1])} cy={y(last.avg7)} r="4.5" fill={AVG} stroke="#fff" strokeWidth="2" className="animate-pop-in" style={{ animationDelay: '1.1s', transformBox: 'fill-box', transformOrigin: 'center' }} />
      <text x={PAD.left} y={H - 6} fontSize="10" fill={AXIS}>
        {formatDate(points[0].date, { day: 'numeric', month: 'short' })}
      </text>
      <text x={W - PAD.right} y={H - 6} fontSize="10" fill={AXIS} textAnchor="end">
        {formatDate(last.date, { day: 'numeric', month: 'short' })}
      </text>
    </svg>
  )
}
