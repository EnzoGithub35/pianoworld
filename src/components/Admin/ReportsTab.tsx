import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Flag, ShieldCheck, Trash2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAdminReports, type ReportWithContext } from '@/hooks/useAdminReports'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/errors'
import { fromNow } from '@/lib/date'

export function ReportsTab() {
  const queryClient = useQueryClient()
  const { data: reports, isLoading } = useAdminReports()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ReportWithContext | null>(null)

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin-reports'] })
    await queryClient.invalidateQueries({ queryKey: ['admin-kpis'] })
    await queryClient.invalidateQueries({ queryKey: ['pianos'] })
  }

  const handleResolve = async (report: ReportWithContext) => {
    setPendingId(report.id)
    try {
      const { error } = await supabase.rpc('resolve_report', { report_id: report.id })
      if (error) {
        logger.error('admin.resolveReport', 'rpc failed', error, { reportId: report.id })
        throw error
      }
      logger.info('admin.resolveReport', 'success', { reportId: report.id })
      toast.success('Signalement classé')
      await refresh()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Action échouée'))
    } finally {
      setPendingId(null)
    }
  }

  const handleForceDelete = async () => {
    if (!pendingDelete?.piano) return
    const piano = pendingDelete.piano
    setPendingId(pendingDelete.id)
    try {
      const { error } = await supabase.rpc('force_delete_piano', { target: piano.id })
      if (error) {
        logger.error('admin.forceDelete', 'rpc failed', error, { pianoId: piano.id })
        throw error
      }
      logger.warn('admin.forceDelete', 'piano removed by admin', { pianoId: piano.id })
      // En même temps on classe le report
      await supabase.rpc('resolve_report', { report_id: pendingDelete.id })
      toast.success('Piano supprimé et signalement classé')
      setPendingDelete(null)
      await refresh()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Action échouée'))
    } finally {
      setPendingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    )
  }

  if (!reports || reports.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          icon={<ShieldCheck className="h-6 w-6" />}
          title="Aucun signalement en attente"
          description="Tout est à jour côté modération."
        />
      </div>
    )
  }

  return (
    <>
      <ul className="space-y-3 p-4 pb-24">
        {reports.map((r) => (
          <li
            key={r.id}
            className="space-y-3 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200">
                <Flag className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-medium">
                    @{r.reporter?.pseudo ?? 'inconnu'}
                  </span>{' '}
                  <span className="text-muted-foreground">
                    a signalé {fromNow(r.created_at)}
                  </span>
                </p>
                {r.piano ? (
                  <Link
                    to={`/piano/${r.piano.id}`}
                    className="mt-0.5 block truncate text-xs text-primary hover:underline"
                  >
                    {r.piano.address}
                    {r.piano.is_deleted && ' (déjà supprimé)'}
                  </Link>
                ) : (
                  <p className="mt-0.5 text-xs italic text-muted-foreground">
                    Piano supprimé entre-temps
                  </p>
                )}
              </div>
              {r.piano?.photo_url && (
                <img
                  src={r.piano.photo_url}
                  alt=""
                  className="h-14 w-14 flex-shrink-0 rounded-lg object-cover"
                  loading="lazy"
                />
              )}
            </div>
            <p className="whitespace-pre-wrap rounded-md bg-muted/50 px-3 py-2 text-sm">
              {r.reason}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                loading={pendingId === r.id && !pendingDelete}
                onClick={() => handleResolve(r)}
              >
                <Check className="h-3.5 w-3.5" />
                Classer
              </Button>
              {r.piano && !r.piano.is_deleted && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="gap-1.5"
                  onClick={() => setPendingDelete(r)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Supprimer le piano
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <Dialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title="Supprimer ce piano ?"
      >
        <p className="mb-4 text-sm text-muted-foreground">
          Le piano sera marqué comme supprimé et disparaîtra de la carte. Le signalement
          sera également classé.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setPendingDelete(null)}>
            Annuler
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            loading={pendingId === pendingDelete?.id}
            onClick={handleForceDelete}
          >
            Confirmer
          </Button>
        </div>
      </Dialog>
    </>
  )
}
