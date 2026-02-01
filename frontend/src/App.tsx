import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import MainLayout from '@/components/layout/MainLayout'
import Dashboard from '@/pages/Dashboard'
import Watchlist from '@/pages/Watchlist'
import Screener from '@/pages/Screener'
import TradeReview from '@/pages/TradeReview'
import Search from '@/pages/Search'
import StockDetail from '@/pages/StockDetail'
import Sentiment from '@/pages/Sentiment'
import SentimentAuthors from '@/pages/SentimentAuthors'
import SentimentSymbols from '@/pages/SentimentSymbols'
import SentimentFavorites from '@/pages/SentimentFavorites'
import ArticleDetail from '@/pages/ArticleDetail'
import Creators from '@/pages/Creators'
import CreatorDetail from '@/pages/CreatorDetail'
import Settings from '@/pages/Settings'
import DailyReview from '@/pages/DailyReview'
import AISettings from '@/pages/AISettings'
import DarePlay from '@/pages/DarePlay'
import DataUpload from '@/pages/DataUpload'
import LoginPage from '@/pages/LoginPage'
import { authApi } from '@/services/authApi'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    authApi.check().then((res) => {
      setIsAuthenticated(res.authenticated)
    }).catch(() => {
      setIsAuthenticated(false)
    })
  }, [])

  // Loading state
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    )
  }

  // Not authenticated - show login
  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={() => setIsAuthenticated(true)} />
  }

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
          <Route path="/sentiment" element={<Sentiment />} />
          <Route path="/sentiment/authors" element={<SentimentAuthors />} />
          <Route path="/sentiment/symbols" element={<SentimentSymbols />} />
          <Route path="/sentiment/favorites" element={<SentimentFavorites />} />
          <Route path="/sentiment/:contentId" element={<ArticleDetail />} />
          <Route path="/creators" element={<Creators />} />
          <Route path="/creators/:userId" element={<CreatorDetail />} />
          <Route path="/daily-review" element={<DailyReview />} />
          <Route path="/dare-play" element={<DarePlay />} />
          <Route path="/ai-settings" element={<AISettings />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/data-upload" element={<DataUpload />} />
        </Routes>
      </MainLayout>
      <Toaster />
    </BrowserRouter>
  )
}

export default App
