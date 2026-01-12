import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useSidebarStore } from '@/store'
import Sidebar from './Sidebar'
import Header from './Header'

interface MainLayoutProps {
  children: ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { isCollapsed } = useSidebarStore()

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div
        className={cn(
          'flex min-h-screen flex-col transition-all duration-300',
          isCollapsed ? 'ml-16' : 'ml-56'
        )}
      >
        <Header />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
