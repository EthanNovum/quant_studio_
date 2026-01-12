import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import MainLayout from '@/components/layout/MainLayout'
import Dashboard from '@/pages/Dashboard'
import Watchlist from '@/pages/Watchlist'
import Screener from '@/pages/Screener'
import TradeReview from '@/pages/TradeReview'
import Search from '@/pages/Search'
import StockDetail from '@/pages/StockDetail'

function App() {
  return (
    <BrowserRouter>
      <MainLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/watchlist" element={<Watchlist />} />
          <Route path="/screener" element={<Screener />} />
          <Route path="/trade_review" element={<TradeReview />} />
          <Route path="/search" element={<Search />} />
          <Route path="/search/:symbol" element={<StockDetail />} />
        </Routes>
      </MainLayout>
      <Toaster />
    </BrowserRouter>
  )
}

export default App
