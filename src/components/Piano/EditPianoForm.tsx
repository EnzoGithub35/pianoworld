import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Camera, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/errors'
import { PIANO_COMMENT_MAX } from '@/lib/constants'
import { uploadPianoPhoto, deletePianoPhoto, validatePhotoFile } from '@/lib/photo'
import { pianoFormSchema } from '@/lib/schemas'
import {
  PIANO_QUALITIES,
  QUALITY_LABELS,
  type Piano,
  type PianoQuality
} from '@/types/database'

export function EditPianoForm({
  piano,
  onClose
}: {
  piano: Piano
  onClose: () => void
}) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [address, setAddress] = useState(piano.address)
  const [comment, setComment] = useState(piano.comment)
  const [quality, setQuality] = useState<PianoQuality>(piano.quality)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(piano.photo_url)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!photoFile) return
    const url = URL.createObjectURL(photoFile)
    setPhotoPreview(url)
    setRemovePhoto(false)
    return () => URL.revokeObjectURL(url)
  }, [photoFile])

  const handleRemovePhoto = () => {
    setPhotoFile(null)
    setPhotoPreview(null)
    setRemovePhoto(true)
  }

  const handleSubmit = async () => {
    if (!user) return
    const parsed = pianoFormSchema.safeParse({ address, comment, quality })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Formulaire invalide')
      return
    }
    setSubmitting(true)
    try {
      let photo_url: string | null = piano.photo_url
      if (photoFile) {
        if (piano.photo_url) await deletePianoPhoto(piano.photo_url)
        photo_url = await uploadPianoPhoto(photoFile, user.id)
      } else if (removePhoto && piano.photo_url) {
        await deletePianoPhoto(piano.photo_url)
        photo_url = null
      }
      const { error } = await supabase
        .from('pianos')
        .update({
          address: parsed.data.address,
          comment: parsed.data.comment,
          quality: parsed.data.quality,
          photo_url
        })
        .eq('id', piano.id)
      if (error) {
        logger.error('piano.edit', 'update failed', error, { pianoId: piano.id })
        throw error
      }
      logger.info('piano.edit', 'success', { pianoId: piano.id })
      toast.success('Modifications enregistrées')
      await queryClient.invalidateQueries({ queryKey: ['piano', piano.id] })
      await queryClient.invalidateQueries({ queryKey: ['pianos'] })
      onClose()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Erreur de mise à jour'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border p-4">
        <h2 className="text-lg font-semibold">Modifier le piano</h2>
        <button onClick={onClose} aria-label="Fermer">
          <X className="h-6 w-6" />
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="space-y-2">
          <Label htmlFor="address">Adresse</Label>
          <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>Photo</Label>
          <div className="flex items-center gap-3">
            <label className="flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-md border-2 border-dashed border-border bg-muted text-muted-foreground hover:bg-accent">
              {photoPreview ? (
                <img src={photoPreview} alt="aperçu" className="h-full w-full object-cover" />
              ) : (
                <Camera className="h-6 w-6" />
              )}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  try {
                    validatePhotoFile(f)
                    setPhotoFile(f)
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Image invalide')
                    e.target.value = ''
                  }
                }}
              />
            </label>
            {photoPreview && (
              <button type="button" onClick={handleRemovePhoto} className="text-xs text-destructive">
                Retirer la photo
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Qualité</Label>
          <div className="grid grid-cols-2 gap-2">
            {PIANO_QUALITIES.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setQuality(q)}
                className={
                  'rounded-md border px-3 py-2 text-sm ' +
                  (q === quality
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background hover:bg-accent')
                }
              >
                {QUALITY_LABELS[q]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="comment">Commentaire</Label>
          <Textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={PIANO_COMMENT_MAX}
          />
          <p className="text-right text-xs text-muted-foreground">
            {comment.length}/{PIANO_COMMENT_MAX}
          </p>
        </div>
      </div>

      <footer
        className="border-t border-border bg-background p-4"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <Button onClick={handleSubmit} loading={submitting} className="w-full">
          Enregistrer les modifications
        </Button>
      </footer>
    </div>
  )
}
