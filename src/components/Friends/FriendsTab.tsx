import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Users, UserPlus, Inbox, Send, Search } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useFriends, useFriendRequests } from '@/hooks/useFriends'
import { FriendCard } from './FriendCard'
import { FriendRequestCard } from './FriendRequestCard'
import { FRIENDS_DISPLAY_LIMIT } from '@/lib/constants'

/**
 * Onglet "Amis" du Dashboard. 3 sous-tabs :
 *  - Mes amis (avec search input client-side)
 *  - Demandes reçues (Badge count = pending)
 *  - Demandes envoyées
 *
 * Tous les empty states ont un CTA pour éviter le cul-de-sac UX.
 */
export function FriendsTab() {
  const [sub, setSub] = useState<'list' | 'received' | 'sent'>('list')
  const [search, setSearch] = useState('')

  const friends = useFriends()
  const received = useFriendRequests('received')
  const sent = useFriendRequests('sent')

  const filteredFriends = useMemo(() => {
    const all = friends.data ?? []
    const q = search.trim().toLowerCase()
    const filtered = q ? all.filter((f) => f.pseudo.toLowerCase().includes(q)) : all
    return filtered.slice(0, FRIENDS_DISPLAY_LIMIT)
  }, [friends.data, search])

  const receivedCount = received.data?.length ?? 0
  const sentCount = sent.data?.length ?? 0
  const friendsCount = friends.data?.length ?? 0

  return (
    <Tabs value={sub} onValueChange={(v) => setSub(v as typeof sub)}>
      <TabsList scrollable className="mb-4">
        <TabsTrigger value="list">
          Mes amis
          {friendsCount > 0 && (
            <Badge variant="outline" className="ml-1.5">
              {friendsCount}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="received">
          Reçues
          {receivedCount > 0 && (
            <Badge variant="primary" className="ml-1.5">
              {receivedCount}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="sent">
          Envoyées
          {sentCount > 0 && (
            <Badge variant="outline" className="ml-1.5">
              {sentCount}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="list">
        {friends.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : friendsCount === 0 ? (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="Pas encore d'amis"
            description="Trouve des pianistes par leur pseudo et envoie-leur une demande."
            action={
              <Link
                to="/search"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              >
                <Search className="h-4 w-4" />
                Chercher un membre
              </Link>
            }
          />
        ) : (
          <>
            {friendsCount > 5 && (
              <div className="mb-3">
                <Input
                  placeholder="Filtrer par pseudo…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-2">
              {filteredFriends.map((f) => (
                <FriendCard key={f.id} friend={f} />
              ))}
            </div>
            {friendsCount > FRIENDS_DISPLAY_LIMIT && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                {FRIENDS_DISPLAY_LIMIT} affichés sur {friendsCount}. Affine avec la
                recherche.
              </p>
            )}
          </>
        )}
      </TabsContent>

      <TabsContent value="received">
        {received.isLoading ? (
          <Skeleton className="h-16 w-full rounded-lg" />
        ) : receivedCount === 0 ? (
          <EmptyState
            icon={<Inbox className="h-5 w-5" />}
            title="Aucune demande pour l'instant"
            description="Quand quelqu'un voudra t'ajouter, ça apparaîtra ici."
          />
        ) : (
          <div className="space-y-2">
            {received.data!.map((r) => (
              <FriendRequestCard key={r.request_id} request={r} direction="received" />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="sent">
        {sent.isLoading ? (
          <Skeleton className="h-16 w-full rounded-lg" />
        ) : sentCount === 0 ? (
          <EmptyState
            icon={<Send className="h-5 w-5" />}
            title="Aucune demande en attente"
            description="Tu n'as pas envoyé de demande non répondue."
            action={
              <Link
                to="/search"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              >
                <UserPlus className="h-4 w-4" />
                Trouver des amis
              </Link>
            }
          />
        ) : (
          <div className="space-y-2">
            {sent.data!.map((r) => (
              <FriendRequestCard key={r.request_id} request={r} direction="sent" />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}
