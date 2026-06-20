import { useEffect, useState, useMemo, useRef } from 'react'
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import {
  Crosshair,
  MapPin,
  X,
  Camera,
  Loader2,
  AlertTriangle,
  Search
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { Dialog } from '@/components/ui/Dialog'
import { useAuth } from '@/contexts/AuthContext'
import { useGeolocation } from '@/hooks/useGeolocation'
import { usePianos } from '@/hooks/usePianos'
import { reverseGeocode, searchAddress, type GeocodeResult } from '@/lib/geocoding'
import { uploadPianoPhoto, deletePianoPhoto, validatePhotoFile } from '@/lib/photo'
import { haversineMeters } from '@/lib/distance'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { getErrorMessage, getFriendlyErrorMessage } from '@/lib/errors'
import { pianoFormSchema } from '@/lib/schemas'
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  DUPLICATE_DISTANCE_METERS,
  PIANO_COMMENT_MAX,
  RATE_LIMITS
} from '@/lib/constants'
import { PIANO_QUALITIES, QUALITY_LABELS, type PianoQuality } from '@/types/database'

// Le visuel est un cercle 40x40 (rounded-full) avec un ring extérieur — pas un
// pin pointu en bas. Pour un cercle, l'anchor doit être au CENTRE [20, 20]
// pour que le centre visuel coïncide avec le latlng cliqué. Avec [20, 20] :
// (le précédent [20, 40] = bottom-center plaçait le cercle 20px au-dessus du clic).
const draggableIcon = L.divIcon({
  className: 'drag-pin',
  html: `<div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-primary/30">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Z"/></svg>
  </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20]
})

function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng)
    }
  })
  return null
}

export function AddPianoFlow({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const { locate, loading: locating } = useGeolocation()
  const { data: pianos } = usePianos()
  const queryClient = useQueryClient()

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [center, setCenter] = useState<[number, number]>([...DEFAULT_MAP_CENTER])
  const [address, setAddress] = useState('')
  const [resolvingAddress, setResolvingAddress] = useState(false)
  const [comment, setComment] = useState('')
  const [quality, setQuality] = useState<PianoQuality>('bon_etat')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)

  // Sprint 6 — Autocomplete Photon pour résoudre le cas "ajouter un piano à
  // distance" (audit P0). Trois sources peuvent setter `address` :
  //  - reverseGeocode après geoloc/clic carte → ne PAS re-trigger l'autocomplete
  //  - typing user → trigger debounce 300ms + suggestions Photon
  //  - pick suggestion → set address + coords + center map
  // `skipAutocompleteRef` discrimine les sources sans re-render extra.
  const [addressSuggestions, setAddressSuggestions] = useState<GeocodeResult[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchingAddress, setSearchingAddress] = useState(false)
  const skipAutocompleteRef = useRef(false)

  /**
   * Le form est "dirty" si l'utilisateur a touché à au moins un champ texte ou photo.
   * Note : on N'inclut PAS `coords` seul — un user qui ouvre le flow et pose juste
   * la position sans rien d'autre ne devrait pas se voir demander une confirmation.
   */
  const isDirty = address.trim().length > 0 || comment.trim().length > 0 || !!photoFile

  useEffect(() => {
    if (!coords) return
    setResolvingAddress(true)
    // Marqueur : la prochaine setAddress vient du reverseGeocode → on saute le
    // debounce autocomplete qui se déclencherait sinon en cascade.
    skipAutocompleteRef.current = true
    reverseGeocode(coords.lat, coords.lng)
      .then((label) => setAddress(label))
      .finally(() => setResolvingAddress(false))
  }, [coords])

  // Sprint 6 — Debounce 300ms sur address pour autocomplete Photon. Skip si
  // address vient d'un reverseGeocode (skipAutocompleteRef) ou d'un pick
  // suggestion. < 3 chars → clear suggestions sans appel réseau.
  useEffect(() => {
    if (skipAutocompleteRef.current) {
      skipAutocompleteRef.current = false
      return
    }
    if (address.trim().length < 3) {
      setAddressSuggestions([])
      setShowSuggestions(false)
      return
    }
    const t = window.setTimeout(() => {
      setSearchingAddress(true)
      searchAddress(address)
        .then((results) => {
          setAddressSuggestions(results)
          setShowSuggestions(results.length > 0)
        })
        .catch(() => {
          // Photon down → silencieux, user peut toujours cliquer la carte
          setAddressSuggestions([])
          setShowSuggestions(false)
        })
        .finally(() => setSearchingAddress(false))
    }, 300)
    return () => window.clearTimeout(t)
  }, [address])

  const pickSuggestion = (s: GeocodeResult) => {
    // Pick = source unique : set coords + address + center map. On saute le
    // reverseGeocode (qui re-set la même address au caractère près) en
    // marquant skipAutocompleteRef AVANT setAddress.
    skipAutocompleteRef.current = true
    setAddress(s.label)
    setCoords({ lat: s.lat, lng: s.lng })
    setCenter([s.lat, s.lng])
    setShowSuggestions(false)
    setAddressSuggestions([])
  }

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview(null)
      return
    }
    const url = URL.createObjectURL(photoFile)
    setPhotoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photoFile])

  const nearbyDuplicate = useMemo(() => {
    if (!coords || !pianos) return null
    return (
      pianos.find(
        (p) =>
          haversineMeters(coords, { lat: p.lat, lng: p.lng }) < DUPLICATE_DISTANCE_METERS
      ) ?? null
    )
  }, [coords, pianos])

  const useMyLocation = async () => {
    try {
      const c = await locate()
      setCoords(c)
      setCenter([c.lat, c.lng])
    } catch (err) {
      // Géoloc refusée ou indisponible → CTA fallback clair.
      toast.error(
        getErrorMessage(
          err,
          'Position indisponible. Tu peux toucher la carte ou taper une adresse.'
        )
      )
    }
  }

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      validatePhotoFile(file)
      setPhotoFile(file)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Image invalide'))
      e.target.value = ''
    }
  }

  const requestClose = () => {
    if (isDirty) setConfirmClose(true)
    else onClose()
  }

  const handleSubmit = async () => {
    // Guard contre les double-clics rapides AVANT que setSubmitting(true) ne propage.
    if (submitting) return
    if (!user) return
    if (!coords) {
      toast.error('Choisis une position')
      return
    }
    const parsed = pianoFormSchema.safeParse({ address, comment, quality })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Formulaire invalide')
      return
    }
    setSubmitting(true)
    // Photo upload déclaré au scope du handler pour permettre le rollback en catch.
    let photo_url: string | null = null
    try {
      if (photoFile) {
        photo_url = await uploadPianoPhoto(photoFile, user.id)
      }
      const { error } = await supabase.from('pianos').insert({
        created_by: user.id,
        lat: coords.lat,
        lng: coords.lng,
        address: parsed.data.address,
        comment: parsed.data.comment,
        quality: parsed.data.quality,
        photo_url
      })
      if (error) {
        logger.error('piano.add', 'insert failed', error, {
          userId: user.id,
          hasPhoto: !!photo_url
        })
        throw error
      }
      logger.info('piano.add', 'success', { userId: user.id, hasPhoto: !!photo_url })
      toast.success('Piano ajouté !')
      await queryClient.invalidateQueries({ queryKey: ['pianos'] })
      onClose()
    } catch (err) {
      // Rollback : si la photo a été uploadée mais que l'insert piano a échoué
      // (rate limit, RLS, network), supprime la photo orpheline du Storage pour
      // ne pas polluer le quota. Best-effort, ne bloque pas le toast d'erreur.
      if (photo_url) {
        await deletePianoPhoto(photo_url).catch(() => {})
      }
      toast.error(
        getFriendlyErrorMessage(err, {
          fallback: "Erreur d'ajout",
          rateLimitLabels: RATE_LIMITS
        })
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="animate-slide-up-modal fixed inset-0 z-[1000] flex flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 pb-3 pt-safe-form-top">
        <h2 className="text-lg font-semibold">Ajouter un piano</h2>
        <button
          onClick={requestClose}
          aria-label="Fermer"
          className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-accent"
        >
          <X className="h-6 w-6" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="relative h-64 w-full">
          <MapContainer
            center={center}
            zoom={coords ? 16 : DEFAULT_MAP_ZOOM}
            scrollWheelZoom
            zoomControl={false}
            className="h-full w-full"
            key={`${center[0]}-${center[1]}`}
          >
            {/* Tuiles CartoDB Voyager pour cohérence avec PianoMap.tsx
               et éviter le bug de fond gris en preview Vercel (cf. commit
               fix(map) — voyager est plus robuste qu'OSM direct). */}
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              attribution="&copy; OSM &copy; CARTO"
              maxZoom={19}
            />
            <MapClickHandler onPick={(lat, lng) => setCoords({ lat, lng })} />
            {coords && (
              <Marker
                position={[coords.lat, coords.lng]}
                icon={draggableIcon}
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const ll = e.target.getLatLng()
                    setCoords({ lat: ll.lat, lng: ll.lng })
                  }
                }}
              />
            )}
          </MapContainer>
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="absolute right-3 top-3 z-[500] flex items-center gap-1.5 rounded-full bg-background px-3 py-2 text-xs font-medium text-foreground shadow-md ring-1 ring-border hover:bg-accent disabled:opacity-60"
          >
            {locating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Crosshair className="h-4 w-4" />
            )}
            Ma position
          </button>
        </div>

        <div className="space-y-4 p-4">
          {!coords && (
            <div className="flex items-center gap-2 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
              <MapPin className="h-4 w-4" /> Clique sur la carte ou utilise « Ma position
              ».
            </div>
          )}

          {nearbyDuplicate && (
            <div className="flex items-start gap-2 rounded-md border border-orange-300 bg-orange-50 p-3 text-xs text-orange-900 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <strong>
                  Un piano existe déjà à moins de {DUPLICATE_DISTANCE_METERS}m :
                </strong>{' '}
                {nearbyDuplicate.address}. Tu peux quand même l'ajouter si c'est un piano
                distinct.
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="address">Adresse</Label>
            <div className="relative">
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onFocus={() => {
                  if (addressSuggestions.length > 0) setShowSuggestions(true)
                }}
                onBlur={() => {
                  // Delay pour permettre au onMouseDown du dropdown de fire avant
                  // que le blur close les suggestions.
                  window.setTimeout(() => setShowSuggestions(false), 150)
                }}
                placeholder={
                  resolvingAddress
                    ? 'Résolution…'
                    : 'Tape une adresse ou clique sur la carte'
                }
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={showSuggestions}
                aria-controls="address-suggestions"
              />
              {searchingAddress && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
              {showSuggestions && addressSuggestions.length > 0 && (
                <ul
                  id="address-suggestions"
                  role="listbox"
                  className="absolute inset-x-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-popover shadow-lg"
                >
                  {addressSuggestions.map((s, i) => (
                    <li
                      key={`${s.lat}-${s.lng}-${i}`}
                      role="option"
                      aria-selected={false}
                    >
                      <button
                        type="button"
                        // onMouseDown plutôt que onClick pour fire AVANT le onBlur
                        // de l'Input (sinon le blur close avant que le click ne hit)
                        onMouseDown={(e) => {
                          e.preventDefault()
                          pickSuggestion(s)
                        }}
                        className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                      >
                        <Search className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                        <span className="flex-1 leading-snug">{s.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Tape une adresse pour ajouter un piano que tu ne vois pas sur la carte.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Photo (optionnelle)</Label>
            <div className="flex items-center gap-3">
              <label className="flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-md border-2 border-dashed border-border bg-muted text-muted-foreground hover:bg-accent">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="aperçu"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Camera className="h-6 w-6" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhoto}
                />
              </label>
              {photoFile && (
                <button
                  type="button"
                  onClick={() => setPhotoFile(null)}
                  className="text-xs text-destructive"
                >
                  Retirer
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
                    'rounded-md border px-3 py-2 text-sm transition-colors ' +
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
            <Label htmlFor="comment">
              Commentaire <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ouverture, accessibilité, état précis…"
              maxLength={PIANO_COMMENT_MAX}
            />
            <p className="text-right text-xs text-muted-foreground">
              {comment.length}/{PIANO_COMMENT_MAX}
            </p>
          </div>
        </div>
      </div>

      <footer className="border-t border-border bg-background p-4 pb-safe-fab">
        <Button onClick={handleSubmit} loading={submitting} className="w-full">
          Ajouter ce piano
        </Button>
      </footer>

      <Dialog
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        title="Abandonner ce piano ?"
      >
        <p className="mb-4 text-sm text-muted-foreground">
          Tu as commencé à remplir ce piano. Si tu fermes maintenant, les informations
          seront perdues.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setConfirmClose(false)}
          >
            Continuer
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={() => {
              setConfirmClose(false)
              onClose()
            }}
          >
            Abandonner
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
