# Demos Blockchain - Complete Diagram Documentation

## Overview

This directory contains comprehensive Mermaid diagram documentation for all major features of the Demos blockchain. Each feature has 10 detailed diagrams covering architecture, flows, state machines, and complete system lifecycles.

**Total Features Documented:** 13
**Total Diagrams:** 130
**Diagram Types:** Flowcharts, Sequence Diagrams, State Machines, Class Diagrams, ER Diagrams, Graph Diagrams

---

## Quick Navigation

### Core Blockchain Features

#### 1. [Blockchain Core](./blockchain-core/BLOCKCHAIN_CORE.md)
**Location:** `diagrams/blockchain-core/`
**Viewer:** [BLOCKCHAIN_CORE_VIEWER.html](./blockchain-core/BLOCKCHAIN_CORE_VIEWER.html)

Complete blockchain fundamentals including block structure, chain management, genesis initialization, database operations, and native hashing.

**Key Topics:**
- Block Structure & Properties (hash, prevHash, number, timestamp, signer, content, nonce)
- Chain Management (genesis, growth, validation, reorganization)
- Block Database Operations (storage, retrieval, indexing)
- Native SHA256 Hashing Implementation
- Block Lifecycle State Machine
- Genesis Block Initialization
- Block Properties & Metadata
- Chain Continuity & Integrity
- Database Schema (blocks, transactions, state)
- Complete System Architecture

---

#### 2. [Global Change Registry (GCR)](./gcr/GCR.md)
**Location:** `diagrams/gcr/`
**Viewer:** [GCR_VIEWER.html](./gcr/GCR_VIEWER.html)

Global mutable state registry managing balances, identities, nonces, and incentives with cryptographic traceability.

**Key Topics:**
- GCR Architecture (HandleGCR core, routines, operations)
- Balance Management (add, remove, rollback operations)
- Nonce Management (increment, decrement, tracking)
- Identity Management (XM, Web2, PQC identities across chains)
- GCR Edit Operations (Transaction → Operation flow)
- Cross-Chain Identity Support (Solana, EVM, MultiversX, TON, etc.)
- Rollback Mechanisms
- GCR Database Schema
- State Change Traceability
- Complete GCR Lifecycle

**Innovations:**
- Cryptographically traceable state modifications
- Multi-chain identity management
- Transaction-derived operations model
- Rollback-safe state transitions

---

#### 3. [PoR-BFT Consensus](./consensus-v2/CONSENSUS_V2.md)
**Location:** `diagrams/consensus-v2/`
**Viewer:** [CONSENSUS_V2_VIEWER.html](./consensus-v2/CONSENSUS_V2_VIEWER.html)

Advanced Proof of Representation Byzantine Fault Tolerant consensus mechanism with validator voting, finalization, and supermajority requirements.

**Key Topics:**
- PoR-BFT Architecture (Proposer, Validators, Voters)
- Block Proposal & Validation Flow
- Vote Collection & Aggregation (2/3+ threshold)
- Block Finalization Process
- Fork Resolution & Chain Selection
- Byzantine Fault Tolerance (33% dishonest tolerance)
- Validator Rotation & Selection
- Vote Verification & Signatures
- Consensus State Machine (Proposed → Voting → Finalized)
- Finality Guarantees

**Security:**
- BFT consensus (tolerates up to 33% Byzantine validators)
- 2/3+ supermajority for finalization
- Cryptographic vote signatures
- Fork resolution with longest chain rule

---

### Network & Communication

#### 4. [Validator & Peer Management](./validator-management/VALIDATOR_PEER_MANAGEMENT.md)
**Location:** `diagrams/validator-management/`
**Viewer:** [VALIDATOR_PEER_MANAGEMENT_VIEWER.html](./validator-management/VALIDATOR_PEER_MANAGEMENT_VIEWER.html)

Complete peer and validator lifecycle management including discovery, registration, authentication, and health monitoring.

**Key Topics:**
- Peer Discovery (Bootstrap, DNS, mDNS, DHT)
- Peer Connection Management (handshake, authentication)
- Validator Registration & Staking
- Validator Selection Algorithm (weighted random by stake)
- Peer Health Monitoring (heartbeat, latency, uptime)
- Peer Reputation System (scoring, penalties, banning)
- Validator Slashing Conditions
- Peer Database Schema
- Connection Pool Management
- Complete Peer Lifecycle State Machine

