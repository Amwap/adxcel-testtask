FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Serves the built dist/ (SPA fallback included); the host nginx (../nginx/nginx.conf) proxies to it
EXPOSE 4173
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0"]
