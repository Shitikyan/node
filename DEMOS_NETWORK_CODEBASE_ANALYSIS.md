# Demos Network Codebase - Comprehensive Analysis

> **Purpose**: Complete codebase understanding for LLMs and developers  
> **Target**: Enable rapid comprehension without re-analysis  
> **Updated**: 2025-07-10  
> **Codebase Version**: 0.9.5 "Entangled Polymer"

## 🏗️ Architecture Overview

### **Core Philosophy**
- **Blockchain Network**: Demos Network with proof-of-consensus (PoRBFT)
- **Runtime**: Bun (TypeScript) - cross-platform support
- **SDK Integration**: `@kynesyslabs/demosdk` package
- **State Management**: Global Change Registry (GCR) for mutable state
- **Transaction Pipeline**: `confirmTx` → validation → `broadcastTx` → execution

### **Key Architectural Patterns**
1. **Singleton Pattern**: SharedState, GCR, PeerManager
2. **Handler Pattern**: Each transaction type has dedicated handler
3. **Pipeline Pattern**: Transaction validation → execution → GCR update
4. **Plugin Architecture**: Features as self-contained modules

## 📁 Directory Structure

```
src/
├── features/                    # Feature modules (plugin-like)
│   ├── logicexecution/         # Smart contract-like functionality
│   ├── web2/                   # Web2 integration & proxy
│   ├── multichain/             # Cross-chain operations
│   ├── incentive/              # Point system & referrals
│   ├── bridges/                # Blockchain bridges
│   ├── fhe/                    # Fully homomorphic encryption
│   ├── zk/                     # Zero-knowledge proofs
│   └── activitypub/            # Fediverse integration
├── libs/                       # Core libraries
│   ├── blockchain/             # Chain, blocks, transactions, GCR
│   ├── network/                # RPC server, endpoint handlers
│   ├── consensus/              # PoRBFT consensus mechanism
│   ├── crypto/                 # Cryptography utilities
│   ├── peer/                   # P2P networking
│   └── utils/                  # Shared utilities
├── model/                      # Database entities (TypeORM)
├── utilities/                  # Application utilities
└── types/                      # TypeScript type definitions
```

## 🔄 Transaction System

### **Transaction Types**
```typescript
type TransactionType = 
  | "native"              // Native blockchain operations
  | "web2Request"         // Web2 proxy requests
  | "crosschainOperation" // Cross-chain operations
  | "demoswork"           // DemosWork computations
  | "l2ps"               // L2PS (Layer 2 Parallel Subnets)
  | "logic_execution"     // Smart contract-like processing
```

### **Transaction Flow**
1. **Validation Phase (`confirmTx`)**
   - Gas calculation
   - Signature verification
   - Balance checking
   - Nonce assignment
   - Returns `ValidityData`

2. **Execution Phase (`broadcastTx`)**
   - Transaction execution
   - GCR operations
   - State updates
   - Response generation

### **Handler Pattern**
Each transaction type follows this pattern:
```typescript
// Location: src/libs/network/routines/transactions/
export default async function handleXRequest(
    tx: Transaction,
    sender: string
): Promise<ResponseType> {
    // Validation
    // Processing
    // Return standardized response
}
```

## 🗃️ Global Change Registry (GCR)

### **Purpose**
- **Mutable State**: Stores changeable blockchain state
- **Cryptographic Security**: All changes traced back to transactions
- **Operation-Based**: Modifications via atomic operations
- **Efficiency**: Quick reference index for state verification

### **Key Concepts**
- **Operations**: Atomic state modifications derived from transactions
- **Traceability**: Every GCR entry links to corresponding transaction
- **Separate Storage**: Not part of blockchain but cryptographically secured
- **Examples**: Balances, identities, nonces, contract state

### **File Structure**
```
src/libs/blockchain/gcr/
├── gcr.ts                      # Main GCR class (deprecated)
├── handleGCR.ts                # GCR operation handler
├── gcr_routines/               # Operation processors
│   ├── txToGCROperation.ts     # Transaction → Operation converter
│   ├── handleNativeOperations.ts
│   ├── GCRBalanceRoutines.ts
│   └── identityManager.ts
└── types/                      # GCR type definitions
```

## 🔄 GCRv2 System - The Modern State Management

### **Architecture Overview**
GCRv2 is the current working system that handles all native transactions in Demos Network. Unlike the legacy `txToGCROperation` system, GCRv2 uses **GCR Edits** that are embedded directly in transactions.

### **How GCRv2 Works**

#### **1. Transaction Creation with GCR Edits**
```typescript
// SDK generates GCR edits automatically
// Location: ../sdks/src/websdk/GCRGeneration.ts
export class GCRGeneration {
    static generate(tx: Transaction): GCREdit[] {
        // Converts transaction into atomic GCR edits
        // For native "send": creates subtract/add balance edits
    }
}
```

