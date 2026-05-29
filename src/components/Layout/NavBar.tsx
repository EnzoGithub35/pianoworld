import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Map as MapIcon, Search, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const items = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Accueil' },
  { to: '/', icon: MapIcon, label: 'Carte', end: true },
  { to: '/search', icon: Search, label: 'Recherche' },
  { to: '/settings', icon: Settings, label: 'Paramètres' }
]

export function NavBar() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex h-16 max-w-md items-stretch">
        {items.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'group relative flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
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
                <Icon
                  className={cn(
                    'h-5 w-5 transition-transform duration-200',
                    isActive ? 'scale-110' : 'group-hover:scale-105'
                  )}
                />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
