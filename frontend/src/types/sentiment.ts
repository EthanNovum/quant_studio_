// Zhihu/Sentiment related types

export interface ZhihuContent {
  content_id: string
  content_type: string
  title: string
  content_text: string | null
  content_url: string | null
  created_time: number
  voteup_count: number
  comment_count: number
  author_id: string | null
  author_name: string | null
  author_avatar: string | null
  is_tagged: number
  related_stocks: string[] | null
}

export interface ZhihuContentListResponse {
  items: ZhihuContent[]
  total: number
  page: number
  page_size: number
}

export interface ZhihuCreator {
  user_id: string
  url_token: string
  user_nickname: string
  user_avatar: string | null
  user_link: string | null
  fans: number
  follows: number
  answer_count: number
  article_count: number
  voteup_count: number
  is_active: number
  last_crawled_at: string | null
  created_at: string
}

export interface SentimentMarker {
  date: string
  count: number
  titles: string[]
  article_ids: string[]
  is_weekend: boolean  // True if any article was published on weekend
}

export interface SentimentMarkersResponse {
  symbol: string
  markers: SentimentMarker[]
}

export interface StockWithAliases {
  symbol: string
  name: string
  aliases: string[]
}

export interface SyncStatus {
  is_running: boolean
  current_task: string | null
  progress: number | null
  last_sync_at: string | null
  log_output: string | null
}

export interface ArticleTimeRange {
  oldest_time: number | null
  newest_time: number | null
  oldest_date: string | null
  newest_date: string | null
  total_count: number
}

export interface CrawlTimeRangeRequest {
  start_date?: string | null
  end_date?: string | null
  creator_ids?: string[] | null
}
