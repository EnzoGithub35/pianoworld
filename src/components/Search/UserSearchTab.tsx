import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search as SearchIcon, AtSign } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { useUserSearch } from '@/hooks/useUsers'
import { USER_SEARCH_MIN_CHARS } from '@/lib/constants'
import { fromNow } from '@/lib/date'
import { EmailSearchDialog } from './EmailSearchDialog'

/**
 * v7 — Tab "Utilisateurs" de la SearchPage.
 *
 * 1 input principal qui cherche pseudo + first_name + last_name via RPC
 * search_users (accent-insensitive, fuzzy).
 *
 * 1 CTA secondaire "Chercher par email" → ouvre EmailSearchDialog
 * (rate-limité 5/24h serveur, submit explicite séparé pour éviter le burn).
 */
export function UserSearchTab() {
  const [query, setQuery] = useState('')
  const [emailOpen, setEmailOpen] = useState(false)
  const { data: users, isLoading } = useUserSearch(query)

  const trimmed = query.trim()
  const showHint = trimmed.length > 0 && trimmed.length < USER_SEARCH_MIN_CHARS

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            inputMode="search"
            autoComplete="off"
            placeholder="Pseudo (ou prénom/nom si renseigné)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex h-11 w-full rounded-md border border-input bg-background pl-10 pr-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={() => setEmailOpen(true)}
        >
          <AtSign className="h-3.5 w-3.5" />
          Tu connais son email ?
        </Button>
      </div>

      {showHint && (
        <p className="px-1 text-xs text-muted-foreground">
          Tape au moins {USER_SEARCH_MIN_CHARS} caractères pour chercher.
        </p>
      )}

      {isLoading && (
        <ul className="space-y-2">
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className="flex items-center gap-3 rounded-xl border border-border p-3"
            >
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </li>
          ))}
        </ul>
      )}

      {!isLoading &&
        trimmed.length >= USER_SEARCH_MIN_CHARS &&
        users &&
        users.length === 0 && (
          <EmptyState
            icon={<SearchIcon className="h-6 w-6" />}
            title="Aucun résultat"
            description="Essaye une autre orthographe, ou cherche par email — la personne peut aussi avoir choisi de ne pas afficher son prénom/nom."
          />
        )}

      {trimmed.length < USER_SEARCH_MIN_CHARS && !showHint && (
        <EmptyState
          icon={<SearchIcon className="h-6 w-6" />}
          title="Trouve quelqu'un"
          description="Tape un pseudo pour chercher (ou un prénom/nom si la personne l'a renseigné dans ses paramètres)."
        />
      )}

      <ul className="space-y-2">
        {users?.map((u) => {
          const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ')
          return (
            <li key={u.id}>
              <Link
                to={`/user/${u.pseudo}`}
                className="card-hover flex items-center gap-3 rounded-xl border border-border bg-card p-3"
              >
                <Avatar pseudo={u.pseudo} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">@{u.pseudo}</p>
                  {fullName && (
                    <p className="truncate text-xs text-muted-foreground">{fullName}</p>
                  )}
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Inscrit {fromNow(u.created_at)}
                  </p>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>

      <EmailSearchDialog open={emailOpen} onClose={() => setEmailOpen(false)} />
    </div>
  )
}
