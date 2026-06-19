import { useEffect, useRef, useState, type ReactNode } from 'react'
import { HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Sprint 6 — Tooltip d'aide tap-friendly (mobile first, pas hover-only).
 *
 * Pattern : icône `HelpCircle` cliquable inline qui affiche un popover sous
 * l'élément avec une explication contextuelle. À utiliser pour expliquer les
 * features non-évidentes : visibility friends vs public, cooldown 30j post
 * ghost-reject, rate-limit anti-énumération email, etc.
 *
 * Choix UX :
 *  - Tap pour ouvrir (mobile-first, hover-only exclus iOS)
 *  - Tap ailleurs OU Escape pour fermer
 *  - `role="tooltip"` + `aria-describedby` pour les screen readers
 *  - Position : sous l'icône à droite (popover absolu, w-64)
 */
export function HelpTooltip({
  label,
  children,
  className
}: {
  /** Aria-label du trigger (ex: "En savoir plus sur la visibilité"). */
  label: string
  /** Contenu du popover (texte ou JSX). */
  children: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <span ref={containerRef} className={cn('relative inline-flex', className)}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="animate-fade-in absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 rounded-lg border border-border bg-popover px-3 py-2 text-xs leading-snug text-popover-foreground shadow-lg"
        >
          {children}
        </span>
      )}
    </span>
  )
}
