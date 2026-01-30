import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import StockSearch from '@/components/stocks/StockSearch'
import { createTrade, getStockPrice, getTrades } from '@/services/transactionApi'
import { useToastStore } from '@/store'

export interface FillFormData {
  code: string
  name: string
  action: 'BUY' | 'SELL' | 'DIVIDEND' | 'BONUS'
  price?: number
}

interface TransactionFormProps {
  fillData?: FillFormData | null
  onFillConsumed?: () => void
}

export default function TransactionForm({ fillData, onFillConsumed }: TransactionFormProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { addToast } = useToastStore()

  const [selectedStock, setSelectedStock] = useState<{ code: string; name: string } | null>(null)
  const [action, setAction] = useState<'BUY' | 'SELL' | 'DIVIDEND' | 'BONUS'>('BUY')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [reason, setReason] = useState('')

  const { data: trades } = useQuery({
    queryKey: ['trades'],
    queryFn: getTrades,
  })

  // Handle fillData from PositionCard
  useEffect(() => {
    if (fillData) {
      setSelectedStock({ code: fillData.code, name: fillData.name })
      setAction(fillData.action)
      if (fillData.price) {
        setPrice(fillData.price.toFixed(3))
      }
      onFillConsumed?.()
    }
  }, [fillData, onFillConsumed])

  // Read URL params on mount
  useEffect(() => {
    const code = searchParams.get('code')
    const name = searchParams.get('name')
    const urlPrice = searchParams.get('price')

    if (code) {
      setSelectedStock({ code, name: name || '' })
      if (urlPrice) {
        setPrice(urlPrice)
      }
      // Clear URL params after reading
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const mutation = useMutation({
    mutationFn: createTrade,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] })
      queryClient.invalidateQueries({ queryKey: ['positions'] })
      addToast({ title: '交易记录已添加' })
      setSelectedStock(null)
      setPrice('')
      setQuantity('')
      setReason('')
    },
    onError: () => {
      addToast({ title: '添加失败', variant: 'destructive' })
    },
  })

  const handleStockSelect = async (stock: { code: string; name: string }) => {
    setSelectedStock(stock)
    const currentPrice = await getStockPrice(stock.code)
    if (currentPrice) {
      setPrice(currentPrice.toFixed(3))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStock || !price || !quantity) return

    mutation.mutate({
      code: selectedStock.code,
      action,
      price: parseFloat(price),
      quantity: parseFloat(quantity),
      date,
      reason: reason || undefined,
    })
  }

  const handleCopyLastTrade = () => {
    if (!trades?.length) {
      addToast({ title: '暂无交易记录可复制', variant: 'destructive' })
      return
    }
    const lastTrade = trades[0]
    setSelectedStock({ code: lastTrade.code, name: lastTrade.name || '' })
    setAction(lastTrade.action)
    setPrice(lastTrade.price.toString())
    setQuantity(lastTrade.quantity.toString())
    setReason(lastTrade.reason || '')
    addToast({ title: '已复制上一条交易记录' })
  }

  return (
    <Card>
      <CardHeader className="pb-3 sm:pb-6 flex flex-row items-center justify-between">
        <CardTitle className="text-base sm:text-lg">新建交易记录</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyLastTrade}
          disabled={!trades?.length}
          className="h-8 text-xs"
        >
          <Copy className="h-3 w-3 mr-1" />
          复制上一条
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          {/* Mobile: single column, Tablet+: two columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="sm:col-span-2 space-y-2">
              <Label className="text-sm">股票代码</Label>
              <StockSearch
                onSelect={handleStockSelect}
                placeholder={selectedStock ? `${selectedStock.code} - ${selectedStock.name}` : '搜索股票...'}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">操作类型</Label>
              <Select value={action} onValueChange={(v) => setAction(v as 'BUY' | 'SELL' | 'DIVIDEND' | 'BONUS')}>
                <SelectTrigger className="h-10 sm:h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BUY">买入</SelectItem>
                  <SelectItem value="SELL">卖出</SelectItem>
                  <SelectItem value="DIVIDEND">分红</SelectItem>
                  <SelectItem value="BONUS">红股入账</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">日期</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 sm:h-9" />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">价格</Label>
              <Input
                type="number"
                step="0.001"
                placeholder="0.000"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="h-10 sm:h-9"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">数量</Label>
              <Input
                type="number"
                step="100"
                placeholder="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="h-10 sm:h-9"
              />
            </div>

            <div className="sm:col-span-2 space-y-2">
              <Label className="text-sm">交易理由 (可选)</Label>
              <textarea
                className="flex min-h-16 sm:min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="记录你的交易逻辑..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>

          <Button type="submit" className="w-full h-10 sm:h-9 text-sm" disabled={!selectedStock || !price || !quantity || mutation.isPending}>
            {mutation.isPending ? '提交中...' : '添加记录'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
