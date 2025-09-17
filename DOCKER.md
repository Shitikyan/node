# Demos Network Node - Docker Setup

This document describes how to run the Demos Network node using Docker containers.

## Quick Start

```bash
# Run with default settings
./docker-run

# Run on custom ports
./docker-run -p 53551 -d 5333

# Clean start (fresh database)
./docker-run -c

# Stop containers
./docker-run --stop
```

## What's Included

- **Ubuntu 24.04** standardized environment
- **Bun runtime** pre-installed
- **PostgreSQL 16** database container
- **All dependencies** pre-installed via `bun install`
- **Data persistence** in `docker_data/` directory

## Directory Structure

```
docker_data/
├── postgres_data/          # PostgreSQL database files
├── identity/               # Node identity (.demos_identity, public.key)
├── peer_lists/             # Peer configuration files
├── logs/                   # Application logs
├── backups/                # Backup files
└── ssl/                    # SSL certificates
```

## Usage

### Basic Commands

```bash
# Start node with default configuration
./docker-run

# Start with verbose logging
./docker-run -v

# Start on custom ports
./docker-run -p 53550 -d 5332

# Start with clean database
./docker-run -c

# Start in restore mode
./docker-run -b true
```

### Docker-Specific Commands

```bash
# Force rebuild Docker images
./docker-run --build

# Build without cache
./docker-run --no-cache

# Show container logs after startup
./docker-run --logs

# Stop running containers
./docker-run --stop

# Clean up containers and data
./docker-run --cleanup
```

### Advanced Usage

```bash
# Custom identity file (relative to docker_data/identity/)
./docker-run -i my_custom_identity

# Custom peer list (relative to docker_data/peer_lists/)
./docker-run -l custom_peers.json

# Override exposed URL
./docker-run -u "https://my-node.example.com"

# Skip git updates (for development)
./docker-run -n
```

## CLI Arguments

All standard `./run` arguments are supported:

| Argument | Description | Default |
|----------|-------------|---------|
| `-p <port>` | Node port | 53550 |
| `-d <port>` | PostgreSQL port | 5332 |
| `-i <file>` | Identity file path | `.demos_identity` |
| `-c` | Clean database on startup | false |
| `-n` | Skip git pull | false |
| `-u <url>` | Override EXPOSED_URL | auto-detected |
| `-l <file>` | Peer list file | `demos_peerlist.json` |
| `-b <true/false>` | Restore from backup | false |
| `-v` | Verbose logging | false |
| `-h` | Show help message | - |

## Docker-Specific Arguments

| Argument | Description |
|----------|-------------|
| `--build` | Force rebuild Docker images |
| `--no-cache` | Build without using Docker cache |
| `--logs` | Show container logs after startup |
| `--detach` | Run containers in background (default) |
| `--stop` | Stop running containers |
| `--cleanup` | Remove containers and volumes |

## System Requirements

### Docker Requirements
- Docker and Docker Compose installed
- Docker daemon running
- Available ports: 5332 (PostgreSQL) and 53550 (Node)

### Recommended Resources
- 8GB RAM minimum (12GB recommended)
- 4+ CPU cores
- 20GB free disk space

## Troubleshooting

### Common Issues

**Port already in use:**
```bash
# Check what's using the port
lsof -i :53550
lsof -i :5332

# Use different ports
./docker-run -p 53551 -d 5333
```

**Docker not running:**
```bash
# Start Docker Desktop or Docker daemon
sudo systemctl start docker  # Linux
open -a Docker              # macOS
```

**Permission denied:**
```bash
# Make sure docker-run is executable
chmod +x docker-run
```

### Viewing Logs

```bash
# Show all container logs
docker compose logs

# Follow logs in real-time
docker compose logs -f

# Show specific container logs
docker compose logs demos-node
docker compose logs demos-postgres
```

### Data Persistence

All data is stored in the `docker_data/` directory:

- **Database**: Persisted in `docker_data/postgres_data/`
- **Identity**: Node keys in `docker_data/identity/`
- **Logs**: Application logs in `docker_data/logs/`
- **Backups**: Backup files in `docker_data/backups/`

To completely reset:
```bash
./docker-run --cleanup
rm -rf docker_data/
```

## Migration from ./run

The Docker setup preserves all functionality from the original `./run` script:

1. **Same CLI arguments** - All flags work the same way
2. **Same data structure** - Files stored in equivalent locations
3. **Same networking** - Same default ports and configuration
4. **Same features** - Clean/restore modes, backup functionality, etc.

### Key Differences

| Aspect | ./run | ./docker-run |
|--------|-------|---------------|
| OS | Host OS (macOS/Linux) | Ubuntu 24.04 |
| Dependencies | Host installation | Pre-installed in container |
| Data location | Various locations | `docker_data/` directory |
| PostgreSQL | `postgres/` folder | Docker container |
| System checks | Host system validation | Docker environment |

## Development

### Building Custom Images

```bash
# Build for specific platform
docker build --platform linux/amd64 -t demos-node .

# Build for multiple platforms
docker build --platform linux/amd64,linux/arm64 -t demos-node .
```

### Environment Variables

The Docker setup uses these environment variables:

- `PG_PORT` - PostgreSQL port
- `RPC_PORT` - Node RPC port
- `EXPOSED_URL` - External URL override
- `IDENTITY_FILE` - Path to identity file
- `PEER_LIST_FILE` - Path to peer list file
- `RESTORE` - Restore mode flag
- `CLEAN` - Clean mode flag
- `VERBOSE` - Verbose logging flag

## Support

For issues specific to the Docker setup, check:

1. Docker logs: `docker compose logs -f`
2. Container status: `docker compose ps`
3. System resources: `docker stats`

For general Demos Network support: https://demos.network/support