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
