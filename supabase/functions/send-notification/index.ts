// @ts-nocheck — Edge Function Deno, types Deno/npm résolus à l'exécution
//
// Webhook handler : déclenché par Supabase Database Webhook sur
// INSERT into notifications_outbox.
//
// Sécurité (défense en profondeur) :
//  1. Header `x-webhook-secret` requis et comparé en temps constant au secret
//     stocké en variable d'environnement (configuré dans Supabase webhook UI).
//  2. Le payload de la requête sert UNIQUEMENT à récupérer l'id de la ligne
//     outbox. Tous les autres champs (recipient_id, kind, payload) sont
//     re-lus depuis la DB avec le service role. Cela empêche toute injection
//     même si le secret venait à fuiter ou si un attaquant rejouait une
//     ancienne requête.
//  3. Les champs interpolés dans le subject mail / push title sont sanitizés
//     côté `templates.ts` pour bloquer toute header injection (\r\n).
//
// Flow :
//  1. Vérifie le secret
//  2. Extrait outboxId du payload
//  3. SELECT la ligne complète depuis la DB
//  4. Charge le profil destinataire (email, prefs)
//  5. Skip si la catégorie est désactivée
//  6. Envoie le mail via Resend
//  7. Envoie le push si push_enabled + souscriptions valides
//  8. Mark sent_at ou error sur la ligne outbox
//
// Configurer dans Supabase > Edge Functions > Secrets :
//   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injectés)
//   - WEBHOOK_SECRET (string aléatoire, ex: `openssl rand -base64 32`)
//   - RESEND_API_KEY
//   - MAIL_FROM (ex: onboarding@resend.dev OU no-reply@<your-domain>)
//   - APP_URL (ex: https://pianoworld.vercel.app)
//   - VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import webpush from 'npm:web-push@3.6.7'
import { renderMail, type NotificationKind, type OutboxPayload } from './templates.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET') ?? ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const MAIL_FROM = Deno.env.get('MAIL_FROM') ?? 'onboarding@resend.dev'
const APP_URL = Deno.env.get('APP_URL') ?? 'https://pianoworld.vercel.app'
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:enzo.reine35@gmail.com'

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

/** Mapping notification_kind → colonne de préférences. */
const KIND_TO_PREF: Record<NotificationKind, string> = {
  piano_comment: 'notify_comments',
  piano_update: 'notify_piano_updates',
  session_conflict: 'notify_session_conflict',
  request_reply: 'notify_request_reply',
  event_created: 'notify_events',
  // v6 — système d'amitié
  friend_arriving: 'notify_friend_arriving',
  friend_request_received: 'notify_friend_request_received',
  friend_request_accepted: 'notify_friend_request_accepted',
  // v7 — pianos favoris
  piano_favorite_update: 'notify_favorite_update'
}

type OutboxRow = {
  id: string
  recipient_id: string
  kind: NotificationKind
  payload: OutboxPayload
  created_at: string
  sent_at: string | null
  error: string | null
}

/**
 * Comparaison de chaînes en temps constant. Empêche les timing attacks sur le
 * secret du webhook (différences mesurables si on retourne dès le premier byte
 * divergent).
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

async function sendMail(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY missing — mails désactivés')
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: `PianoWorld <${MAIL_FROM}>`,
      to: [to],
      subject,
      html
    })
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Resend HTTP ${res.status} : ${text}`)
  }
}

async function sendPushAll(
  userId: string,
  payload: { title: string; body: string; url?: string }
): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth_secret')
    .eq('user_id', userId)

  if (!subs || subs.length === 0) return

  const json = JSON.stringify(payload)
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth_secret }
          },
          json,
          { TTL: 86_400 }
        )
        await supabase
          .from('push_subscriptions')
          .update({ last_used_at: new Date().toISOString() })
          .eq('endpoint', s.endpoint)
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string }
        // 404/410 : abonnement expiré → on supprime
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
        } else {
          console.error('push failed', e?.message ?? err)
        }
      }
    })
  )
}

async function markSent(id: string, error?: string): Promise<void> {
  await supabase.rpc('mark_notification_sent', { notif_id: id, err: error ?? null })
}

/**
 * Process une ligne outbox (re-fetchée depuis la DB pour ne pas dépendre du
 * payload du webhook). Idempotent : si la ligne est déjà sent_at, on skip.
 */