**Features:**
- Multi-method peer discovery
- Reputation-based peer selection
- Stake-weighted validator selection
- Slashing for misbehavior

---

#### 5. [P2P Network & Synchronization](./p2p-network/P2P_NETWORK_SYNC.md)
**Location:** `diagrams/p2p-network/`
**Viewer:** [P2P_NETWORK_SYNC_VIEWER.html](./p2p-network/P2P_NETWORK_SYNC_VIEWER.html)

Peer-to-peer networking infrastructure with fast sync, RPC server, block propagation, and rate limiting.

**Key Topics:**
- P2P Network Architecture (WebSocket, TCP/IP)
- Fast Sync Protocol (header sync → state sync → catch up)
- RPC Server & Message Routing
- Block Propagation (gossip protocol)
- Peer Discovery & Authentication
- Node Call API (query blocks, transactions, state)
- Mempool Synchronization
- Rate Limiting & DDoS Protection
- Network Message Types & Handlers
- Complete Network Flow State Machine

**Performance:**
- Fast sync with parallel downloads
- Gossip-based block propagation
- Rate limiting (100 req/min/peer)
- Efficient state synchronization

---

### Transaction Processing

#### 6. [Transaction Processing & Mempool](./transactions-mempool/TRANSACTIONS_MEMPOOL.md)
**Location:** `diagrams/transactions-mempool/`
**Viewer:** [TRANSACTIONS_MEMPOOL_VIEWER.html](./transactions-mempool/TRANSACTIONS_MEMPOOL_VIEWER.html)

Complete transaction lifecycle from creation through mempool management to block inclusion with post-quantum signatures.

**Key Topics:**
- Transaction Structure (hash, from, to, amount, nonce, timestamp, signatures)
- Post-Quantum Signatures (ML-DSA Dilithium, SL-DSA Sphincs+)
- Transaction Validation (signature, nonce, balance, format)
- Mempool Management (priority queue, size limits, expiry)
- Transaction Broadcasting & Propagation
- Fee Market & Priority Calculation
- Transaction Replacement (nonce-based)
- Double-Spend Prevention
- Transaction Lifecycle State Machine
- Mempool Database Schema

**Security:**
- Dual PQC signatures (ML-DSA + SL-DSA)
- Quantum-resistant cryptography
- Nonce-based replay protection
- Multi-layer validation

---

#### 7. [Block Creation & Validation](./block-creation/BLOCK_CREATION_VALIDATION.md)
**Location:** `diagrams/block-creation/`
**Viewer:** [BLOCK_CREATION_VALIDATION_VIEWER.html](./block-creation/BLOCK_CREATION_VALIDATION_VIEWER.html)

Block assembly, validation voting, finalization, rollback, and complete block lifecycle management.

**Key Topics:**
- Block Structure (header, transactions, encrypted_transactions, metadata)
- Block Creation Process (transaction selection, merkle root, nonce)
- Validation Voting (validator selection, vote collection, 2/3+ threshold)
- Block Finalization (irreversible commitment)
- Block Rollback & Fork Handling
- Native SHA256 Hashing for Blocks
- Chain Continuity Validation
- Block Database Schema
- Block Sync & Propagation
- Complete Block Lifecycle State Machine

**Workflow:**
1. Transaction selection from mempool
2. Block assembly with merkle root
3. Validator voting (2/3+ approval)
4. Finalization & chain commitment
5. Propagation to network

---

### Advanced Features

#### 8. [Bridges & Multichain Integration](./bridges-multichain/BRIDGES_MULTICHAIN.md)
**Location:** `diagrams/bridges-multichain/`
**Viewer:** [BRIDGES_MULTICHAIN_VIEWER.html](./bridges-multichain/BRIDGES_MULTICHAIN_VIEWER.html)

Cross-chain bridges enabling interoperability with EVM chains, Solana, Aptos, and multi-chain transaction execution.

**Key Topics:**
- XM Script System (cross-chain scripting language)
- Cross-Chain Operation Flow (lock → bridge → unlock)
- Native Bridge Architecture (Demos ↔ External chains)
- Rubic Swap Integration (DEX aggregation)
- Multi-Chain Transaction Execution
- Bridge Validators & Consensus
- Cross-Chain State Verification
- Bridge Security (multisig, timelock, fraud proofs)
- Supported Chains (EVM, Solana, Aptos)
- Complete Bridge Lifecycle

**Interoperability:**
- XM scripts for multi-chain logic
- Native bridges to major chains
- Rubic integration for swaps
- Cross-chain state proofs

