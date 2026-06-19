import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/AuthContext'
import { getErrorMessage } from '@/lib/errors'
import { signupSchema, type SignupValues } from '@/lib/schemas'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { FormError } from '@/components/ui/FormError'

export function SignupForm() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<SignupValues>({ resolver: zodResolver(signupSchema) })

  const onSubmit = async (values: SignupValues) => {
    setSubmitting(true)
    try {
      const result = await signUp(values.email, values.password, values.pseudo)
      if (result.needsConfirmation) {
        navigate(`/auth/confirm-pending?email=${encodeURIComponent(result.email)}`)
        return
      }
      toast.success('Bienvenue !')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Inscription échouée'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="pseudo">Pseudo</Label>
        <Input
          id="pseudo"
          autoComplete="username"
          aria-invalid={!!errors.pseudo}
          aria-describedby={errors.pseudo ? 'pseudo-error' : undefined}
          {...register('pseudo')}
        />
        {errors.pseudo && (
          <FormError id="pseudo-error">{errors.pseudo.message}</FormError>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          {...register('email')}
        />
        {errors.email && <FormError id="email-error">{errors.email.message}</FormError>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'password-error' : undefined}
          {...register('password')}
        />
        {errors.password && (
          <FormError id="password-error">{errors.password.message}</FormError>
        )}
      </div>
      <div className="space-y-1.5">
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            aria-invalid={!!errors.acceptCgu}
            aria-describedby={errors.acceptCgu ? 'cgu-error' : undefined}
            className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            {...register('acceptCgu')}
          />
          <span className="text-xs leading-snug text-muted-foreground">
            J'ai lu et j'accepte les{' '}
            <Link
              to="/legal#cgu"
              target="_blank"
              className="font-medium text-primary underline"
            >
              CGU
            </Link>{' '}
            et la{' '}
            <Link
              to="/legal#privacy"
              target="_blank"
              className="font-medium text-primary underline"
            >
              politique de confidentialité
            </Link>
            .
          </span>
        </label>
        {errors.acceptCgu && (
          <FormError id="cgu-error">{errors.acceptCgu.message}</FormError>
        )}
      </div>
      <Button type="submit" className="w-full" loading={submitting}>
        Créer mon compte
      </Button>
    </form>
  )
}