#### **2. GCR Edit Structure**
```typescript
interface GCREdit {
    type: "balance" | "nonce" | "identity" | "points" | "custom"
    operation: "add" | "remove" | "set" | "update"
    account: string           // Target account public key
    txhash: string           // Source transaction hash
    amount?: bigint          // For balance operations
    data?: any               // For custom operations
}
```

#### **3. Consensus Integration**
```typescript
// Location: src/libs/consensus/v2/PoRBFT.ts:366-395
async function applyGCREditsFromMergedMempool(mempool: Transaction[]) {
    for (const tx of mempool) {
        const txGCREdits = tx.content.gcr_edits  // Direct from transaction
        for (const gcrEdit of txGCREdits) {
            const result = await HandleGCR.apply(gcrEdit, tx)  // Apply to state
        }
    }
}
```

#### **4. Storage in Unified Table**
```typescript
// Location: src/model/entities/GCRv2/GCR_Main.ts
@Entity("gcr_main")
export class GCR_Main {
    @PrimaryColumn("text")
    pubkey: string              // Account public key
    
    @Column("bigint") 
    balance: bigint             // Account balance
    
    @Column("integer")
    nonce: number               // Transaction nonce
    
    @Column("jsonb")
    assignedTxs: string[]       // Transaction history
    
    @Column("jsonb")
    identities: any             // Identity data
    
    @Column("jsonb") 
    points: any                 // Point system data
}
```

### **Native Transaction Flow Example**
1. **Client**: Creates "send" transaction → SDK generates 2 GCR edits (subtract sender, add receiver)
2. **Server**: Validates transaction → Regenerates edits server-side for verification
3. **Consensus**: Processes `tx.content.gcr_edits` → Applies to `gcr_main` table
4. **Result**: Balance updates stored in unified state table

### **Key Advantages of GCRv2**
- **Atomic Operations**: All edits succeed or fail together
- **Client-Side Generation**: SDK creates edits automatically
- **Server-Side Validation**: Regenerates edits for consistency checking
- **Unified Storage**: Single `gcr_main` table for all account state
- **Rollback Support**: Failed transactions can be easily reverted
- **Bypasses Legacy**: No dependency on incomplete `txToGCROperation`

### **Processing Files**
- **`GCRGeneration.ts`**: Client-side edit generation
- **`HandleGCR.ts`**: Server-side edit processing
- **`GCRBalanceRoutines.ts`**: Balance update operations
- **`GCRNonceRoutines.ts`**: Nonce management
- **`PoRBFT.ts`**: Consensus integration

## 🌐 Network & RPC System

### **Server Architecture**
- **Runtime**: Bun server with Fastify-like API
- **Port**: 53550 (configurable)
- **Protocols**: HTTP/HTTPS, WebSocket
- **Authentication**: Ed25519 signatures

### **Request Flow**
```
Client Request → manageExecution.ts → Handler → GCR → Response
```

### **Response Format**
```typescript
interface RPCResponse {
    result: number          // HTTP-like status code
    response: any          // Actual data
    require_reply: boolean // Whether client should respond
    extra?: string         // Optional metadata
}
```

### **Key Files**
- **`server_rpc.ts`**: Main RPC server
- **`endpointHandlers.ts`**: Transaction validation/execution
- **`manageExecution.ts`**: Request routing
- **`emptyResponse`**: Standard response template

## 🔐 Security & Cryptography

### **Cryptographic Standards**
- **Primary**: Ed25519 signatures
- **Hashing**: SHA-256 via `Hashing.sha256()`
- **Post-Quantum**: Experimental support via Enigma
- **PGP**: Key server functionality

### **Security Measures**
- **Input Validation**: Size limits, sanitization
- **Rate Limiting**: Configurable per endpoint
- **Authentication**: Public key verification
- **Sandbox**: Isolated execution contexts

## 📊 Shared State Management

### **SharedState Singleton**
Central configuration and state management:
```typescript
// Location: src/utilities/sharedState.ts
class SharedState {
    // Configuration
    serverPort: number
    maxMessageSize: number
    
    // State
    currentTimestamp: number
    lastBlockHash: string
    syncStatus: boolean
    
    // Consensus
    consensusMode: boolean
    lastShard: string[]
    
    // Features
    inMainLoop: boolean
    runningAsNode: boolean
}
```

### **Configuration Pattern**
```typescript
// Environment variables with defaults
maxMessageSize = parseInt(process.env.MAX_MESSAGE_SIZE) || defaultValue
```

## 🔧 Utility Libraries

### **Key Utilities**
- **`Hashing.sha256()`**: String hashing
- **`generateUniqueId()`**: ID generation
- **`logger`**: Logging system
- **`demostdlib/`**: Demos-specific utilities

### **JSON Processing**
```typescript
// Standard pattern for bigint handling
JSON.stringify(data, (_, v) => typeof v === "bigint" ? v.toString() : v)
```

## 🏭 Feature Development Patterns

### **Feature Structure**
```
src/features/[feature]/
├── index.ts                    # Main export
├── handlers/                   # Request handlers
├── types/                      # TypeScript interfaces
├── utils/                      # Helper functions
└── README.md                   # Feature documentation
```

