#!/bin/bash
# init-ssl.sh - Initialize SSL certificates with Let's Encrypt
# Run this script on the server after DNS is configured

set -e

DOMAIN="novamodeling.org"
EMAIL="ethanzhou2015@gmail.com"  # Change this to your email

echo "=== AlphaNote SSL Setup Script ==="
echo "Domain: $DOMAIN"
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo "Please run with sudo: sudo ./init-ssl.sh"
    exit 1
fi

# Create directories
echo "[1/6] Creating directories..."
mkdir -p certbot/conf
mkdir -p certbot/www
mkdir -p backend/data

# Initialize database if not exists
if [ ! -f "backend/data/alphanote.db" ]; then
    echo "[2/6] Initializing database..."
    cd backend && python3 init_db.py && cd ..
else
    echo "[2/6] Database already exists, skipping..."
fi

# Use initial nginx config (without SSL)
echo "[3/6] Setting up initial nginx config..."
cp frontend/nginx.init.conf frontend/nginx.conf.bak
cp frontend/nginx.init.conf frontend/nginx.conf

# Build and start services with initial config
echo "[4/6] Starting services..."
docker-compose down 2>/dev/null || true
docker-compose up -d --build backend frontend

# Wait for nginx to start
echo "Waiting for nginx to start..."
sleep 5

# Request SSL certificate
echo "[5/6] Requesting SSL certificate..."
docker-compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN \
    -d www.$DOMAIN

# Restore SSL nginx config
echo "[6/6] Enabling SSL configuration..."
cat > frontend/nginx.conf << 'NGINX_CONF'
# nginx.conf

# HTTP - redirect to HTTPS
server {
    listen 80;
    server_name novamodeling.org www.novamodeling.org;

    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect all other requests to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS
server {
    listen 443 ssl;
    server_name novamodeling.org www.novamodeling.org;

    # SSL certificates (managed by certbot)
    ssl_certificate /etc/letsencrypt/live/novamodeling.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/novamodeling.org/privkey.pem;

    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    gzip_min_length 1000;

    # Frontend static files (Vite build output)
    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }

    # Reverse proxy: forward /api requests to backend
    location /api/ {
        proxy_pass http://backend:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://backend:8000/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
NGINX_CONF

# Rebuild frontend with SSL config
docker-compose up -d --build frontend

# Start certbot renewal service
docker-compose up -d certbot

echo ""
echo "=== Setup Complete! ==="
echo "Your site is now available at:"
echo "  https://$DOMAIN"
echo "  https://www.$DOMAIN"
echo ""
echo "SSL certificates will auto-renew every 12 hours."
echo ""
echo "To update stock data, run:"
echo "  docker-compose exec backend python scraper.py --mode monthly --type all"
echo "  docker-compose exec backend python scraper.py --mode daily --all --force"
