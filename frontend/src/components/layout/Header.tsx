import { useEffect, useState } from 'react'
import { Moon, Sun, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useThemeStore, useSidebarStore } from '@/store'
import { getProgress } from '@/services/progressApi'

export default function Header() {
  const { theme, toggleTheme } = useThemeStore()
  const { setMobileOpen } = useSidebarStore()
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const progress = await getProgress()
        setLastUpdate(progress.updated_at)
      } catch {
        // ignore
      }
    }
    fetchProgress()
    const interval = setInterval(fetchProgress, 60000) // 每分钟刷新
    return () => clearInterval(interval)
  }, [])

  const formatTime = (isoString: string | null) => {
    if (!isoString) return '未知'
    const date = new Date(isoString)
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 px-3 sm:px-4 md:px-6 backdrop-blur">
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-9 w-9"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <span className="text-xs sm:text-sm text-muted-foreground truncate">
          数据更新: {formatTime(lastUpdate)}
        </span>
      </div>
      <div className="flex items-center gap-1 sm:gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={toggleTheme}
          title={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
        >
          {theme === 'dark' ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </Button>
      </div>
    </header>
  )
}
