# L2PS Implementation Context for Claude Code CLI

## Overview

This document provides comprehensive context about the **L2PS (Layer 2 Privacy Subnets)** implementation in the Demos node codebase. Use this as a reference to understand what L2PS is, what has been implemented, and what work remains.

---

## What is L2PS?

**L2PS (Layer 2 Privacy Subnets)** is a privacy-preserving transaction system integrated with **DTR (Distributed Transaction Routing)** that enables private transactions while maintaining validator consensus participation.

### Core Concept

- **L2PS Participant Nodes**: Non-validator RPC nodes that decrypt and store L2PS transactions locally
- **Validators**: Receive only consolidated L2PS UID → hash mappings (never see transaction content)
- **Privacy Preserved**: Complete separation between encrypted transaction storage and validator consensus

### Architecture Flow

```
Client → L2PS Node → Decrypt → L2PS Mempool (encrypted storage)
                                      ↓
                     Every 5s: Generate Consolidated Hash
                                      ↓
                     Create L2PS Hash Update TX (self-directed)
                                      ↓
                     DTR Routes to ALL Validators
                                      ↓
                     Validators Store UID → Hash Mapping (content blind)
```

---

## Privacy Model

### Data Separation

- **L2PS Participants**: Store full encrypted transactions, can decrypt and view content
- **Validators**: Store only `l2ps_uid → hash` mappings, zero transaction visibility
- **Critical Principle**: L2PS mempool and validator mempool NEVER mix

### Transaction Flow

1. Client encrypts transaction using L2PS network keys
2. L2PS node receives encrypted transaction
3. Node decrypts transaction locally (validates signature)
4. Node stores encrypted transaction in separate L2PS mempool
5. Every 5 seconds, hash service generates consolidated hash
6. Hash update transaction relayed to validators via DTR
7. Validators store only the hash mapping for consensus

---

## Implementation Status

### ✅ Phase 1: Core Infrastructure (100% Complete)

#### L2PS Mempool System

**Entity**: `src/model/entities/L2PSMempool.ts`
- TypeORM entity for L2PS transactions
- Composite indexes: `[l2ps_uid, timestamp]`, `[l2ps_uid, status]`, `[l2ps_uid, block_number]`
- Fields: `hash`, `l2ps_uid`, `original_hash`, `encrypted_tx` (JSONB), `status`, `timestamp`, `block_number`

**Manager**: `src/libs/blockchain/l2ps_mempool.ts` (407 lines)
- `addTransaction()`: Store encrypted transaction with duplicate detection
- `getByUID()`: Retrieve transactions by L2PS network UID
- `getHashForL2PS()`: Generate deterministic consolidated hash
- `existsByOriginalHash()`: Duplicate detection
- `cleanup()`: Remove old processed transactions
- `getStats()`: Comprehensive statistics

**Transaction Handler**: `src/libs/network/routines/transactions/handleL2PS.ts`
- Loads L2PS network instance via `ParallelNetworks.getInstance()`
- Decrypts transaction using `l2psInstance.decryptTx()`
- Re-verifies decrypted transaction signature
- Checks for duplicates via `L2PSMempool.existsByOriginalHash()`
- Stores encrypted transaction in L2PS mempool
- Returns confirmation to client

### ✅ Phase 2: Hash Generation Service (100% Complete)

**Service**: `src/libs/l2ps/L2PSHashService.ts` (390 lines)

**Features**:
- Singleton pattern service
- **Reentrancy protection**: `isGenerating` flag prevents overlapping operations
- 5-second interval hash generation
- Processes all joined L2PS UIDs automatically
- Comprehensive statistics tracking
- Graceful shutdown with timeout

**Key Methods**:
- `start()`: Begin hash generation service
- `stop()`: Graceful shutdown
- `safeGenerateAndRelayHashes()`: Reentrancy-protected wrapper
- `generateAndRelayHashes()`: Core logic iterating through all L2PS UIDs
- `processL2PSNetwork()`: Generate hash for specific L2PS UID
- `relayToValidators()`: DTR relay implementation

**Integration**: `src/index.ts`
- Auto-starts when `getSharedState.l2psJoinedUids` is populated
- Graceful shutdown on SIGINT/SIGTERM

### ✅ Phase 3a: DTR Integration (100% Complete)

#### SDK Transaction Type (in l2ps_simplified branch)

