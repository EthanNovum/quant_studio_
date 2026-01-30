# 域名配置指南 - novamodeling.org

## 服务器信息
- 公网 IP: `20.150.142.82`
- 域名: `novamodeling.org` / `www.novamodeling.org`

---

## 第一步：DNS 配置

在你的域名注册商（如 Cloudflare、阿里云、GoDaddy 等）添加以下 DNS 记录：

| 类型 | 主机记录 | 记录值 | TTL |
|------|----------|--------|-----|
| A | @ | 20.150.142.82 | 600 |
| A | www | 20.150.142.82 | 600 |

**验证 DNS 生效：**
```bash
# 在本地终端执行
nslookup novamodeling.org
nslookup www.novamodeling.org

# 或使用 dig
dig novamodeling.org +short
dig www.novamodeling.org +short
```

等待返回 `20.150.142.82` 后再进行下一步（通常需要几分钟到几小时）。

---

## 第二步：获取 SSL 证书

SSH 登录服务器后执行：

```bash
cd /home/ethan/project/quant_studio

# 运行 SSL 初始化脚本
sudo ./init-ssl.sh
```

脚本会自动完成：
1. 启动 HTTP 服务
2. 通过 Let's Encrypt 获取 SSL 证书
3. 配置 HTTPS 并重启服务
4. 启动证书自动续期

---

## 第三步：验证配置

```bash
# 检查容器状态
docker ps

# 检查 nginx 配置
docker exec alphanote-frontend nginx -t

# 检查证书
ls -la certbot/conf/live/novamodeling.org/
```

---

## 第四步：访问测试

在浏览器中访问：
- https://novamodeling.org
- https://www.novamodeling.org

两个地址都应该能正常访问网站，并显示有效的 SSL 证书（地址栏有锁图标）。

---

## 常见问题

### DNS 未生效
等待 DNS 传播，可使用 https://dnschecker.org 检查全球 DNS 状态。

### 证书获取失败
```bash
# 查看 certbot 日志
docker logs alphanote-certbot

# 确保 80 端口可访问（防火墙需开放）
curl http://novamodeling.org/.well-known/acme-challenge/test
```

### 服务无法启动
```bash
# 查看日志
docker-compose logs frontend
docker-compose logs backend

# 重启服务
docker-compose down
docker-compose up -d
```

### 防火墙配置（Azure）- 当前问题！

**症状**: ERR_TIMED_OUT，无法访问网站

**原因**: Azure 网络安全组 (NSG) 未开放 80/443 端口

**解决方法**:

1. 登录 Azure Portal: https://portal.azure.com
2. 找到你的虚拟机 → 网络 → 网络安全组
3. 添加入站规则：

| 优先级 | 名称 | 端口 | 协议 | 源 | 操作 |
|--------|------|------|------|-----|------|
| 100 | Allow-HTTP | 80 | TCP | Any | 允许 |
| 110 | Allow-HTTPS | 443 | TCP | Any | 允许 |

**或使用 Azure CLI**:
```bash
# 替换 <resource-group> 和 <nsg-name> 为你的实际值
az network nsg rule create \
  --resource-group <resource-group> \
  --nsg-name <nsg-name> \
  --name Allow-HTTP \
  --priority 100 \
  --destination-port-ranges 80 \
  --protocol Tcp \
  --access Allow

az network nsg rule create \
  --resource-group <resource-group> \
  --nsg-name <nsg-name> \
  --name Allow-HTTPS \
  --priority 110 \
  --destination-port-ranges 443 \
  --protocol Tcp \
  --access Allow
```

---

## 文件说明

| 文件 | 说明 |
|------|------|
| `frontend/nginx.conf` | Nginx 配置（脚本会自动更新） |
| `init-ssl.sh` | SSL 初始化脚本 |
| `docker-compose.yml` | Docker 编排配置 |
| `certbot/conf/` | SSL 证书存储目录 |