---

#### 9. [Web2 Integration & DAHR](./web2-integration/WEB2_DAHR.md)
**Location:** `diagrams/web2-integration/`
**Viewer:** [WEB2_DAHR_VIEWER.html](./web2-integration/WEB2_DAHR_VIEWER.html)

Data Agnostic HTTPS Relay enabling blockchain applications to interact with traditional Web2 services with cryptographic integrity.

**Key Topics:**
- DAHR Architecture (Factory pattern, session management)
- Proxy Server Initialization & Lifecycle
- HTTP Request Flow & Forwarding
- Session Management (UUID-based, 24h TTL)
- URL Validation & Normalization
- Request/Response Hashing (SHA256 for integrity)
- Action Routing (CREATE vs START_PROXY)
- Error Handling & Validation
- SSL/TLS Configuration
- Complete DAHR Lifecycle State Machine

**Features:**
- Factory pattern with singleton DAHRFactory
- Session-based proxy instances
- Cryptographic request/response hashing
- URL validation with security checks
- 24-hour session expiry with cleanup

---

#### 10. [Cryptography Systems (FHE, ZK, PQC)](./cryptography/CRYPTOGRAPHY_SYSTEMS.md)
**Location:** `diagrams/cryptography/`
**Viewer:** [CRYPTOGRAPHY_SYSTEMS_VIEWER.html](./cryptography/CRYPTOGRAPHY_SYSTEMS_VIEWER.html)

Advanced cryptography with Fully Homomorphic Encryption, Zero-Knowledge Proofs, and Post-Quantum Cryptography.

**Key Topics:**

**FHE (Fully Homomorphic Encryption):**
- Microsoft SEAL Library with BFV Scheme
- 4096 Polynomial Modulus Degree, tc128 Security
- Homomorphic Operations (add, multiply, negate on encrypted data)
- Noise Budget Management
- Private Computation

**ZK (Zero-Knowledge Proofs):**
- Interactive Proof System (Prover/Verifier)
- Challenge-Response Protocol
- k=20 rounds → 2^-20 cheating probability
- Security Properties (completeness, soundness, zero-knowledge)
- Modular Arithmetic with Large Primes

**PQC (Post-Quantum Cryptography):**
- SuperDilithium (ML-DSA Standard)
- Enigma Wrapper for Quantum-Safe Signatures
- Lattice-Based Cryptography
- Resistant to Shor's Algorithm
- NIST Post-Quantum Compliance

**Use Cases:**
- Private transactions with FHE-encrypted amounts
- Proof-based authentication without revealing secrets
- Quantum-safe transaction signing

---

#### 11. [ActivityPub Integration](./activitypub/ACTIVITYPUB_INTEGRATION.md)
**Location:** `diagrams/activitypub/`
**Viewer:** [ACTIVITYPUB_INTEGRATION_VIEWER.html](./activitypub/ACTIVITYPUB_INTEGRATION_VIEWER.html)

Federated social networking protocol implementation with Express.js server, SQLite storage, and ActivityStreams support.

**Key Topics:**
- ActivityPub Server Architecture (Express.js + SQLite)
- Actor Model & Collections (Person, Note, Activity types)
- SQLite Storage Schema (14 collections)
- REST API Endpoints (GET/PUT/:collection/:id)
- ActivityStreams Object Model (core objects, activities, collections)
- Inbox/Outbox Message Flow (federated delivery)
- Federation Protocol (WebFinger, HTTP signatures)
- Collection Management (Followers, Following, Liked, etc.)
- Data Persistence & Retrieval (CRUD operations)
- Complete ActivityPub Lifecycle

**Features:**
- Express.js REST API with universal handlers
- 14 SQLite collections with JSON blob storage
- ActivityStreams protocol compliance
- HTTP signature verification for federation
- Session-based inbox/outbox management

---

#### 12. [Incentive Management](./incentive/INCENTIVE_MANAGEMENT.md)
**Location:** `diagrams/incentive/`
**Viewer:** [INCENTIVE_MANAGEMENT_VIEWER.html](./incentive/INCENTIVE_MANAGEMENT_VIEWER.html)

Comprehensive point-based incentive system with referrals, levels, rewards, and gamification for network participation.

