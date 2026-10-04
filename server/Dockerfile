FROM node:24-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server ./server

ENV API_PORT=3000
EXPOSE 3000
CMD ["npm", "run", "start:api"]