### **Integration Points**
1. **Transaction Handler**: Add to `manageExecution.ts`
2. **GCR Operations**: Extend `txToGCROperation.ts`
3. **Mempool**: Add to `deriveMempoolOperation.ts`
4. **Types**: Define in feature types file

### **Common Patterns**
- **Response Standardization**: Use `emptyResponse` template
- **Error Handling**: Consistent error response format
- **Configuration**: Store in SharedState
- **Logging**: Use centralized logger

## 📊 Database & Storage

### **Database System**
- **ORM**: TypeORM
- **Entities**: Located in `src/model/entities/`
- **Key Tables**: Blocks, Transactions, GCR, Mempool

### **Storage Patterns**
- **Blockchain Data**: Immutable in database
- **GCR State**: Mutable with transaction traceability
- **Temporary Data**: In-memory caching

## 🚀 Performance & Optimization

### **Performance Considerations**
- **Caching**: Mempool caching, GCR optimization
- **Async Operations**: Extensive use of async/await
- **Memory Management**: Singleton patterns for state
- **Database Queries**: Optimized entity relationships

### **Scalability Features**
- **Sharding**: Validator shard management
- **Consensus**: PoRBFT for high throughput
- **P2P**: Efficient peer management
- **L2PS**: Layer 2 parallel processing

## 🔄 Development Workflow

### **Adding New Features**
1. Create feature directory in `src/features/`
2. Define types and interfaces
3. Implement handler following existing patterns
4. Add transaction type to existing enums
5. Integrate with manageExecution.ts
6. Add GCR operations if needed
7. Update documentation

### **Code Reuse Strategy**
- **Handler Signatures**: Follow `handleIdentityRequest.ts` pattern
- **Response Format**: Use `createRPCResponse` utility
- **Utilities**: Leverage existing crypto/hashing functions
- **Configuration**: Use SharedState pattern

## 🧪 Testing & Validation

### **Test Structure**
- **Unit Tests**: Individual component testing
- **Integration Tests**: Feature interaction testing
- **Transaction Tests**: End-to-end transaction flow

### **Validation Patterns**
- **Input Validation**: Size limits, type checking
- **Signature Verification**: Ed25519 validation
- **State Consistency**: GCR integrity checks

## 🚦 Error Handling

### **Error Response Format**
```typescript
{
    result: 400,                // Error code
    response: "Error message",  // Human-readable error
    require_reply: false,
    extra: "Debug information"  // Optional debug info
}
```

### **Common Error Patterns**
- **Validation Errors**: 400 status codes
- **Authentication Errors**: 401 status codes
- **Not Found**: 404 status codes
- **Server Errors**: 500 status codes

## 🔌 Integration Points

### **SDK Integration**
- **Package**: `@kynesyslabs/demosdk`
- **Types**: Shared type definitions
- **Utilities**: Cryptographic functions
- **Abstractions**: High-level APIs

### **External Services**
- **Bridges**: Multi-chain support
- **Web2**: Proxy and DAHR systems
- **Fediverse**: ActivityPub integration
- **AI Services**: MCP protocol support

## 📈 Monitoring & Observability

### **Logging System**
- **Location**: `src/utilities/logger.ts`
- **Levels**: Debug, info, warn, error
- **Format**: Structured logging with timestamps

### **Performance Metrics**
- **Consensus Time**: Block generation metrics
- **Transaction Throughput**: TPS measurement
- **Network Health**: Peer connectivity status

## 🔮 Future Considerations

### **Architectural Evolution**
- **Modular Design**: Plugin-based architecture
- **Scalability**: Horizontal scaling capabilities
- **Interoperability**: Cross-chain standardization
- **Security**: Advanced cryptographic methods

### **Development Roadmap**
- **Smart Contracts**: Logic execution expansion
- **DeFi Integration**: Financial primitives
- **Privacy Features**: Enhanced ZK integration
- **Enterprise Features**: Governance and compliance

---

## 🎯 Quick Reference for LLMs

### **When Adding New Features**
1. **Follow patterns** in `src/features/web2/` or `src/features/multichain/`
2. **Reuse utilities** from `src/libs/` extensively
3. **Use SharedState** for configuration
4. **Follow handler patterns** from existing transaction handlers
5. **Update integration points** in manageExecution.ts and txToGCROperation.ts

### **Key Files to Understand**
- **`sharedState.ts`**: Central configuration
- **`manageExecution.ts`**: Request routing
- **`txToGCROperation.ts`**: State management
- **`handleIdentityRequest.ts`**: Handler pattern example
- **`server_rpc.ts`**: Response format standards

### **Common Reusable Components**
- **`Hashing.sha256()`**: Hash generation
- **`emptyResponse`**: Response template
- **`createRPCResponse`**: Response builder pattern
- **SharedState configuration**: Environment variables
- **JSON processing**: Bigint handling patterns

---

*This document provides complete codebase understanding for rapid development without re-analysis. All patterns, utilities, and integration points are documented for immediate use.*