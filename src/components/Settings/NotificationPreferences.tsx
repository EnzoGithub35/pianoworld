import { useState } from 'react'
import toast from 'react-hot-toast'
import { Bell, BellOff } from 'lucide-react'
import { Switch } from '@/components/ui/Switch'
import { Skeleton } from '@/components/ui/Skeleton'
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences'
import { useAuth } from '@/contexts/AuthContext'
import { pushSupported, subscribeToPush, unsubscribeFromPush } from '@/lib/web-push'
import { logger } from '@/lib/logger'
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_LABELS,
  NOTIFICATION_SECTION_OF,
  NOTIFICATION_SECTION_LABELS,
  type NotificationSection
} from '@/lib/constants'

/**
 * Préférences notifications affichées dans SettingsPage. Deux blocs :
 *  - 5 catégories indépendantes (toggles)
 *  - Toggle push opt-in (déclenche subscribeToPush / unsubscribeFromPush)
 *
 * Optimistic via le hook. Affiche un skeleton tant que la query n'a pas réglé
 * (sinon les toggles flashent à off → on).
 */
export function NotificationPreferences() {
  const { user } = useAuth()
  const { preferences, isLoading, update } = useNotificationPreferences()
  const [pushBusy, setPushBusy] = useState(false)

  if (isLoading || !preferences) {
    return (
      <div className="space-y-2 p-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-12 rounded-md" />
        ))}
      </div>
    )
  }

  const handlePushToggle = async (next: boolean) => {
    if (!user?.id) return
    if (next && !pushSupported()) {
      toast.error(
        'Notifications push non supportées sur ce navigateur. Installe l’app (PWA) ou utilise les mails.'
      )
      return
    }
    setPushBusy(true)
    try {
      if (next) {
        const ok = await subscribeToPush(user.id)
        if (!ok) {
          toast.error('Activation refusée par le navigateur')
          return
        }
        update({ push_enabled: true })
        toast.success('Notifications push activées')
      } else {
        await unsubscribeFromPush(user.id)
        update({ push_enabled: false })
        toast.success('Notifications push désactivées')
      }
    } catch (err) {
      logger.error(
        'settings.pushToggle',
        'failed',
        err instanceof Error ? err : new Error(String(err))
      )
      toast.error('Erreur lors de la mise à jour')
    } finally {
      setPushBusy(false)
    }
  }

  // Regroupement visuel des toggles par section (Pianos / Sessions / Communauté / Amis).
  // Préserve l'ordre de NOTIFICATION_CATEGORIES ; chaque section apparaît dans
  // l'ordre du premier toggle qui l'introduit.
  const sectionsInOrder: NotificationSection[] = []
  for (const cat of NOTIFICATION_CATEGORIES) {
    const sec = NOTIFICATION_SECTION_OF[cat]
    if (!sectionsInOrder.includes(sec)) sectionsInOrder.push(sec)
  }

  return (
    <div className="overflow-hidden">
      {sectionsInOrder.map((sec) => (
        <div key={sec}>
          <div className="border-t border-border bg-muted/20 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground first:border-t-0">
            {NOTIFICATION_SECTION_LABELS[sec]}
          </div>
          {NOTIFICATION_CATEGORIES.filter(
            (cat) => NOTIFICATION_SECTION_OF[cat] === sec
          ).map((cat) => (
            <Switch
              key={cat}
              id={`notif-${cat}`}
              label={NOTIFICATION_LABELS[cat]}
              checked={preferences[cat]}
              onCheckedChange={(next) => update({ [cat]: next })}
            />
          ))}
        </div>
      ))}
      <div className="border-t border-border bg-muted/30">
        <Switch
          id="notif-push"
          label="Notifications push (navigateur / mobile)"
          description={
            preferences.push_enabled
              ? 'Activées sur cet appareil. Tu peux désactiver à tout moment.'
              : pushSupported()
                ? 'Recevoir les notifications instantanément, même app fermée.'
                : 'Navigateur non compatible. Installe l’app (PWA) pour activer.'
          }
          checked={preferences.push_enabled}
          disabled={pushBusy}
          onCheckedChange={handlePushToggle}
        />
      </div>
      <div className="border-t border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
        {preferences.push_enabled ? (
          <span className="flex items-center gap-1.5">
            <Bell className="h-3 w-3" /> Notifications push actives sur cet appareil
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <BellOff className="h-3 w-3" /> Push désactivé — tu recevras tout par mail
          </span>
        )}
      </div>
    </div>
  )
}
