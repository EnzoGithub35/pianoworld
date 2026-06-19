import { type ReactNode } from 'react'

/**
 * Message d'erreur de formulaire lié au champ via `aria-describedby`.
 *
 * Usage (Sprint 4 audit P2 — liaison erreur↔champ pour lecteurs d'écran) :
 *
 *   <Input
 *     id="email"
 *     aria-invalid={!!errors.email}
 *     aria-describedby={errors.email ? 'email-error' : undefined}
 *     {...register('email')}
 *   />
 *   {errors.email && <FormError id="email-error">{errors.email.message}</FormError>}
 *
 * `role="alert"` fait annoncer le message au moment où il apparaît.
 */
export function FormError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="text-xs text-destructive">
      {children}
    </p>
  )
}
