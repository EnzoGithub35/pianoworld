import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Map as MapIcon, Search, Settings, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { usePendingReceivedCount } from '@/hooks/useFriends'

const items = [
  // Label "Activité" plutôt que "Accueil" pour matcher le 1er onglet du Dashboard
  // (cohérence mentale : NavBar item = Dashboard tab par défaut).
  { to: '/dashboard', icon: LayoutDashboard, label: 'Activité' },
  { to: '/map', icon: MapIcon, label: 'Carte' },
  { to: '/search', icon: Search, label: 'Recherche' },
  { to: '/friends', icon: Users, label: 'Amis' },
  { to: '/settings', icon: Settings, label: 'Paramètres' }
]

export function NavBar() {
  // Badge "demandes amitié en attente" affiché sur l'item Amis.
  const pendingFriends = usePendingReceivedCount()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 pb-safe-bottom backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-md items-stretch">
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'group relative flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    'absolute top-0 h-0.5 w-8 rounded-full bg-primary transition-all duration-200',
                    isActive ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <div className="relative">
                  <Icon
                    className={cn(
                      'h-5 w-5 transition-transform duration-200',
                      isActive ? 'scale-110' : 'group-hover:scale-105'
                    )}
                  />
                  {to === '/friends' && pendingFriends > 0 && (
                    <Badge
                      variant="primary"
                      className="absolute -right-2 -top-1 h-4 min-w-[1rem] justify-center px-1 text-[9px]"
                    >
                      {pendingFriends > 9 ? '9+' : pendingFriends}
                    </Badge>
                  )}
                </div>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
