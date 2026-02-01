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
  X,
  Brain,
  Zap,
  User,
  Swords,
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
  { path: '/daily-review', icon: Brain, label: 'AI复盘' },
  { path: '/dare-play', icon: Swords, label: '舆论试炼场' },
  { path: '/creators', icon: User, label: '创作者' },
  { path: '/sentiment', icon: Newspaper, label: '舆情' },
  { path: '/ai-settings', icon: Zap, label: 'AI设置' },
  { path: '/settings', icon: Settings, label: '创作者设置' },
]

export default function Sidebar() {
  const { isCollapsed, toggle, isMobileOpen, setMobileOpen } = useSidebarStore()

  const handleNavClick = () => {
    // Close mobile sidebar when navigating
    if (isMobileOpen) {
      setMobileOpen(false)
    }
  }

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-border bg-card transition-all duration-300',
        // Desktop styles
        'hidden md:flex',
        isCollapsed ? 'md:w-16' : 'md:w-56',
        // Mobile styles - slide in from left
        isMobileOpen && 'flex w-64 shadow-xl'
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <span className={cn(
          'text-lg font-bold text-primary',
          isCollapsed && 'md:hidden'
        )}>
          {isCollapsed ? 'A' : 'AlphaNote'}
        </span>
        {/* Mobile close button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-8 w-8"
          onClick={() => setMobileOpen(false)}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={handleNavClick}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                isCollapsed && 'md:justify-center md:px-2',
                // Mobile: larger touch targets
                'md:py-2'
              )
            }
          >
            <item.icon className="h-5 w-5 shrink-0" />
            <span className={cn(isCollapsed && 'md:hidden')}>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Toggle button - desktop only */}
      <div className="hidden border-t border-border p-2 md:block">
        <Button variant="ghost" size="icon" className="w-full" onClick={toggle}>
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </aside>
  )
}
