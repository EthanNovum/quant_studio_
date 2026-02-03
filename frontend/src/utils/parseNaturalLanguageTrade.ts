/**
 * 解析自然语言交易记录
 * 例如: "今天买入纳指科技ETF 300份,成交价3.293"
 *       "周三卖出宏桥股份8手,成交价18块2毛"
 */

export interface ParsedTrade {
  stockName?: string
  action?: 'BUY' | 'SELL' | 'DIVIDEND' | 'BONUS'
  price?: number
  quantity?: number
  date?: string
}

// 解析日期
function parseDate(text: string): string | undefined {
  const today = new Date()

  // 今天
  if (/今天|今日/.test(text)) {
    return today.toISOString().split('T')[0]
  }

  // 昨天
  if (/昨天|昨日/.test(text)) {
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    return yesterday.toISOString().split('T')[0]
  }

  // 前天
  if (/前天/.test(text)) {
    const dayBeforeYesterday = new Date(today)
    dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2)
    return dayBeforeYesterday.toISOString().split('T')[0]
  }

  // 周一到周日
  const weekDays: Record<string, number> = {
    '周一': 1, '星期一': 1,
    '周二': 2, '星期二': 2,
    '周三': 3, '星期三': 3,
    '周四': 4, '星期四': 4,
    '周五': 5, '星期五': 5,
    '周六': 6, '星期六': 6,
    '周日': 0, '星期日': 0, '周天': 0, '星期天': 0,
  }

  for (const [dayName, dayNum] of Object.entries(weekDays)) {
    if (text.includes(dayName)) {
      const currentDay = today.getDay()
      let diff = dayNum - currentDay
      // 如果是未来的日子，取上周的
      if (diff > 0) {
        diff -= 7
      }
      const targetDate = new Date(today)
      targetDate.setDate(targetDate.getDate() + diff)
      return targetDate.toISOString().split('T')[0]
    }
  }

  // 匹配具体日期格式: 1月5日, 1-5, 1/5, 2024年1月5日, 2024-1-5
  const datePatterns = [
    /(\d{4})年(\d{1,2})月(\d{1,2})日?/,
    /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/,
    /(\d{1,2})月(\d{1,2})日?/,
    /(\d{1,2})[\/\-](\d{1,2})/,
  ]

  for (const pattern of datePatterns) {
    const match = text.match(pattern)
    if (match) {
      if (match.length === 4) {
        // 有年份
        const year = parseInt(match[1])
        const month = parseInt(match[2])
        const day = parseInt(match[3])
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      } else if (match.length === 3) {
        // 无年份，使用今年
        const month = parseInt(match[1])
        const day = parseInt(match[2])
        const year = today.getFullYear()
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      }
    }
  }

  return undefined
}

// 解析操作类型
function parseAction(text: string): 'BUY' | 'SELL' | 'DIVIDEND' | 'BONUS' | undefined {
  if (/买入|买了|购入|购买|加仓|建仓|抄底/.test(text)) {
    return 'BUY'
  }
  if (/卖出|卖了|出售|清仓|减仓|抛售|止损|止盈/.test(text)) {
    return 'SELL'
  }
  if (/分红|派息|派发/.test(text)) {
    return 'DIVIDEND'
  }
  if (/红股|送股|转增/.test(text)) {
    return 'BONUS'
  }
  return undefined
}

// 解析价格
function parsePrice(text: string): number | undefined {
  // 匹配: 成交价3.293, 价格3.293, 3.293元, @3.293
  // 也匹配: 18块2毛, 18块2, 18.2元

  // 先尝试匹配 "X块X毛X分" 格式
  const chineseMoneyPattern = /(\d+)块(?:(\d)毛?)?(?:(\d)分?)?/
  const chineseMatch = text.match(chineseMoneyPattern)
  if (chineseMatch) {
    let price = parseInt(chineseMatch[1])
    if (chineseMatch[2]) {
      price += parseInt(chineseMatch[2]) * 0.1
    }
    if (chineseMatch[3]) {
      price += parseInt(chineseMatch[3]) * 0.01
    }
    return price
  }

  // 匹配: X毛X分 (无块)
  const jiaoFenPattern = /(\d)毛(?:(\d)分?)?/
  const jiaoFenMatch = text.match(jiaoFenPattern)
  if (jiaoFenMatch && !chineseMatch) {
    let price = parseInt(jiaoFenMatch[1]) * 0.1
    if (jiaoFenMatch[2]) {
      price += parseInt(jiaoFenMatch[2]) * 0.01
    }
    return price
  }

  // 匹配标准价格格式
  const pricePatterns = [
    /(?:成交价|价格|单价|@|＠)\s*(\d+(?:\.\d+)?)/,
    /(\d+(?:\.\d+)?)\s*(?:元|块|港币|美元|港元)/,
    /(?:成交|价)\s*(\d+(?:\.\d+)?)/,
  ]

  for (const pattern of pricePatterns) {
    const match = text.match(pattern)
    if (match) {
      return parseFloat(match[1])
    }
  }

  return undefined
}

// 解析数量
function parseQuantity(text: string): number | undefined {
  // 匹配: 300份, 300股, 8手, 1000单位
  // 注意: 1手 = 100股 (A股/港股), 但ETF等可能不同

  const quantityPatterns = [
    { pattern: /(\d+(?:\.\d+)?)\s*手/, multiplier: 100 },
    { pattern: /(\d+(?:\.\d+)?)\s*(?:份|股|单位)/, multiplier: 1 },
    { pattern: /(?:数量|买入?|卖出?)\s*(\d+(?:\.\d+)?)/, multiplier: 1 },
  ]

  for (const { pattern, multiplier } of quantityPatterns) {
    const match = text.match(pattern)
    if (match) {
      return parseFloat(match[1]) * multiplier
    }
  }

  return undefined
}

// 解析股票名称
function parseStockName(text: string): string | undefined {
  // 移除日期、价格、数量等已知部分后，提取股票名称
  // 股票名称通常在操作词(买入/卖出)之后

  const actionWords = /买入|买了|购入|购买|加仓|建仓|抄底|卖出|卖了|出售|清仓|减仓|抛售|止损|止盈|分红|派息|红股|送股/
  const quantityPattern = /\d+(?:\.\d+)?\s*(?:手|份|股|单位)/
  const pricePattern = /(?:成交价|价格|单价|@|＠)?\s*\d+(?:\.\d+)?(?:元|块|港币|美元|港元)?(?:\d毛)?(?:\d分)?/

  // 尝试在操作词后提取股票名称
  const actionMatch = text.match(actionWords)
  if (actionMatch) {
    const afterAction = text.slice(text.indexOf(actionMatch[0]) + actionMatch[0].length)
    // 提取到数量或价格之前的文本
    let stockName = afterAction
      .replace(quantityPattern, '')
      .replace(pricePattern, '')
      .replace(/[,，。.、\s]+/g, '')
      .trim()

    // 清理末尾的数字（可能是未匹配的数量）
    stockName = stockName.replace(/\d+$/, '').trim()

    if (stockName && stockName.length >= 2) {
      return stockName
    }
  }

  return undefined
}

// 主解析函数
export function parseNaturalLanguageTrade(text: string): ParsedTrade {
  const result: ParsedTrade = {}

  result.date = parseDate(text)
  result.action = parseAction(text)
  result.price = parsePrice(text)
  result.quantity = parseQuantity(text)
  result.stockName = parseStockName(text)

  return result
}