**Files** (in SDK):
- `sdks/src/types/blockchain/TransactionSubtypes/L2PSHashTransaction.ts`
- `sdks/src/websdk/DemosTransactions.ts`: `createL2PSHashUpdate()` method
- Self-directed transaction design (`from === to`) triggers automatic DTR routing

#### Validator Relay

**Implementation**: `src/libs/l2ps/L2PSHashService.ts:250-311`
- Uses existing validator discovery: `getCommonValidatorSeed()` + `getShard()`
- Random validator ordering for load balancing
- Tries all validators until one accepts
- Only operates in production mode (`getSharedState.PROD`)
- Uses `RELAY_TX` NodeCall type

#### Hash Update Handler

**File**: `src/libs/network/endpointHandlers.ts`
- New `l2ps_hash_update` transaction case in switch statement
- Validates L2PS network participation
- Comprehensive error handling
- TODO: Actually store the hash mapping (Phase 3b)

### ⏳ Phase 3b: Validator Hash Storage (NOT IMPLEMENTED)

**Planned Entity**: `src/model/entities/L2PSHashes.ts` (does not exist yet)

**Purpose**: Store L2PS UID → hash mappings for validators

**Planned Schema**:
```typescript
@Entity("l2ps_hashes")
export class L2PSHash {
    @PrimaryColumn() l2ps_uid: string
    @Column() hash: string
    @Column() transaction_count: number
    @Column() block_number: number
    @Column() timestamp: bigint
}
```

### ⚠️ Phase 3c: L2PS Mempool Sync (CRITICAL - PARTIALLY IMPLEMENTED)

**Current Issue**: Each L2PS participant maintains an isolated mempool copy
- No synchronization between participants
- New participants can't access historical transactions
- Single points of failure
- No redundancy

#### Phase 3c-1: NodeCall Endpoints Foundation (PARTIALLY COMPLETE)

**File**: `src/libs/network/manageNodeCall.ts`

**Status**:
- ✅ `getL2PSParticipationById`: Implementation exists (check if node participates)
- ⏳ `getL2PSMempoolInfo`: Placeholder/not implemented
- ⏳ `getL2PSTransactions`: Placeholder/not implemented

**Need to Implement**:
```typescript
case "getL2PSMempoolInfo": {
    // Return: { l2psUid, transactionCount, lastTimestamp }
    const transactions = await L2PSMempool.getByUID(data.l2psUid, "processed")
    response.response = {
        l2psUid: data.l2psUid,
        transactionCount: transactions.length,
        lastTimestamp: transactions[transactions.length - 1]?.timestamp || 0
    }
}

case "getL2PSTransactions": {
    // Return: array of encrypted transactions (optionally filtered by timestamp)
    const transactions = await L2PSMempool.getByUID(
        data.l2psUid,
        "processed",
        data.since_timestamp // Optional filter
    )
    response.response = { transactions }
}
```

#### Phase 3c-2: L2PS Concurrent Sync Service (NOT IMPLEMENTED)

**Planned File**: `src/libs/l2ps/L2PSConcurrentSync.ts` (does not exist)

**Purpose**: Utility functions for L2PS mempool synchronization

**Planned Functions**:
```typescript
// Discover which peers participate in specific L2PS UIDs
export async function discoverL2PSParticipants(peers: Peer[], l2psUids: string[]): Promise<Map<string, Peer[]>>

// Sync L2PS mempool with a specific peer
export async function syncL2PSWithPeer(peer: Peer, l2psUid: string): Promise<void>

// Exchange L2PS participation info with peers
export async function exchangeL2PSParticipation(peers: Peer[]): Promise<void>
```

**Sync Strategy**:
1. Query peers: `nodeCall("getL2PSParticipationById", { l2psUid })`
2. Build participant map per L2PS UID
3. Compare local vs peer mempool counts via `getL2PSMempoolInfo`
4. Request missing transactions via `getL2PSTransactions`
5. Validate signatures and insert into local mempool

#### Phase 3c-3: Integration with Existing Sync (NOT IMPLEMENTED)

**File to Modify**: `src/libs/blockchain/routines/Sync.ts`

**Pattern**: Add small L2PS sync hooks to existing functions without breaking changes

