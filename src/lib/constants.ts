/**
 * Constantes applicatives centralisées.
 *
 * Toute valeur "magique" (coordonnées, seuils, limites) doit vivre ici plutôt
 * que d'être codée en dur dans les composants.
 */

/** Coordonnées initiales de la carte au démarrage. */
export const DEFAULT_MAP_CENTER: readonly [number, number] = [48.1173, -1.6778]
export const DEFAULT_MAP_ZOOM = 13

/** Seuil de détection de doublon en mètres (cf. plan, choix utilisateur). */
export const DUPLICATE_DISTANCE_METERS = 50

/** Limites des champs piano (alignées avec les CHECK contraintes côté SQL). */
export const PIANO_COMMENT_MAX = 500
export const PIANO_ADDRESS_MAX = 500
export const REPORT_REASON_MAX = 500

/** Compression photo (cf. plan, économise les 1 Go Storage Supabase). */
export const PHOTO_MAX_SIZE_MB = 0.2
export const PHOTO_MAX_DIMENSION = 1024
export const PHOTO_JPEG_QUALITY = 0.8

/** Pseudo (aligné avec CHECK SQL et regex côté forms). */
export const PSEUDO_MIN_LENGTH = 2
export const PSEUDO_MAX_LENGTH = 30
export const PSEUDO_REGEX = /^[a-zA-Z0-9_\-.]+$/

/** Mot de passe : 8 caractères minimum (Supabase n'impose pas, c'est notre règle). */
export const PASSWORD_MIN_LENGTH = 8

/** Géocodage : limite haute pour l'autocomplete Photon (rate-limit léger). */
export const GEOCODE_AUTOCOMPLETE_LIMIT = 5

/** Recherche utilisateurs : seuil minimum de caractères pour requêter. */
export const USER_SEARCH_MIN_CHARS = 2
export const USER_SEARCH_MAX_RESULTS = 20

/** Dashboard : nombre d'éléments dans le feed récent. */
export const RECENT_FEED_LIMIT = 15

/** Clé localStorage du tutoriel. */
export const TUTORIAL_STORAGE_KEY = 'pianoworld:tutorial-seen'
export const THEME_STORAGE_KEY = 'pianoworld:theme'

/** Bucket Supabase Storage pour les photos. */
export const PHOTO_BUCKET = 'piano-photos'

/* ===========================================================
 * v2 — Activité (passages & sessions)
 * =========================================================== */

/** Durées de session proposées dans le SessionDialog (en minutes). */
export const SESSION_DURATION_OPTIONS = [15, 30, 60, 90, 120] as const

/** Bornes côté SQL aussi (CHECK). À garder synchronisé. */
export const SESSION_DURATION_MIN = 5
export const SESSION_DURATION_MAX = 240

/** Horizon de planification dans le futur (cf. CHECK SQL). */
export const SESSION_FUTURE_DAYS_MAX = 7

/** Nombre d'avatars visibles dans VisitorStack avant le "+N". */
export const VISITS_DISPLAY_LIMIT = 5

/** Intervalle de rotation du headline "@enzo y était il y a 2h" (ms). */
export const VISITORS_HEADLINE_ROTATION_MS = 4000

/** Refresh des sessions actives (driving le pulse de la carte). */
export const ACTIVE_SESSIONS_STALE_MS = 30_000

/* ===========================================================
 * v3 — Évènements, demandes utilisateurs
 * =========================================================== */

export const EVENT_TITLE_MAX = 120
export const EVENT_DESCRIPTION_MAX = 2000
export const EVENT_LOCATION_MAX = 200

export const REQUEST_SUBJECT_MAX = 120
export const REQUEST_MESSAGE_MAX = 2000

/** Track le dernier replied_at consulté par l'user pour les badges "nouvelle réponse". */
export const REQUESTS_LAST_SEEN_KEY = 'pianoworld:requests-last-seen'

/* ===========================================================
 * v4 — Notifications, push, sécurité, calendrier
 * =========================================================== */

/** Catégories de notification — mirror des colonnes notification_preferences. */
export const NOTIFICATION_CATEGORIES = [
  'notify_comments',
  'notify_piano_updates',
  'notify_session_conflict',
  'notify_request_reply',
  'notify_events',
  // v6 — système d'amitié
  'notify_friend_arriving',
  'notify_friend_request_received',
  'notify_friend_request_accepted'
] as const
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]

