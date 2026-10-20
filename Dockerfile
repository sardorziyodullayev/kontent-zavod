# Kontent Zavod: panel + API + (ixtiyoriy) joylash workeri bitta konteynerda.
# Ma'lumotlar /data ga yoziladi: hostingda shu yo'lga doimiy disk (volume) ulang.

FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=4310 \
    DATA_DIR=/data \
    MEDIA_DIR=/data/media \
    WORKER=1
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json tsconfig.json ./
COPY server ./server
COPY src/core ./src/core
COPY tools ./tools
COPY drizzle ./drizzle
# VOLUME yozilmagan: Railway uni taqiqlaydi, diskni hosting o'zi ulaydi.
RUN mkdir -p /data/media
EXPOSE 4310
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "--import", "tsx", "server/index.ts"]
