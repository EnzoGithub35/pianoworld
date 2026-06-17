import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { Badge } from '@/components/ui/Badge'
import { ActivityTab } from '@/components/Dashboard/ActivityTab'
import { CommunityTab } from '@/components/Community/CommunityTab'
import { EventsTab } from '@/components/Events/EventsTab'
import { MyRequestsTab } from '@/components/Requests/MyRequestsTab'
import { FriendsTab } from '@/components/Friends/FriendsTab'
import { useMyRequests } from '@/hooks/useUserRequests'
import { usePendingReceivedCount } from '@/hooks/useFriends'
import { REQUESTS_LAST_SEEN_KEY } from '@/lib/constants'

/**
 * Hub utilisateur. 3 onglets :
 *  - Activité : stats + feed récent (composant ActivityTab)
 *  - Évènements : liste des events à venir, inscription
 *  - Mes demandes : feedback user / réponses admin
 *
 * Badge "nouvelle réponse" sur Mes demandes : on compare le replied_at le plus
 * récent vs le dernier vu (localStorage). MyRequestsTab marque comme vu au mount.
 */
type DashboardTab = 'activity' | 'community' | 'events' | 'requests' | 'friends'

const VALID_TABS: DashboardTab[] = [
  'activity',
  'community',
  'events',
  'requests',
  'friends'
]

export function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (() => {
    const p = searchParams.get('tab') as DashboardTab | null
    return p && VALID_TABS.includes(p) ? p : 'activity'
  })()
  const [tab, setTab] = useState<DashboardTab>(initialTab)
  const { data: myRequests } = useMyRequests()
  const pendingFriendsCount = usePendingReceivedCount()

  // Sync ?tab=… vers state quand user clique un deep-link
  useEffect(() => {
    const p = searchParams.get('tab') as DashboardTab | null
    if (p && VALID_TABS.includes(p) && p !== tab) setTab(p)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const newReplyCount = useMemo(() => {
    if (!myRequests) return 0
    const lastSeen = Number(localStorage.getItem(REQUESTS_LAST_SEEN_KEY) ?? 0)
    return myRequests.filter(
      (r) => r.replied_at && new Date(r.replied_at).getTime() > lastSeen
    ).length
  }, [myRequests])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <header className="border-b border-border bg-background/80 px-4 py-5 backdrop-blur">
        <h1 className="font-display text-2xl font-bold tracking-tight">PianoWorld</h1>
        <p className="text-xs text-muted-foreground">
          Découvre les pianos publics autour de toi.
        </p>
      </header>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          const next = v as DashboardTab
          setTab(next)
          // Met à jour ?tab= sans recharger la page (deep-link partageable).
          setSearchParams(next === 'activity' ? {} : { tab: next }, { replace: true })
        }}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <TabsList scrollable className="bg-background px-2">
          <TabsTrigger value="activity">Activité</TabsTrigger>
          <TabsTrigger value="community">Communauté</TabsTrigger>
          <TabsTrigger value="events">Évènements</TabsTrigger>
          <TabsTrigger value="friends">
            <span className="flex items-center gap-1.5">
              Amis
              {pendingFriendsCount > 0 && (
                <Badge variant="primary">{pendingFriendsCount}</Badge>
              )}
            </span>
          </TabsTrigger>
          <TabsTrigger value="requests">
            <span className="flex items-center gap-1.5">
              Support
              {newReplyCount > 0 && <Badge variant="primary">{newReplyCount}</Badge>}
            </span>
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto">
          <TabsContent value="activity">
            <ActivityTab />
          </TabsContent>
          <TabsContent value="community">
            <CommunityTab />
          </TabsContent>
          <TabsContent value="events">
            <EventsTab />
          </TabsContent>
          <TabsContent value="friends" className="p-4">
            <FriendsTab />
          </TabsContent>
          <TabsContent value="requests">
            <MyRequestsTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
