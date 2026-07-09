import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from 'react'
import toast from 'react-hot-toast'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { CGU_VERSION } from '@/lib/constants'
import { withRetry } from '@/lib/net'
import { isTransientNetworkError } from '@/lib/errors'
import type { Profile } from '@/types/database'

/**
 * Prédicat de retry partagé pour tous les appels supabase.auth.* :
 * on retente uniquement sur incident infra (5xx / 522 / fetch fail),
 * jamais sur 400 (invalid password) ou 429 (rate-limit auth).
 */
const authRetryOpts = {
  shouldRetry: isTransientNetworkError,
  onRetry: (err: unknown, attempt: number, delayMs: number) => {
    logger.warn('auth.retry', `transient error, retrying in ${delayMs}ms`, {
      attempt,
      err
    })
  }
}

/**
 * Source de vérité de la session côté React. Expose les actions auth (signup,
 * signin, signout, reset) et le `profile` (row du même id que auth.user).
 *
 * Toutes les méthodes throw en cas d'erreur : c'est à l'appelant (forms) de
 * catcher pour afficher un toast user-friendly. Le logger trace les erreurs
 * pour Sentry, mais ne mange jamais l'exception.
 */

/** Résultat de `signUp` : indique si l'utilisateur doit confirmer son email. */
export type SignUpResult = { needsConfirmation: boolean; email: string }

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
  signUp: (email: string, password: string, pseudo: string) => Promise<SignUpResult>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  /** Renvoie l'email de confirmation pour un compte non encore confirmé. */
  resendConfirmation: (email: string) => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

