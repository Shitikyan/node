#!/bin/bash
set -e

# Docker entrypoint for Demos Network Node
echo "🐳 Demos Network Node - Docker Container Starting"

# Environment setup
export PG_HOST=${PG_HOST:-demos-postgres}
export PG_PORT=${PG_PORT:-5332}
export RPC_PORT=${RPC_PORT:-53550}

# Default file paths in container
export IDENTITY_FILE=${IDENTITY_FILE:-/app/docker_data/identity/.demos_identity}
export PEER_LIST_FILE=${PEER_LIST_FILE:-/app/docker_data/peer_lists/demos_peerlist.json}

echo "📋 Container Configuration:"
echo "   🌐 Node Port: $RPC_PORT"
echo "   🗄️  Database Host: $PG_HOST:$PG_PORT"
echo "   🔑 Identity File: $IDENTITY_FILE"
echo "   👥 Peer List: $PEER_LIST_FILE"

# Ensure data directories exist
mkdir -p $(dirname "$IDENTITY_FILE")
mkdir -p $(dirname "$PEER_LIST_FILE")
mkdir -p /app/docker_data/logs
mkdir -p /app/docker_data/backups
mkdir -p /app/docker_data/ssl
mkdir -p /app/data

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
timeout=60
count=0
while ! nc -z "$PG_HOST" "$PG_PORT"; do
    if [ $count -gt $timeout ]; then
        echo "❌ Timeout waiting for PostgreSQL at $PG_HOST:$PG_PORT"
        exit 1
    fi
    echo "   Still waiting... (${count}s elapsed)"
    sleep 2
    count=$((count+2))
done
echo "✅ PostgreSQL is ready"

# Handle restore mode
if [ "$RESTORE" = "true" ]; then
    echo "🔄 Restore mode enabled"
    # Note: Restore logic would be handled by the application
fi

# Handle clean mode
if [ "$CLEAN" = "true" ]; then
    echo "🧹 Clean mode enabled"
    # Note: Clean logic would be handled by the application
fi

# Create default peer list if it doesn't exist
if [ ! -f "$PEER_LIST_FILE" ]; then
    echo "📝 Creating default peer list file"
    echo "[]" > "$PEER_LIST_FILE"
fi

# Verbose logging
if [ "$VERBOSE" = "true" ]; then
    echo "📝 Verbose logging enabled"
    export DEBUG=*
fi

echo "🚀 Starting Demos Network Node..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Execute the command
exec "$@"