import { useEffect, useState } from 'react'
import { Music, Map as MapIcon, Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { TUTORIAL_STORAGE_KEY } from '@/lib/constants'

const SLIDES = [
  {
    icon: MapIcon,
    title: 'Explore la carte',
    text: 'Tous les pianos publics ajoutés par la communauté apparaissent sur la carte. Clique sur un marker pour voir les détails.'
  },
  {
    icon: Plus,
    title: 'Ajoute un piano',
    text: 'Utilise le bouton + en bas à droite de la carte. Tu peux ajouter à ta position actuelle ou choisir un endroit sur la carte.'
  },
  {
    icon: RefreshCw,
    title: 'Mets à jour les pianos vus',
    text: "Quand tu croises un piano cartographié, signale s'il est toujours là, son état, et laisse un commentaire pour la communauté."
  },
  {
    icon: Music,
    title: 'On y va !',
    text: 'Découvre les pianos autour de toi et fais vivre la communauté.'
  }
]

export function Tutorial() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    // Safari incognito / mode privé peut faire échouer localStorage.
    // Fallback : assume vu (le tuto n'est pas critique) plutôt que re-popper.
    try {
      if (!localStorage.getItem(TUTORIAL_STORAGE_KEY)) setOpen(true)
    } catch {
      setOpen(false)
    }
  }, [])

  if (!open) return null

  const slide = SLIDES[step]
  const Icon = slide.icon
  const isLast = step === SLIDES.length - 1

  const close = () => {
    try {
      localStorage.setItem(TUTORIAL_STORAGE_KEY, '1')
    } catch {
      // localStorage indisponible — on continue, le tuto sera re-vu au prochain mount
      // (acceptable car non-bloquant).
    }
    setOpen(false)
  }

  return (
    <div className="animate-fade-in fixed inset-0 z-[2000] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center">
      <div
        key={step}
        className="animate-slide-up-modal sm:animate-scale-in w-full max-w-sm rounded-t-2xl border border-border bg-popover p-6 shadow-2xl sm:rounded-2xl"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold">{slide.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{slide.text}</p>
        </div>

        <div className="my-6 flex justify-center gap-1.5">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={
                'h-1.5 w-1.5 rounded-full ' + (i === step ? 'bg-primary' : 'bg-border')
              }
            />
          ))}
        </div>

        <div className="flex gap-2">
          {step > 0 && (
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setStep(step - 1)}
            >
              Précédent
            </Button>
          )}
          <Button
            className="flex-1"
            onClick={() => (isLast ? close() : setStep(step + 1))}
          >
            {isLast ? 'Commencer' : 'Suivant'}
          </Button>
        </div>
        <button onClick={close} className="mt-3 w-full text-xs text-muted-foreground">
          Passer
        </button>
      </div>
    </div>
  )
}
