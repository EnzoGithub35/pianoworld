// @ts-nocheck — exécuté côté Deno

/**
 * Templates HTML pour chaque notification_kind.
 * Garde un style simple, inline, compatible Gmail/Outlook/Apple Mail.
 *
 * SÉCURITÉ : tous les champs interpolés dans un `subject:` mail ou dans une
 * notification push DOIVENT passer par `sanitizeHeader()`. Resend ne ré-encode
 * pas le subject, donc un `\r\n` permettrait du header injection (Bcc:, etc.).
 * Pour le HTML on continue d'utiliser `escapeHtml()`.
 */

export type NotificationKind =
  | 'piano_comment'
  | 'piano_update'
  | 'session_conflict'
  | 'request_reply'
  | 'event_created'
  | 'friend_arriving'
  | 'friend_request_received'
  | 'friend_request_accepted'
  | 'piano_favorite_update'

export type OutboxPayload = Record<string, unknown>

export type RenderedMail = {
  subject: string
  html: string
  pushTitle: string
  pushBody: string
  url: string
}

/** Longueur max d'un subject mail / titre push. Au-delà, on tronque. */
const HEADER_MAX_LENGTH = 180

// Regex des caractères de contrôle ASCII (0x00–0x1F + 0x7F).
// Construit via String.fromCharCode pour éviter d'écrire les bytes bruts dans
// le source (qui peut être réécrit par certains éditeurs / outils).
const CONTROL_CHARS_PATTERN = (() => {
  const ranges: string[] = []
  for (let i = 0; i <= 0x1f; i++) ranges.push(String.fromCharCode(i))
  ranges.push(String.fromCharCode(0x7f))
  return new RegExp('[' + ranges.join('') + ']', 'g')
})()

/**
 * Nettoie une chaîne destinée à un `subject:` mail ou à un titre de notification
 * push. Supprime tous les contrôles ASCII (\r, \n, \t, \0, etc.) qui
 * permettraient une header injection, normalise les espaces multiples, et
 * tronque à HEADER_MAX_LENGTH.
 */
function sanitizeHeader(input: unknown): string {
  const raw = String(input ?? '')
  const stripped = raw.replace(CONTROL_CHARS_PATTERN, ' ')
  const collapsed = stripped.replace(/\s+/g, ' ').trim()
  if (collapsed.length <= HEADER_MAX_LENGTH) return collapsed
  return collapsed.slice(0, HEADER_MAX_LENGTH - 1) + '…'
}

