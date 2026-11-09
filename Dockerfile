FROM node:24-alpine

WORKDIR /app

COPY package.json ./
COPY server.mjs ./
COPY start-public.mjs ./
COPY database ./database
COPY src ./src
COPY storage ./storage
COPY data ./data

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "--no-warnings", "server.mjs"]