**Proposed Integration Points**:
```typescript
// In mergePeerlist() - after merging blockchain peers
await exchangeL2PSParticipation(newPeers)

// In getHigestBlockPeerData() - concurrent L2PS participant discovery
await discoverL2PSParticipants(peers, getSharedState.l2psJoinedUids)

// In requestBlocks() - sync L2PS data alongside block sync
await syncL2PSWithPeer(peer, l2psUid)
```

---

## Code Patterns & Conventions

### Codebase Structure

**Pattern**: Modular service-based architecture
- Services use singleton pattern (`getInstance()`)
- TypeORM for database entities
- Lodash for utilities (`_.cloneDeep()`)
- Winston-style logging via `src/utilities/logger`

### NodeCall Pattern

**File**: `src/libs/network/manageNodeCall.ts`

**Structure**:
```typescript
export async function manageNodeCall(content: NodeCall): Promise<RPCResponse> {
    let response = _.cloneDeep(emptyResponse)
    response.result = 200

    switch (content.message) {
        case "exampleCall": {
            // Validate data
            if (!data.requiredField) {
                response.result = 400
                response.response = "Missing required field"
                break
            }

            // Process request
            const result = await someService.doWork(data)

            // Return response
            response.response = result
            break
        }
    }

    return response
}
```

### Peer Communication Pattern

**Making NodeCalls**:
```typescript
const result = await peer.call({
    method: "nodeCall",
    params: [{
        message: "getL2PSParticipationById",
        data: { l2psUid: "network_123" }
    }]
}, true) // true = authenticated call

if (result.result === 200) {
    // Success
    const data = result.response
}
```

**Parallel Peer Calls**:
```typescript
const promises = new Map<string, Promise<RPCResponse>>()
for (const peer of peers) {
    promises.set(peer.identity, peer.call(request, false))
}

const responses = new Map<string, RPCResponse>()
for (const [peerId, promise] of promises) {
    const response = await promise
    responses.set(peerId, response)
}
```

### Service Pattern

**Standard Service Structure**:
```typescript
export class ExampleService {
    private static instance: ExampleService | null = null
    private isRunning = false

    static getInstance(): ExampleService {
        if (!this.instance) {
            this.instance = new ExampleService()
        }
        return this.instance
    }

    async start(): Promise<void> {
        if (this.isRunning) {
            throw new Error("Service already running")
        }
        this.isRunning = true
        // Start work
    }

    async stop(): Promise<void> {
        if (!this.isRunning) return
        this.isRunning = false
        // Cleanup
    }
}
```

### Logging

```typescript
import log from "@/utilities/logger"

log.info("[ServiceName] Informational message")
log.debug("[ServiceName] Debug details")
log.warning("[ServiceName] Warning message")
log.error("[ServiceName] Error occurred:", error)
log.custom("category", "message", logToFile)
```

### Database Patterns

**Using TypeORM Repository**:
```typescript
public static repo: Repository<EntityName> = null

public static async init(): Promise<void> {
    const db = await Datasource.getInstance()
    this.repo = db.getDataSource().getRepository(EntityName)
}

// Find with options
const results = await this.repo.find({
    where: { field: value },
    order: { timestamp: "ASC" }
})

// Check existence
const exists = await this.repo.exists({ where: { field: value } })

// Save
await this.repo.save(entityInstance)
```

---

## Key Integration Points

### Shared State

**File**: `src/utilities/sharedState.ts`

**L2PS Relevant Fields**:
```typescript
getSharedState.l2psJoinedUids // string[] - L2PS networks this node participates in
getSharedState.PROD // boolean - production mode flag
getSharedState.publicKeyHex // string - node identity
getSharedState.keypair // KeyPair - node keys
```

### ParallelNetworks (L2PS Network Manager)

**Usage**:
```typescript
import ParallelNetworks from "@/libs/l2ps/parallelNetworks"

const parallelNetworks = ParallelNetworks.getInstance()
const l2psInstance = await parallelNetworks.getL2PS(l2psUid)
// or
const l2psInstance = await parallelNetworks.loadL2PS(l2psUid)

// Decrypt transaction
const decryptedTx = await l2psInstance.decryptTx(l2psTx)
```

### PeerManager

**Getting Peers**:
```typescript
import PeerManager from "@/libs/peer/PeerManager"

const peerManager = PeerManager.getInstance()
const allPeers = peerManager.getPeers() // Returns Peer[]
const specificPeer = peerManager.getPeer(identity)
```

### Sync Integration

