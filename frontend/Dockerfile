# frontend/Dockerfile

# --- Stage 1: Build ---
FROM node:22-alpine AS build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# --- Stage 2: Production (Nginx) ---
FROM nginx:alpine AS production-stage

# Copy built files to Nginx directory
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create directory for certbot challenge
RUN mkdir -p /var/www/certbot

EXPOSE 80
EXPOSE 443

CMD ["nginx", "-g", "daemon off;"]