**Key Topics:**
- Incentive System Architecture (points, levels, rewards)
- Point Earning Mechanisms (transactions, referrals, validation)
- Referral System (multi-level tracking, commissions)
- Level Progression (Bronze → Diamond tiers)
- Reward Distribution (automatic payouts)
- Point Validation & Security
- User Progress Tracking
- Leaderboard & Rankings
- Incentive Database Schema
- Complete Incentive Lifecycle

**Features:**
- Multi-level referral system with commission tiers
- 5-tier level progression (Bronze, Silver, Gold, Platinum, Diamond)
- Activity-based point earning (tx fees, referrals, staking, validation)
- Automatic reward distribution
- Anti-gaming protection and validation

---

#### 13. [MCP Protocol](./mcp/MCP_PROTOCOL.md)
**Location:** `diagrams/mcp/`
**Viewer:** [MCP_PROTOCOL_VIEWER.html](./mcp/MCP_PROTOCOL_VIEWER.html)

Model Context Protocol server enabling AI assistants to interact with blockchain operations via standardized tools.

**Key Topics:**
- MCP Server Architecture (stdio + SSE transports)
- Tool Registration & Management
- Request/Response Flow (ListTools, CallTool)
- Transport Layer (stdio for local, SSE for remote)
- Blockchain Tools (blocks, transactions, chain status)
- Network Tools (peers, node identity, health)
- Tool Execution & Validation
- Session Management
- MCP Protocol Compliance
- Complete MCP Lifecycle

**Features:**
- Dual transport support (stdio + Server-Sent Events)
- Comprehensive blockchain tool suite
- Tool validation with Zod schemas
- Remote network access via SSE/HTTP
- Full MCP SDK compliance

---

## Documentation Standards

Each feature documentation includes:

1. **10 Comprehensive Diagrams** covering all aspects of the feature
2. **Mermaid Syntax** for interactive, version-controllable diagrams
3. **Detailed Descriptions** explaining each diagram's purpose and components
4. **Interactive HTML Viewer** with navigation between diagrams
5. **Architecture Overviews** showing system-wide integration
6. **Sequence Diagrams** for time-based workflows
7. **State Machines** for lifecycle management
8. **Flowcharts** for decision logic and processes
9. **Database Schemas** where applicable
10. **Complete System Lifecycles** from initialization to shutdown

---

## Diagram Categories

### By Type

- **Architecture Diagrams:** System overviews and component relationships
- **Sequence Diagrams:** Time-based interactions and message flows
- **State Machines:** Lifecycle management and state transitions
- **Flowcharts:** Decision logic and process flows
- **ER Diagrams:** Database schemas and relationships
- **Graph Diagrams:** Network topologies and hierarchies

### By Domain

- **Core Blockchain:** Blocks, chains, hashing, genesis
- **Consensus:** Voting, finalization, BFT, validator rotation
- **Networking:** P2P, sync, RPC, propagation, discovery
- **Transactions:** Creation, validation, mempool, PQC signatures
- **Security:** Cryptography (FHE, ZK, PQC), slashing, reputation
- **Interoperability:** Bridges, cross-chain, multi-chain execution
- **Infrastructure:** GCR clustering, Web2 integration, DAHR

---

## Technology Stack

### Diagram Rendering
- **Mermaid.js v10:** Declarative diagram syntax with live rendering
- **CommonMark:** Markdown specification for documentation
- **HTML5 + CSS3:** Interactive viewers with navigation

### Cryptography
- **Microsoft SEAL:** FHE library with BFV scheme
- **SuperDilithium:** Post-quantum signatures (ML-DSA)
- **BigInteger.js:** Large number arithmetic for ZK proofs
- **Node-forge:** RSA cryptography for L2PS
- **Native SHA256:** Blockchain-native hashing

### Blockchain
- **Custom Consensus:** BFT with validator voting
- **LevelDB/RocksDB:** Persistent block storage
- **WebSocket:** Real-time P2P communication
- **Rubic SDK:** Cross-chain swap integration

---

## File Structure