async function process(outboxId: string): Promise<void> {
  const { data: row, error: fetchError } = await supabase
    .from('notifications_outbox')
    .select('*')
    .eq('id', outboxId)
    .maybeSingle<OutboxRow>()

  if (fetchError) {
    console.error('outbox fetch failed', fetchError)
    throw fetchError
  }
  if (!row) {
    console.warn('outbox row not found', { outboxId })
    return
  }
  if (row.sent_at) {
    // Webhook rejoué : on ne ré-envoie pas
    return
  }

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('id, pseudo, banned_at')
    .eq('id', row.recipient_id)
    .maybeSingle()

  if (!profileRow) {
    await markSent(row.id, 'recipient not found')
    return
  }
  if (profileRow.banned_at) {
    await markSent(row.id, 'recipient banned')
    return
  }

  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', row.recipient_id)
    .maybeSingle()

  const prefCol = KIND_TO_PREF[row.kind]
  if (prefs && prefCol && prefs[prefCol] === false) {
    await markSent(row.id, 'opted-out')
    return
  }

  // v6 : pour friend_arriving, on re-vérifie l'amitié à delivery time.
  // Cas race : sender crée session → trigger enqueue notif → sender retire
  // l'amitié AVANT que l'Edge Function process la ligne. Sans re-verify,
  // l'ex-ami reçoit un mail révélant un piano où va le sender. Privacy P1.
  if (row.kind === 'friend_arriving') {
    const senderId = (row.payload as { sender_user_id?: string })?.sender_user_id
    if (!senderId) {
      await markSent(row.id, 'friend_arriving: sender_user_id missing in payload')
      return
    }
    const { data: stillFriends, error: arErr } = await supabase.rpc('are_friends_safe', {
      a: senderId,
      b: row.recipient_id
    })
    if (arErr) {
      console.error('are_friends_safe rpc failed', arErr)
      await markSent(row.id, `are_friends_safe rpc failed: ${arErr.message}`)
      return
    }
    if (!stillFriends) {
      await markSent(row.id, 'no-longer-friends')
      return
    }
  }

  const { data: authUser } = await supabase.auth.admin.getUserById(row.recipient_id)
  const email = authUser?.user?.email
  if (!email) {
    await markSent(row.id, 'no email on auth.users')
    return
  }

  const mail = renderMail(row.kind, row.payload, profileRow.pseudo, APP_URL)

  const errors: string[] = []
  try {
    await sendMail(email, mail.subject, mail.html)
  } catch (err) {
    errors.push(`mail: ${(err as Error).message}`)
  }

  if (prefs?.push_enabled) {
    try {
      await sendPushAll(row.recipient_id, {
        title: mail.pushTitle,
        body: mail.pushBody,
        url: mail.url
      })
    } catch (err) {
      errors.push(`push: ${(err as Error).message}`)
    }
  }

  await markSent(row.id, errors.length > 0 ? errors.join(' | ') : undefined)
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('method not allowed', { status: 405 })
    }

    // Vérification du secret webhook (timing-safe). Absent côté serveur =
    // configuration manquante, on refuse pour éviter le mode "ouvert".
    if (!WEBHOOK_SECRET) {
      console.error('WEBHOOK_SECRET not configured — refusing all requests')
      return new Response('not configured', { status: 503 })
    }
    const provided = req.headers.get('x-webhook-secret') ?? ''
    if (!timingSafeEqual(provided, WEBHOOK_SECRET)) {
      return new Response('forbidden', { status: 403 })
    }

    const body = await req.json()
    const recordId: string | undefined = body?.record?.id
    if (!recordId || typeof recordId !== 'string') {
      return new Response(JSON.stringify({ error: 'missing record.id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    await process(recordId)
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('handler error', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
