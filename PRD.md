# 产品需求文档 (PRD) - DangInvest (v1.0 Release)

| **项目名称** | **DangInvest (AlphaNote + ZhihuInsight)**                |
| ------------ | -------------------------------------------------------- |
| **版本**     | v1.0                                                     |
| **日期**     | 2026-01-25                                               |
| **状态**     | 开发中                                                   |
| **技术栈**   | Electron, React, Python (Local Scripts), AkShare, SQLite |

------

## 1. 产品概述 (Product Overview)

### 1.1 背景

当前个人投资者面临“数据孤岛”问题：定量的行情分析（K线、指标）与定性的舆情分析（知乎大V观点、研报）通常在不同的软件中进行。用户难以直观地将“股价异动”与“当时的舆论归因”对应起来。

### 1.2 产品定位

**DangInvest** 是一款**离线优先 (Offline-First)** 的桌面端投研复盘工具。它不依赖外部服务器，所有数据存储在用户本地。它通过 Python 脚本自动化采集清洗知乎舆情数据，并利用 ECharts 将其精准锚定在个股 K 线图上，帮助用户进行事件驱动分析。

### 1.3 核心价值

1. **归因可视化**：在 K 线图上直接看到某天对应的市场观点。
2. **自动化采集**：一键同步关注的知乎大V文章，建立本地知识库。
3. **智能关联**：通过别名系统，自动将非标准化的股票称呼（如“宁王”）关联到代码。

------

## 2. 技术架构 (Technical Architecture)

系统采用 **Electron 双进程架构**，后端逻辑由本地 Python 脚本/微服务承担。

- **应用壳 (Shell):** Electron (负责窗口管理、原生菜单、系统通知)。
- **前端 (Renderer):** React + TypeScript + **ECharts** (K线/散点图) + TailwindCSS。
- **数据层 (Data & Logic):**
  - **Python Runtime:** 被 Electron 调用的子进程。
  - **Crawler:** Playwright (处理知乎动态渲染)。
  - **Market Data:** AkShare (A股数据源)。
  - **Database:** SQLite (双库模式)。
    - `alpha_data.db`: 存储股票基础信息、行情、别名表。
    - `zhihu_data.db`: 存储爬取的文章、评论、文章-股票关联表。

------

## 3. 功能模块详解 (Functional Specifications)

### 3.1 模块 A: 全局设置与数据管理 (Settings & Data)

此模块是系统的“发动机”，负责数据的获取与定义。

#### A1. 股票别名管理 (Stock Alias Management)

- **需求描述:** 维护一份“代码-别名”映射表，用于提高 NLP 匹配的召回率。
- **功能点:**
  - **别名列表:** 表格展示 `代码` | `名称` | `别名(Tags)`。
  - **新增/编辑:** 弹窗支持搜索股票，添加自定义标签（如：`600519` -> `["茅台", "酱香科技"]`）。
  - **数据存储:** 写入 `alpha_data.db` 的 `stock_aliases` 表。

#### A2. 爬虫配置 (Crawler Config)

- **需求描述:** 管理知乎数据源。
- **功能点:**
  - **监控列表:** 添加/删除知乎用户主页 URL。
  - **Cookie 管理:** 唤起内置浏览器窗口进行扫码登录，保存 Cookie 至本地。
  - **同步策略:** 勾选 `仅更新最近30天` 或 `全量更新`。

#### A3. 数据同步中心 (Sync Center)

- **需求描述:** 手动触发 Python 脚本进行数据更新。
- **操作流:**
  1. 点击“同步行情” -> 调用 `update_market_data.py` (AkShare)。
  2. 点击“同步舆情” -> 调用 `crawler_main.py` (Playwright)。
  3. 点击“执行清洗” -> 调用 `tag_articles.py` (正则+别名匹配)。
- **UI 反馈:** 界面显示终端日志输出 (Stdout) 和进度条。

------

### 3.2 模块 B: 舆情仪表盘 (Sentiment Dashboard)

对应截图中的“文章列表”页，作为日常浏览入口。

- **路由:** `/sentiment`
- **布局:** 瀑布流卡片 (Masonry Layout)。
- **卡片内容:**
  - **Header:** 标题、发布日期、作者头像。
  - **Body:** 摘要（高亮显示匹配到的股票关键词）。
  - **Footer:** **关联股票标签** (e.g., `宝丰能源`, `化工`)。
- **交互:**
  - 点击“关联股票标签” -> 跳转至 **模块 C (个股详情页)**。
  - 点击卡片主体 -> 侧边栏滑出文章详情阅读。

------

### 3.3 模块 C: 个股 K 线与舆情锚点 (Stock Detail & K-Line) **[核心]**

对应截图中的个股详情页，是定量与定性结合的核心界面。

- **路由:** `/stock/:symbol`
- **UI 布局:**
  - **顶部:** 股票基础信息 (现价, 涨跌幅, PE/PB)。
  - **中部 (Main):** **ECharts K线图**。
  - **底部/右侧:** 历史文章列表 (该股相关的所有文章)。

#### C1. ECharts 图表配置 (The Visualization)

- **图表类型:** 组合图 (Candlestick + Line + Scatter)。
- **Grid 0 (主图):**
  - **Series[0] (K线):** 日线数据 (Open, Close, Low, High)。
  - **Series[1-3] (均线):** MA5, MA10, MA20。
  - **Series[4] (舆情锚点/Scatter):**
    - **X轴:** 文章发布日期。
    - **Y轴:** 当日 `High` * 1.05 (显示在K线上方) 或固定在图表顶部。
    - **Symbol:** 气泡图标或自定义 SVG。
    - **ItemStyle:** 颜色区分情感（若有）或默认知乎蓝。
