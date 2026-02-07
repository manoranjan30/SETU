# Stage 1: Build Frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# Stage 2: Build Backend
FROM node:22-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/ .
RUN npm run build

# Stage 3: Final Production Image
FROM node:22-alpine
WORKDIR /usr/src/app

# Stage to copy build outputs
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/node_modules ./node_modules
COPY --from=backend-builder /app/backend/package*.json ./

# Copy Frontend Build to 'client' directory expected by NestJS ServeStatic
COPY --from=frontend-builder /app/frontend/dist ./client

# Expose Port
EXPOSE 3000

# Start App
CMD ["node", "dist/main"]
