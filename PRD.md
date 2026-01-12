# 产品需求文档 (PRD) - AlphaNote v1.0

| **版本** | **日期**   | **修改人**  | **备注**                             |
| -------- | ---------- | ----------- | ------------------------------------ |
| v1.0     | 2026-01-12 | PM (Gemini) | 初始版本，确立离线优先架构与核心模块 |

## 1. 产品概述 (Product Overview)

Quant Studio 是一款面向个人投资者的桌面端优先 (Desktop-first) 的量化投研与复盘 Web 应用。

它旨在解决通用券商软件“重交易、轻复盘”的痛点，提供基于本地数据库的高性能选股器、个性化交易日记以及自动化的持仓盈亏分析功能。

## 2. 技术架构 (Technical Architecture)

采用 **“离线优先 (Offline-First)”** 策略，确保页面秒开，杜绝 API 频次限制导致的卡顿。

- **数据层 (Data Layer):**
  - **数据库:** SQLite (单文件，易备份，高性能)。
  - **数据源:** AkShare (主要)，模拟雪球 API (补充个股详情)。
  - **更新机制:** Python 脚本 (`update_data.py`) + Crontab 定时任务 + 状态文件 (`progress.json`)。
- **后端/API层 (Backend):**
  - 轻量级 Node.js/Python 服务，仅负责读取 SQLite 数据并以 API 形式返回给前端。**严禁**后端在 API 请求中实时爬取外部数据。
- **前端 (Frontend):**
  - React + TypeScript。
  - 图表库: Lightweight-charts (K线) + ECharts (统计)。

------

## 3. 功能模块详解 (Functional Specifications)

### 3.1 全局导航与布局 (Global Layout)

- **侧边栏 (Sidebar):**
  - 位置：左侧固定。
  - 功能：支持展开/收起（折叠后仅显示图标）。
  - **菜单项：**
    1. 仪表盘 (Dashboard /)
    2. 自选股 (Watchlist /watchlist)
    3. 选股器 (Screener /screener)
    4. 交易复盘 (Trade Review /trade_review) **[NEW]**
    5. 搜索 (Search /search) **[独立页面]**
- **通知系统:**
  - 全局右上角 Toast 通知。
  - 数据更新时，显示**数字进度条**（例：`正在更新数据: 22/150`）。

### 3.2 模块：交易与复盘 (/trade_review) **[核心]**

- **功能目标:** 记录每一笔操作，系统自动计算持仓和成本，替代 Excel。
- **输入端 (Transaction Entry):**
  - **新建记录表单:**
    - `Date`: 日期（默认当天）。
    - `Symbol`: 股票代码（支持模糊搜索）。
    - `Action`: Buy / Sell / Dividend。
    - `Price`: 价格（自动读取 DB 中该股最新收盘价作为默认值，可修改）。
    - `Quantity`: 数量。
    - `Reason`: 交易理由/笔记（支持 Markdown）。
- **逻辑端 (Logic - Auto Calc):**
  - **持仓计算:** 实时遍历流水表，聚合计算 `Current Position`。
  - **成本计算:** 采用**移动加权平均法 (Moving Average Cost)**。
    - *公式:* 新成本 = (旧持仓 * 旧成本 + 新买入量 * 新买入价) / (旧持仓 + 新买入量)。
    - *注:* 卖出操作不改变剩余持仓的单位成本，仅产生“已实现盈亏”。
- **展示端 (UI):**
  - **当前持仓卡片 (Active Positions):** 表格展示 `代码`、`名称`、`持仓量`、`平均成本`、`现价`、`浮动盈亏`、`浮动盈亏率`。
  - **交易流水 (History):** 按时间倒序排列的历史操作记录。

### 3.3 模块：选股器 (/screener)

- **筛选逻辑:** 基于本地 SQLite 数据进行过滤，速度毫秒级。
- **功能要点:**
  - **进度反馈:** 当后台脚本运行时，前端轮询 `progress.json`，在页面顶部显示真实进度（如 `22/99`）。
  - **保存筛选 (Save Filter):** 将当前筛选条件保存为“策略”，支持重命名。
  - **结果列表:** 包含 `代码`、`名称`、`现价`、`涨跌幅`、`行业`。点击跳转至 `/search/:symbol`。
  - **负面清单过滤:** 增加开关 `Exclude Negative`。开启后，自动剔除 ROE < 5% 或在“黑名单”中的股票。

