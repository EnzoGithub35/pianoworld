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
  updated_by: string
  still_there: boolean
  new_quality: PianoQuality | null
  comment: string | null
  created_at: string
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

export type PianoSession = {
  id: string
  piano_id: string
  user_id: string
  starts_at: string
  duration_min: number
  created_at: string
  cancelled_at: string | null
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
        }
        Update: {
          pseudo?: string
          created_at?: string
          role?: UserRole
          banned_at?: string | null
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
        }
        Update: {
          cancelled_at?: string | null
        }
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_my_account: {
        Args: Record<string, never>
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
        Args: { target: string; banned: boolean }
        Returns: undefined
      }
      resolve_report: {
        Args: { report_id: string }
        Returns: undefined
      }
      force_delete_piano: {
        Args: { target: string }
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
    }
    Enums: {
      piano_quality: PianoQuality
      user_role: UserRole
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
