export type PianoQuality =
  | 'neuf'
  | 'bon_etat'
  | 'potable'
  | 'desaccorde'
  | 'desastreux'
  | 'autre'

export const PIANO_QUALITIES: PianoQuality[] = [
  'neuf',
  'bon_etat',
  'potable',
  'desaccorde',
  'desastreux',
  'autre'
]

export const QUALITY_LABELS: Record<PianoQuality, string> = {
  neuf: 'Neuf',
  bon_etat: 'Bon état',
  potable: 'Potable',
  desaccorde: 'Désaccordé',
  desastreux: 'Désastreux',
  autre: 'Autre'
}

/**
 * Palette qualité harmonisée avec le thème "bois de piano".
 * Tons légèrement plus saturés/chauds que les Tailwind par défaut pour
 * mieux dialoguer avec le fond crème et l'ambre du primary.
 */
export const QUALITY_COLORS: Record<PianoQuality, string> = {
  neuf: '#16a34a',
  bon_etat: '#84cc16',
  potable: '#ca8a04',
  desaccorde: '#ea580c',
  desastreux: '#b91c1c',
  autre: '#78716c'
}

export type UserRole = 'user' | 'admin' | 'superadmin'

export type Profile = {
  id: string
  pseudo: string
  created_at: string
  role: UserRole
  banned_at: string | null
  accept_cgu_at: string | null
  accept_cgu_version: string | null
  /** v7 — opt-in, NULL par défaut, visible uniquement via RPCs SECURITY DEFINER. */
  first_name: string | null
  /** v7 — opt-in, NULL par défaut, visible uniquement via RPCs SECURITY DEFINER. */
  last_name: string | null
}

export type EventRow = {
  id: string
  title: string
  description: string
  location: string
  starts_at: string
  ends_at: string | null
  max_participants: number | null
  created_by: string
  created_at: string
  cancelled_at: string | null
}

export type EventParticipant = {
  event_id: string
  user_id: string
  joined_at: string
}

export type UserRequest = {
  id: string
  user_id: string
  subject: string
  message: string
  created_at: string
  admin_reply: string | null
  replied_at: string | null
  replied_by: string | null
  status: 'open' | 'answered'
}

export type NotificationPreferences = {
  user_id: string
  notify_comments: boolean
  notify_session_conflict: boolean
  notify_request_reply: boolean
  notify_events: boolean
  notify_piano_updates: boolean
  notify_friend_arriving: boolean
  notify_friend_request_received: boolean
  notify_friend_request_accepted: boolean
  /** v7 — MAJ sur un piano que je suis (favori). */
  notify_favorite_update: boolean
  push_enabled: boolean
  updated_at: string
}

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

export type PushSubscription = {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth_secret: string
  user_agent: string | null
  created_at: string
  last_used_at: string
}

export type AuditLogEntry = {
  id: number
  actor_id: string | null
  action: string
  target_id: string | null
  payload: Record<string, unknown>
  created_at: string
}

export type Piano = {
  id: string
  created_by: string
  lat: number
  lng: number
  address: string
  comment: string
  quality: PianoQuality
  photo_url: string | null
  created_at: string
  is_deleted: boolean
}

export type PianoUpdate = {
  id: string
  piano_id: string
  /** Peut devenir null si l'auteur a supprimé son compte (ON DELETE SET NULL). */
  updated_by: string | null
  still_there: boolean
  new_quality: PianoQuality | null
  comment: string | null
  created_at: string
  /** Snapshot du pseudo au moment de l'update — survit à la suppression de compte. */
  author_pseudo_at_time: string | null
}

export type PianoReport = {
  id: string
  piano_id: string
  reported_by: string
  reason: string
  created_at: string
  resolved: boolean
}

export type PianoVisit = {
  id: string
  piano_id: string
  user_id: string
  visited_at: string
}

export type PianoSessionVisibility = 'public' | 'friends'

export type PianoSession = {
  id: string
  piano_id: string
  user_id: string
  starts_at: string
  duration_min: number
  created_at: string
  cancelled_at: string | null
  /** v6 — qui voit cette session et reçoit la notif friend_arriving. Set-once à l'insert. */
  visibility: PianoSessionVisibility
}

// v6 — système d'amitié bidirectionnel
export type FriendshipStatus = 'pending' | 'accepted'

export type Friendship = {
  id: string
  user_a: string
  user_b: string
  requester_id: string
  status: FriendshipStatus
  created_at: string
  responded_at: string | null
}

/** Statut bilatéral retourné par la RPC get_friend_status. */
export type FriendStatus =
  | 'self'
  | 'none'
  | 'pending_sent'
  | 'pending_received'
  | 'friends'

/** Profil ami retourné par get_my_friends. */
export type FriendProfile = {
  id: string
  pseudo: string
  created_at: string
  friendship_since: string | null
}

/** Demande d'amitié pending retournée par get_my_friend_requests. */
export type FriendRequest = {
  request_id: string
  user_id: string
  pseudo: string
  created_at: string
}

