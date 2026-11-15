/**
 * Introduction présentée par Mia, la marmotte coach : 3 écrans courts avant la création du profil.
 * On peut la passer, et la revoir depuis l'écran Profil.
 */
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, CalendarDays, ChefHat, HeartPulse, LineChart, ShieldCheck, ShoppingCart, Sparkles } from 'lucide-react'
import { Button } from '../../components/ui'
import { Mia } from '../../components/Mia'
import { HEALTH_DISCLAIMER } from '../../domain/safety'

interface Slide {
  title: string
  bubble: string
  points: { icon: typeof Sparkles; text: string }[]
}

const SLIDES: Slide[] = [
  {
    title: 'Salut, moi c’est Mia !',
    bubble: 'Je suis une marmotte des Alpes, et ta coach nutrition. Je t’aide à manger mieux, simplement, sans prise de tête.',
    points: [
      { icon: HeartPulse, text: 'Je calcule tes besoins à partir de ton profil et de ton objectif.' },
      { icon: Sparkles, text: 'Je te propose un rythme doux et réaliste, jamais de régime extrême.' },
      { icon: ShieldCheck, text: 'Tes données restent dans ton navigateur : rien n’est envoyé ailleurs.' },
    ],
  },
  {
    title: 'Ce que je prépare pour toi',
    bubble: 'Chaque semaine, je m’occupe de l’organisation. Toi, tu cuisines et tu savoures.',
    points: [
      { icon: CalendarDays, text: 'Un menu de 7 jours calé sur tes calories, qui respecte le casher, le halal et tes goûts.' },
      { icon: ChefHat, text: 'Le batch cooking : un plan minuté pour cuisiner en une session.' },
      { icon: ShoppingCart, text: 'La liste de courses par rayon, avec les prix Migros, Coop, Lidl et Aldi.' },
    ],
  },
  {
    title: 'Mes règles d’or',
    bubble: 'On avance pas à pas, comme en montagne. La tendance compte plus que le chiffre d’un jour.',
    points: [
      { icon: LineChart, text: 'Pèse-toi 1 à 2 fois par semaine, le matin : je lisse les variations sur 7 jours.' },
      { icon: HeartPulse, text: 'Je ne descends jamais sous un minimum de calories sûr, et je te dis si tu vas trop vite.' },
      { icon: ShieldCheck, text: 'Je donne des repères, pas un avis médical : parle à un professionnel si besoin.' },
    ],
  },
]

export function Intro({ onDone, doneLabel = 'C’est parti !' }: { onDone: () => void; doneLabel?: string }) {
  const [i, setI] = useState(0)
  const [dir, setDir] = useState(1)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const moved = useRef(false)
  useEffect(() => {
    if (moved.current) headingRef.current?.focus()
  }, [i])
  const go = (n: number) => {
    moved.current = true
    setDir(n > i ? 1 : -1)
    setI(n)
  }
  const slide = SLIDES[i]
  const last = i === SLIDES.length - 1

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4 py-8 sm:py-12">
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm font-semibold text-brand-700">Coach Nutrition</p>
        {!last && (
          <Button variant="ghost" onClick={onDone}>
            Passer l’introduction
          </Button>
        )}
      </div>

      <section aria-labelledby="intro-title" className="flex flex-col gap-6 rounded-3xl bg-white p-6 shadow-sm sm:p-10">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-end">
          <Mia size={180} className="animate-bounce-in shrink-0" />
          <div key={`bulle-${i}`} className="animate-pop-in relative w-full origin-bottom-left rounded-2xl rounded-bl-sm bg-brand-50 p-4 text-brand-900 sm:mb-6" style={{ animationDelay: i === 0 ? '350ms' : '0ms' }}>
            <p className="text-lg leading-relaxed">{slide.bubble}</p>
          </div>
        </div>
        <h1 id="intro-title" key={`titre-${i}`} ref={headingRef} tabIndex={-1} className={`${dir > 0 ? 'animate-slide-in-right' : 'animate-slide-in-left'} text-3xl font-bold outline-none`} aria-live="polite">
          {slide.title}
        </h1>
        <ul key={`points-${i}`} className="stagger flex flex-col gap-3">
          {slide.points.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                <Icon size={18} aria-hidden="true" />
              </span>
              <span className="pt-1.5">{text}</span>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-5">
          <Button variant="secondary" onClick={() => go(i - 1)} disabled={i === 0}>
            <ArrowLeft size={16} aria-hidden="true" /> Retour
          </Button>
          <ol className="flex gap-2" aria-label={`Écran ${i + 1} sur ${SLIDES.length}`}>
            {SLIDES.map((s, k) => (
              <li key={s.title} className={`h-2 rounded-full transition-all ${k === i ? 'w-6 bg-brand-600' : 'w-2 bg-slate-300'}`} />
            ))}
          </ol>
          {last ? (
            <Button onClick={onDone}>
              {doneLabel} <ArrowRight size={16} aria-hidden="true" />
            </Button>
          ) : (
            <Button onClick={() => go(i + 1)}>
              Suivant <ArrowRight size={16} aria-hidden="true" />
            </Button>
          )}
        </div>
      </section>
      <p className="mt-6 text-center text-xs text-muted">{HEALTH_DISCLAIMER}</p>
    </main>
  )
}
