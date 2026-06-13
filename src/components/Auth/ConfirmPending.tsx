import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import { getErrorMessage } from '@/lib/errors'

/**
 * Écran d'attente de confirmation par email (post-signup).
 *
 * Bouton "Renvoyer l'email" rate-limité côté client (cooldown 60s) — Supabase
 * applique aussi son propre rate limit côté serveur. Le cooldown est juste
 * pour donner un feedback UX, pas une mesure de sécurité.
 */
export function ConfirmPending() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { resendConfirmation } = useAuth()
  const email = params.get('email') ?? ''
  const [submitting, setSubmitting] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => window.clearTimeout(t)
  }, [cooldown])

  const handleResend = async () => {
    if (!email) {
      toast.error("Email manquant, recommence l'inscription")
      navigate('/auth/signup')
      return
    }
    setSubmitting(true)
    try {
      await resendConfirmation(email)
      toast.success('Email renvoyé. Vérifie aussi tes spams.')
      setCooldown(60)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Envoi échoué'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Mail className="h-7 w-7" />
      </div>
      <div>
        <p className="text-sm">
          On vient de t'envoyer un lien de confirmation à{' '}
          <strong className="font-mono text-foreground">{email || 'ton adresse'}</strong>.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Clique sur le lien dans l'email pour activer ton compte, puis reviens ici pour
          te connecter.
        </p>
      </div>
      <div className="space-y-2 pt-2">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          loading={submitting}
          disabled={cooldown > 0}
          onClick={handleResend}
        >
          {cooldown > 0 ? `Renvoyer (${cooldown}s)` : "Renvoyer l'email"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => navigate('/auth/login')}
        >
          Aller à la connexion
        </Button>
      </div>
    </div>
  )
}