```
diagrams/
├── README.md                           # This file - Master Index
├── DIAGRAMS_INDEX.html                 # Interactive HTML Master Index
│
├── blockchain-core/
│   ├── BLOCKCHAIN_CORE.md              # 10 blockchain core diagrams
│   └── BLOCKCHAIN_CORE_VIEWER.html     # Interactive viewer
│
├── gcr/
│   ├── GCR.md                          # 10 GCR diagrams
│   └── GCR_VIEWER.html                 # Interactive viewer
│
├── consensus-v2/
│   ├── CONSENSUS_V2.md                 # 10 consensus diagrams
│   └── CONSENSUS_V2_VIEWER.html        # Interactive viewer
│
├── validator-management/
│   ├── VALIDATOR_PEER_MANAGEMENT.md    # 10 validator/peer diagrams
│   └── VALIDATOR_PEER_MANAGEMENT_VIEWER.html
│
├── transactions-mempool/
│   ├── TRANSACTIONS_MEMPOOL.md         # 10 transaction diagrams
│   └── TRANSACTIONS_MEMPOOL_VIEWER.html
│
├── block-creation/
│   ├── BLOCK_CREATION_VALIDATION.md    # 10 block creation diagrams
│   └── BLOCK_CREATION_VALIDATION_VIEWER.html
│
├── p2p-network/
│   ├── P2P_NETWORK_SYNC.md             # 10 P2P network diagrams
│   └── P2P_NETWORK_SYNC_VIEWER.html
│
├── bridges-multichain/
│   ├── BRIDGES_MULTICHAIN.md           # 10 bridge diagrams
│   └── BRIDGES_MULTICHAIN_VIEWER.html
│
├── web2-integration/
│   ├── WEB2_DAHR.md                    # 10 Web2/DAHR diagrams
│   └── WEB2_DAHR_VIEWER.html
│
├── cryptography/
│   ├── CRYPTOGRAPHY_SYSTEMS.md         # 10 cryptography diagrams
│   └── CRYPTOGRAPHY_SYSTEMS_VIEWER.html
│
├── activitypub/
│   ├── ACTIVITYPUB_INTEGRATION.md      # 10 ActivityPub diagrams
│   └── ACTIVITYPUB_INTEGRATION_VIEWER.html
│
├── incentive/
│   ├── INCENTIVE_MANAGEMENT.md         # 10 incentive system diagrams
│   └── INCENTIVE_MANAGEMENT_VIEWER.html
│
└── mcp/
    ├── MCP_PROTOCOL.md                 # 10 MCP protocol diagrams
    └── MCP_PROTOCOL_VIEWER.html
```

---

## Usage

### Viewing Diagrams

#### Option 1: Markdown Files
Navigate to any feature's markdown file and view directly in GitHub or any markdown viewer with Mermaid support.

#### Option 2: Interactive HTML Viewers
Open any `*_VIEWER.html` file in a web browser for an interactive experience with:
- Navigation buttons for all 10 diagrams
- Smooth transitions between diagrams
- Responsive design for mobile and desktop
- Mermaid.js live rendering

#### Option 3: Master Index
Open [DIAGRAMS_INDEX.html](./DIAGRAMS_INDEX.html) for a complete overview and navigation to all features.

### Editing Diagrams

1. Edit the Mermaid syntax in the markdown files
2. Diagrams use standard Mermaid syntax (flowchart, sequenceDiagram, stateDiagram-v2, etc.)
3. Test changes by opening the HTML viewer or using Mermaid Live Editor
4. Commit changes to version control

### Creating New Diagrams

1. Create a new directory: `diagrams/feature-name/`
2. Create markdown file: `FEATURE_NAME.md` with 10 diagrams
3. Create HTML viewer: `FEATURE_NAME_VIEWER.html` based on existing templates
4. Update this README.md to include the new feature
5. Update DIAGRAMS_INDEX.html with navigation links

---

## Best Practices

### Diagram Design
- **Clarity:** Use clear, descriptive labels and titles
- **Consistency:** Follow the same color scheme and style across diagrams
- **Completeness:** Cover all aspects of a feature in 10 diagrams
- **Detail:** Include notes, descriptions, and annotations
- **Flow:** Show clear progression and relationships

### Color Coding (Standard across all diagrams)
- `fill:#e1f5ff` - Primary components (blue)
- `fill:#fff4e1` - Secondary components (yellow/orange)
- `fill:#e8f5e9` - Success/completed states (green)
- `fill:#ffebee` - Important/security components (red)
- `fill:#f3e5f5` - Additional/supporting components (purple)
- `fill:#ffcccc` - Error states (light red)

### Documentation
- **Descriptions:** Each diagram should have a 2-3 sentence description
- **Context:** Explain why the diagram matters and what it shows
- **References:** Link related diagrams and documentation
- **Examples:** Include concrete examples where helpful

---

## Contribution Guidelines

When adding or updating diagrams:

