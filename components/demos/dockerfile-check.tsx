"use client"

import { DockerfileCheck } from "@/registry/default/dockerfile-check/dockerfile-check"

const DOCKERFILE = `FROM node:20 AS build
WORKDIR /app
COPY .npmrc ./
COPY . .
RUN npm ci && npm run build

FROM node:20-slim
WORKDIR /app
COPY --from=build /app /app
RUN apt-get update && apt-get install -y curl
ENV STRIPE_SECRET_KEY=sk_live_51Hx
CMD node server.js`

export function Demo() {
  return <DockerfileCheck defaultValue={DOCKERFILE} dockerignore={null} />
}
