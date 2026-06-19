import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/errors'
import { resetPasswordSchema, type ResetPasswordValues } from '@/lib/schemas'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { FormError } from '@/components/ui/FormError'

export function ResetPasswordForm() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<ResetPasswordValues>({ resolver: zodResolver(resetPasswordSchema) })

  const onSubmit = async (values: ResetPasswordValues) => {
    setSubmitting(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: values.password })
      if (error) {
        logger.warn('auth.resetPassword.update', 'failed', { message: error.message })
        throw error
      }
      toast.success('Mot de passe mis à jour')
      navigate('/', { replace: true })
    } catch (err) {
      toast.error(getErrorMessage(err, 'Échec de la mise à jour'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">Nouveau mot de passe</Label>
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
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirmer</Label>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.confirm}
          aria-describedby={errors.confirm ? 'confirm-error' : undefined}
          {...register('confirm')}
        />
        {errors.confirm && (
          <FormError id="confirm-error">{errors.confirm.message}</FormError>
        )}
      </div>
      <Button type="submit" className="w-full" loading={submitting}>
        Mettre à jour
      </Button>
    </form>
  )
}
