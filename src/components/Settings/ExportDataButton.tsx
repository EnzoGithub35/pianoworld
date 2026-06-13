import { useState } from 'react'
import { Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/errors'

/**
 * Export RGPD complet de toutes les données touchant l'utilisateur courant.
 *
 * Passe par la RPC SECURITY DEFINER `export_my_data()` qui agrège côté serveur :
 * profile, pianos, piano_updates, piano_reports, piano_visits, piano_sessions,
 * event_participants, user_requests, notification_preferences, push_subscriptions.
 *
 * Les push subscriptions sont exposées sans p256dh ni auth_secret (sensibles) ;
 * seuls endpoint + métadonnées sortent.
 */
export function ExportDataButton() {
  const { user } = useAuth()
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    if (!user) return
    setExporting(true)
    try {
      const { data, error } = await supabase.rpc('export_my_data')
      if (error) {
        logger.error('settings.export', 'rpc failed', error)
        throw error
      }
      const blob = new Blob([JSON.stringify(data ?? {}, null, 2)], {
        type: 'application/json'
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pianoworld-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      logger.info('settings.export', 'downloaded')
      toast.success('Export téléchargé')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Export échoué'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <Button
      variant="outline"
      className="w-full justify-start gap-2"
      onClick={handleExport}
      loading={exporting}
    >
      <Download className="h-4 w-4" /> Exporter mes données (JSON)
    </Button>
  )
}