- **交互 (Tooltip):**
  - 鼠标悬停在 Scatter 点上，触发自定义 `formatter`。
  - **展示内容:** HTML 浮层，列出当日所有相关文章标题。
  - **点击行为:** 点击 Scatter 点，右侧面板自动滚动到对应的文章位置。

#### C2. 周末/非交易日处理

- **逻辑:** 若文章发布于周六/周日，K 线图中不存在该 X 轴坐标。
- **策略:** 在数据清洗阶段 (`tag_articles.py`)，将 `display_date` 字段吸附到**前一个交易日(周五)**，并在 Tooltip 中标注“发布于周末”。

------

## 4. 数据架构 (Database Schema)

基于 SQLite，拆分为两个文件。

### 4.1 主数据库 (`alpha_data.db`)

*原有 AlphaNote 结构 + 新增表*

SQL

```
-- 股票基础表
CREATE TABLE stock_basic (
    symbol TEXT PRIMARY KEY, 
    name TEXT, 
    industry TEXT
);

-- 股票别名表 [NEW]
CREATE TABLE stock_aliases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    alias TEXT NOT NULL, -- 例如 "宁王"
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(symbol) REFERENCES stock_basic(symbol)
);

-- 日线行情表
CREATE TABLE daily_quotes (
    symbol TEXT,
    date TEXT,
    open REAL, high REAL, low REAL, close REAL, volume REAL,
    PRIMARY KEY (symbol, date)
);
```

### 4.2 舆情数据库 (`zhihu_data.db`)

*原有 MediaCrawler 结构 + 关联表*

SQL

```
-- 知乎内容表 (爬虫写入)
CREATE TABLE zhihu_content (
    content_id TEXT PRIMARY KEY,
    type TEXT, -- 'article' or 'answer'
    title TEXT,
    content_text TEXT,
    created_time INTEGER, -- Timestamp
    author_name TEXT,
    voteup_count INTEGER
);

-- 关联关系表 [NEW] (清洗脚本写入)
CREATE TABLE article_stock_ref (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id TEXT NOT NULL,
    stock_symbol TEXT NOT NULL,
    display_date TEXT,      -- 对齐后的交易日日期 (YYYY-MM-DD)
    original_date TEXT,     -- 原始发布日期
    match_keyword TEXT,     -- 命中的词 (如 "宁王")
    match_score INTEGER,    -- 匹配权重
    FOREIGN KEY(article_id) REFERENCES zhihu_content(content_id)
);
```

------

## 5. 接口与脚本逻辑 (API & Scripts)

Electron 通过 `child_process.spawn` 或 `exec` 调用 Python 脚本。

### 5.1 脚本：`scripts/tag_articles.py` (清洗核心)

这是连接两个数据库的桥梁。

1. **连接:** 同时连接 `alpha_data.db` 和 `zhihu_data.db`。
2. **构建字典:** 读取 `stock_basic` (代码, 名称) 和 `stock_aliases` (别名)，构建 Aho-Corasick 自动机或正则列表。
3. **遍历:** 读取 `zhihu_content` 中 `is_tagged = 0` 的新文章。
4. **匹配:** 扫描标题和正文。
   - *规则:* 标题命中权重 10，正文命中权重 1。总分 >= 2 视为有效关联。
5. **日期对齐:** 将 `created_time` 转换为日期。利用 `akshare.tool_trade_date_hist` 检查是否为交易日，若不是，向前回溯。
6. **写入:** 插入 `article_stock_ref` 表。

### 5.2 前端 API (React Hooks)

前端不直接查库，通过 Electron 的 IPC 通信调用主进程，主进程使用 `better-sqlite3` 查询本地 DB。

- `ipc.invoke('get-stock-kline', symbol)`: 返回 ECharts 所需的 OHLC 数组。

- `ipc.invoke('get-stock-sentiment-markers', symbol)`:

  - 查询 SQL:

    SQL

    ```
    SELECT display_date, count(*) as count, group_concat(title) as titles 
    FROM article_stock_ref 
    JOIN zhihu_content ON article_stock_ref.article_id = zhihu_content.content_id
    WHERE stock_symbol = ? 
    GROUP BY display_date
    ```

  - 返回格式: `[{ date: '2026-01-21', value: [high_price * 1.02], titles: [...] }]`

------

## 6. 非功能需求 (Non-functional Requirements)

1. **性能:**
   - ECharts 渲染 3年日线数据 (约 750 个点) + 50 个舆情标记点应在 200ms 内完成。
   - 本地数据库查询应建立索引 (`symbol`, `date`) 以确保毫秒级响应。
2. **离线可用性:**
   - 无网络状态下，除了“同步数据”功能不可用，其他浏览、图表交互、配置功能必须完全可用。
3. **数据隐私:**
   - 所有爬取的 Cookie 和数据仅存在用户本地 `AppData` 目录下，不上传云端。

------

## 7. 下一步开发计划 (Next Steps)

1. **Phase 1 (基础建设):** 搭建 Electron + React 框架，初始化两个 SQLite 数据库文件。
2. **Phase 2 (数据脚本):** 移植 AkShare 脚本和 Playwright 爬虫脚本，并实现 `tag_articles.py` 清洗逻辑。
3. **Phase 3 (别名系统):** 开发前端“别名管理”页面，实现后端 CRUD 逻辑。
4. **Phase 4 (可视化):** 集成 ECharts，实现 K 线与舆情锚点的叠加渲染。