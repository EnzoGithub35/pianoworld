import imageCompression from 'browser-image-compression'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import {
  PHOTO_BUCKET,
  PHOTO_JPEG_QUALITY,
  PHOTO_MAX_DIMENSION,
  PHOTO_MAX_SIZE_MB
} from '@/lib/constants'

/** Taille max acceptée AVANT compression (sécurité contre les fichiers énormes). */
const MAX_INPUT_SIZE_MB = 20
const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif'
]

/**
 * Valide un fichier avant compression. Throw un Error avec un message lisible
 * si invalide. À appeler juste après la sélection du fichier.
 */
export function validatePhotoFile(file: File): void {
  if (!file.type.startsWith('image/')) {
    throw new Error('Le fichier doit être une image')
  }
  if (
    file.type &&
    !ACCEPTED_TYPES.includes(file.type) &&
    !file.type.startsWith('image/')
  ) {
    throw new Error('Format non supporté (JPG, PNG, WebP, HEIC)')
  }
  const sizeMB = file.size / (1024 * 1024)
  if (sizeMB > MAX_INPUT_SIZE_MB) {
    throw new Error(
      `Image trop lourde (${sizeMB.toFixed(1)} Mo, max ${MAX_INPUT_SIZE_MB} Mo)`
    )
  }
}

/**
 * Compresse une photo côté client avant upload pour économiser le quota Storage.
 * Cible : <200 Ko / 1024px de côté max, JPEG.
 *
 * Sprint 7 sécu (A.7 backlog) — Strip RGPD des metadata EXIF (notamment GPS) :
 *  - `preserveExif: false` (default lib mais explicité pour intention) garantit
 *    que les coordonnées GPS encodées par iOS/Android dans la photo d'un piano
 *    prise depuis le domicile NE FUITENT PAS sur le bucket Storage public.
 *  - Le re-encode JPEG via canvas (browser-image-compression) recrée les pixels
 *    sans copier les marqueurs EXIF/IPTC/XMP. La rotation visuelle est
 *    conservée séparément via `exifOrientation` calculé avant strip.
 *  - Test régression : src/lib/__tests__/photo.test.ts vérifie qu'une image
 *    avec un marqueur EXIF injecté ressort sans ce marqueur.
 */
export async function compressPhoto(file: File): Promise<File> {
  logger.debug('photo.compress', 'starting', {
    name: file.name,
    sizeKB: Math.round(file.size / 1024)
  })
  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: PHOTO_MAX_SIZE_MB,
      maxWidthOrHeight: PHOTO_MAX_DIMENSION,
      useWebWorker: true,
      fileType: 'image/jpeg',
      initialQuality: PHOTO_JPEG_QUALITY,
      // RGPD A.7 — strip EXIF (GPS, device, etc.). Explicite vs default lib.
      preserveExif: false
    })
    logger.debug('photo.compress', 'done', {
      beforeKB: Math.round(file.size / 1024),
      afterKB: Math.round(compressed.size / 1024)
    })
    return compressed
  } catch (err) {
    logger.error('photo.compress', 'compression failed', err, { name: file.name })
    throw err
  }
}

/**
 * Compresse et upload une photo dans le bucket public. Retourne l'URL publique.
 * Le path inclut l'userId pour la traçabilité et la RLS de suppression.
 */
export async function uploadPianoPhoto(file: File, userId: string): Promise<string> {
  const compressed = await compressPhoto(file)
  const path = `${userId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, compressed, { contentType: 'image/jpeg', upsert: false })
  if (error) {
    logger.error('photo.upload', 'storage upload failed', error, { path, userId })
    throw error
  }
  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path)
  logger.info('photo.upload', 'uploaded', { path })
  return data.publicUrl
}

/**
 * Supprime une photo via son URL publique. Best-effort : log mais ne throw pas
 * (suppression de photo orpheline ne doit pas bloquer la suppression d'un piano).
 */
export async function deletePianoPhoto(publicUrl: string): Promise<void> {
  const marker = `/${PHOTO_BUCKET}/`
  const idx = publicUrl.indexOf(marker)
  if (idx === -1) {
    logger.warn('photo.delete', 'URL malformed, skipping', { publicUrl })
    return
  }
  const path = publicUrl.slice(idx + marker.length)
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove([path])
  if (error) {
    logger.warn('photo.delete', 'remove failed (non-fatal)', {
      path,
      error: error.message
    })
  } else {
    logger.debug('photo.delete', 'removed', { path })
  }
}
