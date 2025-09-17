# Multi-stage build for Demos Network Node
FROM ubuntu:24.04 AS builder

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV BUN_INSTALL=/usr/local

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    unzip \
    ca-certificates \
    build-essential \
    python3 \
    python3-pip \
    git \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash

# Verify Bun installation
RUN bun --version

# Set working directory
WORKDIR /app

# Copy package files first for better caching (skip lockfile for faster builds)
COPY package.json ./

# Install dependencies with verbose output
RUN bun install

# Copy source code
COPY . .

# Directories will be created by bind mounts

# Install dependencies and build (skip lint for Docker)

# Production stage
FROM ubuntu:24.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV BUN_INSTALL=/usr/local
ENV NODE_ENV=production

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    netcat-openbsd \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Bun in production image
RUN curl -fsSL https://bun.sh/install | bash

# Create non-root user
RUN groupadd -r demos && useradd -r -g demos -d /app -s /bin/bash demos

# Set working directory
WORKDIR /app

# Copy application from builder
COPY --from=builder /app /app
COPY --from=builder /app/node_modules /app/node_modules

# Create data directories and set permissions
RUN mkdir -p docker_data/identity \
    docker_data/peer_lists \
    docker_data/logs \
    docker_data/backups \
    docker_data/ssl \
    docker_data/data \
    logs && \
    chown -R demos:demos /app

# Switch to non-root user
USER demos

# Expose the application port (default 53550)
EXPOSE 53550

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${RPC_PORT:-53550}/health || exit 1

# Create entrypoint script
COPY --chown=demos:demos docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Start the application
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["bun", "run", "start:bun"]