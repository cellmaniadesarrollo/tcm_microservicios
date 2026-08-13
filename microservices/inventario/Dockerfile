FROM node:20-alpine

WORKDIR /app

# Copiar archivos de configuración
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Instalar dependencias
RUN npm install --legacy-peer-deps

# Copiar código fuente
COPY src ./src

EXPOSE 3030 3005

# Usar el mismo comando que en desarrollo pero con NODE_ENV=production
CMD ["npm", "run", "start:prod"]