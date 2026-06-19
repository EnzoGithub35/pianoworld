import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Bell, Music, Map as MapIcon, Plus, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import { TUTORIAL_STORAGE_KEY } from '@/lib/constants'
import { pushSupported, subscribeToPush } from '@/lib/web-push'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'

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
    icon: Bell,
    title: 'Reste informé',
    text: "Active les notifications pour savoir quand un ami arrive sur un piano, quand un favori est mis à jour, ou quand quelqu'un commente le tien. Tu pourras ajuster ça plus tard dans les Paramètres."
  },
  {
    icon: Music,
    title: 'On y va !',
    text: 'Découvre les pianos autour de toi et fais vivre la communauté.'
  }
]

const PUSH_SLIDE_INDEX = 3 // Slide "Reste informé"

export function Tutorial() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [subscribing, setSubscribing] = useState(false)

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

  const enablePush = async () => {
    if (!user || subscribing) return
    setSubscribing(true)
    try {
      const ok = await subscribeToPush(user.id)
      if (ok) {
        // Activer aussi le toggle push_enabled dans notification_preferences
        // pour que le user reçoive effectivement les notifs (le subscribe seul
        // ne suffit pas — l'Edge Function check push_enabled).
        await supabase
          .from('notification_preferences')
          .update({ push_enabled: true })
          .eq('user_id', user.id)
        toast.success('Notifications activées')
      } else {
        toast('Notifications refusées par le navigateur', { icon: '🔕' })
      }
    } catch (err) {
      logger.warn('tutorial.push.subscribe', 'failed', { err })
      toast.error("Impossible d'activer les notifications")
    } finally {
      setSubscribing(false)
      // Avance au slide suivant après tentative (succès ou échec)
      setStep((s) => Math.min(s + 1, SLIDES.length - 1))
    }
  }

  return (
    <div className="animate-fade-in fixed inset-0 z-[2000] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center">
      <div
        key={step}
        className="animate-slide-up-modal sm:animate-scale-in relative w-full max-w-sm rounded-t-2xl border border-border bg-popover p-6 shadow-2xl sm:rounded-2xl"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
      >
        {/* Sprint 6 — X header visible pour skip rapide (avant : seul le lien
            "Passer le tutoriel" en bas, peu visible mobile). Garde aussi le
            skip link en bas pour les users qui scrollent jusqu'au final. */}
        <button
          type="button"
          onClick={close}
          aria-label="Fermer le tutoriel"
          className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

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

        {step === PUSH_SLIDE_INDEX ? (
          <div className="flex flex-col gap-2">
            {pushSupported() && user ? (
              <Button
                className="w-full gap-2"
                onClick={enablePush}
                loading={subscribing}
                disabled={subscribing}
              >
                <Bell className="h-4 w-4" />
                Activer les notifications
              </Button>
            ) : (
              <p className="rounded-md bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
                {!user
                  ? 'Connecte-toi pour activer les notifications.'
                  : 'Notifications push non supportées par ton navigateur.'}
              </p>
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setStep(step + 1)}
            >
              Plus tard (réglable dans Paramètres)
            </Button>
          </div>
        ) : (
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
        )}
        <button onClick={close} className="mt-3 w-full text-xs text-muted-foreground">
          Passer le tutoriel
        </button>
      </div>
    </div>
  )
}
