import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Brain,
  Settings,
  Zap,
  DollarSign,
  Clock,
  FileText,
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Eye,
  Trash2,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToastStore } from '@/store'
import {
  getAIStatus,
  getAIUsageStats,
  getAIUsageLogs,
  getAIUsageLogDetail,
  getAIConfigs,
  setAIConfig,
  analyzeBatch,
} from '@/services/aiApi'
import type { AIUsageLog, AIUsageLogDetail } from '@/types'

export default function AISettings() {
  const { addToast } = useToastStore()
  const queryClient = useQueryClient()

  const [batchLimit, setBatchLimit] = useState(10)
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null)
  const [promptInput, setPromptInput] = useState('')
  const [showPromptEditor, setShowPromptEditor] = useState(false)

  // Queries
  const { data: aiStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['ai-status'],
    queryFn: getAIStatus,
  })

  const { data: usageStats } = useQuery({
    queryKey: ['ai-usage-stats'],
    queryFn: () => getAIUsageStats(30),
  })

  const { data: usageLogs, refetch: refetchLogs } = useQuery({
    queryKey: ['ai-usage-logs'],
    queryFn: () => getAIUsageLogs({ page: 1, page_size: 20 }),
  })

  const { data: configs } = useQuery({
    queryKey: ['ai-configs'],
    queryFn: getAIConfigs,
  })

  const { data: logDetail } = useQuery({
    queryKey: ['ai-usage-log-detail', selectedLogId],
    queryFn: () => getAIUsageLogDetail(selectedLogId!),
    enabled: !!selectedLogId,
  })

  // Mutations
  const analyzeBatchMutation = useMutation({
    mutationFn: () => analyzeBatch({ limit: batchLimit }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['ai-status'] })
      queryClient.invalidateQueries({ queryKey: ['ai-usage-stats'] })
      queryClient.invalidateQueries({ queryKey: ['ai-usage-logs'] })
      addToast({
        title: 'AI 分析完成',
        description: `成功处理 ${result.successful}/${result.total_articles} 篇文章`,
        type: 'success',
      })
    },
    onError: (error: any) => {
      addToast({
        title: '分析失败',
        description: error.response?.data?.detail || '请检查 API 配置',
        type: 'error',
      })
    },
  })

  const saveConfigMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => setAIConfig(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-configs'] })
      queryClient.invalidateQueries({ queryKey: ['ai-status'] })
      addToast({ title: '配置已保存', type: 'success' })
    },
    onError: () => {
      addToast({ title: '保存失败', type: 'error' })
    },
  })

  const currentPrompt = configs?.find((c) => c.key === 'sentiment_prompt')?.value || ''

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="h-6 w-6" />
          AI 分析设置
        </h1>
        <p className="text-sm text-muted-foreground">
          配置 AI 模型、查看 Token 消耗和 Prompt 调试
        </p>
      </div>

      {/* Status Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              {aiStatus?.api_configured ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <div>
                <div className="text-sm text-muted-foreground">API 状态</div>
                <div className="font-medium">
                  {aiStatus?.api_configured ? '已配置' : '未配置'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <div>
                <div className="text-sm text-muted-foreground">当前模型</div>
                <div className="font-medium">{aiStatus?.current_model || '-'}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <div>
                <div className="text-sm text-muted-foreground">已分析文章</div>
                <div className="font-medium">
                  {aiStatus?.stats.processed_articles || 0} / {aiStatus?.stats.total_articles || 0}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <div>
                <div className="text-sm text-muted-foreground">AI 洞察数</div>
                <div className="font-medium">{aiStatus?.stats.total_insights || 0}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Batch Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            批量 AI 分析
          </CardTitle>
          <CardDescription>
            对未处理的文章运行 AI 情绪分析，提取股票、情绪分和核心逻辑
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">处理数量:</span>
              <Input
                type="number"
                value={batchLimit}
                onChange={(e) => setBatchLimit(parseInt(e.target.value) || 10)}
                className="w-20"
                min={1}
                max={100}
              />
            </div>
            <Button
              onClick={() => analyzeBatchMutation.mutate()}
              disabled={analyzeBatchMutation.isPending || !aiStatus?.api_configured}
            >
              {analyzeBatchMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              开始分析
            </Button>
          </div>

          {!aiStatus?.api_configured && (
            <div className="text-sm text-destructive">
              请先配置 OPENAI_API_KEY 环境变量
            </div>
          )}

          {aiStatus?.stats.unprocessed_articles !== undefined && aiStatus.stats.unprocessed_articles > 0 && (
            <div className="text-sm text-muted-foreground">
              待处理文章: {aiStatus.stats.unprocessed_articles} 篇
            </div>
          )}

          {analyzeBatchMutation.data && (
            <div className="rounded-md bg-muted p-4 text-sm">
              <div className="font-medium mb-2">分析结果</div>
              <div className="grid grid-cols-2 gap-2">
                <div>批次 ID: {analyzeBatchMutation.data.batch_id}</div>
                <div>总文章数: {analyzeBatchMutation.data.total_articles}</div>
                <div className="text-green-600">成功: {analyzeBatchMutation.data.successful}</div>
                <div className="text-red-600">失败: {analyzeBatchMutation.data.failed}</div>
                <div>总 Token: {analyzeBatchMutation.data.total_usage.total_tokens.toLocaleString()}</div>
                <div>预估成本: ${analyzeBatchMutation.data.total_usage.total_cost.toFixed(4)}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Token 消耗统计
            <Badge variant="secondary">近 30 天</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {usageStats ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-md bg-muted p-3">
                  <div className="text-2xl font-bold">{usageStats.total_requests}</div>
                  <div className="text-xs text-muted-foreground">总请求数</div>
                </div>
                <div className="rounded-md bg-muted p-3">
                  <div className="text-2xl font-bold">{usageStats.total_tokens.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">总 Token</div>
                </div>
                <div className="rounded-md bg-muted p-3">
                  <div className="text-2xl font-bold text-green-600">
                    ${usageStats.total_cost_usd.toFixed(4)}
                  </div>
                  <div className="text-xs text-muted-foreground">预估成本</div>
                </div>
                <div className="rounded-md bg-muted p-3">
                  <div className="text-2xl font-bold">{usageStats.avg_processing_time_ms.toFixed(0)}ms</div>
                  <div className="text-xs text-muted-foreground">平均耗时</div>
                </div>
              </div>

              {usageStats.by_model.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">按模型统计</div>
                  <div className="space-y-2">
                    {usageStats.by_model.map((m) => (
                      <div key={m.model} className="flex items-center justify-between text-sm">
                        <span className="font-mono">{m.model}</span>
                        <div className="flex items-center gap-4">
                          <span>{m.requests} 次</span>
                          <span>{m.tokens.toLocaleString()} tokens</span>
                          <span className="text-green-600">${m.cost_usd.toFixed(4)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-muted-foreground">暂无数据</div>
          )}
        </CardContent>
      </Card>

      {/* Prompt Configuration */}
      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={() => setShowPromptEditor(!showPromptEditor)}
        >
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Prompt 配置
              {aiStatus?.has_custom_prompt && (
                <Badge variant="secondary">已自定义</Badge>
              )}
            </div>
            {showPromptEditor ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </CardTitle>
          <CardDescription>
            自定义 AI 分析的系统提示词，优化情绪分析效果
          </CardDescription>
        </CardHeader>
        {showPromptEditor && (
          <CardContent className="space-y-4">
            <Textarea
              placeholder="输入自定义 Prompt..."
              value={promptInput || currentPrompt}
              onChange={(e) => setPromptInput(e.target.value)}
              rows={12}
              className="font-mono text-sm"
            />
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  if (promptInput.trim()) {
                    saveConfigMutation.mutate({
                      key: 'sentiment_prompt',
                      value: promptInput.trim(),
                    })
                  }
                }}
                disabled={!promptInput.trim() || saveConfigMutation.isPending}
              >
                {saveConfigMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                保存 Prompt
              </Button>
              {currentPrompt && (
                <Button
                  variant="outline"
                  onClick={() => setPromptInput(currentPrompt)}
                >
                  重置为当前
                </Button>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Usage Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              请求日志
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchLogs()}>
              <RefreshCw className="h-4 w-4 mr-1" />
              刷新
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {usageLogs && usageLogs.length > 0 ? (
            <div className="space-y-2">
              {usageLogs.map((log) => (
                <div
                  key={log.id}
                  className={`rounded-md border p-3 cursor-pointer transition-colors ${
                    selectedLogId === log.id ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                  }`}
                  onClick={() => setSelectedLogId(selectedLogId === log.id ? null : log.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {log.success ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="font-mono text-sm">{log.model_name}</span>
                      <Badge variant="outline" className="text-xs">
                        {log.request_type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{log.total_tokens.toLocaleString()} tokens</span>
                      <span>${log.estimated_cost.toFixed(4)}</span>
                      <span>{log.processing_time_ms}ms</span>
                      <span>{new Date(log.created_at).toLocaleString('zh-CN')}</span>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {selectedLogId === log.id && logDetail && (
                    <div className="mt-4 space-y-4 border-t pt-4">
                      <div>
                        <div className="text-sm font-medium mb-2 flex items-center gap-2">
                          <Eye className="h-4 w-4" />
                          Prompt
                        </div>
                        <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-48 whitespace-pre-wrap">
                          {logDetail.prompt_text || '无'}
                        </pre>
                      </div>
                      <div>
                        <div className="text-sm font-medium mb-2 flex items-center gap-2">
                          <Brain className="h-4 w-4" />
                          Response
                        </div>
                        <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-48 whitespace-pre-wrap">
                          {logDetail.response_text || '无'}
                        </pre>
                      </div>
                      {logDetail.error_message && (
                        <div>
                          <div className="text-sm font-medium mb-2 text-red-500">错误信息</div>
                          <pre className="text-xs bg-red-500/10 text-red-500 p-3 rounded-md">
                            {logDetail.error_message}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground text-center py-8">暂无请求日志</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
