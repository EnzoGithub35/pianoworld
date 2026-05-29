import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, UserX, Users } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useUserSearch } from '@/hooks/useUsers'
import { USER_SEARCH_MIN_CHARS } from '@/lib/constants'
import { fromNow } from '@/lib/date'

export function SearchPage() {
  const [query, setQuery] = useState('')
  const { data: results, isLoading } = useUserSearch(query)
  const trimmed = query.trim()
  const tooShort = trimmed.length > 0 && trimmed.length < USER_SEARCH_MIN_CHARS

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <header className="space-y-3 border-b border-border bg-background/80 px-4 py-5 backdrop-blur">
        <h1 className="font-display text-2xl font-bold tracking-tight">Rechercher</h1>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pseudo d'un utilisateur…"
            className="pl-9"
            autoFocus
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24">
        {trimmed.length === 0 && (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="Trouve un pianoteur"
            description={`Tape au moins ${USER_SEARCH_MIN_CHARS} caractères du pseudo recherché.`}
          />
        )}

        {tooShort && (
          <p className="text-center text-xs text-muted-foreground">
            Encore {USER_SEARCH_MIN_CHARS - trimmed.length} caractère
            {USER_SEARCH_MIN_CHARS - trimmed.length > 1 ? 's' : ''}…
          </p>
        )}

        {trimmed.length >= USER_SEARCH_MIN_CHARS && isLoading && (
          <ul className="space-y-2">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </li>
            ))}
          </ul>
        )}

        {trimmed.length >= USER_SEARCH_MIN_CHARS &&
          !isLoading &&
          results &&
          results.length === 0 && (
            <EmptyState
              icon={<UserX className="h-6 w-6" />}
              title="Aucun résultat"
              description={`Personne ne s'appelle « ${trimmed} » pour l'instant.`}
            />
          )}

        {results && results.length > 0 && (
          <ul className="space-y-2 animate-fade-in">
            {results.map((u) => (
              <li key={u.id}>
                <Link
                  to={`/user/${u.pseudo}`}
                  className="card-hover flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                >
                  <Avatar pseudo={u.pseudo} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">@{u.pseudo}</p>
                    <p className="text-xs text-muted-foreground">
                      Inscrit {fromNow(u.created_at)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
