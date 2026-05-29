import { useState } from 'react'
import { Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/errors'

export function ExportDataButton() {
  const { user, profile } = useAuth()
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    if (!user) return
    setExporting(true)
    try {
      const [pianosRes, updatesRes, reportsRes] = await Promise.all([
        supabase.from('pianos').select('*').eq('created_by', user.id),
        supabase.from('piano_updates').select('*').eq('updated_by', user.id),
        supabase.from('piano_reports').select('*').eq('reported_by', user.id)
      ])
      if (pianosRes.error) {
        logger.error('settings.export', 'pianos failed', pianosRes.error)
        throw pianosRes.error
      }
      if (updatesRes.error) {
        logger.error('settings.export', 'updates failed', updatesRes.error)
        throw updatesRes.error
      }
      if (reportsRes.error) {
        logger.error('settings.export', 'reports failed', reportsRes.error)
        throw reportsRes.error
      }

      const payload = {
        exported_at: new Date().toISOString(),
        user: { id: user.id, email: user.email },
        profile,
        pianos: pianosRes.data ?? [],
        piano_updates: updatesRes.data ?? [],
        piano_reports: reportsRes.data ?? []
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
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
      logger.info('settings.export', 'downloaded', {
        pianos: payload.pianos.length,
        updates: payload.piano_updates.length,
        reports: payload.piano_reports.length
      })
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
