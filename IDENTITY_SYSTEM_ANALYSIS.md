# Demos Network Current Identity Verification System Analysis

## Executive Summary

The Demos Network implements a **public multi-identity verification system** that allows users to link and verify multiple blockchain addresses (Web3), Web2 social accounts, and post-quantum cryptographic identities. All identity data is stored publicly in the **Global Change Registry (GCR)** - a JSONB-based state storage system.

---

## 1. CURRENT IDENTITY/VERIFICATION SYSTEM ARCHITECTURE

### 1.1 Three-Tier Identity Model

The system supports three distinct identity types stored in `StoredIdentities`:

```typescript
// Location: /src/model/entities/types/IdentityTypes.ts
export type StoredIdentities = {
    xm: {           // Cross-chain (Web3) identities
        [chain: string]: {
            [subchain: string]: SavedXmIdentity[]
        }
    }
    web2: {         // Web2 social identities
        [context: string]: Web2GCRData["data"][]
    }
    pqc: {          // Post-Quantum Cryptography identities
        [algorithm: string]: SavedPqcIdentity[]
    }
}
```

### 1.2 Supported Social Platforms

Currently implemented Web2 identity contexts:
- **Twitter/X** - Via tweet URL proof with bot detection
- **GitHub** - Via gist proof validation
- **Discord** - Via Discord message proof
- **Telegram** - Via dual-signature attestation (user + bot)

### 1.3 Cross-Chain Identity Support

Supported blockchain chains:
- **EVM Networks** (Ethereum, Polygon, Arbitrum, etc.) - with chainId validation
- **Solana** - mainnet only (testnet not supported)
- **IBC** - Interchain networks
- **TON** - TON blockchain
- **XRPL** - Ripple
- **NEAR** - NEAR Protocol
- **Aptos** - (through MultiVersX)
- **Bitcoin** - (limited support)

---

## 2. DATABASE SCHEMA FOR IDENTITIES/VERIFICATION

### 2.1 Main GCR Entity Structure

**File**: `/src/model/entities/GCRv2/GCR_Main.ts`

```typescript
@Entity("gcr_main")
export class GCRMain {
    pubkey: string                          // Primary key - ed25519 public key
    assignedTxs: string[]                  // Transaction hashes for this account
    nonce: number                          // Last nonce used
    balance: bigint                        // Account balance
    identities: StoredIdentities           // All linked identities (JSONB)
    points: {                              // Incentive points tracking
        totalPoints: number
        breakdown: {
            web3Wallets: { [chain: string]: number }
            socialAccounts: { twitter, github, discord, telegram }
            referrals: number
            demosFollow: number
        }
    }
    referralInfo: {                        // Referral system data
        totalReferrals: number
        referralCode: string
        referrals: Array<{...}>
    }
    flagged: boolean                       // Compliance flag (bot detection, etc.)
    flaggedReason: string                  // Why account is flagged
    reviewed: boolean                      // Manual review status
    createdAt: Date
    updatedAt: Date
}
```

### 2.2 Identity Data Structures

#### Web3 Identity (SavedXmIdentity)
```typescript
interface SavedXmIdentity {
    address: string        // Cross-chain address
    signature: string      // Proof of ownership signature
    publicKey: string      // Public key (optional)
    timestamp: number      // When linked
    signedData: string     // Original signed message
}
```

#### Web2 Identity (Web2GCRData)
```typescript
// Stored as Web2GCRData["data"][] in GCR
{
    userId: string         // Platform-specific ID
    username: string       // Display name
    proof: string          // Proof URL or attestation object
    proofHash: string      // SHA256 hash of proof (for validation)
    timestamp: number      // When linked
    // For Telegram specifically:
    // proof is a TelegramSignedAttestation object with dual signatures
}
```

#### Post-Quantum Identity (SavedPqcIdentity)
```typescript
interface SavedPqcIdentity {
    address: string        // PQC public key
    signature: string      // Proof signature
    timestamp: number      // When linked
    algorithm: string      // Algorithm type (falcon, dilithium, etc.)
}
```

