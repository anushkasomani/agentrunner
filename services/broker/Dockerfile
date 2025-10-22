FROM node:20-alpine
WORKDIR /app

# 1) Bring in root + workspace package.jsons so npm knows about workspaces
COPY package.json tsconfig.base.json ./
COPY packages/common/package.json packages/common/tsconfig.json ./packages/common/
COPY services/broker/package.json services/broker/tsconfig.json ./services/broker/

# 2) Install workspace deps (creates node_modules/@agentrunner/common symlink)
RUN npm install

# 3) TS type deps so tsc is happy
RUN npm install -D typescript @types/node @types/express @types/uuid @types/pg

# 4) Now copy the rest of the sources
COPY . .

# 5) Build common first, then broker (so subpath exports point to dist files)
RUN npx tsc -p packages/common/tsconfig.json \
 && npx tsc -p services/broker/tsconfig.json

EXPOSE 7004
CMD ["node","services/broker/dist/server.js"]
