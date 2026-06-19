import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { Badge } from '@/components/ui/Badge'
import { ActivityTab } from '@/components/Dashboard/ActivityTab'
import { EventsTab } from '@/components/Events/EventsTab'
import { MyRequestsTab } from '@/components/Requests/MyRequestsTab'
import { FavoritesTab } from '@/components/Dashboard/FavoritesTab'
import { useMyRequests } from '@/hooks/useUserRequests'
import { useEvents } from '@/hooks/useEvents'
import { useAuth } from '@/contexts/AuthContext'
import { REQUESTS_LAST_SEEN_KEY } from '@/lib/constants'

/**
 * Hub utilisateur. 4 onglets (post audit Sprint 3 fusion) :
 *  - Activité : stats + toggle interne Récent / Communauté (fusion v3)
 *  - Évènements (admin-only en l'absence d'event) : liste des events
 *  - Favoris (v7) : pianos marqués favoris
 *  - Support : feedback user / réponses admin (avec Badge nouvelle réponse)
 *
 * v7 : les "Amis" sont maintenant une page standalone /friends (NavBar 5e
 * icône Users). L'ancien `?tab=friends` redirige automatiquement.
 *
 * Sprint 3 audit P1/M : ancien tab 'community' fusionné dans 'activity' via
 * toggle interne pour réduire le débordement de 5 onglets sur mobile 360px.
 * Back-compat ?tab=community → redirect vers ?tab=activity.
 *
 * Badge "nouvelle réponse" sur Support : on compare le replied_at le plus
 * récent vs le dernier vu (localStorage). MyRequestsTab marque comme vu au mount.
 */
type DashboardTab = 'activity' | 'events' | 'favorites' | 'requests'

const VALID_TABS: DashboardTab[] = ['activity', 'events', 'favorites', 'requests']

export function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const { data: events } = useEvents(false)
  const { data: myRequests } = useMyRequests()
  // Masque l'onglet Évènements aux non-admins si aucun event n'existe.
  const showEventsTab = isAdmin || (events && events.length > 0)

  const initialTab = (() => {
    const p = searchParams.get('tab') as DashboardTab | null
    return p && VALID_TABS.includes(p) ? p : 'activity'
  })()
  const [tab, setTab] = useState<DashboardTab>(initialTab)

  // v7 — back-compat : ?tab=friends → page /friends standalone.
  useEffect(() => {
    if (searchParams.get('tab') === 'friends') {
      navigate('/friends', { replace: true })
    }
  }, [searchParams, navigate])

  // Sprint 3 audit — back-compat : ?tab=community → activity (toggle interne)
  useEffect(() => {
    if (searchParams.get('tab') === 'community') {
      setSearchParams({}, { replace: true })
      setTab('activity')
    }
  }, [searchParams, setSearchParams])

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
          {showEventsTab && <TabsTrigger value="events">Évènements</TabsTrigger>}
          <TabsTrigger value="favorites">Favoris</TabsTrigger>
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
          <TabsContent value="events">
            <EventsTab />
          </TabsContent>
          <TabsContent value="favorites">
            <FavoritesTab />
          </TabsContent>
          <TabsContent value="requests">
            <MyRequestsTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
