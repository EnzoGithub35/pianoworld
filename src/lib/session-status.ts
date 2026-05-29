import type { PianoSession } from '@/types/database'

/**
 * Logique pure de statut d'une session. Sans React, sans Supabase, testable en
 * isolation. Toujours prendre `now` en paramètre pour permettre l'injection
 * dans les tests.
 */

function sessionEndMs(s: Pick<PianoSession, 'starts_at' | 'duration_min'>): number {
  return new Date(s.starts_at).getTime() + s.duration_min * 60_000
}

export function isSessionCancelled(s: Pick<PianoSession, 'cancelled_at'>): boolean {
  return s.cancelled_at !== null
}

/** Active = en cours en ce moment ET non annulée. */
export function isSessionActive(
  s: Pick<PianoSession, 'starts_at' | 'duration_min' | 'cancelled_at'>,
  now: Date = new Date()
): boolean {
  if (isSessionCancelled(s)) return false
  const nowMs = now.getTime()
  return new Date(s.starts_at).getTime() <= nowMs && sessionEndMs(s) > nowMs
}

/** Upcoming = pas encore commencée ET non annulée. */
export function isSessionUpcoming(
  s: Pick<PianoSession, 'starts_at' | 'cancelled_at'>,
  now: Date = new Date()
): boolean {
  if (isSessionCancelled(s)) return false
  return new Date(s.starts_at).getTime() > now.getTime()
}

/** Past = terminée OU annulée. */
export function isSessionPast(
  s: Pick<PianoSession, 'starts_at' | 'duration_min' | 'cancelled_at'>,
  now: Date = new Date()
): boolean {
  if (isSessionCancelled(s)) return true
  return sessionEndMs(s) <= now.getTime()
}

/** Minutes restantes pour une session active (>= 0). 0 si non active. */
export function sessionRemainingMinutes(
  s: Pick<PianoSession, 'starts_at' | 'duration_min' | 'cancelled_at'>,
  now: Date = new Date()
): number {
  if (!isSessionActive(s, now)) return 0
  const ms = sessionEndMs(s) - now.getTime()
  return Math.max(0, Math.ceil(ms / 60_000))
}
