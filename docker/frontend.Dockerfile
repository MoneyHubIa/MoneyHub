FROM node:22-bookworm-slim AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY apps/backend/prisma apps/backend/prisma
COPY apps/backend/prisma.config.ts apps/backend/prisma.config.ts
RUN npm ci --no-audit --no-fund
COPY apps/frontend apps/frontend
ENV APP_URL=http://localhost:8080 \
    EXPO_NO_DOTENV=1 \
    EXPO_PUBLIC_FIREBASE_API_KEY=demo-api-key \
    EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-moneyhub.firebaseapp.com \
    EXPO_PUBLIC_FIREBASE_PROJECT_ID=demo-moneyhub \
    EXPO_PUBLIC_FIREBASE_APP_ID=demo-app-id \
    EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_URL=http://localhost:9099 \
    CI=true
RUN npm run build:web -w apps/frontend

FROM nginx:1.28-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/frontend/dist /usr/share/nginx/html
EXPOSE 80
