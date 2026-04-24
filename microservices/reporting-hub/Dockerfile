# Dockerfile (en gateway/ o cada microservicio)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build   # genera dist/

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY package*.json ./
RUN npm ci --only=production
COPY . .
CMD ["node", "dist/main"]
EXPOSE 3000