### 3.4 模块：自选股 (/watchlist)

- **分组管理:**
  - 支持创建文件夹（如：ETF、白马股、投机）。
  - 支持拖拽排序。
  - 删除文件夹需二次确认弹窗。
- **数据展示:**
  - K线图上方固定展示详细指标：`今开`、`最高`、`最低`、`换手率`、`市盈率(TTM)`、`均价`、`成交量/额`、`市值`、`ROE`。
  - **负面标签:** 若该股 ROE < 5% 或连亏3年，在名称旁显示红色 `DANGER` 标签，悬停显示原因。

### 3.5 模块：搜索 (/search)

- **独立页面:** 拥有巨大的搜索框，居中显示。
- **详情展示:**
  - 点击搜索结果后，进入详情页 `/search/:symbol`。
  - **基础信息:** 调用 AkShare (模拟雪球接口) 获取 `公司全名`、`地区`、`实控人`、`电话`、`主营业务`。
  - 如果本地库中没有该股的基础信息，显示“数据待下次月度更新同步”。

------

## 4. 数据策略与后端脚本 (Data Strategy)

### 4.1 数据库设计 (SQLite Schema)

建议表结构，确保覆盖所有需求：

1. **`stock_basic`** (静态信息): `symbol` (PK), `name`, `industry`, `roe`, `controller`, `description`, `listing_date`.
2. **`daily_quotes`** (行情数据): `symbol`, `date`, `open`, `high`, `low`, `close`, `volume`, `turnover`, `pe`, `pb`, `market_cap`.
3. **`transactions`** (用户交易): `id`, `symbol`, `action`, `price`, `quantity`, `date`, `reason`, `commission`.
4. **`saved_screeners`** (筛选策略): `id`, `name`, `criteria_json`, `created_at`.

### 4.2 智能更新脚本 (`scripts/update_data.py`)

这是系统的核心引擎，需接受参数控制行为。

- **依赖库:** `akshare`, `sqlite3`, `pandas`.
- **运行模式 (Modes):**
  - `--mode daily`:
    - 检查 `ak.tool_trade_date_hist_sina()`。非交易日直接退出。
    - 更新自选股 + 全市场(可选) 的 K线数据。
    - 更新每日指标 (PE/PB/MarketCap)。
    - **写入进度:** 每处理一只股票，更新 `/tmp/update_progress.json`。
  - `--mode monthly`:
    - 更新 `stock_basic` 表 (ROE、实控人、行业)。
- **输出日志:** 所有操作记录至 `logs/update.log`。

### 4.3 自动化配置 (Automation)

用户需在 macOS 终端配置 Crontab：

Bash

```
# 每日 17:05 (A股收盘后) 运行脚本
5 17 * * 1-5 /path/to/project/scripts/update_data.sh
```

**`update_data.sh` 逻辑:**

1. 运行 `python update_data.py --mode daily`。
2. `if [ $(date +%d) -eq 01 ]; then python update_data.py --mode monthly; fi` (每月1号加更基础信息)。

------

## 5. UI/UX 规范 (Design Guidelines)

- **配色:** 默认深色模式 (Dark Mode)，适配夜间复盘场景。
  - 上涨: 红 / 下跌: 绿 (符合 A 股习惯)。
  - 警示/负面: 鲜艳红色背景 + 白色文字。
- **交互:**
  - **无光标干扰:** 图表上方的文字信息固定高度，不因鼠标移开而消失或跳动。
  - **编辑器:** Markdown 编辑器需简洁，支持粘贴截图。

------

## 6. 下一步开发计划 (Next Steps)

1. **Phase 1 (后端优先):** 编写 `update_data.py` 和 SQLite 建表脚本，手动运行测试数据抓取是否正常。
2. **Phase 2 (复盘模块):** 开发 `/trade_review` 页面，实现记账和持仓自动计算逻辑。
3. **Phase 3 (选股与搜索):** 改造 `/screener` 进度条，迁移 `/search` 为独立页面并对接详情数据。
4. **Phase 4 (UI 细节):** 统一 Sidebar 样式，添加负面清单高亮逻辑。