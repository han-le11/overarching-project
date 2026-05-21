FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./

RUN npm install --legacy-peer-deps

COPY . .

RUN npm run build

FROM denoland/deno:alpine-2.4.3

WORKDIR /app

COPY --from=builder /app/dist ./dist

EXPOSE 4321

ENV PORT=4321

CMD ["run", "--allow-net", "--allow-read", "--allow-env", "./dist/server/entry.mjs"]
