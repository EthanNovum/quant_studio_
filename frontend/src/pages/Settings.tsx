import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, RefreshCw, Play, Square, Search, Calendar, Database, Users, Loader2, Key, Eye, EyeOff, Info, CheckCircle, XCircle, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useToastStore } from '@/store'
import {
  getCreators,
  getAllAliases,
  createAlias,
  updateStockAliases,
  getSyncStatus,
  getArticleTimeRange,
  startCrawl,
  startTagging,
  stopSync,
  getConfig,
  setConfig,
  testCookies,
} from '@/services/sentimentApi'
import { searchStocks } from '@/services/stockApi'

export default function Settings() {
  const { addToast } = useToastStore()
  const queryClient = useQueryClient()

  // ========== Crawl Time Range ==========
  const [crawlStartDate, setCrawlStartDate] = useState('')
  const [crawlEndDate, setCrawlEndDate] = useState('')
  const [selectedCreatorIds, setSelectedCreatorIds] = useState<string[]>([])
  const [selectAllCreators, setSelectAllCreators] = useState(true)

  // ========== Cookies Config ==========
  const [cookiesInput, setCookiesInput] = useState('')
  const [showCookies, setShowCookies] = useState(false)
  const [cookieTestResult, setCookieTestResult] = useState<{ valid: boolean; message: string } | null>(null)

  // Fetch current cookies
  const { data: cookiesConfig } = useQuery({
    queryKey: ['config-zhihu-cookies'],
    queryFn: () => getConfig('zhihu_cookies'),
  })

  // Save cookies mutation
  const saveCookiesMutation = useMutation({
    mutationFn: (cookies: string) => setConfig('zhihu_cookies', cookies),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-zhihu-cookies'] })
      addToast({ title: 'Cookies 已保存', type: 'success' })
      setCookieTestResult(null) // Reset test result when cookies change
    },
    onError: () => {
      addToast({ title: '保存失败', type: 'error' })
    },
  })

  // Test cookies mutation
  const testCookiesMutation = useMutation({
    mutationFn: testCookies,
    onSuccess: (result) => {
      setCookieTestResult(result)
      if (result.valid) {
        addToast({ title: 'Cookie 有效', description: result.message, type: 'success' })
      } else {
        addToast({ title: 'Cookie 无效', description: result.message, type: 'error' })
      }
    },
    onError: () => {
      setCookieTestResult({ valid: false, message: '测试请求失败' })
      addToast({ title: '测试失败', type: 'error' })
    },
  })

  const { data: creators } = useQuery({
    queryKey: ['creators'],
    queryFn: getCreators,
  })

  // ========== Article Time Range ==========
  const { data: articleTimeRange } = useQuery({
    queryKey: ['article-time-range'],
    queryFn: getArticleTimeRange,
  })

  // ========== Aliases Section ==========
  const [aliasSearch, setAliasSearch] = useState('')
  const [selectedStock, setSelectedStock] = useState<{ symbol: string; name: string } | null>(null)
  const [newAlias, setNewAlias] = useState('')
  const [editingAliases, setEditingAliases] = useState<string[]>([])

  const { data: aliases } = useQuery({
    queryKey: ['aliases'],
    queryFn: getAllAliases,
  })

  const { data: searchResults } = useQuery({
    queryKey: ['stock-search', aliasSearch],
    queryFn: () => searchStocks(aliasSearch),
    enabled: aliasSearch.length >= 2,
  })

  const createAliasMutation = useMutation({
    mutationFn: ({ symbol, alias }: { symbol: string; alias: string }) => createAlias(symbol, alias),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aliases'] })
      setNewAlias('')
      addToast({ title: '别名已添加', type: 'success' })
    },
    onError: (error: any) => {
      addToast({ title: '添加失败', description: error.response?.data?.detail, type: 'error' })
    },
  })

  // ========== Sync Section ==========
  const { data: syncStatus, refetch: refetchSyncStatus } = useQuery({
    queryKey: ['sync-status'],
    queryFn: getSyncStatus,
    refetchInterval: 2000, // Always poll every 2 seconds
  })

  const startCrawlMutation = useMutation({
    mutationFn: () => startCrawl({
      start_date: crawlStartDate || null,
      end_date: crawlEndDate || null,
      creator_ids: selectAllCreators ? null : selectedCreatorIds,
    }),
    onSuccess: () => {
      // Immediately refetch status multiple times to catch the state change
      refetchSyncStatus()
      setTimeout(() => refetchSyncStatus(), 500)
      setTimeout(() => refetchSyncStatus(), 1000)
      addToast({ title: '爬虫已启动', type: 'success' })
    },
    onError: (error: any) => {
      addToast({ title: '启动失败', description: error.response?.data?.detail, type: 'error' })
    },
  })

  // Handle creator selection toggle
  const toggleCreatorSelection = (userId: string) => {
    setSelectedCreatorIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const handleSelectAllToggle = (checked: boolean) => {
    setSelectAllCreators(checked)
    if (checked) {
      setSelectedCreatorIds([])
    }
  }

  const startTaggingMutation = useMutation({
    mutationFn: (retagAll: boolean) => startTagging(retagAll),
    onSuccess: () => {
      refetchSyncStatus()
      addToast({ title: '标签任务已启动', type: 'success' })
    },
  })

  const stopSyncMutation = useMutation({
    mutationFn: stopSync,
    onSuccess: () => {
      refetchSyncStatus()
      addToast({ title: '已请求停止', type: 'success' })
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">设置</h1>
        <p className="text-sm text-muted-foreground">管理爬虫配置、股票别名和数据同步</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sync Center */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              数据同步中心
            </CardTitle>
            <CardDescription>手动触发数据更新任务</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Cookies Configuration */}
            <div className="rounded-md border p-3">
              <div className="flex items-center gap-2 text-sm font-medium mb-2">
                <Key className="h-4 w-4" />
                知乎 Cookies 配置
                {cookiesConfig?.value ? (
                  <Badge variant="secondary" className="text-xs">已配置</Badge>
                ) : (
                  <Badge variant="destructive" className="text-xs">未配置</Badge>
                )}
                {cookieTestResult && (
                  cookieTestResult.valid ? (
                    <Badge variant="default" className="text-xs bg-green-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      有效
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs">
                      <XCircle className="h-3 w-3 mr-1" />
                      无效
                    </Badge>
                  )
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                爬取知乎内容需要登录 Cookies。请在浏览器登录知乎后，从开发者工具中复制 Cookie 值。
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showCookies ? 'text' : 'password'}
                    placeholder="粘贴知乎 Cookie 字符串..."
                    value={cookiesInput}
                    onChange={(e) => setCookiesInput(e.target.value)}
                    className="pr-10 text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCookies(!showCookies)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCookies ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  onClick={() => {
                    if (cookiesInput.trim()) {
                      saveCookiesMutation.mutate(cookiesInput.trim())
                      setCookiesInput('')
                    }
                  }}
                  disabled={!cookiesInput.trim() || saveCookiesMutation.isPending}
                  size="sm"
                >
                  {saveCookiesMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    '保存'
                  )}
                </Button>
              </div>
              {cookiesConfig?.value && (
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    当前已保存 Cookies（长度: {cookiesConfig.value.length} 字符）
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testCookiesMutation.mutate()}
                    disabled={testCookiesMutation.isPending}
                  >
                    {testCookiesMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-1" />
                    )}
                    测试 Cookie
                  </Button>
                </div>
              )}
              {cookieTestResult && (
                <div className={`mt-2 text-xs p-2 rounded ${cookieTestResult.valid ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                  {cookieTestResult.message}
                </div>
              )}
            </div>

            {/* Article Time Range Info */}
            {articleTimeRange && articleTimeRange.total_count > 0 && (
              <div className="rounded-md border p-3 bg-muted/50">
                <div className="flex items-center gap-2 text-sm font-medium mb-2">
                  <Database className="h-4 w-4" />
                  当前数据库文章时间范围
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">最新文章:</span>
                    <span className="ml-2 font-medium">{articleTimeRange.newest_date || '无数据'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">最早文章:</span>
                    <span className="ml-2 font-medium">{articleTimeRange.oldest_date || '无数据'}</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  共 {articleTimeRange.total_count.toLocaleString()} 篇文章
                </div>
              </div>
            )}

            {/* Crawl Time Range Settings */}
            <div className="rounded-md border p-3">
              <div className="flex items-center gap-2 text-sm font-medium mb-2">
                <Calendar className="h-4 w-4" />
                爬取时间范围设置
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">开始日期</label>
                  <Input
                    type="date"
                    value={crawlStartDate}
                    onChange={(e) => setCrawlStartDate(e.target.value)}
                    className="h-8 text-sm"
                    disabled={syncStatus?.is_running}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">结束日期</label>
                  <Input
                    type="date"
                    value={crawlEndDate}
                    onChange={(e) => setCrawlEndDate(e.target.value)}
                    className="h-8 text-sm"
                    disabled={syncStatus?.is_running}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                留空表示不限制，只爬取指定时间范围内的文章
              </p>
            </div>

            {/* Creator Selection */}
            <div className="rounded-md border p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4" />
                  选择要同步的创作者
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">全部同步</span>
                  <Switch
                    checked={selectAllCreators}
                    onCheckedChange={handleSelectAllToggle}
                    disabled={syncStatus?.is_running}
                  />
                </div>
              </div>

              {!selectAllCreators && (
                <div className="space-y-2 max-h-64 overflow-auto">
                  {creators && creators.length > 0 ? (
                    creators.filter(c => c.is_active === 1).map((creator) => (
                      <div
                        key={creator.user_id}
                        className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                          selectedCreatorIds.includes(creator.user_id)
                            ? 'bg-primary/10 border-primary'
                            : 'hover:bg-muted'
                        }`}
                        onClick={() => !syncStatus?.is_running && toggleCreatorSelection(creator.user_id)}
                      >
                        <Checkbox
                          checked={selectedCreatorIds.includes(creator.user_id)}
                          onCheckedChange={() => toggleCreatorSelection(creator.user_id)}
                          disabled={syncStatus?.is_running}
                        />
                        {creator.user_avatar && (
                          <img
                            src={creator.user_avatar}
                            alt=""
                            className="h-6 w-6 rounded-full"
                          />
                        )}
                        <span className="text-sm flex-1">{creator.user_nickname}</span>
                        <span className="text-xs text-muted-foreground">
                          {creator.answer_count + creator.article_count} 篇
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground text-center py-2">
                      暂无活跃的创作者
                    </div>
                  )}
                </div>
              )}

              {!selectAllCreators && selectedCreatorIds.length > 0 && (
                <div className="mt-2 text-xs text-muted-foreground">
                  已选择 {selectedCreatorIds.length} 个创作者
                </div>
              )}

              {!selectAllCreators && selectedCreatorIds.length === 0 && creators && creators.filter(c => c.is_active === 1).length > 0 && (
                <p className="text-xs text-amber-600 mt-2">
                  请至少选择一个创作者
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <Button
                onClick={() => startCrawlMutation.mutate()}
                disabled={syncStatus?.is_running || startCrawlMutation.isPending || (!selectAllCreators && selectedCreatorIds.length === 0)}
              >
                {startCrawlMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                {startCrawlMutation.isPending ? '启动中...' : '同步舆情'}
              </Button>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      onClick={() => startTaggingMutation.mutate(false)}
                      disabled={syncStatus?.is_running || startTaggingMutation.isPending}
                    >
                      {startTaggingMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      执行清洗
                      <Info className="ml-1 h-3 w-3 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p>清洗是指对已爬取的文章进行分析，自动识别并标记文章中提到的股票代码或名称，建立文章与股票的关联关系。只处理尚未标记的新文章。</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      onClick={() => startTaggingMutation.mutate(true)}
                      disabled={syncStatus?.is_running || startTaggingMutation.isPending}
                    >
                      重新清洗全部
                      <Info className="ml-1 h-3 w-3 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p>重新处理所有文章（包括已标记的），重新识别股票关联。适用于添加新的股票别名后，需要重新匹配历史文章的情况。</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {syncStatus?.is_running && (
                <Button variant="destructive" onClick={() => stopSyncMutation.mutate()}>
                  <Square className="mr-2 h-4 w-4" />
                  停止
                </Button>
              )}
            </div>

            {/* Status - Always visible with better styling */}
            <div className={`rounded-md p-4 ${syncStatus?.is_running ? 'bg-primary/10 border border-primary' : 'bg-muted'}`}>
              <div className="flex items-center gap-2 text-sm">
                {syncStatus?.is_running && (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                )}
                <span className="font-medium">状态:</span>
                {syncStatus?.is_running ? (
                  <Badge variant="default" className="animate-pulse">
                    {syncStatus.current_task || '运行中'}
                  </Badge>
                ) : (
                  <Badge variant="secondary">空闲</Badge>
                )}
              </div>
              {syncStatus?.is_running && (
                <div className="mt-2 text-xs text-muted-foreground">
                  正在执行任务，请稍候...
                </div>
              )}
              {syncStatus?.last_sync_at && (
                <div className="mt-1 text-xs text-muted-foreground">
                  上次同步: {new Date(syncStatus.last_sync_at).toLocaleString('zh-CN')}
                </div>
              )}
            </div>

            {/* Log output - Always visible */}
            <div className="rounded-md bg-black p-3 font-mono text-xs text-green-400">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400">日志输出</span>
                {syncStatus?.is_running && (
                  <span className="flex items-center gap-1 text-yellow-400">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    运行中
                  </span>
                )}
              </div>
              <div className="max-h-48 overflow-auto">
                <pre className="whitespace-pre-wrap">{syncStatus?.log_output || '暂无日志'}</pre>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Creators Management - Link to dedicated page */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              知乎创作者监控
            </CardTitle>
            <CardDescription>管理要爬取的知乎用户</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                当前监控 {creators?.filter(c => c.is_active === 1).length || 0} 位活跃创作者，共 {creators?.length || 0} 位
              </div>
              <Link to="/creators">
                <Button variant="outline">
                  管理创作者
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Aliases Management */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>股票别名管理</CardTitle>
            <CardDescription>
              添加股票的别名/昵称，用于提高舆情匹配的召回率（如：宁王 → 300750）
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search stock */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="搜索股票代码或名称..."
                  value={aliasSearch}
                  onChange={(e) => setAliasSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Search results */}
            {searchResults && searchResults.length > 0 && !selectedStock && (
              <div className="max-h-40 overflow-auto rounded-md border">
                {searchResults.slice(0, 10).map((stock) => (
                  <div
                    key={stock.symbol}
                    className="cursor-pointer px-3 py-2 hover:bg-accent"
                    onClick={() => {
                      setSelectedStock(stock)
                      setAliasSearch('')
                      const existing = aliases?.find((a) => a.symbol === stock.symbol)
                      setEditingAliases(existing?.aliases || [])
                    }}
                  >
                    <span className="font-medium">{stock.symbol}</span>
                    <span className="ml-2 text-muted-foreground">{stock.name}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Selected stock alias editor */}
            {selectedStock && (
              <div className="rounded-md border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <span className="font-medium">{selectedStock.symbol}</span>
                    <span className="ml-2 text-muted-foreground">{selectedStock.name}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedStock(null)}>
                    关闭
                  </Button>
                </div>

                {/* Current aliases */}
                <div className="mb-3 flex flex-wrap gap-2">
                  {editingAliases.map((alias, idx) => (
                    <Badge key={idx} variant="secondary" className="gap-1">
                      {alias}
                      <button
                        className="ml-1 hover:text-destructive"
                        onClick={() => {
                          const newAliases = editingAliases.filter((_, i) => i !== idx)
                          setEditingAliases(newAliases)
                          updateStockAliases(selectedStock.symbol, newAliases)
                            .then(() => queryClient.invalidateQueries({ queryKey: ['aliases'] }))
                        }}
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                  {editingAliases.length === 0 && (
                    <span className="text-sm text-muted-foreground">暂无别名</span>
                  )}
                </div>

                {/* Add new alias */}
                <div className="flex gap-2">
                  <Input
                    placeholder="添加新别名..."
                    value={newAlias}
                    onChange={(e) => setNewAlias(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newAlias.trim()) {
                        createAliasMutation.mutate({
                          symbol: selectedStock.symbol,
                          alias: newAlias.trim(),
                        })
                        setEditingAliases([...editingAliases, newAlias.trim()])
                        setNewAlias('')
                      }
                    }}
                  />
                  <Button
                    onClick={() => {
                      if (newAlias.trim()) {
                        createAliasMutation.mutate({
                          symbol: selectedStock.symbol,
                          alias: newAlias.trim(),
                        })
                        setEditingAliases([...editingAliases, newAlias.trim()])
                        setNewAlias('')
                      }
                    }}
                    disabled={!newAlias.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Existing aliases list */}
            {aliases && aliases.length > 0 && !selectedStock && (
              <div className="rounded-md border">
                <div className="max-h-64 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">代码</th>
                        <th className="px-3 py-2 text-left font-medium">名称</th>
                        <th className="px-3 py-2 text-left font-medium">别名</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aliases.map((item) => (
                        <tr
                          key={item.symbol}
                          className="cursor-pointer border-t hover:bg-accent"
                          onClick={() => {
                            setSelectedStock({ symbol: item.symbol, name: item.name })
                            setEditingAliases(item.aliases)
                          }}
                        >
                          <td className="px-3 py-2 font-medium">{item.symbol}</td>
                          <td className="px-3 py-2">{item.name}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              {item.aliases.slice(0, 3).map((alias, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {alias}
                                </Badge>
                              ))}
                              {item.aliases.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{item.aliases.length - 3}
                                </Badge>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
