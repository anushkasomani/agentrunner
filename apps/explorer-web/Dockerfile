FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY next.config.js ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY app/ ./app/

# Build the application
RUN npm run build

# Expose port
EXPOSE 3006

# Start the application
CMD ["npm", "start"]
