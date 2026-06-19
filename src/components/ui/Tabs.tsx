import {
  createContext,
  useContext,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode
} from 'react'
import { cn } from '@/lib/utils'

/**
 * Composant Tabs accessible (rôle tablist + clavier ←→).
 * Contrôlé : le parent gère l'état actif via `value` + `onValueChange`.
 *
 * Usage :
 *   <Tabs value={tab} onValueChange={setTab}>
 *     <TabsList>
 *       <TabsTrigger value="a">A</TabsTrigger>
 *       <TabsTrigger value="b">B</TabsTrigger>
 *     </TabsList>
 *     <TabsContent value="a">…</TabsContent>
 *     <TabsContent value="b">…</TabsContent>
 *   </Tabs>
 */

type TabsContextValue = {
  value: string
  onValueChange: (v: string) => void
  baseId: string
}

const TabsContext = createContext<TabsContextValue | undefined>(undefined)

function useTabsContext() {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error('TabsList/Trigger/Content must be inside <Tabs>')
  return ctx
}

export function Tabs({
  value,
  onValueChange,
  children,
  className
}: {
  value: string
  onValueChange: (v: string) => void
  children: ReactNode
  className?: string
}) {
  const baseId = useId()
  return (
    <TabsContext.Provider value={{ value, onValueChange, baseId }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({
  children,
  className,
  scrollable = false
}: {
  children: ReactNode
  className?: string
  /** Sur mobile, si trop d'onglets, scroll horizontal. */
  scrollable?: boolean
}) {
  const listRef = useRef<HTMLDivElement>(null)

  // WAI-ARIA Tabs pattern : Arrow Left/Right cycle, Home/End vont aux extrêmes.
  // Sprint 4 audit P2 — C.2 backlog. Active automatiquement l'onglet ciblé
  // (modèle "automatic activation" — adapté à des TabsContent toujours montés).
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
    const node = listRef.current
    if (!node) return
    const tabs = Array.from(
      node.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])')
    )
    if (tabs.length === 0) return
    const currentIndex = tabs.findIndex((t) => t === document.activeElement)
    let nextIndex = currentIndex
    if (e.key === 'ArrowLeft') {
      nextIndex = currentIndex <= 0 ? tabs.length - 1 : currentIndex - 1
    } else if (e.key === 'ArrowRight') {
      nextIndex = currentIndex === tabs.length - 1 ? 0 : currentIndex + 1
    } else if (e.key === 'Home') {
      nextIndex = 0
    } else if (e.key === 'End') {
      nextIndex = tabs.length - 1
    }
    if (nextIndex !== currentIndex && tabs[nextIndex]) {
      e.preventDefault()
      tabs[nextIndex].focus()
      tabs[nextIndex].click()
    }
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      onKeyDown={handleKeyDown}
      className={cn(
        'flex border-b border-border',
        scrollable && 'scrollbar-none overflow-x-auto',
        className
      )}
    >
      {children}
    </div>
  )
}

export function TabsTrigger({
  value,
  children,
  className,
  disabled
}: {
  value: string
  children: ReactNode
  className?: string
  disabled?: boolean
}) {
  const { value: active, onValueChange, baseId } = useTabsContext()
  const isActive = active === value
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-controls={`${baseId}-panel-${value}`}
      id={`${baseId}-tab-${value}`}
      tabIndex={isActive ? 0 : -1}
      disabled={disabled}
      onClick={() => onValueChange(value)}
      className={cn(
        'relative whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
        isActive
          ? 'border-primary text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground',
        disabled && 'pointer-events-none opacity-50',
        className
      )}
    >
      {children}
    </button>
  )
}

export function TabsContent({
  value,
  children,
  className
}: {
  value: string
  children: ReactNode
  className?: string
}) {
  const { value: active, baseId } = useTabsContext()
  if (active !== value) return null
  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-tab-${value}`}
      className={cn('animate-fade-in', className)}
    >
      {children}
    </div>
  )
}
