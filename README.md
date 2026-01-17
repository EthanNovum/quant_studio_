# AlphaNote 数据更新脚本

## 概述

`scraper.py` 是 AlphaNote 的数据更新脚本，位于 `backend/` 目录下，使用 AkShare 从网络获取 A 股市场数据（包括股票、ETF、LOF 基金）并存储到本地 SQLite 数据库。

## 依赖

```bash
pip install akshare pandas
```

或使用 uv:

```bash
uv pip install akshare pandas
```

## 使用方法

### 基本命令

```bash
# 进入 backend 目录
cd backend

# 查看帮助信息
python scraper.py --help

# 更新股票基本信息（建议每月运行一次）
python scraper.py --mode monthly

# 更新行情数据（默认获取最近1年数据）
python scraper.py --mode daily
```

### 参数说明

| 参数      | 类型 | 默认值 | 说明                                                         |
| --------- | ---- | ------ | ------------------------------------------------------------ |
| `--mode`  | 必填 | -      | 更新模式：`daily`（行情数据）或 `monthly`（基本信息）        |
| `--type`  | 可选 | stock  | 资产类型：`stock`（股票）、`etf`、`lof`、`all`（全部），仅用于 `--mode monthly` |
| `--years` | 可选 | 1      | 获取多少年的历史数据，仅用于 `--mode daily`                  |
| `--start` | 可选 | -      | 起始日期，格式 YYYYMMDD，优先级高于 `--years`，仅用于 `--mode daily` |
| `--all`   | 可选 | False  | 更新所有资产（而非仅自选股），仅用于 `--mode daily`          |
| `--limit` | 可选 | -      | 限制更新的数量，两种模式都可用                               |
| `--force` | 可选 | False  | 强制更新，忽略交易日检查，仅用于 `--mode daily`              |

### 示例

#### 更新基本信息（monthly 模式）

```bash
# 更新所有股票的基本信息
python scraper.py --mode monthly

# 只更新前100只股票（用于测试）
python scraper.py --mode monthly --limit 100

# 更新 ETF 基金基本信息
python scraper.py --mode monthly --type etf

# 更新 LOF 基金基本信息
python scraper.py --mode monthly --type lof

# 更新所有资产（股票 + ETF + LOF）
python scraper.py --mode monthly --type all

# 更新 ETF，但只更新前50只（用于测试）
python scraper.py --mode monthly --type etf --limit 50

# 更新所有资产，每种类型限制100只
python scraper.py --mode monthly --type all --limit 100
```

#### 更新行情数据（daily 模式）

```bash
# 更新自选股最近1年的行情数据（默认）
python scraper.py --mode daily

# 更新自选股最近3年的行情数据
python scraper.py --mode daily --years 3

# 更新【所有资产】最近1年的行情数据（包括股票、ETF、LOF）
python scraper.py --mode daily --all

# 更新【所有资产】最近5年的行情数据
python scraper.py --mode daily --all --years 5

# 更新【所有资产】但限制前500只
python scraper.py --mode daily --all --limit 500

# 从指定日期开始更新（从2020年1月1日至今）
python scraper.py --mode daily --start 20200101

# 强制更新（即使今天不是交易日）
python scraper.py --mode daily --years 2 --force

# 组合使用：更新所有资产5年数据，强制运行
python scraper.py --mode daily --all --years 5 --force
```

### 使用 uv 运行

如果你使用 uv 管理 Python 环境：

```bash
# 进入 backend 目录
cd backend

# 更新3年行情数据
uv run python scraper.py --mode daily --years 3

# 更新股票基本信息
uv run python scraper.py --mode monthly

# 更新 ETF 基本信息
uv run python scraper.py --mode monthly --type etf

# 更新所有资产基本信息
uv run python scraper.py --mode monthly --type all
```

## 更新模式说明

### daily 模式

