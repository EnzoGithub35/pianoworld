import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Modale accessible (WAI-ARIA Dialog Pattern) :
 *  - role="dialog" + aria-modal="true" + aria-labelledby vers le titre
 *  - Focus initial : 1er élément focusable de la modale (fallback : bouton fermer)
 *  - Focus trap : Tab/Shift+Tab cyclent dans la modale (Sprint 4 audit P2 — C.1 backlog)
 *  - Focus restore : à la fermeture, retour à l'élément précédent
 *  - Escape ferme (déjà OK)
 */
export function Dialog({
  open,
  onClose,
  title,
  children
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    // Mémorise l'élément focusé avant ouverture pour le restorer à la fermeture
    previousFocusRef.current = document.activeElement as HTMLElement | null

    // Focus initial : 1er élément focusable, fallback bouton fermer
    const node = dialogRef.current
    if (node) {
      const focusables = node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      // Skip le bouton X (toujours dernier dans le DOM si pas d'autres focusables)
      const firstInteractive =
        Array.from(focusables).find((el) => el.getAttribute('aria-label') !== 'Fermer') ??
        focusables[0]
      firstInteractive?.focus()
    }

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !dialogRef.current) return
      // Focus trap : cycle entre 1er et dernier focusable de la modale
      const focusables = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => !el.hasAttribute('aria-hidden'))
      if (focusables.length === 0) {
        e.preventDefault()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey) {
        if (active === first || !dialogRef.current.contains(active)) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (active === last || !dialogRef.current.contains(active)) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handler)
    return () => {
      document.removeEventListener('keydown', handler)
      // Restore focus à l'élément précédent (button qui a ouvert la modale)
      previousFocusRef.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="animate-fade-in fixed inset-0 z-[1100] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center">
      {/* Backdrop : décoratif pour l'AT (un seul "Fermer" exposé via le bouton X
          + l'Escape déjà géré). aria-hidden + tabIndex=-1 pour éviter le bruit
          screen reader + qu'il ne soit pas dans le focus trap. */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="animate-slide-up-modal sm:animate-scale-in relative w-full max-w-sm rounded-t-2xl border border-border bg-popover p-5 shadow-2xl sm:rounded-2xl"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
