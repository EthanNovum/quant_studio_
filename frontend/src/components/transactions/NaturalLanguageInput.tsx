import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { parseNaturalLanguageTrade, type ParsedTrade } from '@/utils/parseNaturalLanguageTrade'

interface NaturalLanguageInputProps {
  onParsed: (data: ParsedTrade) => void
}

export default function NaturalLanguageInput({ onParsed }: NaturalLanguageInputProps) {
  const [inputText, setInputText] = useState('')

  const handleParse = () => {
    if (!inputText.trim()) return

    const parsed = parseNaturalLanguageTrade(inputText)
    onParsed(parsed)
    setInputText('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleParse()
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <textarea
          placeholder="例: 今天买入纳指科技ETF 300份,成交价3.293"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleParse}
          disabled={!inputText.trim()}
          className="h-auto px-3 self-stretch"
        >
          <Sparkles className="h-4 w-4 mr-1" />
          解析
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        输入自然语言描述，自动解析填入表单
      </p>
    </div>
  )
}
