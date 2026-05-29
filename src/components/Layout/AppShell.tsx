import { Outlet } from 'react-router-dom'
import { NavBar } from './NavBar'

export function AppShell() {
  return (
    <div className="flex h-full flex-col">
      <main className="flex-1 overflow-hidden pb-16">
        <Outlet />
      </main>
      <NavBar />
    </div>
  )
}
