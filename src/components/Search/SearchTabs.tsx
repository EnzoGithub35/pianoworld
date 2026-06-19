import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { UserSearchTab } from './UserSearchTab'
import { PianoSearchTab } from './PianoSearchTab'
import { SEARCH_TAB_KEY } from '@/lib/constants'

type SearchTab = 'users' | 'pianos'
const VALID: SearchTab[] = ['users', 'pianos']

/**
 * v7 — SearchPage container : 2 tabs (Utilisateurs / Pianos) persisté
 * localStorage pour reprendre où l'user était.
 */
export function SearchTabs() {
  const [tab, setTab] = useState<SearchTab>(() => {
    try {
      const stored = localStorage.getItem(SEARCH_TAB_KEY)
      if (stored && VALID.includes(stored as SearchTab)) return stored as SearchTab
    } catch {
      // localStorage indispo : défaut sur users
    }
    return 'users'
  })

  useEffect(() => {
    try {
      localStorage.setItem(SEARCH_TAB_KEY, tab)
    } catch {
      // best-effort
    }
  }, [tab])

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as SearchTab)}
      className="flex h-full flex-col overflow-hidden"
    >
      <TabsList className="bg-background">
        <TabsTrigger value="users" className="flex-1">
          Utilisateurs
        </TabsTrigger>
        <TabsTrigger value="pianos" className="flex-1">
          Pianos
        </TabsTrigger>
      </TabsList>

      <div className="flex-1 overflow-y-auto p-4 pb-24">
        <TabsContent value="users">
          <UserSearchTab />
        </TabsContent>
        <TabsContent value="pianos">
          <PianoSearchTab />
        </TabsContent>
      </div>
    </Tabs>
  )
}
