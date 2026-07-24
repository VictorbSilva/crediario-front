import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export function AppShell() {
  return (
    <div className="min-h-dvh md:flex">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 px-4 py-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:px-8 md:py-6 md:pb-8">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