**File**: `src/libs/blockchain/routines/Sync.ts`

**Key Functions**:
- `mergePeerlist(block)`: Merge peers from block content
- `getHigestBlockPeerData(peers)`: Discover highest block peer
- `requestBlocks()`: Main block sync loop

---

## Implementation Guidelines

### What to Implement Next

**Priority 1: Complete NodeCall Endpoints**
1. Implement `getL2PSMempoolInfo` in `manageNodeCall.ts`
2. Implement `getL2PSTransactions` in `manageNodeCall.ts`
3. Add proper input validation and error handling

**Priority 2: Create L2PS Sync Utilities**
1. Create `src/libs/l2ps/L2PSConcurrentSync.ts`
2. Implement `discoverL2PSParticipants()`
3. Implement `syncL2PSWithPeer()`
4. Follow existing code patterns (singleton, logging, error handling)

**Priority 3: Integrate with Sync.ts**
1. Add minimal L2PS sync hooks to `Sync.ts`
2. Do NOT break existing blockchain sync
3. Make L2PS sync run concurrently, not sequentially

**Priority 4: Validator Hash Storage**
1. Create `src/model/entities/L2PSHashes.ts`
2. Create manager similar to `L2PSMempool.ts`
3. Complete the `handleL2PSHashUpdate()` implementation

### Important Constraints

- **Do NOT overengineer**: Follow existing patterns, keep it simple
- **Do NOT break existing sync**: L2PS sync should be additive, not disruptive
- **Privacy first**: Never expose decrypted L2PS transaction content to validators
- **Reuse infrastructure**: No new dependencies, use existing peer/network code
- **Follow conventions**: Match logging style, naming patterns, file structure

### Testing Considerations

- Test with multiple L2PS participants
- Verify sync works for new nodes joining an existing L2PS network
- Ensure validators never receive transaction content
- Validate duplicate detection works correctly
- Test graceful shutdown and error recovery

---

## Branch Information

**Current Development Branch**: `l2ps_simplified`
- Last updated: July 10, 2025
- Status: Phase 1, 2, 3a complete; Phase 3b, 3c incomplete
- Most recent l2ps-related branch in the repository

**Main Branch**: Merge target after completion

---

## Quick Reference

### Key Files Locations

**Implemented**:
- L2PS Entity: `src/model/entities/L2PSMempool.ts`
- L2PS Mempool Manager: `src/libs/blockchain/l2ps_mempool.ts`
- L2PS Hash Service: `src/libs/l2ps/L2PSHashService.ts`
- L2PS Transaction Handler: `src/libs/network/routines/transactions/handleL2PS.ts`
- NodeCall Router: `src/libs/network/manageNodeCall.ts`
- Endpoint Handlers: `src/libs/network/endpointHandlers.ts`
- Startup Integration: `src/index.ts`

**To Be Created**:
- Validator Hash Storage: `src/model/entities/L2PSHashes.ts`
- Concurrent Sync Utilities: `src/libs/l2ps/L2PSConcurrentSync.ts`

**To Be Modified**:
- Sync Integration: `src/libs/blockchain/routines/Sync.ts`
- NodeCall Router: `src/libs/network/manageNodeCall.ts` (complete placeholders)

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    L2PS ARCHITECTURE                        │
└─────────────────────────────────────────────────────────────┘

Client Application
       │
       ▼
L2PS Participant Node (Non-Validator)
       ├─► Decrypt Transaction (handleL2PS.ts)
       ├─► Store in L2PS Mempool (l2ps_mempool.ts)
       │   └─► L2PSMempoolTx Entity (PostgreSQL)
       │
       └─► Every 5s: L2PSHashService
               ├─► Generate Consolidated Hash
               ├─► Create L2PS Hash Update TX
               └─► Relay to Validators (DTR)
                       │
                       ▼
Validator Node (Consensus)
       ├─► Receive Hash Update TX (RELAY_TX)
       ├─► Validate Transaction
       └─► Store UID → Hash Mapping
           └─► [TODO: L2PSHashes Entity]

L2PS Participant Sync (Horizontal)
       ├─► [TODO: Discover Participants]
       ├─► [TODO: Exchange Mempool Info]
       └─► [TODO: Sync Missing Transactions]
```

---

## End of Context Document

Use this document to understand the L2PS system architecture, implementation status, and next steps. Follow the established patterns and conventions when implementing remaining features.