function shell(title: string, bodyHtml: string, cta?: { label: string; url: string }) {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#FAF6F1;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#3F2E20;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" style="max-width:520px;background:#FFFDF9;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.04);overflow:hidden;">
        <tr><td style="padding:24px 24px 8px 24px;">
          <div style="font-size:13px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#B5651D;">🎹 PianoWorld</div>
          <h1 style="margin:8px 0 0 0;font-size:20px;line-height:1.3;">${escapeHtml(title)}</h1>
        </td></tr>
        <tr><td style="padding:8px 24px 16px 24px;font-size:15px;line-height:1.55;">
          ${bodyHtml}
        </td></tr>
        ${
          cta
            ? `<tr><td style="padding:0 24px 24px 24px;">
                <a href="${cta.url}" style="display:inline-block;background:#B5651D;color:#fff;font-weight:600;text-decoration:none;padding:11px 18px;border-radius:8px;">${escapeHtml(cta.label)}</a>
              </td></tr>`
            : ''
        }
        <tr><td style="padding:16px 24px;background:#F5EFE7;font-size:11px;color:#7A6A5A;border-top:1px solid #E7DFD2;">
          Tu reçois ce mail car tu es inscrit sur PianoWorld. Tu peux ajuster tes préférences depuis l'onglet <strong>Paramètres → Notifications</strong>.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatDateFr(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function renderMail(
  kind: NotificationKind,
  payload: OutboxPayload,
  recipientPseudo: string,
  appUrl: string
): RenderedMail {
  switch (kind) {
    case 'piano_comment': {
      const url = `${appUrl}/piano/${encodeURIComponent(String(payload.piano_id ?? ''))}`
      const subject = sanitizeHeader('Nouveau commentaire sur ton piano')
      const body = `
        <p>Salut <strong>@${escapeHtml(recipientPseudo)}</strong>,</p>
        <p>Quelqu'un vient de laisser un commentaire sur le piano que tu as ajouté à <strong>${escapeHtml(
          payload.piano_address
        )}</strong> :</p>
        <blockquote style="margin:12px 0;padding:12px 14px;background:#F5EFE7;border-left:3px solid #B5651D;border-radius:6px;font-style:italic;">
          ${escapeHtml(payload.comment)}
        </blockquote>
        ${payload.new_quality ? `<p>Nouvelle qualité signalée : <strong>${escapeHtml(payload.new_quality)}</strong>.</p>` : ''}
        ${typeof payload.still_there === 'boolean' ? `<p>Présence : <strong>${payload.still_there ? 'encore là' : 'a disparu'}</strong>.</p>` : ''}
      `
      return {
        subject,
        url,
        html: shell(subject, body, { label: 'Voir le piano', url }),
        pushTitle: sanitizeHeader('Nouveau commentaire 🎹'),
        pushBody: sanitizeHeader(payload.piano_address)
      }
    }
    case 'piano_update': {
      const url = `${appUrl}/piano/${encodeURIComponent(String(payload.piano_id ?? ''))}`
      const subject = sanitizeHeader('Mise à jour sur ton piano')
      const body = `
        <p>Salut <strong>@${escapeHtml(recipientPseudo)}</strong>,</p>
        <p>Quelqu'un vient de mettre à jour l'état du piano à <strong>${escapeHtml(payload.piano_address)}</strong>.</p>
        ${typeof payload.still_there === 'boolean' ? `<p>Présence : <strong>${payload.still_there ? 'encore là ✅' : 'a disparu ❌'}</strong></p>` : ''}
        ${payload.new_quality ? `<p>Nouvelle qualité : <strong>${escapeHtml(payload.new_quality)}</strong>.</p>` : ''}
      `
      return {
        subject,
        url,
        html: shell(subject, body, { label: 'Voir le piano', url }),
        pushTitle: sanitizeHeader('MAJ sur ton piano 🎹'),
        pushBody: sanitizeHeader(payload.piano_address)
      }
    }
    case 'session_conflict': {
      const url = `${appUrl}/piano/${encodeURIComponent(String(payload.piano_id ?? ''))}`
      const subject = sanitizeHeader("Quelqu'un d'autre joue au même moment !")
      const body = `
        <p>Salut <strong>@${escapeHtml(recipientPseudo)}</strong>,</p>
        <p>Un autre pianiste vient de réserver un créneau sur le piano <strong>${escapeHtml(payload.piano_address)}</strong> au même moment que toi.</p>
        <p>Leur créneau : <strong>${escapeHtml(formatDateFr(payload.their_starts_at as string))}</strong> pendant <strong>${escapeHtml(payload.their_duration_min)} min</strong>.</p>
        <p>Bonne occasion de jouer à quatre mains 🎹🎹 ou de décaler ton créneau.</p>
      `
      return {
        subject,
        url,
        html: shell(subject, body, { label: 'Voir le piano', url }),
        pushTitle: sanitizeHeader('Un autre pianiste au même moment 🎹'),
        pushBody: sanitizeHeader(payload.piano_address)
      }
    }
    case 'request_reply': {
      const url = `${appUrl}/dashboard`
      const subject = sanitizeHeader(`Réponse à ta demande : ${payload.subject ?? ''}`)
      const body = `
        <p>Salut <strong>@${escapeHtml(recipientPseudo)}</strong>,</p>
        <p>L'équipe PianoWorld a répondu à ta demande <strong>« ${escapeHtml(payload.subject)} »</strong> :</p>
        <blockquote style="margin:12px 0;padding:12px 14px;background:#F5EFE7;border-left:3px solid #B5651D;border-radius:6px;white-space:pre-wrap;">
          ${escapeHtml(payload.reply)}
        </blockquote>
      `
      return {
        subject,
        url,
        html: shell(subject, body, { label: 'Voir ma demande', url }),
        pushTitle: sanitizeHeader('Réponse à ta demande'),
        pushBody: sanitizeHeader(payload.subject)
      }
    }
    case 'event_created': {
      const url = `${appUrl}/dashboard`
      const subject = sanitizeHeader(`Nouvel évènement : ${payload.title ?? ''}`)
      const body = `
        <p>Salut <strong>@${escapeHtml(recipientPseudo)}</strong>,</p>
        <p>Un nouvel évènement vient d'être créé :</p>
        <h2 style="margin:8px 0;font-size:18px;">${escapeHtml(payload.title)}</h2>
        <p>📍 ${escapeHtml(payload.location)}</p>
        <p>🗓️ ${escapeHtml(formatDateFr(payload.starts_at as string))}</p>
      `
      return {
        subject,
        url,
        html: shell(subject, body, { label: "Voir et m'inscrire", url }),
        pushTitle: sanitizeHeader('Nouvel évènement 🎵'),
        pushBody: sanitizeHeader(payload.title)
      }
    }
    case 'friend_arriving': {
      const senderPseudo = String(payload.sender_pseudo ?? '?')
      const pianoAddress = String(payload.piano_address ?? '?')
      const pianoId = String(payload.piano_id ?? '')
      const startsAt = String(payload.starts_at ?? '')
      const url = `${appUrl}/piano/${encodeURIComponent(pianoId)}#sessions`
      // Wording dynamique : live vs futur (recalcul à delivery time).
      const startsMs = Date.parse(startsAt)
      const durMin = Number(payload.duration_min ?? 0)
      const nowMs = Date.now()
      const isLive = !isNaN(startsMs) && startsMs <= nowMs && nowMs <= startsMs + durMin * 60_000
      const verb = isLive ? 'joue actuellement' : 'va jouer'
      const subject = sanitizeHeader(`@${senderPseudo} ${verb} au piano de ${pianoAddress}`)
      const body = `
        <p>Salut <strong>@${escapeHtml(recipientPseudo)}</strong>,</p>
        <p><strong>@${escapeHtml(senderPseudo)}</strong> ${escapeHtml(verb)} au piano à <strong>${escapeHtml(pianoAddress)}</strong>${
          !isLive && startsAt ? ` (${escapeHtml(formatDateFr(startsAt))})` : ''
        }.</p>
        <p>Tu veux venir l'écouter ou le rejoindre ?</p>
      `
      return {
        subject,
        url,
        html: shell(subject, body, { label: 'Voir le piano', url }),
        pushTitle: sanitizeHeader(`@${senderPseudo} ${verb} 🎹`),
        pushBody: sanitizeHeader(pianoAddress)
      }
    }
    case 'friend_request_received': {
      const requesterPseudo = String(payload.requester_pseudo ?? '?')
      const url = `${appUrl}/dashboard?tab=friends`
      const subject = sanitizeHeader(`@${requesterPseudo} veut être ton ami sur PianoWorld`)
      const body = `
        <p>Salut <strong>@${escapeHtml(recipientPseudo)}</strong>,</p>
        <p><strong>@${escapeHtml(requesterPseudo)}</strong> souhaite t'ajouter comme ami.</p>
        <p>Si vous êtes amis, tu pourras voir ses créneaux privés et il pourra voir les tiens (si tu les marques "amis uniquement").</p>
      `
      return {
        subject,
        url,
        html: shell(subject, body, { label: 'Voir la demande', url }),
        pushTitle: sanitizeHeader(`@${requesterPseudo} t'envoie une demande d'ami`),
        pushBody: sanitizeHeader('Réponds depuis ton dashboard')
      }
    }
    case 'piano_favorite_update': {
      const updaterPseudo = String(payload.updater_pseudo ?? 'Quelqu’un')
      const pianoAddress = String(payload.piano_address ?? '?')
      const pianoId = String(payload.piano_id ?? '')
      const url = `${appUrl}/piano/${encodeURIComponent(pianoId)}`
      const stillThere =
        typeof payload.still_there === 'boolean' ? payload.still_there : null
      const subject = sanitizeHeader(`Mise à jour d’un piano favori : ${pianoAddress}`)
      const body = `
        <p>Salut <strong>@${escapeHtml(recipientPseudo)}</strong>,</p>
        <p><strong>@${escapeHtml(updaterPseudo)}</strong> a mis à jour le piano de <strong>${escapeHtml(pianoAddress)}</strong> que tu as ajouté à tes favoris.</p>
        <p style="font-size:13px;color:#7A6A5A;">Tu peux retirer ce piano de tes favoris à tout moment depuis sa fiche.</p>
        ${stillThere === false ? `<p>⚠️ Le piano <strong>n'est plus là</strong> d'après la dernière MAJ.</p>` : ''}
        ${stillThere === true ? `<p>Le piano est <strong>encore là</strong> ✅</p>` : ''}
        ${payload.quality ? `<p>État actuel : <strong>${escapeHtml(payload.quality)}</strong>.</p>` : ''}
      `
      return {
        subject,
        url,
        html: shell(subject, body, { label: 'Voir le piano', url }),
        pushTitle: sanitizeHeader(`MAJ d’un piano favori 🔖`),
        pushBody: sanitizeHeader(`@${updaterPseudo} · ${pianoAddress}`)
      }
    }
    case 'friend_request_accepted': {
      const otherPseudo = String(payload.other_pseudo ?? '?')
      const autoAccepted = payload.auto_accepted === true
      const url = `${appUrl}/user/${encodeURIComponent(otherPseudo)}`
      const subject = autoAccepted
        ? sanitizeHeader(`@${otherPseudo} et toi êtes maintenant amis !`)
        : sanitizeHeader(`@${otherPseudo} a accepté ta demande d'ami`)
      const body = autoAccepted
        ? `
        <p>Salut <strong>@${escapeHtml(recipientPseudo)}</strong>,</p>
        <p>Vous avez tous les deux voulu vous ajouter en même temps avec <strong>@${escapeHtml(otherPseudo)}</strong> — vous êtes maintenant amis ! 🎉</p>
      `
        : `
        <p>Salut <strong>@${escapeHtml(recipientPseudo)}</strong>,</p>
        <p><strong>@${escapeHtml(otherPseudo)}</strong> a accepté ta demande d'ami. Vous pouvez maintenant voir vos créneaux friends-only respectifs.</p>
      `
      return {
        subject,
        url,
        html: shell(subject, body, { label: 'Voir son profil', url }),
        pushTitle: sanitizeHeader(
          autoAccepted ? `Vous êtes maintenant amis 🎉` : `@${otherPseudo} a accepté ta demande`
        ),
        pushBody: sanitizeHeader(otherPseudo)
      }
    }
  }
}
