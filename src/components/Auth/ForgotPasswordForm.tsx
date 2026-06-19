import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/AuthContext'
import { getErrorMessage } from '@/lib/errors'
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/lib/schemas'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { FormError } from '@/components/ui/FormError'

export function ForgotPasswordForm() {
  const { resetPassword } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema) })

  const onSubmit = async (values: ForgotPasswordValues) => {
    setSubmitting(true)
    try {
      await resetPassword(values.email)
      setSent(true)
      toast.success('Email envoyé')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Envoi échoué'))
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm">
        Si un compte existe, un email contenant un lien de réinitialisation t'a été
        envoyé.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
      <Button type="submit" className="w-full" loading={submitting}>
        Envoyer le lien de réinitialisation
      </Button>
    </form>
  )
}
