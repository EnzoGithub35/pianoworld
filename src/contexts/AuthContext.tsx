import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import toast from 'react-hot-toast'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { isUniqueViolation } from '@/lib/errors'
import type { Profile } from '@/types/database'

/**
 * Source de vérité de la session côté React. Expose les actions auth (signup,
 * signin, signout, reset) et le `profile` (row du même id que auth.user).
 *
 * Toutes les méthodes throw en cas d'erreur : c'est à l'appelant (forms) de
 * catcher pour afficher un toast user-friendly. Le logger trace les erreurs
 * pour Sentry, mais ne mange jamais l'exception.
 */

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  /** True si le profil a un rôle 'admin' ou 'superadmin'. */
  isAdmin: boolean
  /** True si le profil a explicitement le rôle 'superadmin'. */
  isSuperadmin: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, pseudo: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) {
    logger.error('auth.fetchProfile', 'profile select failed', error, { userId })
    return null
  }
  return data
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    /**
     * Safety net : si getSession ou fetchProfile hang (réseau coupé, Supabase
     * en pause, etc.), on débloque l'UI au bout de 8s plutôt que d'avoir un
     * splash infini. L'utilisateur arrive sur la page de login.
     */
    const safetyTimer = window.setTimeout(() => {
      if (!mounted) return
      logger.warn('auth.init', 'safety timeout fired, forcing loading=false')
      setLoading(false)
    }, 8000)

    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) logger.error('auth.getSession', 'failed', error)
        if (!mounted) return
        setSession(data.session)
        setUser(data.session?.user ?? null)
        if (data.session?.user) {
          const p = await fetchProfile(data.session.user.id)
          if (mounted) setProfile(p)
        }
        logger.debug('auth.init', 'session resolved', {
          authenticated: !!data.session?.user
        })
      } catch (err) {
        logger.error('auth.init', 'unexpected error', err)
      } finally {
        if (mounted) {
          window.clearTimeout(safetyTimer)
          setLoading(false)
        }
      }
    }
    init()

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      logger.debug('auth.stateChange', event, { hasSession: !!newSession })
      setSession(newSession)
      setUser(newSession?.user ?? null)
      if (newSession?.user) {
        // fire-and-forget : le profile peut arriver après les autres setState
        fetchProfile(newSession.user.id)
          .then((p) => {
            if (mounted) setProfile(p)
          })
          .catch((err) => logger.error('auth.stateChange', 'profile fetch failed', err))
      } else {
        setProfile(null)
      }
    })

    return () => {
      mounted = false
      window.clearTimeout(safetyTimer)
      sub.subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      logger.warn('auth.signIn', 'failed', { code: error.status, message: error.message })
      throw error
    }
    logger.info('auth.signIn', 'success')
  }

  const signUp = async (email: string, password: string, pseudo: string) => {
    const { data: existing, error: lookupError } = await supabase
      .from('profiles')
      .select('id')
      .ilike('pseudo', pseudo)
      .maybeSingle()
    if (lookupError) {
      logger.error('auth.signUp', 'pseudo lookup failed', lookupError, { pseudo })
      throw lookupError
    }
    if (existing) throw new Error('Ce pseudo est déjà pris')

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { pseudo } }
    })
    if (error) {
      logger.warn('auth.signUp', 'signup failed', { message: error.message })
      throw error
    }
    if (!data.user) {
      logger.error('auth.signUp', 'no user returned', new Error('no-user'))
      throw new Error('Inscription échouée')
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .insert({ id: data.user.id, pseudo })
    if (profileError) {
      if (isUniqueViolation(profileError)) {
        throw new Error('Ce pseudo est déjà pris')
      }
      logger.error('auth.signUp', 'profile insert failed', profileError, {
        userId: data.user.id
      })
      throw new Error('Compte créé mais profil non enregistré, contacte le support.')
    }
    logger.info('auth.signUp', 'success', { userId: data.user.id })
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      logger.warn('auth.signOut', 'failed', { message: error.message })
      throw error
    }
    logger.info('auth.signOut', 'success')
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset`
    })
    if (error) {
      logger.warn('auth.resetPassword', 'failed', { message: error.message })
      throw error
    }
    logger.info('auth.resetPassword', 'email sent')
  }

  const refreshProfile = async () => {
    if (!user) return
    const p = await fetchProfile(user.id)
    setProfile(p)
  }

  /**
   * Banned check : si le profil charge avec banned_at non-null, on signe out
   * immédiatement. Effectue le toast une seule fois par session pour éviter le
   * spam si onAuthStateChange retrigger.
   */
  useEffect(() => {
    if (!profile || !profile.banned_at) return
    logger.warn('auth.banned', 'kicking banned user', { userId: profile.id })
    toast.error('Ce compte a été suspendu', { id: 'banned' })
    void supabase.auth.signOut()
  }, [profile])

  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin'
  const isSuperadmin = profile?.role === 'superadmin'

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        isAdmin,
        isSuperadmin,
        signIn,
        signUp,
        signOut,
        resetPassword,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider')
  return ctx
}
