# AlphaNote 部署指南

## 项目结构

```
alphanote/
├── backend/                 # FastAPI 后端
│   ├── app/                 # 应用代码
│   │   ├── routers/         # API 路由
│   │   ├── models/          # 数据库模型
│   │   ├── schemas/         # Pydantic schemas
│   │   ├── services/        # 业务逻辑
│   │   ├── config.py        # 配置
│   │   ├── database.py      # 数据库连接
│   │   └── main.py          # FastAPI 应用
│   ├── data/                # 数据文件（开发环境）
│   ├── main.py              # 入口文件
│   ├── scraper.py           # 数据爬虫脚本
│   ├── init_db.py           # 数据库初始化
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .dockerignore
├── frontend/                # Vite + React 前端
│   ├── src/
│   ├── package.json
│   ├── Dockerfile
│   └── .dockerignore
├── docker-compose.yml       # Docker 编排配置
├── nginx.conf               # Nginx 配置
└── backend_data/            # 数据持久化目录（生产环境）
```

## 本地开发

### 后端

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 初始化数据库
python init_db.py

# 运行开发服务器
uvicorn main:app --reload --port 8000
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

### 数据抓取

```bash
cd backend

# 更新股票基本信息
python scraper.py --mode monthly

# 更新 ETF 基本信息
python scraper.py --mode monthly --type etf

# 更新所有资产基本信息
python scraper.py --mode monthly --type all

# 更新行情数据
python scraper.py --mode daily --force

# 更新所有资产行情数据
python scraper.py --mode daily --all --force
```

## Docker 部署

### 1. 准备数据目录

```bash
# 创建数据持久化目录
mkdir -p backend_data

# 如果有现有数据库，复制过来
cp backend/data/alphanote.db backend_data/
```

### 2. 构建并启动

```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f
```

### 3. 初始化数据库（首次部署）

```bash
# 进入后端容器
docker exec -it alphanote-backend bash

# 初始化数据库
python init_db.py

# 导入基础数据
python scraper.py --mode monthly --type all --limit 100
```

### 4. 定时更新数据

在服务器上配置 crontab：

```bash
crontab -e

# 每天下午6点更新行情数据
0 18 * * * docker exec alphanote-backend python scraper.py --mode daily

# 每月1号凌晨2点更新基本信息
0 2 1 * * docker exec alphanote-backend python scraper.py --mode monthly --type all
```

## 环境变量

后端支持以下环境变量：

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `DATABASE_PATH` | `/app/data/alphanote.db` | SQLite 数据库路径 |
| `PROGRESS_PATH` | `/app/data/progress.json` | 进度文件路径 |
| `LOG_PATH` | `/app/data/update.log` | 日志文件路径 |

## 常用命令

```bash
# 查看运行状态
docker-compose ps

# 重启服务
docker-compose restart

# 停止服务
docker-compose down

# 查看后端日志
docker-compose logs backend

# 进入后端容器
docker exec -it alphanote-backend bash

# 进入前端容器
docker exec -it alphanote-frontend sh

# 备份数据库
docker cp alphanote-backend:/app/data/alphanote.db ./backup.db
```

## 更新部署

```bash
# 拉取最新代码
git pull

# 重新构建并部署
docker-compose build
docker-compose up -d
```

## 故障排除

### 1. 前端无法访问后端 API

检查 nginx 配置和后端健康状态：

```bash
# 检查后端是否正常运行
curl http://localhost:8000/health

# 查看 nginx 日志
docker-compose logs frontend
```

### 2. 数据库文件丢失

确保 `backend_data` 目录正确挂载：

```bash
docker-compose down
ls -la backend_data/
docker-compose up -d
```

### 3. 数据抓取失败

进入容器手动运行脚本查看详细错误：

```bash
docker exec -it alphanote-backend bash
python scraper.py --mode daily --force
```
