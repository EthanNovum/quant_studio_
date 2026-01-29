import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useSidebarStore } from '@/store'
import Sidebar from './Sidebar'
import Header from './Header'

interface MainLayoutProps {
  children: ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { isCollapsed, isMobileOpen, setMobileOpen } = useSidebarStore()

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <Sidebar />
      <div
        className={cn(
          'flex min-h-screen flex-col transition-all duration-300',
          // Desktop: respect sidebar collapsed state
          'md:ml-16',
          !isCollapsed && 'md:ml-56',
          // Mobile: no margin (sidebar is overlay)
          'ml-0'
        )}
      >
        <Header />
        <main className="flex-1 p-3 sm:p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
