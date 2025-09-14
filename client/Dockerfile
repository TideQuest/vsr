# syntax=docker/dockerfile:1

FROM node:20-alpine
WORKDIR /usr/src/app

# Install Python and build dependencies for native modules
RUN apk add --no-cache python3 py3-setuptools make g++

# Enable corepack and pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

COPY package.json pnpm-lock.yaml* .npmrc* ./
RUN pnpm install --frozen-lockfile=false

COPY index.html ./
COPY tsconfig.json vite.config.ts ./
COPY src ./src

EXPOSE 5173
ENV HOST=0.0.0.0

CMD ["pnpm","dev","--host","0.0.0.0","--port","5173"]

