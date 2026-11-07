# Small production image. No npm install needed: the server has zero dependencies.
# Works on a VPS (docker compose) and on hosting services such as Render or Railway:
# they set PORT themselves, and a disk/volume can be mounted at /data to keep accounts and chats.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/data PORT=3000
COPY package.json ./
COPY server ./server
COPY public ./public
RUN mkdir -p /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD sh -c 'wget -qO- "http://127.0.0.1:${PORT:-3000}/healthz" >/dev/null || exit 1'
CMD ["node", "server/index.js"]
