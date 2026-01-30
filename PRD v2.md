

# 产品需求文档 (PRD) - DangInvest (v2.0 Release)

## 1. 产品概述 (Product Overview)

### 1.1 核心痛点与解决方案

- **痛点**：传统复盘需要手动翻阅知乎、研报，再人脑比对 K 线，效率低下且难以量化“情绪”。
- **解法**：
  1. **自动化情报**：后端自动爬取并调用 LLM API 提取核心观点与情绪分。
  2. **决策闭环**：提供专门的“当日复盘”页面，强制用户基于“数据+AI观点”做出 交易决策（买入/卖出/观望），并记录理由。

### 1.2 用户角色

- **超级管理员 (您)**：既是系统的开发者，也是唯一的深度用户。拥有所有数据的读写权限和 AI Token 的消耗权限。

------

## 2. 系统架构 (System Architecture)

系统由“展示层”和“计算层”完全分离：

1. **Frontend (Next.js)**: 负责数据可视化、复盘交互、决策录入。
2. **API Gateway (FastAPI)**: 处理前端请求，管理数据库读写。
3. **Background Worker (Celery/Redis)**:
   - **Crawler Worker**: 定时/手动触发 Playwright 爬取知乎。
   - **AI Worker**: 将爬取的文本通过 API 发送给 LLM，获取结构化数据（JSON）。
4. **Database (PostgreSQL)**: 存储结构化后的行情、文章、AI 分析结果及交易决策。

------

## 3. 核心业务流程 (Core Workflows)

### 3.1 智能化数据处理流 (The AI Pipeline)

这是本系统最核心的升级，替代了原本的 `tag_articles.py`。

1. **采集**: Crawler 抓取知乎文章/回答。

2. **清洗**: 存入临时表。

3. **AI 处理 (Async)**: Worker 调用 LLM API，Prompt 如下：

   > "阅读这篇文章，提取其中提及的A股股票代码（如无明确提及则根据别名推理），分析作者对该股的情绪（看多/看空/中性，1-10分打分），并用一句话总结核心逻辑（如：产能释放、政策利好）。返回 JSON 格式。"

4. **入库**: 将 AI 返回的 `[Symbol, Sentiment_Score, Summary, Logic_Tags]` 写入数据库。

### 3.2 当日复盘决策流 (The Daily Review Loop)

这是用户每天收盘后的核心工作流。

1. **系统准备**: 自动拉取今日 K 线 + 今日新增/更新的 AI 分析情报。
2. **用户浏览**: 进入“当日复盘”页面，系统按“情绪热度”或“持仓关联”排序股票。
3. **人工决策**: 用户阅读 AI 摘要，查看 K 线位置，点击【决策按钮】（加仓/减仓/躺平），并输入【复盘笔记】。
4. **归档**: 生成一份“当日复盘日报”。

------

## 4. 功能模块详解 (Functional Specifications)

### 4.1 模块 A: 智能驾驶舱 (Dashboard)

- **概览**: 展示今日市场整体情绪（基于爬取的所有文章的 AI 情绪打分均值）。
- **舆情异动榜**: 列出今日 AI 判定情绪分变化最大，或提及次数激增的个股。

### 4.2 模块 B: 当日复盘中心 (Daily Review Center) **[NEW & CORE]**

一个沉浸式的、类似 Tinder 的“阅后即判”工作台。

- **界面布局**:
  - **左侧 (列表)**: 待复盘股票列表（系统自动筛选：今日有新观点的 + 当前持仓的）。
  - **右侧上部 (可视化)**: 该股的 K 线图 (ECharts)，叠加今日的 AI 情绪锚点。
  - **右侧中部 (情报)**:
    - **AI 摘要**: "今日新增 3 篇观点，总体看多 (8.5分)。核心逻辑：固态电池商业化加速。"
    - **原文卡片**: 3 篇知乎文章的标题、作者、AI 提炼的“金句”。
  - **右侧底部 (操作区)**:
    - **决策按钮**: [看多/买入] [看空/卖出] [观望/Hold]
    - **笔记框**: 快速记录今日想法 (Markdown)。
    - **提交**: 点击后自动切换到左侧列表的下一只股票。

### 4.3 模块 C: 个股全景 (Stock Detail)

- **K 线舆情叠加**:
  - 与 v1.0 类似，但在 Tooltip 中不再只显示标题，而是显示 **AI Summary** 和 **Sentiment Score**。
  - **颜色编码**: 散点颜色根据 AI 情绪分渲染（红色=看多，绿色=看空，灰色=中性）。
- **历史决策回溯**: 在 K 线图上标记出你自己在“模块 B”中做出的历史决策点（买点/卖点），验证自己的判断是否准确。

### 4.4 模块 D: 知识库与配置 (Knowledge Base)

- **别名管理**: 依然保留，但在 AI 模式下，可以作为 Prompt 的一部分提示给 LLM，提高准确率。
- **Prompt 调试**: 一个专门的页面，用于调整发送给 LLM 的系统提示词（System Prompt），以优化提取效果。

------

## 5. 数据结构设计 (PostgreSQL Schema)

相比 SQLite，我们需要更规范的关系型设计。

SQL

```
-- 股票基础表
CREATE TABLE stocks (
    symbol VARCHAR(10) PRIMARY KEY, -- "600519"
    name VARCHAR(50),
    industry VARCHAR(50)
);

-- 文章源数据表
CREATE TABLE articles (
    id SERIAL PRIMARY KEY,
    source_url VARCHAR(255) UNIQUE,
    title TEXT,
    content TEXT, -- 原始内容
    author VARCHAR(50),
    publish_date DATE
);

-- AI 分析结果表 [核心]
CREATE TABLE ai_insights (
    id SERIAL PRIMARY KEY,
    article_id INT REFERENCES articles(id),
    stock_symbol VARCHAR(10) REFERENCES stocks(symbol),
    sentiment_score INT, -- 1-10
    sentiment_label VARCHAR(10), -- "Bullish", "Bearish"
    summary_text TEXT, -- "AI 总结的一句话逻辑"
    key_tags TEXT[], -- ["产能扩张", "涨价"]
    created_at TIMESTAMP DEFAULT NOW()
);

-- 用户决策/复盘表 [NEW]
CREATE TABLE user_decisions (
    id SERIAL PRIMARY KEY,
    stock_symbol VARCHAR(10) REFERENCES stocks(symbol),
    review_date DATE,
    action_type VARCHAR(20), -- "BUY", "SELL", "HOLD"
    rationale TEXT, -- 用户复盘笔记
    linked_insight_ids INT[] -- 关联了哪些 AI 观点导致了这个决策
);
```

------

## 6. 开发路线图 (Roadmap)

1. **Phase 1: 骨架搭建**
   - 初始化 Next.js + FastAPI 项目。
   - 配置 PostgreSQL 数据库。
   - 实现 AkShare 行情同步接口。
2. **Phase 2: AI 管道打通**
   - 集成 OpenAI/DeepSeek API 客户端。
   - 编写 Crawler -> API -> Database 的处理脚本。
   - 调试 Prompt，确保 AI 能准确提取股票和情绪。
3. **Phase 3: 复盘页面开发**
   - 开发“当日复盘”的高效 UI。
   - 实现决策数据的录入与存储。
4. **Phase 4: 可视化与回顾**
   - 将历史决策点和 AI 情绪点同时画在 K 线图上，形成闭环验证。

### 