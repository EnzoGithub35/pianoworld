import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronRight,
  KeyRound,
  LogOut,
  Moon,
  Pencil,
  Shield,
  ShieldCheck,
  Sun,
  Trash2,
  Users
} from 'lucide-react'
import { useFriends, usePendingReceivedCount } from '@/hooks/useFriends'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { EditPseudoDialog } from '@/components/Settings/EditPseudoDialog'
import { DeleteAccountDialog } from '@/components/Settings/DeleteAccountDialog'
import { ExportDataButton } from '@/components/Settings/ExportDataButton'
import { ChangePasswordDialog } from '@/components/Settings/ChangePasswordDialog'
import { NotificationPreferences } from '@/components/Settings/NotificationPreferences'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {children}
      </div>
    </section>
  )
}

function Row({
  icon: Icon,
  label,
  value,
  onClick,
  variant = 'default',
  divider = true
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value?: string
  onClick?: () => void
  variant?: 'default' | 'destructive'
  divider?: boolean
}) {
  const isClickable = !!onClick
  const variantClass = variant === 'destructive' ? 'text-destructive' : 'text-foreground'
  const content = (
    <>
      <span className={'flex items-center gap-3 ' + variantClass}>
        <span
          className={
            'flex h-8 w-8 items-center justify-center rounded-lg ' +
            (variant === 'destructive'
              ? 'bg-destructive/10 text-destructive'
              : 'bg-muted text-muted-foreground')
          }
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-sm font-medium">{label}</span>
      </span>
      <span className="flex items-center gap-2">
        {value && <span className="text-xs text-muted-foreground">{value}</span>}
        {isClickable && variant !== 'destructive' && (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </span>
    </>
  )
  const className =
    'flex w-full items-center justify-between px-3 py-3 text-left transition-colors ' +
    (isClickable ? 'hover:bg-accent' : '') +
    (divider ? ' border-b border-border last:border-b-0' : '')

  return isClickable ? (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  )
}

export function SettingsPage() {
  const { user, profile, signOut, isAdmin, isSuperadmin } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [editPseudo, setEditPseudo] = useState(false)
  const [deleteAccount, setDeleteAccount] = useState(false)
  const [changePassword, setChangePassword] = useState(false)
  const friends = useFriends()
  const pendingCount = usePendingReceivedCount()
  const friendsCount = friends.data?.length ?? 0
  const friendsLabel =
    pendingCount > 0
      ? `${friendsCount} (${pendingCount} en attente)`
      : friendsCount > 0
        ? `${friendsCount}`
        : undefined

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background">
      <header className="border-b border-border bg-background/80 px-4 py-5 backdrop-blur">
        <h1 className="font-display text-2xl font-bold tracking-tight">Paramètres</h1>
      </header>

      <div className="space-y-6 p-4 pb-24">
        <Section title="Compte">
          <Row
            icon={Pencil}
            label="Pseudo"
            value={`@${profile?.pseudo ?? '—'}`}
            onClick={() => setEditPseudo(true)}
          />
          <Row icon={Shield} label="Email" value={user?.email ?? '—'} />
          <Row
            icon={KeyRound}
            label="Changer mon mot de passe"
            onClick={() => setChangePassword(true)}
          />
        </Section>

        <Section title="Social">
          <Link
            to="/dashboard?tab=friends"
            className="flex items-center justify-between px-3 py-3 transition-colors hover:bg-accent"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Users className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium">Mes amis</span>
            </span>
            <span className="flex items-center gap-2">
              {friendsLabel && (
                <span className="text-xs text-muted-foreground">{friendsLabel}</span>
              )}
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </span>
          </Link>
        </Section>

        <Section title="Notifications">
          <NotificationPreferences />
        </Section>

        <Section title="Apparence">
          <Row
            icon={theme === 'dark' ? Sun : Moon}
            label={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
            onClick={toggleTheme}
          />
        </Section>

        <Section title="Données (RGPD)">
          <div className="px-3 py-3">
            <ExportDataButton />
          </div>
          <Link
            to="/legal"
            className="flex items-center justify-between border-t border-border px-3 py-3 transition-colors hover:bg-accent"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Shield className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium">
                Mentions légales & confidentialité
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </Section>

        {isAdmin && (
          <Section title="Administration">
            <Link
              to="/admin"
              className="flex items-center justify-between px-3 py-3 transition-colors hover:bg-accent"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <span className="text-sm font-medium">
                  Dashboard {isSuperadmin ? 'superadmin' : 'admin'}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </Section>
        )}

        <Section title="Session">
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center justify-between px-3 py-3 text-left transition-colors hover:bg-accent"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <LogOut className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium">Se déconnecter</span>
            </span>
          </button>
        </Section>

        <Section title="Zone dangereuse">
          <Row
            icon={Trash2}
            label="Supprimer mon compte"
            variant="destructive"
            onClick={() => setDeleteAccount(true)}
          />
        </Section>

        <p className="px-1 pt-2 text-center text-[11px] text-muted-foreground">
          PianoWorld · v0.1
        </p>
      </div>

      <EditPseudoDialog open={editPseudo} onClose={() => setEditPseudo(false)} />
      <DeleteAccountDialog open={deleteAccount} onClose={() => setDeleteAccount(false)} />
      <ChangePasswordDialog
        open={changePassword}
        onClose={() => setChangePassword(false)}
      />
    </div>
  )
}
