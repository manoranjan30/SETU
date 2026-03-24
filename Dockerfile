# Stage 1: Build Frontend (Dev)
FROM node:22-alpine AS frontend-dev
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .

# Stage 2: Build Frontend (Prod)
FROM frontend-dev AS frontend-builder
RUN npm run build

# Stage 3: Build Backend (Dev)
FROM node:22-alpine AS backend-dev
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/ .

# Stage 4: Build Backend (Prod)
FROM backend-dev AS backend-builder
RUN npm run build

# Stage 3: Final Production Image
FROM node:22-alpine
WORKDIR /usr/src/app

# Stage to copy build outputs
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/node_modules ./node_modules
COPY --from=backend-builder /app/backend/package*.json ./
COPY --from=backend-builder /app/backend/firebase-service-account.json ./firebase-service-account.json
COPY backend/scripts ./scripts

# Copy Frontend Build to 'client' directory expected by NestJS ServeStatic
COPY --from=frontend-builder /app/frontend/dist ./client

ENV RUN_DB_MIGRATIONS=true
ENV DB_MIGRATION_SCRIPT=migration:run:dist

# Create uploads directory so multer can write files on first upload
RUN mkdir -p /usr/src/app/uploads

# Expose Port
EXPOSE 3000

# Start App
CMD ["npm", "run", "start:prod:migrated"]