- 更新资产的每日行情数据（开盘价、收盘价、最高价、最低价、成交量等）
- **默认行为**：只更新自选股列表中的资产，如果自选股为空则更新前100只
- **使用 `--all`**：更新 `stock_basic` 表中的所有资产（股票、ETF、LOF）
- **使用 `--limit`**：配合 `--all` 使用，限制更新的数量
- 默认只在交易日运行，非交易日会跳过（使用 `--force` 可强制运行）
- 数据存储在 `daily_quotes` 表中
- **自动识别资产类型**：脚本会根据 `asset_type` 字段自动选择正确的 API

### monthly 模式

- 更新资产的基本信息
- **股票**：行业、ROE、实际控制人、上市日期等
- **ETF/LOF**：代码、名称
- 使用 `--type` 参数选择要更新的资产类型：
  - `stock`（默认）：约 5000+ 只 A 股
  - `etf`：约 1300+ 只 ETF 基金
  - `lof`：约 400 只 LOF 基金
  - `all`：全部资产
- 数据存储在 `stock_basic` 表中
- 建议每月运行一次

## 支持的资产类型

| 类型  | 说明             | 数量   | 代码特征                                                 |
| ----- | ---------------- | ------ | -------------------------------------------------------- |
| stock | A 股股票         | ~5000+ | 000xxx, 002xxx, 300xxx, 600xxx, 601xxx, 603xxx 等        |
| etf   | 交易型开放式基金 | ~1300+ | 51xxxx, 56xxxx, 58xxxx (沪), 15xxxx, 16xxxx, 18xxxx (深) |
| lof   | 上市型开放式基金 | ~400   | 501xxx, 160xxx, 161xxx, 162xxx 等                        |

## 数据存储

- 数据库位置：`backend/data/alphanote.db`
- 更新进度文件：`backend/data/progress.json`
- 日志文件：`backend/data/update.log`

## 进度监控

脚本运行时会将进度写入 `backend/data/progress.json`，前端可以通过 API (`GET /api/progress`) 获取更新进度。

进度文件格式：

```json
{
  "is_running": true,
  "mode": "daily",
  "current": 50,
  "total": 100,
  "current_symbol": "510300",
  "started_at": "2025-01-13T10:00:00",
  "updated_at": "2025-01-13T10:05:00"
}
```

## 常见问题

### Q: 为什么 daily 模式没有运行？

A: 默认情况下，daily 模式只在交易日运行。如果今天不是交易日，脚本会跳过。使用 `--force` 参数可以强制运行：

```bash
python scraper.py --mode daily --force
```

### Q: 如何只更新特定时间段的数据？

A: 使用 `--start` 参数指定起始日期：

```bash
# 从2022年1月1日开始更新
python scraper.py --mode daily --start 20220101
```

### Q: 如何添加 ETF 到数据库？

A: 先更新 ETF 基本信息，然后更新行情数据：

```bash
# 第一步：添加 ETF 到 stock_basic 表
python scraper.py --mode monthly --type etf

# 第二步：更新行情数据（需要先把 ETF 加入自选股，或使用 --all）
python scraper.py --mode daily --all --force
```

### Q: 更新很慢怎么办？

A: 由于数据来源限制，更新速度取决于网络和 AkShare 的请求频率限制。建议：

1. 使用 `--limit` 参数先测试少量资产
2. 在网络良好的环境下运行
3. 考虑在服务器上使用 crontab 定时运行

### Q: 数据库不存在怎么办？

A: 先运行初始化脚本：

```bash
python init_db.py
```

## 定时任务配置（可选）

可以使用 crontab 配置定时更新：

```bash
# 编辑 crontab
crontab -e

# 每天下午6点更新行情数据
0 18 * * * cd /path/to/alphanote/backend && python scraper.py --mode daily

# 每月1号凌晨2点更新股票基本信息
0 2 1 * * cd /path/to/alphanote/backend && python scraper.py --mode monthly

# 每月1号凌晨3点更新 ETF 基本信息
0 3 1 * * cd /path/to/alphanote/backend && python scraper.py --mode monthly --type etf

# 每月1号凌晨4点更新 LOF 基本信息
0 4 1 * * cd /path/to/alphanote/backend && python scraper.py --mode monthly --type lof
```