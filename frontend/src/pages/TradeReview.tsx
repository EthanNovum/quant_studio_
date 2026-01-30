import { useState, useCallback } from 'react'
import TransactionForm, { type FillFormData } from '@/components/transactions/TransactionForm'
import TransactionList from '@/components/transactions/TransactionList'
import PositionCard from '@/components/transactions/PositionCard'

export default function TradeReview() {
  const [fillData, setFillData] = useState<FillFormData | null>(null)

  const handleFillForm = useCallback((data: FillFormData) => {
    setFillData(data)
  }, [])

  const handleFillConsumed = useCallback(() => {
    setFillData(null)
  }, [])

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold">交易复盘</h1>

      {/* Mobile: stack vertically, Desktop: 3-column grid */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 order-1">
          <TransactionForm fillData={fillData} onFillConsumed={handleFillConsumed} />
        </div>
        <div className="lg:col-span-2 order-2">
          <PositionCard onFillForm={handleFillForm} />
        </div>
      </div>

      <TransactionList />
    </div>
  )
}
