import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/AuthContext'
import { getErrorMessage } from '@/lib/errors'
import { loginSchema, type LoginValues } from '@/lib/schemas'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'

export function LoginForm() {
  const { signIn } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (values: LoginValues) => {
    setSubmitting(true)
    try {
      await signIn(values.email, values.password)
      toast.success('Connecté')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Connexion échouée'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...register('email')} />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register('password')}
        />
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>
      <Button type="submit" className="w-full" loading={submitting}>
        Se connecter
      </Button>
    </form>
  )
}