### 2.3 Transaction Storage

**File**: `/src/model/entities/Transactions.ts`

```typescript
@Entity("transactions")
export class Transactions {
    id: number
    blockNumber: number
    signature: string                // Algorithm-specific signature
    ed25519_signature: string        // ed25519 signature (nullable)
    status: string                   // Transaction status
    hash: string                     // Unique tx hash
    content: TransactionContent      // Full tx content (JSON)
    type: TransactionContent["type"] // Transaction type
    from: string                     // Sender address
    from_ed25519_address: string     // Sender ed25519 address
    to: string                       // Recipient
    amount: number
    nonce: number
    timestamp: number
    networkFee: number
    rpcFee: number
    additionalFee: number
}
```

---

## 3. TRANSACTION TYPES DEFINITION

### 3.1 Transaction Type System

Transaction types are defined in the DemoSDK (`@kynesyslabs/demosdk/types`):

**Common types**:
- `"genesis"` - Genesis block transactions
- `"NODE_ONLINE"` - Node status updates
- Identity-related types (see below)
- Native operations
- GCR operations

### 3.2 Identity-Specific Transaction Types

**Location**: Handled in `/src/libs/network/routines/transactions/handleIdentityRequest.ts`

Transaction structure for identity operations:
```typescript
interface IdentityPayload {
    method: string  // Identity operation method
    payload: any    // Operation-specific data
}

// Supported methods:
// "xm_identity_assign"      - Add Web3 identity
// "xm_identity_remove"      - Remove Web3 identity
// "web2_identity_assign"    - Add Web2 identity
// "web2_identity_remove"    - Remove Web2 identity
// "pqc_identity_assign"     - Add PQC identity
// "pqc_identity_remove"     - Remove PQC identity
```

### 3.3 GCR Edit Operations

**Location**: `/src/libs/blockchain/gcr/types/GCROperations.ts`

GCR edits are applied through `GCREdit` type from DemoSDK:

```typescript
interface GCREdit {
    type: "identity" | "balance" | "nonce"  // Operation type
    operation: "add" | "remove"              // Add or remove
    context: "xm" | "web2" | "pqc"          // Identity type
    account: string                          // Target account
    data: any                                // Operation-specific data
    isRollback: boolean                      // Rollback flag
}
```

**Supported combinations** (in `GCRIdentityRoutines.apply()`):
- `xmadd`, `xmremove` - Cross-chain identity operations
- `web2add`, `web2remove` - Web2 identity operations
- `pqcadd`, `pqcremove` - Post-quantum identity operations
- `pointsadd`, `pointsremove` - Incentive points

---

## 4. HOW VALIDATOR LOGIC HANDLES TRANSACTIONS

### 4.1 Transaction Validation Pipeline

**File**: `/src/libs/blockchain/routines/validateTransaction.ts`

Process:
1. **Signature Verification** - Verify tx signature using sender's public key
2. **Validity Data Creation** - Generate `ValidityData` structure
3. **Gas Calculation** - Calculate gas requirements (deprecated in current flow)
4. **RPC Signature** - Sign the ValidityData with node's signing algorithm

```typescript
async function confirmTransaction(
    tx: Transaction,
    sender: string,
): Promise<ValidityData> {
    // 1. Verify signature
    const { verified } = await Transaction.confirmTx(tx, sender)
    
    // 2. Create validity data
    let validityData: ValidityData = {
        data: {
            valid: verified,
            reference_block: referenceBlock,
            message: "...",
            transaction: tx
        },
        signature: null,
        rpc_public_key: { ... }
    }
    
    // 3. Sign validity data
    validityData = await signValidityData(validityData)
    return validityData
}
```

### 4.2 Identity Request Handling

**File**: `/src/libs/network/routines/transactions/handleIdentityRequest.ts`

Validator logic for identity operations:

```typescript
async function handleIdentityRequest(
    tx: Transaction,
    sender: string,
): Promise<IdentityResponse> {
    const payload = tx.content.data[1] as IdentityPayload
    
    switch (payload.method) {
        case "xm_identity_assign":
            // Verify cross-chain signature using IdentityManager
            return await IdentityManager.verifyPayload(payload.payload, sender)
            
        case "pqc_identity_assign":
            // Verify PQC signatures
            return await IdentityManager.verifyPqcPayload(payload.payload, sender)
            
        case "web2_identity_assign":
            // Verify Web2 proof (GitHub gist, Twitter tweet, Discord msg, Telegram attestation)
            return await verifyWeb2Proof(payload.payload, sender)
            
        case "xm_identity_remove":
        case "pqc_identity_remove":
        case "web2_identity_remove":
            return { success: true, message: "Identity removed" }
    }
}
```

### 4.3 Validators Management

**File**: `/src/libs/blockchain/routines/validatorsManagement.ts`

Validator entrance requirements:
- Minimum stake: 10000000000000000000000000
- Not already staking
- Not in chain blacklist
- Never been kicked from chain

Validator status:
- Status 2 = Valid/Active
- Checked via `GCR.getGCRValidatorStatus()`

---

## 5. CRYPTOGRAPHIC & ATTESTATION MECHANISMS

### 5.1 Current Cryptographic Implementations

#### ED25519 (Primary Identity Algorithm)
- **Purpose**: Node and user identities
- **File**: `/src/libs/crypto/cryptography.ts`
- **Key Management**: BIP39 mnemonic → ED25519 keypair
- **Usage**: Primary signing algorithm for transactions

```typescript
// Key generation from mnemonic
async mnemonicToSeed(mnemonic: string): Uint8Array
async loadIdentity(): KeyPair  // From stored mnemonic
```

#### Post-Quantum Cryptography - SuperDilithium

**File**: `/src/libs/crypto/pqc/enigma.ts`

```typescript
class Enigma {
    async init(privateKey?: Uint8Array)
    async sign(message: string | Uint8Array)
    async verify(signature, message, publicKey)
    async exportKeys(passphrase: string)
}
```

- **Algorithm**: SuperDilithium (lattice-based)
- **Use Case**: Future quantum-resistant signing
- **Status**: Implemented but not yet integrated into main flow

#### RSA (Legacy - Not Quantum Safe)
- 8192-bit keys (strong classically, but NOT quantum-resistant)
- Used in `EnhancedCrypto` for hybrid encryption
- Hybrid approach: RSA-OAEP for key encapsulation + AES-GCM for data

**File**: `/src/features/postQuantumCryptography/enigma_lite.ts`

### 5.2 Web2 Proof Verification System

**File**: `/src/libs/abstraction/index.ts`

#### Twitter Proof Verification
```typescript
// Process:
1. Extract tweet ID from proof URL
2. Fetch tweet via Twitter API
3. Parse proof payload from tweet text
4. Verify signature using ed25519: verify({
    algorithm: "ed25519",
    message: sender.ed25519_address,
    publicKey: sender.pubkey,
    signature: extractedSignature
})
```

#### GitHub Proof Verification
```typescript
// Process:
1. Extract gist ID and username from URL
2. Fetch gist content via GitHub API
3. Validate gist owner matches username
4. Parse and verify signature
```

#### Discord Proof Verification
```typescript
// Process:
1. Extract channel ID and message ID from Discord URL
2. Fetch message from Discord API
3. Validate message author
4. Parse payload from message content
5. Verify signature
```

#### Telegram Dual-Signature Attestation

**Unique approach**: Requires TWO signatures
```typescript
// Structure:
TelegramSignedAttestation {
    payload: {
        telegram_user_id: number/string
        username: string
        challenge: string
        public_key: hex string      // User's ed25519 public key
        signature: hex string        // User's signature of challenge
        bot_address: hex string      // Bot's ed25519 address
    }
    signature: {                     // Bot's signature
        type: "ed25519"
        data: hex string
    }
}

// Verification:
1. Verify user signature: user_pubkey signs challenge
2. Verify bot signature: bot_address signs entire payload
3. Check bot authorization: bot_address must exist in genesis block
```