/** Labels FR pour les toggles de préférences dans Settings. */
export const NOTIFICATION_LABELS: Record<NotificationCategory, string> = {
  notify_comments: 'Commentaire sur un de mes pianos',
  notify_piano_updates: 'Mise à jour d’état d’un de mes pianos',
  notify_session_conflict: 'Quelqu’un joue au même moment que moi',
  notify_request_reply: 'Réponse à mes demandes',
  notify_events: 'Nouveaux évènements',
  notify_friend_arriving: 'Un ami arrive sur un piano',
  notify_friend_request_received: 'Quelqu’un veut être mon ami',
  notify_friend_request_accepted: 'Ma demande d’ami a été acceptée'
}

/** Regroupement visuel des toggles dans la page Settings → Notifications.
 *  Permet de couper la liste en sections (Pianos, Sessions, Communauté, Amis). */
export type NotificationSection = 'pianos' | 'sessions' | 'communaute' | 'amis'
export const NOTIFICATION_SECTION_OF: Record<NotificationCategory, NotificationSection> =
  {
    notify_comments: 'pianos',
    notify_piano_updates: 'pianos',
    notify_session_conflict: 'sessions',
    notify_events: 'communaute',
    notify_request_reply: 'communaute',
    notify_friend_arriving: 'amis',
    notify_friend_request_received: 'amis',
    notify_friend_request_accepted: 'amis'
  }
export const NOTIFICATION_SECTION_LABELS: Record<NotificationSection, string> = {
  pianos: 'Mes pianos',
  sessions: 'Sessions de piano',
  communaute: 'Communauté',
  amis: 'Amis'
}

/** Cookie de consentement (bandeau RGPD). */
export const COOKIE_CONSENT_KEY = 'pianoworld:cookie-consent'

/** Clé localStorage du dernier opt-in push (anti-spam de la demande de permission). */
export const PUSH_OPT_IN_KEY = 'pianoworld:push-opt-in'

/** VAPID public key (à override par VITE_VAPID_PUBLIC_KEY en prod). */
export const VAPID_PUBLIC_KEY_FALLBACK = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''

/** Rate limits : valeurs MIROIR de within_rate_limit() côté SQL.
 *  Sert uniquement aux messages d'erreur UX (le SQL est la vérité). */
export const RATE_LIMITS: Record<string, { count: number; windowLabel: string }> = {
  piano_create: { count: 5, windowLabel: '24 h' },
  piano_update: { count: 30, windowLabel: '24 h' },
  piano_visit: { count: 50, windowLabel: '24 h' },
  piano_session: { count: 10, windowLabel: '24 h' },
  piano_report: { count: 5, windowLabel: '24 h' },
  user_request: { count: 5, windowLabel: '7 jours' },
  friend_request: { count: 20, windowLabel: '24 h' }
}

/* ===========================================================
 * v6 — Système d'amitié + visibility sessions + compteur présence
 * =========================================================== */

/** Pagination liste amis dans FriendsTab (LIMIT côté SQL = 500). */
export const FRIENDS_DISPLAY_LIMIT = 200

/** Max d'avatars empilés dans PianoPresenceCounter avant le "+N". */
export const PRESENCE_AVATAR_STACK_LIMIT = 5

/** Refresh du compteur de présence (sessions actives expirent en continu). */
export const PRESENCE_STALE_MS = 30_000

/** Visibilité d'une session piano. Mirror SQL CHECK piano_sessions.visibility. */
export const SESSION_VISIBILITIES = ['public', 'friends'] as const
export const SESSION_VISIBILITY_LABELS: Record<
  (typeof SESSION_VISIBILITIES)[number],
  string
> = {
  public: 'Tout le monde',
  friends: 'Mes amis uniquement'
}

/** Onglet "Communauté" : combien de jours dans le passé / futur sont affichés. */
export const COMMUNITY_PAST_DAYS = 7
export const COMMUNITY_FUTURE_DAYS = 14

/**
 * Version des CGU. À incrémenter manuellement (date ISO) à chaque modification
 * substantielle. Si `profiles.accept_cgu_version` est différent à la connexion,
 * on peut imposer la re-lecture (à brancher plus tard via une route /cgu-update).
 */
export const CGU_VERSION = '2026-05-30'
