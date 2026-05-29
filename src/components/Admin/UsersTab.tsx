import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, ShieldCheck, UserMinus, UserPlus } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/contexts/AuthContext'
import {
  useAdminUsers,
  type AdminUserFilter,
  type AdminUserRow
} from '@/hooks/useAdminUsers'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'

function RoleBadge({ role }: { role: AdminUserRow['role'] }) {
  if (role === 'superadmin') return <Badge variant="primary">superadmin</Badge>
  if (role === 'admin') return <Badge variant="primary">admin</Badge>
  return null
}

export function UsersTab() {
  const { profile: me, isSuperadmin } = useAuth()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<AdminUserFilter>('all')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const { data: users, isLoading } = useAdminUsers(query, filter)

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    await queryClient.invalidateQueries({ queryKey: ['admin-kpis'] })
  }

  const handleBan = async (user: AdminUserRow, ban: boolean) => {
    setPendingId(user.id)
    try {
      const { error } = await supabase.rpc('set_user_banned', {
        target: user.id,
        banned: ban
      })
      if (error) {
        logger.error('admin.ban', 'rpc failed', error, { target: user.id, ban })
        throw error
      }
      logger.warn('admin.ban', ban ? 'banned' : 'unbanned', { target: user.id })
      toast.success(ban ? `@${user.pseudo} banni` : `@${user.pseudo} débanni`)
      await refresh()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Action échouée'))
    } finally {
      setPendingId(null)
    }
  }

  const handlePromote = async (user: AdminUserRow, makeAdmin: boolean) => {
    setPendingId(user.id)
    try {
      const { error } = await supabase.rpc('set_user_role', {
        target: user.id,
        new_role: makeAdmin ? 'admin' : 'user'
      })
      if (error) {
        logger.error('admin.role', 'rpc failed', error, { target: user.id })
        throw error
      }
      logger.warn('admin.role', makeAdmin ? 'promoted' : 'demoted', { target: user.id })
      toast.success(
        makeAdmin ? `@${user.pseudo} est admin` : `@${user.pseudo} repassé user`
      )
      await refresh()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Action échouée'))
    } finally {
      setPendingId(null)
    }
  }

  const filters: { id: AdminUserFilter; label: string }[] = [
    { id: 'all', label: 'Tous' },
    { id: 'admin', label: 'Admins' },
    { id: 'banned', label: 'Bannis' }
  ]

  return (
    <div className="space-y-4 p-4 pb-24">
      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un pseudo…"
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                filter === f.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background hover:bg-accent'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <ul className="space-y-2">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex gap-3 rounded-xl border border-border p-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </li>
          ))}
        </ul>
      )}

      {!isLoading && users && users.length === 0 && (
        <EmptyState
          icon={<UserMinus className="h-6 w-6" />}
          title="Aucun utilisateur"
          description="Aucun résultat avec les filtres actuels."
        />
      )}

      <ul className="space-y-2">
        {users?.map((u) => {
          const isMe = u.id === me?.id
          const isBanned = !!u.banned_at
          const isUserAdmin = u.role === 'admin' || u.role === 'superadmin'
          const isUserSuperadmin = u.role === 'superadmin'
          const busy = pendingId === u.id
          return (
            <li
              key={u.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3"
            >
              <Link to={`/user/${u.pseudo}`} className="flex flex-1 items-center gap-3">
                <Avatar pseudo={u.pseudo} size="md" />
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    @{u.pseudo}
                    {isMe && <span className="text-xs text-muted-foreground">(toi)</span>}
                    <RoleBadge role={u.role} />
                    {isBanned && <Badge variant="destructive">banni</Badge>}
                  </p>
                </div>
              </Link>
              {!isMe && !isUserSuperadmin && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant={isBanned ? 'outline' : 'destructive'}
                    loading={busy}
                    onClick={() => handleBan(u, !isBanned)}
                    className="gap-1.5"
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                    {isBanned ? 'Débannir' : 'Bannir'}
                  </Button>
                  {isSuperadmin && !isUserAdmin && (
                    <Button
                      size="sm"
                      variant="outline"
                      loading={busy}
                      onClick={() => handlePromote(u, true)}
                      className="gap-1.5"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Admin
                    </Button>
                  )}
                  {isSuperadmin && u.role === 'admin' && (
                    <Button
                      size="sm"
                      variant="outline"
                      loading={busy}
                      onClick={() => handlePromote(u, false)}
                      className="gap-1.5"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Rétrograder
                    </Button>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