1. **Maintain Quality:** Follow the 10-diagram standard for each feature
2. **Use Mermaid:** All diagrams must use Mermaid syntax
3. **Create Viewers:** Each feature needs an HTML viewer
4. **Update Index:** Update this README and the master HTML index
5. **Test Rendering:** Verify diagrams render correctly in both markdown and HTML
6. **Add Descriptions:** Include clear descriptions for each diagram
7. **Follow Structure:** Use the established directory and file naming conventions

---

## Version History

- **v1.1** - Added 3 new feature sets (130 diagrams total)
  - ActivityPub Integration
  - Incentive Management
  - MCP Protocol

- **v1.0** - Initial release with 10 complete feature sets (100 diagrams total)
  - Blockchain Core
  - Global Cluster Registry (GCR)
  - Consensus V2
  - Validator & Peer Management
  - Transaction Processing & Mempool
  - Block Creation & Validation
  - P2P Network & Synchronization
  - Bridges & Multichain Integration
  - Web2 Integration (DAHR)
  - Cryptography Systems (FHE, ZK, PQC)

---

## Related Documentation

- **[Source Code](../src/)** - Implementation of all features
- **[API Documentation](../docs/api/)** - API reference (if available)
- **[Architecture Overview](../docs/architecture/)** - High-level architecture docs (if available)
- **[Developer Guide](../docs/developer-guide/)** - Development guidelines (if available)

---

## License

This documentation is part of the Demos blockchain project.
© 2024 Kynesys Labs

---

## Quick Links

| Feature | Markdown | HTML Viewer |
|---------|----------|-------------|
| Blockchain Core | [BLOCKCHAIN_CORE.md](./blockchain-core/BLOCKCHAIN_CORE.md) | [View](./blockchain-core/BLOCKCHAIN_CORE_VIEWER.html) |
| Global Change Registry | [GCR.md](./gcr/GCR.md) | [View](./gcr/GCR_VIEWER.html) |
| PoR-BFT Consensus | [CONSENSUS_V2.md](./consensus-v2/CONSENSUS_V2.md) | [View](./consensus-v2/CONSENSUS_V2_VIEWER.html) |
| Validator Management | [VALIDATOR_PEER_MANAGEMENT.md](./validator-management/VALIDATOR_PEER_MANAGEMENT.md) | [View](./validator-management/VALIDATOR_PEER_MANAGEMENT_VIEWER.html) |
| Transactions & Mempool | [TRANSACTIONS_MEMPOOL.md](./transactions-mempool/TRANSACTIONS_MEMPOOL.md) | [View](./transactions-mempool/TRANSACTIONS_MEMPOOL_VIEWER.html) |
| Block Creation | [BLOCK_CREATION_VALIDATION.md](./block-creation/BLOCK_CREATION_VALIDATION.md) | [View](./block-creation/BLOCK_CREATION_VALIDATION_VIEWER.html) |
| P2P Network | [P2P_NETWORK_SYNC.md](./p2p-network/P2P_NETWORK_SYNC.md) | [View](./p2p-network/P2P_NETWORK_SYNC_VIEWER.html) |
| Bridges & Multichain | [BRIDGES_MULTICHAIN.md](./bridges-multichain/BRIDGES_MULTICHAIN.md) | [View](./bridges-multichain/BRIDGES_MULTICHAIN_VIEWER.html) |
| Web2 Integration | [WEB2_DAHR.md](./web2-integration/WEB2_DAHR.md) | [View](./web2-integration/WEB2_DAHR_VIEWER.html) |
| Cryptography Systems | [CRYPTOGRAPHY_SYSTEMS.md](./cryptography/CRYPTOGRAPHY_SYSTEMS.md) | [View](./cryptography/CRYPTOGRAPHY_SYSTEMS_VIEWER.html) |
| ActivityPub Integration | [ACTIVITYPUB_INTEGRATION.md](./activitypub/ACTIVITYPUB_INTEGRATION.md) | [View](./activitypub/ACTIVITYPUB_INTEGRATION_VIEWER.html) |
| Incentive Management | [INCENTIVE_MANAGEMENT.md](./incentive/INCENTIVE_MANAGEMENT.md) | [View](./incentive/INCENTIVE_MANAGEMENT_VIEWER.html) |
| MCP Protocol | [MCP_PROTOCOL.md](./mcp/MCP_PROTOCOL.md) | [View](./mcp/MCP_PROTOCOL_VIEWER.html) |

---

**For the best experience, open [DIAGRAMS_INDEX.html](./DIAGRAMS_INDEX.html) in your browser.**
