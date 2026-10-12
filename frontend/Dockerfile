FROM node:22-bookworm-slim AS development
WORKDIR /app
ENV CI=1 EXPO_NO_TELEMETRY=1 EXPO_NO_DOTENV=1
COPY frontend/package.json frontend/yarn.lock ./
COPY frontend/scripts ./scripts
RUN yarn install --frozen-lockfile --non-interactive
COPY frontend/ ./
EXPOSE 8081
CMD ["yarn", "expo", "start", "--web", "--host", "lan", "--port", "8081"]

FROM development AS build
# An empty origin intentionally makes the web bundle call same-origin /api.
ARG EXPO_PUBLIC_BACKEND_URL_WEB=""
ARG EXPO_PUBLIC_APP_URL=""
ARG EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=""
ENV EXPO_PUBLIC_BACKEND_URL_WEB=$EXPO_PUBLIC_BACKEND_URL_WEB \
    EXPO_PUBLIC_APP_URL=$EXPO_PUBLIC_APP_URL \
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=$EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
RUN yarn expo export --platform web

FROM nginxinc/nginx-unprivileged:1.28-alpine AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
