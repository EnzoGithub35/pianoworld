import { logger } from '@/lib/logger'
import { supabase } from '@/lib/supabase'
import { VAPID_PUBLIC_KEY_FALLBACK } from '@/lib/constants'

/**
 * Web Push côté client.
 *
 *  - Vérifie le support navigateur (iOS Safari : besoin de PWA installée, pas onglet)
 *  - Demande la permission navigateur
 *  - Récupère la PushSubscription auprès du service worker (déjà enregistré par
 *    vite-plugin-pwa)
 *  - Persiste endpoint + clés dans la table `push_subscriptions`
 *
 * L'envoi effectif des notifications se fait côté serveur (Edge Function
 * `send-notification`), à partir de la même table.
 */

export function pushSupported(): boolean {
  return (
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  )
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i)
  return out
}

function arrayBufferToBase64(buf: ArrayBuffer | null): string {
  if (!buf) return ''
  const bytes = new Uint8Array(buf)
  let str = ''
  for (let i = 0; i < bytes.byteLength; i++) str += String.fromCharCode(bytes[i])
  return btoa(str)
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    const reg = await navigator.serviceWorker.ready
    return reg
  } catch (err) {
    logger.warn('webpush.registration', 'failed', { err: String(err) })
    return null
  }
}

/**
 * Demande la permission et abonne le navigateur au push.
 * Retourne true en cas de succès, false sinon (avec toast géré par l'appelant).
 */
export async function subscribeToPush(userId: string): Promise<boolean> {
  if (!pushSupported()) {
    logger.warn('webpush.subscribe', 'not supported')
    return false
  }
  const vapidKey = VAPID_PUBLIC_KEY_FALLBACK
  if (!vapidKey) {
    logger.warn('webpush.subscribe', 'no VAPID public key configured')
    return false
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    logger.info('webpush.subscribe', 'permission denied', { permission })
    return false
  }

  const reg = await getRegistration()
  if (!reg) return false

  try {
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource
    })
    const json = sub.toJSON() as {
      endpoint?: string
      keys?: { p256dh?: string; auth?: string }
    }
    const endpoint = json.endpoint ?? sub.endpoint
    const p256dh = json.keys?.p256dh ?? arrayBufferToBase64(sub.getKey('p256dh'))
    const auth = json.keys?.auth ?? arrayBufferToBase64(sub.getKey('auth'))
    if (!endpoint || !p256dh || !auth) {
      logger.error(
        'webpush.subscribe',
        'missing subscription fields',
        new Error('incomplete subscription')
      )
      return false
    }

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint,
        p256dh,
        auth_secret: auth,
        user_agent: navigator.userAgent
      },
      { onConflict: 'endpoint' }
    )
    if (error) {
      logger.error('webpush.subscribe', 'persist failed', error)
      return false
    }
    logger.info('webpush.subscribe', 'success', { userId })
    return true
  } catch (err) {
    logger.error(
      'webpush.subscribe',
      'subscribe failed',
      err instanceof Error ? err : new Error(String(err))
    )
    return false
  }
}

/** Désinscrit le device et supprime sa ligne en DB. */
export async function unsubscribeFromPush(userId: string): Promise<boolean> {
  const reg = await getRegistration()
  if (!reg) return false
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return true
  try {
    await sub.unsubscribe()
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', sub.endpoint)
    if (error) {
      logger.warn('webpush.unsubscribe', 'db delete failed', {
        message: error.message
      })
    }
    return true
  } catch (err) {
    logger.error(
      'webpush.unsubscribe',
      'failed',
      err instanceof Error ? err : new Error(String(err))
    )
    return false
  }
}
