import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(value: number | null | undefined, decimals: number = 2): string {
  if (value === null || value === undefined) return '-'
  return value.toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

export function formatLargeNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}万亿`
  if (value >= 1e8) return `${(value / 1e8).toFixed(2)}亿`
  if (value >= 1e4) return `${(value / 1e4).toFixed(2)}万`
  return value.toLocaleString('zh-CN')
}

export function getPriceColorClass(change: number | null | undefined): string {
  if (change === null || change === undefined || change === 0) return 'price-unchanged'
  return change > 0 ? 'price-up' : 'price-down'
}

// Pinyin initial mapping for common Chinese characters used in stock names
const pinyinMap: Record<string, string> = {
  // Common stock name characters
  '阿': 'a', '安': 'a', '爱': 'a', '奥': 'a',
  '北': 'b', '博': 'b', '百': 'b', '宝': 'b', '保': 'b', '邦': 'b', '滨': 'b', '比': 'b', '渤': 'b',
  '长': 'c', '城': 'c', '创': 'c', '诚': 'c', '成': 'c', '春': 'c', '川': 'c', '楚': 'c', '晨': 'c', '超': 'c', '昌': 'c', '财': 'c', '常': 'c',
  '大': 'd', '东': 'd', '德': 'd', '达': 'd', '电': 'd', '迪': 'd', '鼎': 'd', '丹': 'd', '帝': 'd', '道': 'd',
  '恩': 'e', '尔': 'e',
  '方': 'f', '富': 'f', '凤': 'f', '飞': 'f', '丰': 'f', '福': 'f', '峰': 'f', '佛': 'f', '芳': 'f', '复': 'f', '分': 'f',
  '国': 'g', '光': 'g', '广': 'g', '贵': 'g', '高': 'g', '港': 'g', '钢': 'g', '格': 'g', '桂': 'g', '工': 'g', '冠': 'g', '股': 'g',
  '华': 'h', '海': 'h', '恒': 'h', '红': 'h', '航': 'h', '湖': 'h', '汇': 'h', '合': 'h', '浩': 'h', '杭': 'h', '沪': 'h', '环': 'h', '虹': 'h', '惠': 'h', '和': 'h', '豪': 'h', '河': 'h', '宏': 'h', '鸿': 'h', '皇': 'h', '黄': 'h', '互': 'h',
  '建': 'j', '金': 'j', '江': 'j', '京': 'j', '嘉': 'j', '佳': 'j', '晶': 'j', '杰': 'j', '锦': 'j', '久': 'j', '济': 'j', '吉': 'j', '君': 'j', '交': 'j', '精': 'j', '基': 'j', '聚': 'j', '捷': 'j', '剑': 'j',
  '凯': 'k', '康': 'k', '控': 'k', '科': 'k', '昆': 'k', '开': 'k', '矿': 'k', '快': 'k',
  '蓝': 'l', '力': 'l', '联': 'l', '龙': 'l', '隆': 'l', '乐': 'l', '利': 'l', '林': 'l', '领': 'l', '灵': 'l', '陆': 'l', '路': 'l', '绿': 'l', '兰': 'l', '立': 'l', '柳': 'l', '罗': 'l', '露': 'l', '伦': 'l',
  '美': 'm', '明': 'm', '民': 'm', '茅': 'm', '梦': 'm', '牧': 'm', '马': 'm', '满': 'm', '煤': 'm', '铭': 'm', '闽': 'm', '蒙': 'm',
  '南': 'n', '宁': 'n', '能': 'n', '农': 'n', '诺': 'n', '纳': 'n', '内': 'n', '牛': 'n',
  '欧': 'o',
  '平': 'p', '鹏': 'p', '浦': 'p', '普': 'p', '品': 'p', '飘': 'p',
  '清': 'q', '青': 'q', '齐': 'q', '启': 'q', '强': 'q', '秦': 'q', '汽': 'q', '全': 'q', '乾': 'q', '琴': 'q', '旗': 'q', '泉': 'q', '奇': 'q', '群': 'q', '前': 'q',
  '瑞': 'r', '荣': 'r', '融': 'r', '锐': 'r', '润': 'r', '日': 'r', '仁': 'r', '容': 'r', '人': 'r',
  '三': 's', '上': 's', '深': 's', '申': 's', '盛': 's', '顺': 's', '沈': 's', '双': 's', '石': 's', '苏': 's', '森': 's', '尚': 's', '世': 's', '山': 's', '水': 's', '数': 's', '晟': 's', '胜': 's', '生': 's', '神': 's', '时': 's', '圣': 's', '首': 's', '舜': 's', '思': 's', '司': 's', '松': 's', '商': 's', '实': 's', '士': 's', '氏': 's', '索': 's', '赛': 's', '四': 's',
  '天': 't', '太': 't', '同': 't', '泰': 't', '特': 't', '通': 't', '拓': 't', '腾': 't', '唐': 't', '台': 't', '铁': 't', '图': 't', '土': 't', '塔': 't',
  '万': 'w', '维': 'w', '伟': 'w', '文': 'w', '武': 'w', '物': 'w', '沃': 'w', '威': 'w', '旺': 'w', '网': 'w', '王': 'w', '温': 'w', '卫': 'w', '无': 'w', '五': 'w', '皖': 'w', '闻': 'w',
  '西': 'x', '新': 'x', '信': 'x', '鑫': 'x', '兴': 'x', '星': 'x', '祥': 'x', '欣': 'x', '雪': 'x', '讯': 'x', '先': 'x', '香': 'x', '厦': 'x', '湘': 'x', '象': 'x', '翔': 'x', '夏': 'x', '雄': 'x', '轩': 'x', '旭': 'x', '晓': 'x', '小': 'x', '学': 'x', '许': 'x', '熙': 'x',
  '云': 'y', '阳': 'y', '扬': 'y', '银': 'y', '永': 'y', '亿': 'y', '益': 'y', '友': 'y', '裕': 'y', '远': 'y', '元': 'y', '源': 'y', '雅': 'y', '燕': 'y', '药': 'y', '业': 'y', '叶': 'y', '易': 'y', '宜': 'y', '颖': 'y', '优': 'y', '悦': 'y', '越': 'y', '粤': 'y', '渝': 'y', '宇': 'y', '玉': 'y', '育': 'y', '誉': 'y', '原': 'y', '圆': 'y', '园': 'y', '月': 'y', '英': 'y', '映': 'y', '用': 'y', '油': 'y', '游': 'y', '右': 'y', '有': 'y', '耀': 'y',
  '中': 'z', '浙': 'z', '众': 'z', '正': 'z', '珠': 'z', '智': 'z', '振': 'z', '紫': 'z', '卓': 'z', '招': 'z', '兆': 'z', '展': 'z', '州': 'z', '洲': 'z', '志': 'z', '之': 'z', '致': 'z', '置': 'z', '制': 'z', '指': 'z', '纸': 'z', '至': 'z', '质': 'z', '周': 'z', '舟': 'z', '资': 'z', '子': 'z', '宗': 'z', '综': 'z', '总': 'z', '组': 'z', '祖': 'z', '钻': 'z', '庄': 'z', '装': 'z', '壮': 'z', '追': 'z', '准': 'z', '自': 'z', '足': 'z', '尊': 'z', '遵': 'z', '证': 'z', '郑': 'z', '镇': 'z', '震': 'z', '蒸': 'z', '争': 'z', '征': 'z', '政': 'z', '整': 'z', '直': 'z', '职': 'z', '植': 'z', '执': 'z', '知': 'z', '只': 'z', '值': 'z', '脂': 'z', '枝': 'z', '支': 'z', '芝': 'z', '吱': 'z', '织': 'z', '肢': 'z', '栀': 'z', '汁': 'z', '蜘': 'z'
}

/**
 * Get pinyin initials for a Chinese string
 * e.g., "贵州茅台" -> "gzmt"
 */
export function getPinyinInitials(str: string): string {
  if (!str) return ''
  return str
    .split('')
    .map((char) => {
      // If it's already a letter or number, return as-is (lowercase)
      if (/[a-zA-Z0-9]/.test(char)) return char.toLowerCase()
      // Look up in pinyin map
      return pinyinMap[char] || ''
    })
    .join('')
}

/**
 * Check if a search query matches a stock name by pinyin initials
 * e.g., matchesPinyin("贵州茅台", "gzmt") -> true
 */
export function matchesPinyin(stockName: string, query: string): boolean {
  if (!query || !stockName) return false
  const queryLower = query.toLowerCase()
  const initials = getPinyinInitials(stockName)
  return initials.includes(queryLower)
}
