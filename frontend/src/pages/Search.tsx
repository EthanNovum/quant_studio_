import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search as SearchIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { searchStocks } from '@/services/stockApi'

export default function Search() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const { data } = useQuery({
    queryKey: ['search', search],
    queryFn: () => searchStocks(search),
    enabled: search.length > 0,
  })

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <h1 className="mb-8 text-3xl font-bold">搜索股票</h1>

      <div className="w-full max-w-xl">
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-14 pl-12 text-lg"
            placeholder="输入股票代码或名称..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        {data && data.length > 0 && (
          <div className="mt-4 rounded-lg border border-border bg-card">
            {data.map((stock) => (
              <button
                key={stock.symbol}
                className="flex w-full items-center justify-between border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-accent"
                onClick={() => navigate(`/search/${stock.symbol}`)}
              >
                <div>
                  <span className="font-medium">{stock.symbol}</span>
                  <span className="ml-3 text-muted-foreground">{stock.name}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {search && data && data.length === 0 && (
          <div className="mt-4 text-center text-muted-foreground">
            未找到匹配的股票
          </div>
        )}
      </div>
    </div>
  )
}
