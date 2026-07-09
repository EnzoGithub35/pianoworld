import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Session, User, AuthChangeEvent } from '@supabase/supabase-js'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'

type AuthStateCallback = (
  event: AuthChangeEvent,
  session: Session | null
) => void | Promise<void>

// vi.mock est hoisté en haut du fichier par Vitest : toute variable référencée
// dans la factory doit passer par vi.hoisted() pour éviter une TDZ error.
const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  resend: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  refreshSession: vi.fn(),
  rpc: vi.fn(),
  fromMaybeSingle: vi.fn(),
  functionsInvoke: vi.fn(),
  authStateChangeCallback: undefined as AuthStateCallback | undefined
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
      signInWithPassword: mocks.signInWithPassword,
      signUp: mocks.signUp,
      signOut: mocks.signOut,
      resend: mocks.resend,
      resetPasswordForEmail: mocks.resetPasswordForEmail,
      refreshSession: mocks.refreshSession
    },
    rpc: mocks.rpc,
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        ilike: vi.fn(() => ({ maybeSingle: mocks.fromMaybeSingle }))
      }))
    })),
    functions: { invoke: mocks.functionsInvoke }
  }
}))

const mockToast = vi.hoisted(() => ({
  loading: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  dismiss: vi.fn()
}))
vi.mock('react-hot-toast', () => ({ default: mockToast }))

const mockLogger = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}))
vi.mock('@/lib/logger', () => ({ logger: mockLogger }))

function makeUser(id = 'user-1'): User {
  return {
    id,
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString()
  } as unknown as User
}

function makeSession(user: User): Session {
  return {
    access_token: 'tok',
    refresh_token: 'refresh',
    expires_in: 3600,
    token_type: 'bearer',
    user
  } as unknown as Session
}

function transientError(status = 522) {
  return { status, message: 'Connection Timed Out', name: 'AuthApiError' }
}

function renderAuthHook() {
  return renderHook(() => useAuth(), {
    wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>
  })
}

beforeEach(() => {
  // resetAllMocks (pas clearAllMocks) : on veut aussi virer les
  // mockImplementation posés par le test précédent.
  vi.resetAllMocks()
  vi.useFakeTimers()
  mocks.onAuthStateChange.mockImplementation((cb: AuthStateCallback) => {
    mocks.authStateChangeCallback = cb
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  })
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null })
  mocks.rpc.mockResolvedValue({ data: null, error: null })
  mocks.fromMaybeSingle.mockResolvedValue({ data: null, error: null })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('AuthContext — init() retry sur getSession', () => {
  it('récupère la session après 2 échecs transitoires puis un succès', async () => {
    const session = makeSession(makeUser())
    mocks.getSession
      .mockResolvedValueOnce({ data: { session: null }, error: transientError() })
      .mockResolvedValueOnce({ data: { session: null }, error: transientError() })
      .mockResolvedValueOnce({ data: { session }, error: null })

    const { result } = renderAuthHook()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })

    expect(mocks.getSession).toHaveBeenCalledTimes(3)
    expect(result.current.session).toEqual(session)
    expect(result.current.loading).toBe(false)
  })

  it('loading=false sans session si getSession échoue sur les 3 tentatives', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: null },
      error: transientError()
    })
    const { result } = renderAuthHook()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })

    expect(mocks.getSession).toHaveBeenCalledTimes(3)
    expect(result.current.loading).toBe(false)
    expect(result.current.session).toBeNull()
  })

  it('le safety timer force loading=false + toast après 8s si getSession hang', async () => {
    mocks.getSession.mockImplementation(() => new Promise(() => {})) // ne résout jamais
    const { result } = renderAuthHook()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    expect(mockToast.loading).toHaveBeenCalledWith(
      'Reconnexion en cours…',
      expect.objectContaining({ id: 'auth-reconnect' })
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5100) // total ~8100ms
    })
    expect(result.current.loading).toBe(false)
    expect(mockToast.error).toHaveBeenCalledWith(
      'Connexion lente. Vérifie ta connexion et réessaie.',
      expect.objectContaining({ id: 'auth-timeout', duration: 6000 })
    )
  })
})