**File**: `/src/libs/abstraction/index.ts` - `verifyTelegramProof()`

### 5.3 Zero-Knowledge Proof Infrastructure

**Status**: Foundational implementation exists

**File**: `/src/features/zk/iZKP/zk.ts`

Current ZK implementation is basic (Schnorr-like protocol):
```typescript
class Prover {
    generateCommitment(): BigInteger
    respondToChallenge(challenge: number): BigInteger
}

class Verifier {
    generateChallenge(commitment): number
    verifyResponse(response, challenge): boolean
}
```

**Assessment**: Very basic, not suitable for production privacy systems. Would need significant enhancement for ZK-SNARK integration.

---

## 6. GCR (GLOBAL CHANGE REGISTRY) - PUBLIC ATTESTATION SYSTEM

### 6.1 What is GCR?

The **Global Change Registry** is Demos Network's public state ledger:
- **Storage**: JSONB columns in PostgreSQL
- **Scope**: Stores ALL user account state (balances, identities, points, etc.)
- **Accessibility**: ALL data is PUBLIC - visible to any network participant
- **Structure**: Per-user GCR entries indexed by ed25519 public key

### 6.2 Identity Application Flow

**File**: `/src/libs/blockchain/gcr/gcr_routines/GCRIdentityRoutines.ts`

#### Adding Cross-Chain (Web3) Identity
```typescript
async applyXmIdentityAdd(editOperation) {
    // 1. Ensure GCR exists for user
    const accountGCR = await ensureGCRForUser(account)
    
    // 2. Check if identity already linked
    const addressExists = accountGCR.identities.xm[chain][subchain]
        .some(id => id.address === targetAddress)
    if (addressExists) return { success: false }
    
    // 3. Add identity
    accountGCR.identities.xm[chain][subchain].push({
        address: normalizedAddress,
        signature: signature,
        publicKey: publicKey,
        timestamp: timestamp,
        signedData: signedData
    })
    
    // 4. Award incentive points for first connection
    if (isFirst) {
        await IncentiveManager.walletLinked(account, address, chain)
    }
    
    // 5. Save to database
    await gcrMainRepository.save(accountGCR)
}
```

#### Adding Web2 Identity
```typescript
async applyWeb2IdentityAdd(editOperation) {
    // 1. Get or create GCR entry
    const accountGCR = await ensureGCRForUser(account)
    
    // 2. Verify proof based on context:
    if (context === "telegram") {
        // Verify dual signatures
        proofOk = await verifyWeb2Proof(payload, accountGCR.pubkey)
    } else {
        // Verify SHA256 hash of proof
        proofOk = Hashing.sha256(proof) === proofHash
    }
    
    // 3. Add identity to GCR
    accountGCR.identities.web2[context].push(data)
    
    // 4. Award points for first connection
    if (isFirst) {
        await IncentiveManager.twitterLinked(account, userId)
        // or .githubLinked(), .telegramLinked(), .discordLinked()
    }
    
    // 5. Save to database
    await gcrMainRepository.save(accountGCR)
}
```

#### Adding Post-Quantum Identity
```typescript
async applyPqcIdentityAdd(editOperation) {
    // 1. Get or create GCR entry
    const accountGCR = await ensureGCRForUser(account)
    
    // 2. For each PQC identity in payload:
    for (const identity of identities) {
        // 3. Validate required fields
        if (!algorithm || !address || !signature) return error
        
        // 4. Check if already exists
        const keyExists = accountGCR.identities.pqc[algorithm]
            .some(key => key.address === address)
        if (keyExists) return error
        
        // 5. Add identity
        accountGCR.identities.pqc[algorithm].push({
            address,
            signature,
            timestamp
        })
    }
    
    // 6. Save to database
    await gcrMainRepository.save(accountGCR)
}
```

