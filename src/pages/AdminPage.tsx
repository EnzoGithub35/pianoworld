import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { KpisTab } from '@/components/Admin/KpisTab'
import { UsersTab } from '@/components/Admin/UsersTab'
import { RolesTab } from '@/components/Admin/RolesTab'
import { ReportsTab } from '@/components/Admin/ReportsTab'
import { EventsAdminTab } from '@/components/Admin/EventsAdminTab'
import { RequestsAdminTab } from '@/components/Admin/RequestsAdminTab'
import { AuditLogTab } from '@/components/Admin/AuditLogTab'

/**
 * Hub d'administration. Sub-tabs gérées par <Tabs> ; chaque tab est un
 * composant indépendant pour permettre l'extraction lazy si besoin plus tard.
 *
 * L'onglet "Rôles" n'est visible que pour les superadmins (`isSuperadmin`).
 *
 * Sprint 4 audit P2 — C.4 backlog : tab synchronisé avec ?tab= pour que le
 * refresh / deep-link préservent l'onglet actif.
 */
const VALID_TABS = [
  'kpis',
  'users',
  'reports',
  'events',
  'requests',
  'audit',
  'roles'
] as const
type AdminTab = (typeof VALID_TABS)[number]

export function AdminPage() {
  const navigate = useNavigate()
  const { isSuperadmin } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const initialTab = (() => {
    const p = searchParams.get('tab')
    if (p && (VALID_TABS as readonly string[]).includes(p)) {
      // Garde-fou : un non-superadmin ne peut pas atterrir sur ?tab=roles
      if (p === 'roles' && !isSuperadmin) return 'kpis'
      return p as AdminTab
    }
    return 'kpis'
  })()
  const [tab, setTab] = useState<AdminTab>(initialTab)

  // Sync ?tab=… → state quand l'URL change (deep-link partagé)
  useEffect(() => {
    const p = searchParams.get('tab')
    if (
      p &&
      (VALID_TABS as readonly string[]).includes(p) &&
      p !== tab &&
      !(p === 'roles' && !isSuperadmin)
    ) {
      setTab(p as AdminTab)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <header className="flex items-center gap-2 border-b border-border bg-background px-4 py-3">
        <button
          onClick={() => navigate('/settings')}
          aria-label="Retour"
          className="rounded-full p-1.5 hover:bg-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-xl font-bold tracking-tight">Administration</h1>
      </header>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          const next = v as AdminTab
          setTab(next)
          // ?tab= par défaut omis pour 'kpis' (URL propre sur landing)
          setSearchParams(next === 'kpis' ? {} : { tab: next }, { replace: true })
        }}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <TabsList scrollable className="bg-background px-2">
          <TabsTrigger value="kpis">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="users">Utilisateurs</TabsTrigger>
          <TabsTrigger value="reports">Signalements</TabsTrigger>
          <TabsTrigger value="events">Évènements</TabsTrigger>
          <TabsTrigger value="requests">Demandes</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
          {isSuperadmin && <TabsTrigger value="roles">Rôles</TabsTrigger>}
        </TabsList>

        <div className="flex-1 overflow-y-auto">
          <TabsContent value="kpis">
            <KpisTab />
          </TabsContent>
          <TabsContent value="users">
            <UsersTab />
          </TabsContent>
          <TabsContent value="reports">
            <ReportsTab />
          </TabsContent>
          <TabsContent value="events">
            <EventsAdminTab />
          </TabsContent>
          <TabsContent value="requests">
            <RequestsAdminTab />
          </TabsContent>
          <TabsContent value="audit">
            <AuditLogTab />
          </TabsContent>
          {isSuperadmin && (
            <TabsContent value="roles">
              <RolesTab />
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div>
  )
}
