# Multi-stage build for MADE MCP Server
FROM node:20-alpine AS builder

# Install git and other build dependencies
RUN apk add --no-cache git

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --production

# Production stage
FROM node:20-alpine AS production

# Install git (needed to clone MADE repository)
RUN apk add --no-cache git

# Create app directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Create directories for MADE repository and data
RUN mkdir -p /app/made-repo /app/data/indexes /app/data/cache

# Build argument for MADE version (required)
ARG MADE_VERSION
ENV MADE_VERSION=${MADE_VERSION}

# Validate that MADE_VERSION is provided
RUN if [ -z "$MADE_VERSION" ]; then \
    echo "ERROR: MADE_VERSION build argument is required. Use --build-arg MADE_VERSION=<version>" && \
    exit 1; \
  fi

# Clone the MADE design system repository at the specified version
RUN echo "Cloning MADE design system version: $MADE_VERSION" && \
    git clone --depth 1 --branch "$MADE_VERSION" https://github.com/Mastercard/made.git /app/made-repo || \
    (echo "Failed to clone MADE version $MADE_VERSION. Available versions can be found at: https://github.com/Mastercard/made/tags" && exit 1)

# Verify the clone was successful and show some info
RUN echo "Successfully cloned MADE design system:" && \
    ls -la /app/made-repo && \
    echo "MADE version info:" && \
    (cd /app/made-repo && git log --oneline -1)

# Build indexes from the cloned MADE repository
RUN echo "Building indexes from MADE repository..." && \
    node dist/scripts/build-indexes.js /app/made-repo "$MADE_VERSION" && \
    echo "Indexes built successfully"

# Expose the port the app runs on
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); \
    const options = { hostname: 'localhost', port: 3000, path: '/health', timeout: 5000 }; \
    const req = http.request(options, (res) => { \
      if (res.statusCode === 200) process.exit(0); \
      else process.exit(1); \
    }); \
    req.on('error', () => process.exit(1)); \
    req.on('timeout', () => process.exit(1)); \
    req.end();"

# Set environment variables
ENV NODE_ENV=production
ENV MADE_REPO_PATH=/app/made-repo
ENV DATA_DIR=/app/data

# Start the server
CMD ["node", "dist/server.js"]