### 6.3 Public Query Interface

**File**: `/src/libs/blockchain/gcr/gcr_routines/identityManager.ts`

Get identities:
```typescript
static async getIdentities(address: string, key?: string): Promise<any>
static async getXmIdentities(address, chain, subchain)
static async getWeb2Identities(address, context)
static async getPQCIdentity(address)
```

### 6.4 GCR Versioning

The system uses multiple GCR table versions:
- `GlobalChangeRegistry` (v1) - Legacy format
- `GCRMain` (v2) - Current format - primary table
- `GCRHashes` (v2) - Hash tracking
- `GCRTracker` (v2) - Operation tracking
- `GCRSubnetsTxs` (v2) - Transaction tracking

---

## 7. KEY INTEGRATION POINTS

### 7.1 Social Account Linking

**Web2 Tools**: `/src/libs/identity/tools/`
- `twitter.ts` - Twitter API integration + bot detection
- `discord.ts` - Discord message verification
- `crosschain.ts` - Cross-chain address validation

**Web2 Parsers**: `/src/libs/abstraction/web2/`
- Parse proof URLs/messages
- Extract payload (message + signature + type)
- Verify signature against sender's ed25519 key

### 7.2 Incentive System Integration

**File**: `/src/libs/blockchain/gcr/gcr_routines/IncentiveManager.ts`

Points awarded on first connection:
- Twitter link: `twitterLinked(account, userId)`
- GitHub link: `githubLinked(account, userId)`
- Telegram link: `telegramLinked(account, userId, referralCode, proof)`
- Discord link: `discordLinked(account, referralCode)`
- Wallet link: `walletLinked(account, address, chain)`

Points deducted on unlinking:
- `twitterUnlinked()`, `githubUnlinked()`, etc.

### 7.3 Bot Detection for Twitter

**File**: `/src/libs/identity/tools/twitter.ts`

Implements `TwitterBotDetector` with scoring system:
- Verification status
- Username pattern analysis
- Bio content analysis
- Profile completeness
- Timing anomalies
- Content patterns
- Account age/activity ratio
- Followers analysis
- Quota limit detection

**Threshold**: Score >= 15 = Likely bot

---

## 8. EXISTING GAPS & LIMITATIONS

### 8.1 For ZK-SNARK Privacy Integration

**Current Issues**:
1. **All identities are PUBLIC** - stored in JSONB in accessible GCR
2. **No privacy layer** - identity linking is transparent to network
3. **Proof of control** - only requires signature, not zero-knowledge proofs
4. **No anonymity set** - identities are directly linked to ed25519 addresses
5. **Social account exposure** - Twitter/GitHub/Discord IDs are visible in GCR
6. **No confidentiality** - balance and points are public

### 8.2 Transaction Type System

**Limitation**: Transaction types come from external SDK - limited extensibility
- Would need SDK changes for new transaction types
- GCREdit types use `any` due to union type constraints
- No standardized identity operation type definitions

### 8.3 Zero-Knowledge Proof Infrastructure

- Current ZK implementation (iZKP) is too basic
- No ZK-SNARK support (would need library like snarkjs or circom)
- No privacy-preserving proof system
- Dilithium PQC not integrated into main identity flow

### 8.4 Cryptographic Limitations

- RSA used in hybrid encryption is NOT quantum-resistant
- Only ed25519 has production integration
- SuperDilithium is implemented but not used
- No lattice-based encryption for privacy

---

## 9. ARCHITECTURAL RECOMMENDATIONS FOR ZK-SNARK PRIVACY SYSTEM

### 9.1 Parallel Privacy Layer Architecture

To integrate ZK-SNARK privacy alongside public identity system:

**Option 1: Dual-Registration Model**
```
User Ed25519 Address
├── Public GCR (current)
│   └── Identities: {xm, web2, pqc}
│   └── Balance: public
│   └── Points: public
└── Private Commitment Registry (new)
    └── Identity Commitments: hash(identities)
    └── Private Balance: encrypted
    └── Proof of Solvency: ZK proofs
```

