import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search as SearchIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { searchStocks } from '@/services/stockApi'

export default function StockSearch({ onSelect, placeholder = '搜索股票(代码/名称/拼音)...', className }: {
  onSelect: (stock: { code: string; name: string }) => void
  placeholder?: string
  className?: string
}) {
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const { data } = useQuery({
    queryKey: ['search', search],
    queryFn: () => searchStocks(search),
    enabled: search.length > 0,
  })

  const handleSelect = (stock: { symbol: string; name: string }) => {
    onSelect({ code: stock.symbol, name: stock.name })
    setSearch('')
    setIsOpen(false)
  }

  return (
    <div className={`relative ${className || ''}`}>
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          className="pl-10"
        />
      </div>

      {isOpen && data && data.length > 0 && (
        <div className="absolute top-full z-50 mt-1 w-full rounded-md border border-border bg-card shadow-lg">
          {data.map((stock) => (
            <button
              key={stock.symbol}
              className="flex w-full items-center justify-between px-4 py-2 text-left hover:bg-accent"
              onClick={() => handleSelect(stock)}
            >
              <span className="font-medium">{stock.symbol}</span>
              <span className="text-sm text-muted-foreground">{stock.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
