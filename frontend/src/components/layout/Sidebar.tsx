import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Star,
  Filter,
  FileText,
  Search,
  ChevronLeft,
  ChevronRight,
  Newspaper,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSidebarStore } from '@/store'
import { Button } from '@/components/ui/button'

const navItems = [
  { path: '/', icon: LayoutDashboard, label: '仪表盘' },
  { path: '/watchlist', icon: Star, label: '自选股' },
  { path: '/screener', icon: Filter, label: '选股器' },
  { path: '/trade_review', icon: FileText, label: '交易复盘' },
  { path: '/search', icon: Search, label: '搜索' },
  { path: '/sentiment', icon: Newspaper, label: '舆情' },
  { path: '/settings', icon: Settings, label: '设置' },
]

export default function Sidebar() {
  const { isCollapsed, toggle } = useSidebarStore()

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-card transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-border px-4">
        {!isCollapsed && <span className="text-lg font-bold text-primary">AlphaNote</span>}
        {isCollapsed && <span className="text-lg font-bold text-primary">A</span>}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                isCollapsed && 'justify-center px-2'
              )
            }
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!isCollapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Toggle button */}
      <div className="border-t border-border p-2">
        <Button variant="ghost" size="icon" className="w-full" onClick={toggle}>
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </aside>
  )
}
