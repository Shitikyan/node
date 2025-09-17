# Demos Network Node Dockerization Scope

## Project Goal
Dockerize the Demos Network node to standardize the OS environment and dependencies while preserving all existing functionality and data handling patterns.

## Core Principle
**Docker should ONLY standardize the OS and dependencies (Ubuntu 24.04, Bun, bun install) and NOTHING ELSE.**
All data persistence, configuration, and functionality must remain identical to the current `./run` script.

## Architecture Design

### Container Setup
- **Two-container architecture**: 
  - App container (demos-node): Ubuntu 24.04 + Bun + Node.js application
  - Database container (demos-postgres): PostgreSQL (maintain current version)
- **Single docker-compose.yml**: Replaces current `postgres/docker-compose.yml` approach
- **Multi-architecture support**: Build for amd64 and arm64

### Integration Strategy
- **Alongside existing**: Docker setup works alongside `./run`, doesn't replace it
- **New docker-run script**: Wrapper script that translates CLI args to docker-compose
- **CLI compatibility**: All current `./run` arguments must be passable to docker setup

## Environment Standardization

### What Gets Standardized
- ✅ **Operating System**: Ubuntu 24.04 LTS base image
- ✅ **Runtime**: Bun installation and setup
- ✅ **Dependencies**: All `bun install` dependencies pre-installed
- ✅ **System utilities**: Standard Ubuntu packages needed for operation

### What Remains The Same
- ❌ **Networking**: Same ports (53550 for node, 5332 for PostgreSQL)
- ❌ **Data persistence**: Same bind mount patterns, now in `docker_data/`
- ❌ **Configuration**: Same CLI arguments and environment variables
- ❌ **Functionality**: Clean/restore modes, backup/restore, peer management
- ❌ **File structure**: Identity files, peer lists, logs - all preserved

## Data Persistence Strategy

### Bind Mount Structure
```
docker_data/
├── postgres_data/          # PostgreSQL data (replaces current postgres/data_*)
├── identity/               # .demos_identity, public.key files
├── peer_lists/             # demos_peerlist.json
├── logs/                   # Application logs
├── backups/                # Backup files
└── ssl/                    # SSL certificates
```

### Port Configuration
- **Node Port**: 53550 (configurable via -p argument)
- **PostgreSQL Port**: 5332 (configurable via -d argument)
- **Docker networking**: Bridge network for container communication

## CLI Argument Preservation

### Supported Arguments (via docker-run)
```bash
./docker-run [OPTIONS]
  -p <port>       Node port (default: 53550)
  -d <port>       PostgreSQL port (default: 5332)
  -i <file>       Identity file path (bind mounted)
  -c              Clean database on startup
  -n              Skip git pull (handled in docker context)
  -u <url>        Override EXPOSED_URL
  -l <file>       Peer list file (bind mounted)
  -b <true/false> Restore from backup
  -v              Verbose logging
  -h              Show help message
```

## System Requirements Changes

### Removed Requirements (Handled by Docker)
- OS-specific RAM/CPU checks (Docker handles resource allocation)
- Platform detection (Ubuntu 24.04 standardized)
- Bun installation checks (pre-installed in image)
- Network latency checks (container networking)

### Preserved Requirements
- Docker and Docker Compose installation
- Port availability checks (host level)
- Sufficient host resources for containers

## Implementation Components

### 1. Dockerfile (demos-node)
- Ubuntu 24.04 LTS base
- Bun installation
- Application dependencies
- Working directory setup
- Proper user permissions

### 2. docker-compose.yml
- demos-node service definition
- demos-postgres service definition
- Network configuration
- Volume mounts for data persistence
- Environment variable passthrough

### 3. docker-run Script
- CLI argument parsing
- Docker Compose orchestration
- Environment variable setup
- Volume mount configuration
- Error handling and logging

### 4. Documentation Updates
- Docker setup instructions
- Migration guide from ./run to docker-run
- Troubleshooting guide for Docker-specific issues

## Testing Strategy

### Functional Parity Tests
- All ./run arguments work with docker-run
- Clean/restore functionality preserved
- Backup/restore operations work
- Network connectivity maintained
- Performance equivalence

### Docker-Specific Tests
- Multi-architecture builds
- Container resource usage
- Data persistence across restarts
- Port conflict handling
- Volume mount permissions

## Deployment Scenarios

### Development Use
- Replace local environment setup complexity
- Consistent development environment across team
- Easy onboarding for new developers

### Production Use
- Standardized deployment environment
- Container orchestration compatibility
- Simplified server setup and maintenance