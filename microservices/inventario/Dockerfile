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

# 🔴 IMPORTANTE: COMPILAR LA APLICACIÓN
RUN npm run build

# Limpiar dependencias de desarrollo
RUN npm prune --production

EXPOSE 3030 3005

CMD ["node", "dist/main.js"]