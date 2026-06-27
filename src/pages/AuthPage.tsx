import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Logo } from '@/components/Layout/Logo'
import { SplashScreen } from '@/components/Layout/SplashScreen'
import { LoginForm } from '@/components/Auth/LoginForm'
import { SignupForm } from '@/components/Auth/SignupForm'
import { ConfirmPending } from '@/components/Auth/ConfirmPending'
import { ForgotPasswordForm } from '@/components/Auth/ForgotPasswordForm'
import { ResetPasswordForm } from '@/components/Auth/ResetPasswordForm'

function AuthLayout({
  title,
  subtitle,
  children,
  footer
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-background p-6">
      {/* Décor d'arrière-plan : taches floues warm */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="animate-fade-in relative w-full max-w-sm space-y-6">
        <header className="flex flex-col items-center gap-3 text-center">
          <Logo className="h-16 w-16" />
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">PianoWorld</h1>
            <p className="mt-1 text-sm font-medium text-foreground">{title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </header>
        <div className="rounded-2xl border border-border bg-card/80 p-5 shadow-sm backdrop-blur">
          {children}
        </div>
        {footer}
      </div>
    </div>
  )
}

function LoginRoute() {
  const navigate = useNavigate()
  return (
    <AuthLayout title="Bon retour" subtitle="Connecte-toi pour explorer les pianos.">
      <LoginForm />
      <div className="mt-4 flex justify-between text-xs">
        <button
          className="font-medium text-primary hover:underline"
          onClick={() => navigate('/auth/signup')}
        >
          Créer un compte
        </button>
        <button
          className="font-medium text-muted-foreground hover:text-foreground"
          onClick={() => navigate('/auth/forgot')}
        >
          Mot de passe oublié ?
        </button>
      </div>
    </AuthLayout>
  )
}

function SignupRoute() {
  const navigate = useNavigate()
  return (
    <AuthLayout
      title="Rejoins l'aventure"
      subtitle="Cartographie les pianos publics avec la communauté."
    >
      <SignupForm />
      <div className="mt-4 text-center text-xs">
        <span className="text-muted-foreground">Déjà inscrit ? </span>
        <button
          className="font-medium text-primary hover:underline"
          onClick={() => navigate('/auth/login')}
        >
          Se connecter
        </button>
      </div>
    </AuthLayout>
  )
}

function ForgotRoute() {
  const navigate = useNavigate()
  return (
    <AuthLayout
      title="Mot de passe oublié"
      subtitle="Reçois un email avec un lien de réinitialisation."
    >
      <ForgotPasswordForm />
      <div className="mt-4 text-center text-xs">
        <button
          className="font-medium text-primary hover:underline"
          onClick={() => navigate('/auth/login')}
        >
          ← Retour connexion
        </button>
      </div>
    </AuthLayout>
  )
}

function ResetRoute() {
  return (
    <AuthLayout title="Nouveau mot de passe" subtitle="Choisis ton nouveau mot de passe.">
      <ResetPasswordForm />
    </AuthLayout>
  )
}

function ConfirmPendingRoute() {
  return (
    <AuthLayout
      title="Vérifie ta boîte mail"
      subtitle="Un lien de confirmation t'a été envoyé."
    >
      <ConfirmPending />
    </AuthLayout>
  )
}

export function AuthPage() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <SplashScreen />

  const isReset = location.pathname.startsWith('/auth/reset')
  const isConfirmPending = location.pathname.startsWith('/auth/confirm-pending')
  if (user && !isReset && !isConfirmPending) {
    // Si on a une destination préservée (depuis RequireAuth), on y retourne.
    // Sinon défaut sur la carte. Le `from` peut contenir search + hash.
    // v8 : la racine `/` est désormais la landing publique — on envoie vers
    // `/map` qui est la première route protégée utile.
    const state = location.state as { from?: string } | null
    const target = state?.from && state.from !== '/auth' ? state.from : '/map'
    return <Navigate to={target} replace />
  }

  return (
    <Routes>
      <Route path="login" element={<LoginRoute />} />
      <Route path="signup" element={<SignupRoute />} />
      <Route path="confirm-pending" element={<ConfirmPendingRoute />} />
      <Route path="forgot" element={<ForgotRoute />} />
      <Route path="reset" element={<ResetRoute />} />
      <Route path="*" element={<Navigate to="/auth/login" replace />} />
    </Routes>
  )
}
