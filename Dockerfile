# Multi-stage build for MADE MCP Server

FROM node:20-slim AS builder

# Install git and other build dependencies
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app


# Copy package files and node_modules from host
COPY package*.json ./
COPY node_modules ./node_modules

# Copy source code
COPY . .

# Build the application (using host node_modules)
RUN npm run build

# Production stage
FROM node:20-slim AS production

# Install git (needed to clone MADE repository)
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app


# Copy built application and node_modules from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./


# Create data directories (MADE repo will be copied from submodule)
RUN mkdir -p /app/data/indexes /app/data/cache



# Copy the MADE design system submodule
COPY made-repo /app/made-repo

# Verify the copy was successful and show some info
RUN echo "Successfully copied MADE design system:" && \
  ls -la /app/made-repo

# Build argument for MADE commit hash
ARG MADE_COMMIT_HASH=unknown

# Build indexes from the copied MADE repository
RUN echo "Building indexes from MADE repository..." && \
  node dist/scripts/build-indexes.js /app/made-repo main $MADE_COMMIT_HASH && \
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