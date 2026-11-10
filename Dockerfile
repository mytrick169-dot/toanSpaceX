FROM node:24-alpine

WORKDIR /app

# Cài đặt thư viện (OCR tiếng Việt, bộ dựng trang PDF) trước để tận dụng cache Docker
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.mjs ./
COPY start-public.mjs ./
COPY vie.traineddata ./
COPY database ./database
COPY src ./src
COPY storage ./storage
COPY data ./data

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "--no-warnings", "server.mjs"]