/** Entrée de présence retournée par list_piano_presence. */
export type PresenceEntry = {
  session_id: string
  user_id: string
  pseudo: string
  starts_at: string
  duration_min: number
  visibility: PianoSessionVisibility
}

/** Ligne agrégée retournée par get_active_piano_counts (batch carte). */
export type PianoPresenceCount = {
  piano_id: string
  count: number
}

// v7 — recherche unifiée + favoris

/** Row de piano_favorites (SELECT self-only via RLS). */
export type PianoFavorite = {
  piano_id: string
  user_id: string
  created_at: string
}

/** Résultat de search_users / find_user_by_email — first/last name peuvent être NULL (opt-in). */
export type UserSearchResult = {
  id: string
  pseudo: string
  first_name: string | null
  last_name: string | null
  created_at: string
}

/** Résultat de search_pianos — inclut le pseudo auteur (JOIN). */
export type PianoSearchResult = {
  id: string
  address: string
  comment: string
  quality: PianoQuality
  photo_url: string | null
  lat: number
  lng: number
  created_by: string | null
  author_pseudo: string | null
  created_at: string
}

/** Résultat de get_my_favorites pour le Dashboard tab Favoris. */
export type FavoriteWithPiano = {
  piano_id: string
  address: string
  quality: PianoQuality
  photo_url: string | null
  lat: number
  lng: number
  favorited_at: string
  last_update_at: string | null
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: {
          id: string
          pseudo: string
          created_at?: string
          role?: UserRole
          banned_at?: string | null
          accept_cgu_at?: string | null
          accept_cgu_version?: string | null
          first_name?: string | null
          last_name?: string | null
        }
        Update: {
          pseudo?: string
          created_at?: string
          role?: UserRole
          banned_at?: string | null
          accept_cgu_at?: string | null
          accept_cgu_version?: string | null
          first_name?: string | null
          last_name?: string | null
        }
        Relationships: []
      }
      pianos: {
        Row: Piano
        Insert: {
          id?: string
          created_by: string
          lat: number
          lng: number
          address: string
          comment: string
          quality: PianoQuality
          photo_url?: string | null
          created_at?: string
          is_deleted?: boolean
        }
        Update: {
          lat?: number
          lng?: number
          address?: string
          comment?: string
          quality?: PianoQuality
          photo_url?: string | null
          is_deleted?: boolean
        }
        Relationships: []
      }
      piano_updates: {
        Row: PianoUpdate
        Insert: {
          id?: string
          piano_id: string
          updated_by: string
          still_there: boolean
          new_quality?: PianoQuality | null
          comment?: string | null
          created_at?: string
          author_pseudo_at_time?: string | null
        }
        Update: Record<string, never>
        Relationships: []
      }
      piano_reports: {
        Row: PianoReport
        Insert: {
          id?: string
          piano_id: string
          reported_by: string
          reason: string
          created_at?: string
          resolved?: boolean
        }
        Update: {
          resolved?: boolean
        }
        Relationships: []
      }
      piano_visits: {
        Row: PianoVisit
        Insert: {
          id?: string
          piano_id: string
          user_id: string
          visited_at?: string
        }
        Update: Record<string, never>
        Relationships: []
      }
      piano_sessions: {
        Row: PianoSession
        Insert: {
          id?: string
          piano_id: string
          user_id: string
          starts_at: string
          duration_min: number
          created_at?: string
          cancelled_at?: string | null
          /** v6 — défaut 'public' côté DB. Set-once : pas modifiable post-INSERT. */
          visibility?: PianoSessionVisibility
        }
        Update: {
          cancelled_at?: string | null
        }
        Relationships: []
      }
      friendships: {
        Row: Friendship
        // friendships : REVOKE ALL côté client. Pas d'INSERT/UPDATE/DELETE direct
        // possible — accès exclusif via les RPCs send/accept/reject/cancel/remove.
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
      events: {
        Row: EventRow
        Insert: {
          id?: string
          title: string
          description: string
          location: string
          starts_at: string
          ends_at?: string | null
          max_participants?: number | null
          created_by: string
          created_at?: string
          cancelled_at?: string | null
        }
        Update: {
          title?: string
          description?: string
          location?: string
          starts_at?: string
          ends_at?: string | null
          max_participants?: number | null
          cancelled_at?: string | null
        }
        Relationships: []
      }
      event_participants: {
        Row: EventParticipant
        Insert: {
          event_id: string
          user_id: string
          joined_at?: string
        }
        Update: Record<string, never>
        Relationships: []
      }
      user_requests: {
        Row: UserRequest
        Insert: {
          id?: string
          user_id: string
          subject: string
          message: string
          created_at?: string
          admin_reply?: string | null
          replied_at?: string | null
          replied_by?: string | null
          status?: 'open' | 'answered'
        }
        Update: Record<string, never>
        Relationships: []
      }
      notification_preferences: {
        Row: NotificationPreferences
        Insert: {
          user_id: string
          notify_comments?: boolean
          notify_session_conflict?: boolean
          notify_request_reply?: boolean
          notify_events?: boolean
          notify_piano_updates?: boolean
          notify_friend_arriving?: boolean
          notify_friend_request_received?: boolean
          notify_friend_request_accepted?: boolean
          notify_favorite_update?: boolean
          push_enabled?: boolean
          updated_at?: string
        }
        Update: {
          notify_comments?: boolean
          notify_session_conflict?: boolean
          notify_request_reply?: boolean
          notify_events?: boolean
          notify_piano_updates?: boolean
          notify_friend_arriving?: boolean
          notify_friend_request_received?: boolean
          notify_friend_request_accepted?: boolean
          notify_favorite_update?: boolean
          push_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      piano_favorites: {
        Row: PianoFavorite
        Insert: {
          piano_id: string
          user_id: string
          created_at?: string
        }
        Update: Record<string, never>
        Relationships: []
      }
      push_subscriptions: {
        Row: PushSubscription
        Insert: {
          id?: string
          user_id: string
          endpoint: string
          p256dh: string
          auth_secret: string
          user_agent?: string | null
          created_at?: string
          last_used_at?: string
        }
        Update: {
          last_used_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: AuditLogEntry
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_my_account: {
        Args: { p_password: string }
        Returns: undefined
      }
      is_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
      is_superadmin: {
        Args: Record<string, never>
        Returns: boolean
      }
      is_banned: {
        Args: { uid?: string }
        Returns: boolean
      }
      set_user_role: {
        Args: { target: string; new_role: UserRole }
        Returns: undefined
      }
      set_user_banned: {
        Args: { target: string; banned: boolean; p_password: string }
        Returns: undefined
      }
      resolve_report: {
        Args: { report_id: string }
        Returns: undefined
      }
      force_delete_piano: {
        Args: { target: string; p_password: string }
        Returns: undefined
      }
      reply_to_request: {
        Args: { request_id: string; reply: string }
        Returns: undefined
      }
      event_has_room: {
        Args: { eid: string }
        Returns: boolean
      }
      within_rate_limit: {
        Args: { action_name: string }
        Returns: boolean
      }
      mark_notification_sent: {
        Args: { notif_id: string; err?: string | null }
        Returns: undefined
      }
      list_pending_notifications: {
        Args: { lim?: number }
        Returns: { id: string }[]
      }
      purge_old_notifications: {
        Args: Record<string, never>
        Returns: undefined
      }
      verify_my_password: {
        Args: { p: string }
        Returns: boolean
      }
      get_my_profile: {
        Args: Record<string, never>
        Returns: Profile
      }
      admin_list_users: {
        Args: { q?: string; filter?: string; lim?: number }
        Returns: Profile[]
      }
      export_my_data: {
        Args: Record<string, never>
        Returns: unknown
      }
      // v6 — système d'amitié
      send_friend_request: {
        Args: { target: string }
        Returns: string
      }
      accept_friend_request: {
        Args: { request_id: string }
        Returns: undefined
      }
      reject_friend_request: {
        Args: { request_id: string }
        Returns: undefined
      }
      cancel_friend_request: {
        Args: { request_id: string }
        Returns: undefined
      }
      remove_friendship: {
        Args: { other_user: string }
        Returns: undefined
      }
      get_my_friends: {
        Args: Record<string, never>
        Returns: FriendProfile[]
      }
      get_my_friend_requests: {
        Args: { direction?: 'received' | 'sent' }
        Returns: FriendRequest[]
      }
      get_friend_status: {
        Args: { target: string }
        Returns: FriendStatus
      }
      get_active_piano_counts: {
        Args: { piano_ids: string[] }
        Returns: PianoPresenceCount[]
      }
      list_piano_presence: {
        Args: { p_piano: string }
        Returns: PresenceEntry[]
      }
      are_friends: {
        Args: { a: string; b: string }
        Returns: boolean
      }
      // v7 — recherche unifiée + favoris
      search_users: {
        Args: { q: string }
        Returns: UserSearchResult[]
      }
      find_user_by_email: {
        Args: { p_email: string }
        Returns: UserSearchResult[]
      }
      search_pianos: {
        Args: { q: string }
        Returns: PianoSearchResult[]
      }
      update_my_profile_names: {
        Args: { p_first: string | null; p_last: string | null }
        Returns: undefined
      }
      toggle_piano_favorite: {
        Args: { p_piano: string }
        Returns: boolean
      }
      get_my_favorites: {
        Args: Record<string, never>
        Returns: FavoriteWithPiano[]
      }
      enforce_caller_rate_limit: {
        Args: { p_action: string; p_max: number; p_window: string }
        Returns: undefined
      }
    }
    Enums: {
      piano_quality: PianoQuality
      user_role: UserRole
      notification_kind: NotificationKind
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