describe('AuthContext — signIn() retry', () => {
  it('signIn retry sur 522 puis succès', async () => {
    mocks.signInWithPassword
      .mockResolvedValueOnce({
        data: { user: null, session: null },
        error: transientError()
      })
      .mockResolvedValueOnce({
        data: { user: null, session: null },
        error: transientError()
      })
      .mockResolvedValueOnce({
        data: { user: makeUser(), session: makeSession(makeUser()) },
        error: null
      })

    const { result } = renderAuthHook()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0) // flush init() (session initiale null, immédiat)
    })

    let signInPromise!: Promise<void>
    await act(async () => {
      signInPromise = result.current.signIn('a@b.com', 'pw')
      await vi.advanceTimersByTimeAsync(5000)
    })
    await expect(signInPromise).resolves.toBeUndefined()
    expect(mocks.signInWithPassword).toHaveBeenCalledTimes(3)
  })

  it('signIn throw immédiatement sur 400, sans retry', async () => {
    const invalidErr = {
      status: 400,
      message: 'Invalid login credentials',
      name: 'AuthApiError'
    }
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: invalidErr
    })
    const { result } = renderAuthHook()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    await expect(result.current.signIn('a@b.com', 'wrong')).rejects.toEqual(invalidErr)
    expect(mocks.signInWithPassword).toHaveBeenCalledTimes(1)
  })
})

describe('AuthContext — recovery sur SIGNED_OUT inattendu', () => {
  it('SIGNED_OUT inattendu + refreshSession réussi → pas de déconnexion', async () => {
    const user = makeUser()
    mocks.getSession.mockResolvedValue({
      data: { session: makeSession(user) },
      error: null
    })
    const { result } = renderAuthHook()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current.user).not.toBeNull()

    mocks.refreshSession.mockResolvedValueOnce({
      data: { session: makeSession(user) },
      error: null
    })
    await act(async () => {
      await mocks.authStateChangeCallback!('SIGNED_OUT', null)
    })

    expect(mocks.refreshSession).toHaveBeenCalledTimes(1)
    expect(result.current.user).not.toBeNull() // early return respecté, pas de setUser(null)
  })

  it('SIGNED_OUT inattendu + refreshSession échoue (2 tentatives) → toast + déconnexion', async () => {
    const user = makeUser()
    mocks.getSession.mockResolvedValue({
      data: { session: makeSession(user) },
      error: null
    })
    const { result } = renderAuthHook()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    mocks.refreshSession.mockResolvedValue({
      data: { session: null },
      error: transientError()
    })
    await act(async () => {
      const p = mocks.authStateChangeCallback!('SIGNED_OUT', null)
      await vi.advanceTimersByTimeAsync(5000)
      await p
    })

    expect(mocks.refreshSession).toHaveBeenCalledTimes(2) // attempts:2 pour ce cas précis
    expect(result.current.user).toBeNull()
    expect(result.current.session).toBeNull()
    expect(mockToast.error).toHaveBeenCalledWith(
      'Session expirée pendant un incident réseau. Reconnecte-toi.',
      expect.objectContaining({ id: 'session-lost', duration: 6000 })
    )
  })

  it('signOut volontaire empêche la tentative de recovery', async () => {
    const user = makeUser()
    mocks.getSession.mockResolvedValue({
      data: { session: makeSession(user) },
      error: null
    })
    mocks.signOut.mockResolvedValue({ error: null })
    const { result } = renderAuthHook()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    await act(async () => {
      await result.current.signOut()
      await mocks.authStateChangeCallback!('SIGNED_OUT', null) // avant les 500ms de reset du flag
    })

    expect(mocks.refreshSession).not.toHaveBeenCalled()
  })
})
