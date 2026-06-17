import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { profileNamesSchema, type ProfileNamesValues } from '@/lib/schemas'
import { FIRST_NAME_MAX, LAST_NAME_MAX } from '@/lib/constants'
import { getErrorMessage } from '@/lib/errors'
import { useAuth } from '@/contexts/AuthContext'

/**
 * v7 — Dialog opt-in pour first_name / last_name.
 *
 * Décision RGPD : champs nullables, default NULL. Le user remplit s'il veut
 * être trouvable par nom dans la recherche (search_users matche les 3
 * colonnes pseudo + first_name + last_name). Empty string → NULL côté DB.
 *
 * Bouton "Effacer" pour repasser à NULL si l'user change d'avis.
 */
export function EditNamesDialog({
  open,
  onClose,
  currentFirstName,
  currentLastName
}: {
  open: boolean
  onClose: () => void
  currentFirstName: string | null
  currentLastName: string | null
}) {
  const { refreshProfile } = useAuth()
  const qc = useQueryClient()

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isDirty }
  } = useForm<ProfileNamesValues>({
    resolver: zodResolver(profileNamesSchema),
    defaultValues: {
      first_name: currentFirstName ?? '',
      last_name: currentLastName ?? ''
    }
  })

  // Resync les defaultValues quand le dialog re-ouvre avec d'autres valeurs.
  useEffect(() => {
    if (open) {
      reset({
        first_name: currentFirstName ?? '',
        last_name: currentLastName ?? ''
      })
    }
  }, [open, currentFirstName, currentLastName, reset])

  const update = useMutation({
    mutationFn: async (values: ProfileNamesValues) => {
      const { error } = await supabase.rpc('update_my_profile_names', {
        p_first: values.first_name?.trim() || null,
        p_last: values.last_name?.trim() || null
      })
      if (error) {
        logger.error('profile.names.update', 'rpc failed', error)
        throw error
      }
      logger.info('profile.names.update', 'success')
    },
    onSuccess: async () => {
      toast.success('Profil mis à jour')
      // Refresh le profile context + invalide les queries qui peuvent dépendre
      // des noms (profile par pseudo, search_users).
      await refreshProfile?.()
      await qc.invalidateQueries({ queryKey: ['profile'] })
      await qc.invalidateQueries({ queryKey: ['users-search'] })
      onClose()
    }
  })

  const onSubmit = (values: ProfileNamesValues) => {
    update.mutate(values)
  }

  const handleClear = () => {
    setValue('first_name', '', { shouldDirty: true })
    setValue('last_name', '', { shouldDirty: true })
  }

  return (
    <Dialog open={open} onClose={onClose} title="Nom et prénom">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Optionnel. Aide tes amis à te retrouver par nom plutôt que par pseudo. Tu peux
          les laisser vides ou les supprimer à tout moment.
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="first-name">Prénom</Label>
          <Input
            id="first-name"
            maxLength={FIRST_NAME_MAX}
            autoComplete="given-name"
            {...register('first_name')}
          />
          {errors.first_name && (
            <p className="text-xs text-destructive">{errors.first_name.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="last-name">Nom</Label>
          <Input
            id="last-name"
            maxLength={LAST_NAME_MAX}
            autoComplete="family-name"
            {...register('last_name')}
          />
          {errors.last_name && (
            <p className="text-xs text-destructive">{errors.last_name.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-2 pt-1 sm:flex-row">
          <Button
            type="button"
            variant="ghost"
            className="sm:flex-1"
            onClick={handleClear}
            disabled={update.isPending}
          >
            Effacer
          </Button>
          <Button
            type="submit"
            className="sm:flex-1"
            loading={update.isPending}
            disabled={update.isPending || !isDirty}
          >
            Enregistrer
          </Button>
        </div>

        {update.error && (
          <p className="text-xs text-destructive">
            {getErrorMessage(update.error, 'Erreur lors de la mise à jour')}
          </p>
        )}
      </form>
    </Dialog>
  )
}
