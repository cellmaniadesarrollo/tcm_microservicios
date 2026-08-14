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

# Compilar con tsc
RUN npx tsc

# Verificar que dist existe
RUN ls -la dist/ || (echo "❌ ERROR: dist no se creó" && exit 1)

# Limpiar dependencias de desarrollo
RUN npm prune --production

EXPOSE 3030 3005

CMD ["node", "dist/main.js"]