import { useState, useRef, useCallback } from 'react'
import { Upload, Database, CheckCircle, XCircle, Loader2, FileUp, Trash2, Play, Pause, RotateCcw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { useToastStore } from '@/store'
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js'

// Types
interface Article {
  content_id: string
  content_type: string
  title: string
  content_text: string | null
  content_url: string | null
  created_time: number
  updated_time: number
  voteup_count: number
  comment_count: number
  author_id: string | null
  author_name: string | null
  author_avatar: string | null
}

interface Creator {
  user_id: string
  url_token: string
  user_nickname: string
  user_avatar: string | null
  user_link: string | null
  gender: string | null
  fans: number
  follows: number
  answer_count: number
  article_count: number
  voteup_count: number
}

interface UploadState {
  status: 'idle' | 'loading' | 'uploading' | 'paused' | 'completed' | 'error'
  fileName: string | null
  totalArticles: number
  totalCreators: number
  uploadedArticles: number
  uploadedCreators: number
  currentBatch: number
  totalBatches: number
  errorMessage: string | null
  logs: string[]
}

const BATCH_SIZE = 50
const STORAGE_KEY = 'data_upload_progress'

export default function DataUpload() {
  const { addToast } = useToastStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const [uploadToken, setUploadToken] = useState('')
  const [state, setState] = useState<UploadState>({
    status: 'idle',
    fileName: null,
    totalArticles: 0,
    totalCreators: 0,
    uploadedArticles: 0,
    uploadedCreators: 0,
    currentBatch: 0,
    totalBatches: 0,
    errorMessage: null,
    logs: [],
  })

  // Store parsed data in refs to avoid re-renders
  const articlesRef = useRef<Article[]>([])
  const creatorsRef = useRef<Creator[]>([])
  const uploadedIdsRef = useRef<Set<string>>(new Set())

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString('zh-CN')
    setState(prev => ({
      ...prev,
      logs: [...prev.logs.slice(-100), `[${timestamp}] ${message}`],
    }))
  }, [])

  // Load progress from localStorage
  const loadProgress = useCallback(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        uploadedIdsRef.current = new Set(data.uploadedIds || [])
        return data
      }
    } catch {
      // ignore
    }
    return null
  }, [])

  // Save progress to localStorage
  const saveProgress = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        uploadedIds: Array.from(uploadedIdsRef.current),
        fileName: state.fileName,
        uploadedArticles: state.uploadedArticles,
        uploadedCreators: state.uploadedCreators,
      }))
    } catch {
      // ignore
    }
  }, [state.fileName, state.uploadedArticles, state.uploadedCreators])

  // Clear progress
  const clearProgress = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    uploadedIdsRef.current = new Set()
    articlesRef.current = []
    creatorsRef.current = []
    setState({
      status: 'idle',
      fileName: null,
      totalArticles: 0,
      totalCreators: 0,
      uploadedArticles: 0,
      uploadedCreators: 0,
      currentBatch: 0,
      totalBatches: 0,
      errorMessage: null,
      logs: [],
    })
  }, [])

  // Parse SQLite file
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setState(prev => ({ ...prev, status: 'loading', fileName: file.name, logs: [], errorMessage: null }))
    addLog(`正在读取文件: ${file.name}`)

    try {
      // Initialize sql.js
      const SQL = await initSqlJs({
        locateFile: (filename) => `https://sql.js.org/dist/${filename}`,
      })

      // Read file as ArrayBuffer
      const buffer = await file.arrayBuffer()
      const db = new SQL.Database(new Uint8Array(buffer))

      addLog('SQLite 数据库加载成功')

      // Load saved progress
      const savedProgress = loadProgress()
      if (savedProgress && savedProgress.fileName === file.name) {
        addLog(`发现上次上传进度: 已上传 ${savedProgress.uploadedArticles} 篇文章`)
      }

      // Parse articles
      addLog('正在解析文章数据...')
      const articles: Article[] = []
      try {
        const articleRows = db.exec(`
          SELECT
            content_id, content_type, title, content_text, content_url,
            created_time, updated_time, voteup_count, comment_count,
            user_id, user_nickname, user_avatar
          FROM zhihu_content
        `)

        if (articleRows.length > 0) {
          for (const row of articleRows[0].values) {
            articles.push({
              content_id: String(row[0] || ''),
              content_type: String(row[1] || 'article'),
              title: String(row[2] || ''),
              content_text: row[3] ? String(row[3]) : null,
              content_url: row[4] ? String(row[4]) : null,
              created_time: Number(row[5]) || 0,
              updated_time: Number(row[6]) || 0,
              voteup_count: Number(row[7]) || 0,
              comment_count: Number(row[8]) || 0,
              author_id: row[9] ? String(row[9]) : null,
              author_name: row[10] ? String(row[10]) : null,
              author_avatar: row[11] ? String(row[11]) : null,
            })
          }
        }
      } catch (e) {
        addLog('警告: 无法读取 zhihu_content 表')
      }

      addLog(`解析到 ${articles.length} 篇文章`)

      // Parse creators
      addLog('正在解析创作者数据...')
      const creators: Creator[] = []
      try {
        const creatorRows = db.exec(`
          SELECT
            user_id, url_token, user_nickname, user_avatar, user_link,
            gender, fans, follows, anwser_count, article_count, get_voteup_count
          FROM zhihu_creator
        `)

        if (creatorRows.length > 0) {
          for (const row of creatorRows[0].values) {
            creators.push({
              user_id: String(row[0] || ''),
              url_token: String(row[1] || ''),
              user_nickname: String(row[2] || ''),
              user_avatar: row[3] ? String(row[3]) : null,
              user_link: row[4] ? String(row[4]) : null,
              gender: row[5] ? String(row[5]) : null,
              fans: Number(row[6]) || 0,
              follows: Number(row[7]) || 0,
              answer_count: Number(row[8]) || 0,
              article_count: Number(row[9]) || 0,
              voteup_count: Number(row[10]) || 0,
            })
          }
        }
      } catch (e) {
        addLog('警告: 无法读取 zhihu_creator 表')
      }

      addLog(`解析到 ${creators.length} 位创作者`)

      db.close()

      // Store in refs
      articlesRef.current = articles
      creatorsRef.current = creators

      // Filter out already uploaded
      const pendingArticles = articles.filter(a => !uploadedIdsRef.current.has(a.content_id))
      const totalBatches = Math.ceil(pendingArticles.length / BATCH_SIZE) + Math.ceil(creators.length / BATCH_SIZE)

      setState(prev => ({
        ...prev,
        status: 'idle',
        totalArticles: articles.length,
        totalCreators: creators.length,
        uploadedArticles: articles.length - pendingArticles.length,
        totalBatches,
      }))

      addLog(`准备就绪，待上传 ${pendingArticles.length} 篇文章，${creators.length} 位创作者`)

    } catch (error: any) {
      addLog(`错误: ${error.message}`)
      setState(prev => ({
        ...prev,
        status: 'error',
        errorMessage: error.message,
      }))
      addToast({ title: '文件解析失败', description: error.message, type: 'error' })
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Upload a batch
  const uploadBatch = async (items: Article[] | Creator[], type: 'articles' | 'creators', batchNum: number) => {
    const response = await fetch('/api/sync/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Upload-Token': uploadToken,
      },
      body: JSON.stringify({
        articles: type === 'articles' ? items : [],
        creators: type === 'creators' ? items : [],
        batch_id: `${type}-${batchNum}`,
      }),
      signal: abortControllerRef.current?.signal,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }))
      throw new Error(error.detail || `HTTP ${response.status}`)
    }

    return response.json()
  }

  // Start upload
  const startUpload = async () => {
    if (!uploadToken) {
      addToast({ title: '请输入上传令牌', type: 'error' })
      return
    }

    setState(prev => ({ ...prev, status: 'uploading', errorMessage: null }))
    abortControllerRef.current = new AbortController()

    const articles = articlesRef.current.filter(a => !uploadedIdsRef.current.has(a.content_id))
    const creators = creatorsRef.current

    addLog(`开始上传: ${articles.length} 篇文章, ${creators.length} 位创作者`)

    let currentBatch = 0
    const totalBatches = Math.ceil(articles.length / BATCH_SIZE) + Math.ceil(creators.length / BATCH_SIZE)

    try {
      // Upload articles
      for (let i = 0; i < articles.length; i += BATCH_SIZE) {
        // Check if paused
        if (abortControllerRef.current?.signal.aborted) {
          addLog('上传已暂停')
          return
        }

        const batch = articles.slice(i, i + BATCH_SIZE)
        currentBatch++

        addLog(`上传文章批次 ${currentBatch}/${totalBatches} (${batch.length} 篇)`)

        try {
          const result = await uploadBatch(batch, 'articles', currentBatch)

          // Mark as uploaded
          batch.forEach(a => uploadedIdsRef.current.add(a.content_id))

          setState(prev => ({
            ...prev,
            uploadedArticles: prev.uploadedArticles + batch.length,
            currentBatch,
          }))

          saveProgress()

          addLog(`  ✓ 成功: +${result.articles_inserted} ~${result.articles_updated}`)
        } catch (error: any) {
          if (error.name === 'AbortError') {
            addLog('上传已暂停')
            setState(prev => ({ ...prev, status: 'paused' }))
            return
          }
          throw error
        }

        // Small delay between batches
        await new Promise(r => setTimeout(r, 100))
      }

      // Upload creators
      for (let i = 0; i < creators.length; i += BATCH_SIZE) {
        if (abortControllerRef.current?.signal.aborted) {
          addLog('上传已暂停')
          return
        }

        const batch = creators.slice(i, i + BATCH_SIZE)
        currentBatch++

        addLog(`上传创作者批次 ${currentBatch}/${totalBatches} (${batch.length} 位)`)

        try {
          const result = await uploadBatch(batch, 'creators', currentBatch)

          setState(prev => ({
            ...prev,
            uploadedCreators: prev.uploadedCreators + batch.length,
            currentBatch,
          }))

          addLog(`  ✓ 成功: +${result.creators_inserted} ~${result.creators_updated}`)
        } catch (error: any) {
          if (error.name === 'AbortError') {
            addLog('上传已暂停')
            setState(prev => ({ ...prev, status: 'paused' }))
            return
          }
          throw error
        }

        await new Promise(r => setTimeout(r, 100))
      }

      // Completed
      setState(prev => ({ ...prev, status: 'completed' }))
      addLog('✅ 全部上传完成!')
      addToast({ title: '上传完成', type: 'success' })
      clearProgress()

    } catch (error: any) {
      addLog(`❌ 错误: ${error.message}`)
      setState(prev => ({
        ...prev,
        status: 'error',
        errorMessage: error.message,
      }))
      addToast({ title: '上传失败', description: error.message, type: 'error' })
    }
  }

  // Pause upload
  const pauseUpload = () => {
    abortControllerRef.current?.abort()
    setState(prev => ({ ...prev, status: 'paused' }))
    saveProgress()
    addLog('上传已暂停，进度已保存')
  }

  // Resume upload
  const resumeUpload = () => {
    startUpload()
  }

  // Calculate progress
  const totalItems = state.totalArticles + state.totalCreators
  const uploadedItems = state.uploadedArticles + state.uploadedCreators
  const progressPercent = totalItems > 0 ? Math.round((uploadedItems / totalItems) * 100) : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">数据上传</h1>
        <p className="text-sm text-muted-foreground">从本地 SQLite 数据库上传文章和创作者数据到服务器</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upload Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              上传配置
            </CardTitle>
            <CardDescription>选择 SQLite 数据库文件并配置上传参数</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Token input */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">上传令牌</label>
              <Input
                type="password"
                placeholder="输入服务器的 AUTH_PASSWORD..."
                value={uploadToken}
                onChange={(e) => setUploadToken(e.target.value)}
                disabled={state.status === 'uploading'}
              />
              <p className="text-xs text-muted-foreground mt-1">
                使用服务器配置的 AUTH_PASSWORD 进行认证
              </p>
            </div>

            {/* File input */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">SQLite 数据库文件</label>
              <div className="flex gap-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".db,.sqlite,.sqlite3"
                  onChange={handleFileSelect}
                  disabled={state.status === 'uploading' || state.status === 'loading'}
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                选择 MediaCrawler/database/sqlite_tables.db 文件
              </p>
            </div>

            {/* File info */}
            {state.fileName && (
              <div className="rounded-md border p-3 bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="h-4 w-4" />
                  <span className="text-sm font-medium">{state.fileName}</span>
                  {state.status === 'loading' && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">文章:</span>
                    <span className="ml-2 font-medium">{state.totalArticles}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">创作者:</span>
                    <span className="ml-2 font-medium">{state.totalCreators}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              {state.status === 'idle' && state.totalArticles > 0 && (
                <Button onClick={startUpload} disabled={!uploadToken}>
                  <Play className="h-4 w-4 mr-2" />
                  开始上传
                </Button>
              )}

              {state.status === 'uploading' && (
                <Button variant="outline" onClick={pauseUpload}>
                  <Pause className="h-4 w-4 mr-2" />
                  暂停
                </Button>
              )}

              {state.status === 'paused' && (
                <Button onClick={resumeUpload}>
                  <Play className="h-4 w-4 mr-2" />
                  继续上传
                </Button>
              )}

              {(state.status === 'completed' || state.status === 'error' || state.status === 'paused') && (
                <Button variant="outline" onClick={clearProgress}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  清除进度
                </Button>
              )}

              {state.status === 'error' && (
                <Button onClick={startUpload}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  重试
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upload Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5" />
              上传进度
            </CardTitle>
            <CardDescription>实时显示上传状态</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status badge */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">状态:</span>
              {state.status === 'idle' && <Badge variant="secondary">就绪</Badge>}
              {state.status === 'loading' && (
                <Badge variant="secondary">
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  解析中
                </Badge>
              )}
              {state.status === 'uploading' && (
                <Badge variant="default" className="animate-pulse">
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  上传中
                </Badge>
              )}
              {state.status === 'paused' && <Badge variant="outline">已暂停</Badge>}
              {state.status === 'completed' && (
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  完成
                </Badge>
              )}
              {state.status === 'error' && (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  错误
                </Badge>
              )}
            </div>

            {/* Progress bar */}
            {totalItems > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>总进度</span>
                  <span>{progressPercent}%</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>文章: {state.uploadedArticles}/{state.totalArticles}</div>
                  <div>创作者: {state.uploadedCreators}/{state.totalCreators}</div>
                </div>
                {state.currentBatch > 0 && (
                  <div className="text-xs text-muted-foreground">
                    批次: {state.currentBatch}/{state.totalBatches}
                  </div>
                )}
              </div>
            )}

            {/* Error message */}
            {state.errorMessage && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {state.errorMessage}
              </div>
            )}

            {/* Logs */}
            <div className="rounded-md bg-black p-3 font-mono text-xs text-green-400">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400">上传日志</span>
                {state.status === 'uploading' && (
                  <span className="flex items-center gap-1 text-yellow-400">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    运行中
                  </span>
                )}
              </div>
              <div className="max-h-48 overflow-auto">
                <pre className="whitespace-pre-wrap">
                  {state.logs.length > 0 ? state.logs.join('\n') : '等待操作...'}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>使用说明</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none">
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>在本地运行 MediaCrawler 爬虫，数据会保存在 <code className="bg-muted px-1 rounded">MediaCrawler/database/sqlite_tables.db</code></li>
            <li>输入服务器的 <strong>AUTH_PASSWORD</strong> 作为上传令牌</li>
            <li>选择 SQLite 数据库文件，系统会自动解析文章和创作者数据</li>
            <li>点击"开始上传"，数据会分批上传到服务器</li>
            <li>上传支持<strong>断点续传</strong>：暂停后可继续，刷新页面后重新选择同一文件也会自动跳过已上传的数据</li>
          </ol>
          <div className="mt-4 p-3 bg-muted rounded-md text-xs">
            <strong>提示:</strong> 每批上传 {BATCH_SIZE} 条数据，大文件可能需要几分钟。上传过程中请勿关闭页面。
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