**Option 2: Commitment-Based Identity**
```
Commitment Address (derived from hash)
├── Hidden identities
├── Zero-knowledge proofs of:
│   └── Proof of web2 account ownership
│   └── Proof of cross-chain address control
│   └── Proof of valid social account
└── Privacy-preserving balance/points
```

### 9.2 Key Design Decisions Needed

1. **Should Privacy be Optional or Mandatory?**
   - Optional: Keep current public system, add optional privacy tier
   - Mandatory: Move to privacy-first, support public proofs for compatibility

2. **Identity Linking Method**
   - Keep same verification process, wrap in ZK proof
   - Change to threshold-based multi-proof system

3. **Storage Approach**
   - New separate tables for privacy commitments
   - Extend GCRMain with privacy column

4. **Interoperability**
   - How does private identity interact with public incentive system?
   - Can private accounts earn/spend public points?

---

## 10. FILES REFERENCE MAP

### Core Identity Files
- `/src/model/entities/types/IdentityTypes.ts` - Identity data types
- `/src/model/entities/GCRv2/GCR_Main.ts` - Main GCR schema
- `/src/libs/identity/identity.ts` - User identity/key management
- `/src/libs/identity/tools/twitter.ts` - Twitter bot detection
- `/src/libs/identity/tools/discord.ts` - Discord integration
- `/src/libs/identity/tools/crosschain.ts` - Cross-chain tools

### Verification & Validation
- `/src/libs/abstraction/index.ts` - Web2 proof verification
- `/src/libs/abstraction/web2/github.ts` - GitHub proof parser
- `/src/libs/abstraction/web2/twitter.ts` - Twitter proof parser
- `/src/libs/abstraction/web2/discord.ts` - Discord proof parser
- `/src/libs/blockchain/routines/validateTransaction.ts` - Transaction validation
- `/src/libs/network/routines/transactions/handleIdentityRequest.ts` - Identity request routing

### GCR Operations
- `/src/libs/blockchain/gcr/gcr_routines/GCRIdentityRoutines.ts` - Apply identity operations
- `/src/libs/blockchain/gcr/gcr_routines/identityManager.ts` - Identity verification
- `/src/libs/blockchain/gcr/gcr_routines/IncentiveManager.ts` - Points system
- `/src/libs/blockchain/gcr/gcr.ts` - Main GCR implementation

### Cryptography
- `/src/libs/crypto/cryptography.ts` - ED25519 key management
- `/src/libs/crypto/pqc/enigma.ts` - SuperDilithium PQC
- `/src/features/postQuantumCryptography/enigma_lite.ts` - Hybrid encryption
- `/src/features/zk/iZKP/zk.ts` - Basic ZK proof system

### Transaction Processing
- `/src/libs/blockchain/transaction.ts` - Transaction class
- `/src/libs/blockchain/gcr/gcr_routines/txToGCROperation.ts` - TX to GCR operation conversion

---

## 11. CONCLUSION

The Demos Network implements a sophisticated **public, multi-layered identity verification system** that:

1. **Supports three identity types**: Web3 (cross-chain), Web2 (social), and PQC (post-quantum)
2. **Uses ed25519 as primary cryptography** with future PQC readiness
3. **Stores all identities publicly in GCR** - transparent and verifiable
4. **Implements dual-signature attestation** for Telegram (user + bot)
5. **Includes bot detection** for social accounts
6. **Awards incentive points** for linked identities

For **ZK-SNARK privacy integration**, the main challenge is the public nature of GCR storage. A privacy system would need to either:
- Create a parallel private commitment registry
- Use commitments and zero-knowledge proofs for identity verification
- Implement selective disclosure mechanisms
- Maintain compatibility with existing incentive system

The current ZK infrastructure is minimal and would require substantial development for production use.

