import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

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
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/40 backdrop-blur-sm animate-fade-in sm:items-center">
      <button
        type="button"
        aria-label="Fermer"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-sm rounded-t-2xl border border-border bg-popover p-5 shadow-2xl animate-slide-up-modal sm:rounded-2xl sm:animate-scale-in"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
