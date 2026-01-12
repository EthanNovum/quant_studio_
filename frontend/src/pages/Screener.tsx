import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, Play, Save } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  executeScreener,
  getIndustries,
  getSavedScreeners,
  saveScreener,
  deleteScreener,
  type FilterCriteria,
  type ScreenerResult,
} from '@/services/screenerApi'
import { useToastStore } from '@/store'
import { formatNumber } from '@/lib/utils'

export default function Screener() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { addToast } = useToastStore()

  const [peMin, setPeMin] = useState('')
  const [peMax, setPeMax] = useState('')
  const [pbMin, setPbMin] = useState('')
  const [pbMax, setPbMax] = useState('')
  const [roeMin, setRoeMin] = useState('')
  const [selectedIndustry, setSelectedIndustry] = useState<string>('')
  const [excludeNegative, setExcludeNegative] = useState(false)
  const [results, setResults] = useState<ScreenerResult[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isSaveOpen, setIsSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')

  const { data: industries } = useQuery({
    queryKey: ['industries'],
    queryFn: getIndustries,
  })

  const { data: savedScreeners } = useQuery({
    queryKey: ['screeners'],
    queryFn: getSavedScreeners,
  })

  const executeMutation = useMutation({
    mutationFn: executeScreener,
    onSuccess: (data) => {
      setResults(data.results)
      setTotalCount(data.total)
    },
    onError: () => {
      addToast({ title: '筛选失败', variant: 'destructive' })
    },
  })

  const saveMutation = useMutation({
    mutationFn: ({ name, criteriaJson }: { name: string; criteriaJson: string }) => saveScreener(name, criteriaJson),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screeners'] })
      setIsSaveOpen(false)
      setSaveName('')
      addToast({ title: '策略已保存' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteScreener,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screeners'] })
      addToast({ title: '策略已删除' })
    },
  })

  const buildFilters = (): FilterCriteria[] => {
    const filters: FilterCriteria[] = []

    if (peMin) {
      filters.push({ field: 'pe_ttm', operator: '>=', value: parseFloat(peMin) })
    }
    if (peMax) {
      filters.push({ field: 'pe_ttm', operator: '<=', value: parseFloat(peMax) })
    }
    if (pbMin) {
      filters.push({ field: 'pb', operator: '>=', value: parseFloat(pbMin) })
    }
    if (pbMax) {
      filters.push({ field: 'pb', operator: '<=', value: parseFloat(pbMax) })
    }
    if (roeMin) {
      filters.push({ field: 'roe', operator: '>=', value: parseFloat(roeMin) })
    }
    if (selectedIndustry) {
      filters.push({ field: 'industry', operator: '=', value: selectedIndustry })
    }

    return filters
  }

  const handleExecute = () => {
    const filters = buildFilters()
    executeMutation.mutate({
      filters,
      exclude_negative: excludeNegative,
    })
  }

  const handleSave = () => {
    if (!saveName) return
    const criteriaJson = JSON.stringify({
      pe_min: peMin,
      pe_max: peMax,
      pb_min: pbMin,
      pb_max: pbMax,
      roe_min: roeMin,
      industry: selectedIndustry,
      exclude_negative: excludeNegative,
    })
    saveMutation.mutate({ name: saveName, criteriaJson })
  }

  const loadScreener = (criteriaStr: string) => {
    try {
      const criteria = JSON.parse(criteriaStr)
      setPeMin(criteria.pe_min || '')
      setPeMax(criteria.pe_max || '')
      setPbMin(criteria.pb_min || '')
      setPbMax(criteria.pb_max || '')
      setRoeMin(criteria.roe_min || '')
      setSelectedIndustry(criteria.industry || '')
      setExcludeNegative(criteria.exclude_negative || false)
    } catch {
      addToast({ title: '加载失败', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">选股器</h1>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Filters */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>筛选条件</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>市盈率 (PE) 最小</Label>
                  <Input
                    type="number"
                    placeholder="不限"
                    value={peMin}
                    onChange={(e) => setPeMin(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>市盈率 (PE) 最大</Label>
                  <Input
                    type="number"
                    placeholder="不限"
                    value={peMax}
                    onChange={(e) => setPeMax(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>ROE 最小 (%)</Label>
                  <Input
                    type="number"
                    placeholder="不限"
                    value={roeMin}
                    onChange={(e) => setRoeMin(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>市净率 (PB) 最小</Label>
                  <Input
                    type="number"
                    placeholder="不限"
                    value={pbMin}
                    onChange={(e) => setPbMin(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>市净率 (PB) 最大</Label>
                  <Input
                    type="number"
                    placeholder="不限"
                    value={pbMax}
                    onChange={(e) => setPbMax(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>行业</Label>
                  <Select value={selectedIndustry || '__all__'} onValueChange={(v) => setSelectedIndustry(v === '__all__' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="全部行业" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">全部行业</SelectItem>
                      {industries?.map((ind) => (
                        <SelectItem key={ind} value={ind}>
                          {ind}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={excludeNegative} onCheckedChange={setExcludeNegative} />
                  <Label>排除负面清单</Label>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleExecute} disabled={executeMutation.isPending}>
                  <Play className="mr-2 h-4 w-4" />
                  {executeMutation.isPending ? '筛选中...' : '执行筛选'}
                </Button>
                <Button variant="outline" onClick={() => setIsSaveOpen(true)}>
                  <Save className="mr-2 h-4 w-4" />
                  保存策略
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          {results.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>筛选结果 ({totalCount})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>代码</TableHead>
                      <TableHead>名称</TableHead>
                      <TableHead>行业</TableHead>
                      <TableHead className="text-right">ROE</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((stock) => (
                      <TableRow
                        key={stock.symbol}
                        className="cursor-pointer"
                        onClick={() => navigate(`/search/${stock.symbol}`)}
                      >
                        <TableCell className="font-medium">{stock.symbol}</TableCell>
                        <TableCell>{stock.name}</TableCell>
                        <TableCell>{stock.industry || '-'}</TableCell>
                        <TableCell className="text-right">
                          {stock.roe !== null && stock.roe !== undefined ? `${stock.roe.toFixed(2)}%` : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Saved screeners */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>已保存策略</CardTitle>
            </CardHeader>
            <CardContent>
              {!savedScreeners?.length ? (
                <div className="py-4 text-center text-sm text-muted-foreground">暂无保存的策略</div>
              ) : (
                <div className="space-y-2">
                  {savedScreeners.map((screener) => (
                    <div
                      key={screener.id}
                      className="flex items-center justify-between rounded-lg border border-border p-2"
                    >
                      <button
                        className="flex-1 text-left text-sm hover:text-primary"
                        onClick={() => loadScreener(screener.criteria_json)}
                      >
                        {screener.name}
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => deleteMutation.mutate(screener.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Save dialog */}
      <Dialog open={isSaveOpen} onOpenChange={setIsSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>保存策略</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="策略名称"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={!saveName || saveMutation.isPending}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
