FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm i
COPY src ./src
COPY tsconfig.json ./
RUN npm run build || npx tsc -p tsconfig.json
EXPOSE 7100
CMD ["node","dist/server.js"]