async function fetchProfile(userId: string): Promise<Profile | null> {
  // Les colonnes sensibles (role, banned_at) de public.profiles ne sont plus
  // accessibles via SELECT direct (column-level revoke). On passe par la RPC
  // SECURITY DEFINER `get_my_profile` qui retourne la ligne complète du user
  // courant en bypassant les grants colonne par colonne.
  const { data, error } = await supabase.rpc('get_my_profile')
  if (error) {
    logger.error('auth.fetchProfile', 'rpc get_my_profile failed', error, { userId })
    return null
  }
  return (data as Profile | null) ?? null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  /**
   * v8 Phase 1.5 — flag pour distinguer un SIGNED_OUT *volontaire* (bouton
   * "Se déconnecter") d'un SIGNED_OUT *involontaire* (refresh token échu à
   * cause d'un 522). Sans ce flag, on ne peut pas savoir s'il faut tenter
   * une récupération de session ou accepter la déconnexion.
   */
  const signOutInProgress = useRef(false)

  /**
   * Miroir de `user` lisible depuis le callback `onAuthStateChange` :
   * ce callback est enregistré une seule fois par le useEffect ci-dessous
   * (deps []) donc une closure sur `user` resterait figée à sa valeur au
   * montage (toujours null). Le ref est tenu à jour à chaque changement de
   * `user` et lu via `.current` pour avoir la valeur réelle au moment de
   * l'event, sans avoir à réabonner onAuthStateChange à chaque connexion.
   */
  const userRef = useRef<User | null>(null)
  useEffect(() => {
    userRef.current = user
  }, [user])

  useEffect(() => {
    let mounted = true

    /**
     * Sprint 10 — Reconnexion silencieuse : si l'init dure > 3s, on affiche
     * un toast info "Reconnexion en cours…" pour expliquer la latence au
     * lieu de laisser le user face à un splash blanc. Dismiss au resolve.
     */
    const reconnectingTimer = window.setTimeout(() => {
      if (!mounted) return
      toast.loading('Reconnexion en cours…', {
        id: 'auth-reconnect',
        duration: Infinity
      })
    }, 3000)

    /**
     * Safety net : si getSession ou fetchProfile hang (réseau coupé, Supabase
     * en pause, etc.), on débloque l'UI au bout de 8s plutôt que d'avoir un
     * splash infini. Toast d'erreur pour signaler la connexion lente.
     */
    const safetyTimer = window.setTimeout(() => {
      if (!mounted) return
      toast.dismiss('auth-reconnect')
      toast.error('Connexion lente. Vérifie ta connexion et réessaie.', {
        id: 'auth-timeout',
        duration: 6000
      })
      logger.warn('auth.init', 'safety timeout fired, forcing loading=false')
      setLoading(false)
    }, 8000)

    const init = async () => {
      try {
        // v8 Phase 1.5 — getSession peut échouer en 522 sur cold-start
        // Supabase. On retente 3× avec backoff (~5.6s max) avant que le
        // safety timer 8s ne prenne le relais.
        const { data, error } = await withRetry(async () => {
          const r = await supabase.auth.getSession()
          if (r.error && isTransientNetworkError(r.error)) throw r.error
          return r
        }, authRetryOpts)
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
          window.clearTimeout(reconnectingTimer)
          window.clearTimeout(safetyTimer)
          toast.dismiss('auth-reconnect')
          setLoading(false)
        }
      }
    }
    init()

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      logger.debug('auth.stateChange', event, { hasSession: !!newSession })

      // v8 Phase 1.5 — SIGNED_OUT involontaire (refresh token échu à cause
      // d'un 522) : on tente une récupération silencieuse avant d'accepter
      // la déconnexion. `signOutInProgress` distingue d'un signout user.
      if (
        event === 'SIGNED_OUT' &&
        !newSession &&
        userRef.current &&
        !signOutInProgress.current
      ) {
        logger.warn('auth.stateChange', 'unexpected SIGNED_OUT, attempting refresh')
        try {
          const { data } = await withRetry(
            async () => {
              const r = await supabase.auth.refreshSession()
              if (r.error) throw r.error
              return r
            },
            { ...authRetryOpts, attempts: 2 }
          )
          if (data.session) {
            logger.info('auth.stateChange', 'refresh recovered session')
            // supabase-js va émettre TOKEN_REFRESHED juste après → on laisse
            // ce prochain event mettre à jour la session. On sort ici pour
            // éviter le setUser(null) plus bas.
            return
          }
        } catch (err) {
          logger.warn('auth.stateChange', 'refresh recovery failed', { err })
          toast.error('Session expirée pendant un incident réseau. Reconnecte-toi.', {
            id: 'session-lost',
            duration: 6000
          })
        }
        // Recovery a échoué → on continue en dessous et on accepte le signout
      }

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
      window.clearTimeout(reconnectingTimer)
      window.clearTimeout(safetyTimer)
      toast.dismiss('auth-reconnect')
      sub.subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    // v8 Phase 1.5 — retry sur incidents transitoires (522/504/fetch fail)
    // uniquement. Les 400 "mauvais password" throw immédiatement.
    // signInWithPassword ne throw pas de lui-même — il retourne { error }.
    // On throw explicitement en cas d'error transitoire pour laisser
    // withRetry retenter ; sinon on retourne le résultat pour laisser le
    // handling normal des erreurs métier.
    const { error } = await withRetry(async () => {
      const result = await supabase.auth.signInWithPassword({ email, password })
      if (result.error && isTransientNetworkError(result.error)) throw result.error
      return result
    }, authRetryOpts)
    if (error) {
      logger.warn('auth.signIn', 'failed', { code: error.status, message: error.message })
      throw error
    }
    logger.info('auth.signIn', 'success')
  }

  const signUp = async (
    email: string,
    password: string,
    pseudo: string
  ): Promise<SignUpResult> => {
    // Sprint 7 sécu (A.6.4) — Rate-limit signup par IP via Edge Function.
    // Fail-open si l'Edge Function plante (le rate-limit Supabase Auth + le
    // check pseudo unique restent les filets) : on n'empêche pas un user
    // légitime de signup à cause d'une indispo de l'edge fn.
    try {
      // v8 Phase 1.5 — retry sur incidents transitoires (2 tentatives, plus
      // agressif que le safety fail-open standard pour ne pas trop retarder
      // le signup si l'Edge Function est simplement down).
      const { data: gate, error: gateError } = await withRetry(
        () =>
          supabase.functions.invoke<{
            allowed: boolean
            error?: string
            message?: string
          }>('signup-protected', { body: {} }),
        { ...authRetryOpts, attempts: 2 }
      )
      if (!gateError && gate && gate.allowed === false) {
        logger.warn('auth.signUp', 'ip_rate_limit blocked', { error: gate.error })
        throw new Error(
          gate.message ?? 'Trop de tentatives depuis cette connexion. Réessaie plus tard.'
        )
      }
    } catch (err) {
      // Distingue les erreurs de NOTRE throw (rate-limit hit) de celles de
      // l'invoke lui-même (réseau, fonction non déployée). Le rate-limit hit
      // doit être propagé ; l'erreur d'invoke est swallow (fail-open).
      if (err instanceof Error && err.message.includes('Trop de tentatives')) {
        throw err
      }
      logger.warn('auth.signUp', 'ip rate-limit check failed (fail-open)', {
        message: err instanceof Error ? err.message : String(err)
      })
    }

    // Pseudo dup check best-effort (race possible : le trigger DB ajoute un
    // suffixe en fallback, donc on est protégé même en cas de course).
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

    const redirectTo = `${window.location.origin}/auth/login`
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { pseudo, accept_cgu_version: CGU_VERSION },
        emailRedirectTo: redirectTo
      }
    })
    if (error) {
      logger.warn('auth.signUp', 'signup failed', { message: error.message })
      throw error
    }
    if (!data.user) {
      logger.error('auth.signUp', 'no user returned', new Error('no-user'))
      throw new Error('Inscription échouée')
    }
    // Le profil est créé par le trigger SQL on_auth_user_created. Plus
    // d'INSERT manuel ici — avec email confirmation activée, auth.uid()
    // serait null et la policy profiles_insert_self refuserait.
    const needsConfirmation = !data.session
    logger.info('auth.signUp', 'success', {
      userId: data.user.id,
      needsConfirmation
    })
    return { needsConfirmation, email }
  }

  const resendConfirmation = async (email: string) => {
    const redirectTo = `${window.location.origin}/auth/login`
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: redirectTo }
    })
    if (error) {
      logger.warn('auth.resendConfirmation', 'failed', { message: error.message })
      throw error
    }
    logger.info('auth.resendConfirmation', 'sent')
  }

  const signOut = async () => {
    // v8 Phase 1.5 — flag le signout comme volontaire pour empêcher
    // onAuthStateChange de tenter une récupération de session.
    signOutInProgress.current = true
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        logger.warn('auth.signOut', 'failed', { message: error.message })
        throw error
      }
      logger.info('auth.signOut', 'success')
    } finally {
      // Petit délai pour laisser onAuthStateChange traiter le SIGNED_OUT avec
      // le flag à true avant de le repasser à false (sinon race).
      setTimeout(() => {
        signOutInProgress.current = false
      }, 500)
    }
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
    toast.error(
      'Ce compte a été suspendu. Pour toute question, contacte enzo.reine35@gmail.com',
      { id: 'banned', duration: 10000 }
    )
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
        resendConfirmation,
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
