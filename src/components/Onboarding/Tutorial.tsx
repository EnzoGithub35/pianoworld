import { useEffect, useState } from 'react'
import { Music, Map as MapIcon, Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { TUTORIAL_STORAGE_KEY } from '@/lib/constants'

const SLIDES = [
  {
    icon: MapIcon,
    title: 'Explore la carte',
    text: "Tous les pianos publics ajoutés par la communauté apparaissent sur la carte. Clique sur un marker pour voir les détails."
  },
  {
    icon: Plus,
    title: 'Ajoute un piano',
    text: "Utilise le bouton + en bas à droite de la carte. Tu peux ajouter à ta position actuelle ou choisir un endroit sur la carte."
  },
  {
    icon: RefreshCw,
    title: 'Mets-le à jour',
    text: "Quand tu passes devant un piano, indique s'il est toujours là et son état. Ça aide tout le monde."
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
    if (!localStorage.getItem(TUTORIAL_STORAGE_KEY)) setOpen(true)
  }, [])

  if (!open) return null

  const slide = SLIDES[step]
  const Icon = slide.icon
  const isLast = step === SLIDES.length - 1

  const close = () => {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, '1')
    setOpen(false)
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-fade-in sm:items-center">
      <div
        key={step}
        className="w-full max-w-sm rounded-t-2xl border border-border bg-popover p-6 shadow-2xl animate-slide-up-modal sm:rounded-2xl sm:animate-scale-in"
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
                'h-1.5 w-1.5 rounded-full ' +
                (i === step ? 'bg-primary' : 'bg-border')
              }
            />
          ))}
        </div>

        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="outline" className="flex-1" onClick={() => setStep(step - 1)}>
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
