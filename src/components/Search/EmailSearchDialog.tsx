import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AtSign } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Avatar } from '@/components/ui/Avatar'
import { FormError } from '@/components/ui/FormError'
import { HelpTooltip } from '@/components/ui/HelpTooltip'
import { emailSearchSchema, type EmailSearchValues } from '@/lib/schemas'
import { useEmailSearch } from '@/hooks/useEmailSearch'
import { getFriendlyErrorMessage } from '@/lib/errors'
import { RATE_LIMITS } from '@/lib/constants'
import type { UserSearchResult } from '@/types/database'

/**
 * v7 — Dialog modal "Chercher par email".
 *
 * Flow séparé de la recherche pseudo car :
 *  - RPC `find_user_by_email` est **rate-limité 5/24h serveur** (anti
 *    account-enumeration).
 *  - Submit explicite (pas de debounce) → on ne crame pas le quota au
 *    moindre keypress.
 *  - Réponse : 0 ou 1 row max. 0 = inexistant OU banni (pas de leak
 *    d'existence).
 */
export function EmailSearchDialog({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}) {
  const [result, setResult] = useState<UserSearchResult | null | 'not-found'>(null)
  const search = useEmailSearch()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<EmailSearchValues>({
    resolver: zodResolver(emailSearchSchema)
  })

  const handleClose = () => {
    reset()
    setResult(null)
    onClose()
  }

  const onSubmit = async (values: EmailSearchValues) => {
    setResult(null)
    try {
      const found = await search.mutateAsync(values.email)
      setResult(found ?? 'not-found')
    } catch {
      // L'erreur est rendue dans le rendering ci-dessous via search.error
    }
  }

  const error = search.error

  return (
    <Dialog open={open} onClose={handleClose} title="Chercher par email">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="email-search">Email exact</Label>
          <Input
            id="email-search"
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="ami@example.com"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-search-error' : undefined}
            {...register('email')}
          />
          {errors.email && (
            <FormError id="email-search-error">{errors.email.message}</FormError>
          )}
        </div>

        <div className="flex items-start gap-1.5">
          <p className="flex-1 text-[11px] text-muted-foreground">
            Limite : {RATE_LIMITS.user_search_email.count} recherches par{' '}
            {RATE_LIMITS.user_search_email.windowLabel}. L'email reste privé — seul le
            pseudo est révélé si la personne existe.
          </p>
          <HelpTooltip label="Pourquoi cette limite">
            La recherche par email exact est limitée pour éviter qu'un attaquant scanne
            toute une liste d'emails (énumération de comptes). C'est aussi pour ça qu'on
            ne dit jamais si un compte existe vraiment — seul un pseudo est révélé si
            match.
          </HelpTooltip>
        </div>

        <Button
          type="submit"
          className="w-full"
          loading={search.isPending}
          disabled={search.isPending}
        >
          Chercher
        </Button>
      </form>

      {/* Résultats post-submit */}
      {result && result !== 'not-found' && (
        <div className="mt-4 rounded-xl border border-border bg-card p-3">
          <Link
            to={`/user/${result.pseudo}`}
            onClick={handleClose}
            className="flex items-center gap-3"
          >
            <Avatar pseudo={result.pseudo} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">@{result.pseudo}</p>
              {(result.first_name || result.last_name) && (
                <p className="truncate text-xs text-muted-foreground">
                  {[result.first_name, result.last_name].filter(Boolean).join(' ')}
                </p>
              )}
            </div>
          </Link>
        </div>
      )}

      {result === 'not-found' && (
        <div className="mt-4 rounded-md border border-dashed border-border px-3 py-3 text-center">
          <AtSign className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
          <p className="text-sm">Aucun compte avec cet email</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Vérifie l'orthographe ou demande à ta personne son pseudo.
          </p>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {getFriendlyErrorMessage(error, {
            fallback: 'Erreur lors de la recherche',
            rateLimitLabels: RATE_LIMITS
          })}
        </div>
      )}
    </Dialog>
  )
}
