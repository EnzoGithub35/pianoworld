import { SearchTabs } from '@/components/Search/SearchTabs'

/**
 * v7 — SearchPage : container minimaliste qui wrap les 2 tabs
 * (Utilisateurs / Pianos).
 *
 * La logique de recherche vit dans `SearchTabs` + ses 2 sous-tabs.
 * Persistance localStorage de l'onglet sélectionné via SEARCH_TAB_KEY.
 */
export function SearchPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <header className="border-b border-border bg-background/80 px-4 py-5 backdrop-blur">
        <h1 className="font-display text-2xl font-bold tracking-tight">Rechercher</h1>
        <p className="text-xs text-muted-foreground">Trouve un pianiste ou un piano.</p>
      </header>
      <SearchTabs />
    </div>
  )
}
