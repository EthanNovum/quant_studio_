#!/bin/bash

# AlphaNote 重新部署脚本
# 用于从 git 拉取最新代码后快速重新部署
#
# 用法:
#   ./redeploy.sh           # 完整重新部署（拉取代码 + 重建所有服务）
#   ./redeploy.sh -f        # 仅重建 frontend
#   ./redeploy.sh -b        # 仅重建 backend
#   ./redeploy.sh -q        # 快速重启（不重建镜像）
#   ./redeploy.sh --no-pull # 不拉取代码，直接重建

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 默认参数
DO_PULL=true
BUILD_FRONTEND=true
BUILD_BACKEND=true
QUICK_RESTART=false
NO_CACHE=""

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--frontend)
            BUILD_BACKEND=false
            shift
            ;;
        -b|--backend)
            BUILD_FRONTEND=false
            shift
            ;;
        -q|--quick)
            QUICK_RESTART=true
            shift
            ;;
        --no-pull)
            DO_PULL=false
            shift
            ;;
        --no-cache)
            NO_CACHE="--no-cache"
            shift
            ;;
        -h|--help)
            echo "用法: $0 [选项]"
            echo ""
            echo "选项:"
            echo "  -f, --frontend   仅重建 frontend"
            echo "  -b, --backend    仅重建 backend"
            echo "  -q, --quick      快速重启（不重建镜像）"
            echo "  --no-pull        不拉取代码"
            echo "  --no-cache       构建时不使用缓存"
            echo "  -h, --help       显示帮助"
            exit 0
            ;;
        *)
            echo -e "${RED}未知参数: $1${NC}"
            exit 1
            ;;
    esac
done

# 切换到项目目录
cd "$(dirname "$0")"

echo -e "${BLUE}=========================================="
echo "  AlphaNote 重新部署"
echo "==========================================${NC}"

# 1. 拉取最新代码
if [ "$DO_PULL" = true ]; then
    echo -e "\n${YELLOW}[1/4] 拉取最新代码...${NC}"
    git pull
else
    echo -e "\n${YELLOW}[1/4] 跳过代码拉取${NC}"
fi

# 2. 快速重启模式
if [ "$QUICK_RESTART" = true ]; then
    echo -e "\n${YELLOW}[2/4] 快速重启模式...${NC}"
    # 确保 postgres 正在运行
    docker-compose up -d postgres
    echo -e "${YELLOW}等待 PostgreSQL 就绪...${NC}"
    sleep 3
    docker-compose restart frontend backend
    echo -e "\n${GREEN}快速重启完成！${NC}"
    docker-compose ps
    exit 0
fi

# 确定要构建的服务
SERVICES=""
if [ "$BUILD_FRONTEND" = true ] && [ "$BUILD_BACKEND" = true ]; then
    SERVICES=""
    echo -e "\n${YELLOW}[2/4] 重建所有服务...${NC}"
elif [ "$BUILD_FRONTEND" = true ]; then
    SERVICES="frontend"
    echo -e "\n${YELLOW}[2/4] 仅重建 frontend...${NC}"
elif [ "$BUILD_BACKEND" = true ]; then
    SERVICES="backend"
    echo -e "\n${YELLOW}[2/4] 仅重建 backend...${NC}"
fi

# 3. 停止并重建
if [ -z "$SERVICES" ]; then
    # 完整重建：停止 frontend 和 backend，保持 postgres 运行
    docker-compose stop frontend backend
    docker-compose rm -f frontend backend
    echo -e "\n${YELLOW}[3/4] 构建镜像...${NC}"
    docker-compose build $NO_CACHE frontend backend
    echo -e "\n${YELLOW}[4/4] 启动服务...${NC}"
    # 确保 postgres 正在运行
    docker-compose up -d postgres
    echo -e "${YELLOW}等待 PostgreSQL 就绪...${NC}"
    sleep 5
    docker-compose up -d frontend backend
else
    # 部分重建：确保 postgres 正在运行
    docker-compose up -d postgres
    echo -e "${YELLOW}等待 PostgreSQL 就绪...${NC}"
    sleep 3
    docker-compose stop $SERVICES
    echo -e "\n${YELLOW}[3/4] 构建镜像...${NC}"
    docker-compose build $NO_CACHE $SERVICES
    echo -e "\n${YELLOW}[4/4] 启动服务...${NC}"
    docker-compose up -d $SERVICES
fi

# 等待服务启动
echo -e "\n${YELLOW}等待服务启动...${NC}"
sleep 3

# 检查服务状态
echo -e "\n${GREEN}=========================================="
echo "  部署完成！服务状态："
echo "==========================================${NC}"
docker-compose ps

# 显示最近日志
echo -e "\n${BLUE}最近日志 (按 Ctrl+C 退出):${NC}"
docker-compose logs --tail=20
