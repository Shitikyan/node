# ZK-SNARK Privacy Identity System - Implementation Plan

## Executive Summary

This document outlines the implementation plan for a **privacy-preserving identity system** using ZK-SNARKs alongside Demos Network's existing public identity system. Users can prove "I have a unique GitHub/Discord/Twitter account and EVM/Solana wallet linked to my Demos account" without revealing which specific accounts they are.

---

## 1. SCOPE & OBJECTIVES

### In Scope

**Web2 Platforms** (3):
- ✅ Twitter/X
- ✅ GitHub
- ✅ Discord
- ❌ Telegram (deferred - dual-signature complexity)

**Cross-Chain** (2):
- ✅ EVM (Ethereum, Polygon, Arbitrum, etc.) - **Priority 1**
- ✅ Solana - **Priority 2**
- ❌ TON, XRPL, NEAR, Aptos, Bitcoin (future releases)

**Features**:
- ✅ Nullifier-based commitment system
- ✅ Merkle tree for commitment accumulation
- ✅ Zero-knowledge proofs of identity ownership
- ✅ Dual-mode architecture (public + private coexist)
- ❌ Incentive system integration (only public identities earn points)
- ❌ Post-quantum cryptography integration (future)

### Success Criteria

1. User can privately link Twitter/GitHub/Discord accounts
2. User can privately link EVM and Solana wallets
3. User can prove ownership without revealing specific account
4. System prevents double-linking (same account to multiple Demos addresses)
5. Backward compatible with existing public identity system
6. Proof generation < 10 seconds
7. Proof verification < 1 second

---

## 2. SYSTEM ARCHITECTURE

### 2.1 Dual-Mode Identity Model

```
Demos User (ed25519 address)
│
├─ PUBLIC MODE (existing, unchanged)
│  ├─ identities.web2 = { twitter: [...], github: [...], discord: [...] }
│  ├─ identities.xm = { evm: [...], solana: [...] }
│  └─ points = { ... }  ← Only public identities earn points
│
└─ PRIVATE MODE (new)
   ├─ identity_commitments[] = [
   │    { hash: H(provider_id, secret), leaf_index: 0, type: "twitter" },
   │    { hash: H(wallet_addr, secret), leaf_index: 1, type: "evm" }
   │  ]
   ├─ merkle_root = root of commitment tree
   └─ used_nullifiers[] = [nullifier1, nullifier2, ...]
```

### 2.2 Core Cryptographic Flow

#### Phase 1: Commitment (Link Identity - One Time)

```
User (client-side):
1. Generate secret (never leaves device)
2. Create commitment = H(provider_id, secret)
3. Sign transaction: { type: "identity_commitment", commitment, identity_type }

Validator:
4. Verify transaction signature
5. Add commitment to Merkle tree
6. Store commitment in GCR
7. Update merkle_root
```

#### Phase 2: Attestation (Prove Ownership - Repeatable)

```
User (client-side):
1. Generate nullifier = H(provider_id, context)
2. Create ZK proof: "I know (provider_id, secret) in commitment tree"
3. Sign transaction: { type: "identity_attestation", proof, nullifier }

Validator:
4. Verify transaction signature
5. Check nullifier not used before
6. Verify ZK proof against current merkle_root
7. Mark nullifier as used
```

### 2.3 Nullifier System

**Purpose**: Prevent same identity from being proven multiple times in same context

```typescript
// Nullifier generation (client-side)
nullifier = Poseidon(provider_id, context_string, secret)

// Examples:
nullifier_twitter_governance = H(twitter_id, "governance_vote_2025", secret)
nullifier_evm_airdrop = H(evm_address, "airdrop_round_1", secret)

// Validator checks:
if (usedNullifiers.includes(nullifier)) {
    return { valid: false, reason: "Nullifier already used" }
}
```

**Key insight**: Different contexts allow same identity to be proven multiple times, but same context only once.

---

## 3. ZK CIRCUIT DESIGN

### 3.1 Core Circuits (Build from Scratch)

We will **trash existing ZK code** (`/src/features/zk/iZKP/`) and rebuild using **snarkjs + Circom**.

#### Circuit 1: ED25519 Signature Verification

**File**: `/src/libs/zk/circuits/ed25519Verify.circom`

```circom
pragma circom 2.0.0;

include "circomlib/circuits/eddsaposeidon.circom";

template ED25519SignatureVerify() {
    signal input message;
    signal input signature[64];
    signal input publicKey[32];
    signal output valid;

    component verifier = EdDSAPoseidonVerifier();
    verifier.enabled <== 1;
    verifier.Ax <== publicKey[0];
    verifier.Ay <== publicKey[1];
    verifier.S <== signature[0];
    verifier.R8x <== signature[1];
    verifier.R8y <== signature[2];
    verifier.M <== message;

    valid <== verifier.out;
}

component main = ED25519SignatureVerify();
```

**Purpose**: Verify Demos user's ed25519 signature in ZK
**Complexity**: Medium (150-200 constraints)
**Usage**: Validate user owns their Demos account

#### Circuit 2: EVM ECDSA Signature Verification

**File**: `/src/libs/zk/circuits/evmSignatureVerify.circom`

```circom
pragma circom 2.0.0;

include "circomlib/circuits/ecdsa.circom";
include "circomlib/circuits/sha256.circom";

template EVMSignatureVerify() {
    signal input message[32];           // keccak256(message)
    signal input signature_r[256];      // ECDSA signature r
    signal input signature_s[256];      // ECDSA signature s
    signal input signature_v;           // Recovery id
    signal input publicKey_x[256];      // Public key x-coordinate
    signal input publicKey_y[256];      // Public key y-coordinate
    signal input evmAddress[20];        // Ethereum address (last 20 bytes of keccak256(pubkey))

    signal output valid;

    // Verify ECDSA signature on secp256k1
    component ecdsaVerify = ECDSAVerify(64, 4);
    ecdsaVerify.r <== signature_r;
    ecdsaVerify.s <== signature_s;
    ecdsaVerify.msghash <== message;
    ecdsaVerify.pubkey[0] <== publicKey_x;
    ecdsaVerify.pubkey[1] <== publicKey_y;

    // Verify address matches public key
    component addressCheck = Keccak256(64);
    addressCheck.in <== [publicKey_x, publicKey_y];

    // Last 20 bytes of hash should match evmAddress
    signal addressValid;
    // ... address validation logic ...

    valid <== ecdsaVerify.result * addressValid;
}

component main = EVMSignatureVerify();
```

**Purpose**: Verify EVM wallet signature in ZK
**Complexity**: HIGH (50,000+ constraints) - ECDSA on secp256k1 is expensive
**Usage**: Prove ownership of EVM wallet without revealing address

#### Circuit 3: Solana Signature Verification

**File**: `/src/libs/zk/circuits/solanaSignatureVerify.circom`

```circom
pragma circom 2.0.0;

include "circomlib/circuits/eddsaposeidon.circom";

template SolanaSignatureVerify() {
    signal input message[32];
    signal input signature[64];
    signal input publicKey[32];
    signal output valid;

    // Solana uses ed25519, similar to Demos
    component verifier = EdDSAPoseidonVerifier();
    verifier.enabled <== 1;
    verifier.Ax <== publicKey[0];
    verifier.Ay <== publicKey[1];
    verifier.S <== signature[0];
    verifier.R8x <== signature[1];
    verifier.R8y <== signature[2];
    verifier.M <== message;

    valid <== verifier.out;
}

component main = SolanaSignatureVerify();
```

**Purpose**: Verify Solana wallet signature in ZK
**Complexity**: Medium (similar to ed25519)
**Usage**: Prove ownership of Solana wallet

#### Circuit 4: Merkle Tree Membership Proof

**File**: `/src/libs/zk/circuits/merkleProof.circom`

```circom
pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/mux1.circom";

template MerkleTreeInclusionProof(levels) {
    signal input leaf;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    signal input root;

    component hashers[levels];
    component mux[levels];

    signal levelHashes[levels + 1];
    levelHashes[0] <== leaf;

    for (var i = 0; i < levels; i++) {
        // Select left or right based on path index
        mux[i] = MultiMux1(2);
        mux[i].c[0][0] <== levelHashes[i];
        mux[i].c[0][1] <== pathElements[i];
        mux[i].c[1][0] <== pathElements[i];
        mux[i].c[1][1] <== levelHashes[i];
        mux[i].s <== pathIndices[i];

        // Hash the pair
        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== mux[i].out[0];
        hashers[i].inputs[1] <== mux[i].out[1];

        levelHashes[i + 1] <== hashers[i].out;
    }

    // Verify root matches
    root === levelHashes[levels];
}

component main = MerkleTreeInclusionProof(20); // 20 levels = 1M leaves
```

**Purpose**: Prove commitment exists in Merkle tree
**Complexity**: Low (20 * 2 = 40 Poseidon hashes)
**Usage**: Prove "I have a commitment in the tree" without revealing which one

#### Circuit 5: Identity Commitment Generator

**File**: `/src/libs/zk/circuits/identityCommitment.circom`

```circom
pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";

template IdentityCommitment() {
    signal input providerId;      // Twitter ID, GitHub ID, EVM address, etc.
    signal input secret;          // User's secret (never revealed)
    signal output commitment;

    component hasher = Poseidon(2);
    hasher.inputs[0] <== providerId;
    hasher.inputs[1] <== secret;

    commitment <== hasher.out;
}

component main = IdentityCommitment();
```

**Purpose**: Generate cryptographic commitment
**Complexity**: Trivial (1 Poseidon hash)
**Usage**: Client-side commitment generation

#### Circuit 6: Full Identity Attestation

**File**: `/src/libs/zk/circuits/identityAttestation.circom`

```circom
pragma circom 2.0.0;

include "./identityCommitment.circom";
include "./merkleProof.circom";
include "circomlib/circuits/poseidon.circom";

template IdentityAttestation(levels) {
    // Private inputs (not revealed)
    signal input providerId;           // Twitter ID, EVM address, etc.
    signal input secret;               // User secret
    signal input merklePathElements[levels];
    signal input merklePathIndices[levels];

    // Public inputs (revealed)
    signal input merkleRoot;           // Current commitment tree root
    signal input nullifier;            // Context-specific nullifier
    signal input contextHash;          // Hash of context string

    // Generate commitment
    component commitmentGen = IdentityCommitment();
    commitmentGen.providerId <== providerId;
    commitmentGen.secret <== secret;

    // Prove commitment is in tree
    component merkleProof = MerkleTreeInclusionProof(levels);
    merkleProof.leaf <== commitmentGen.commitment;
    merkleProof.pathElements <== merklePathElements;
    merkleProof.pathIndices <== merklePathIndices;
    merkleProof.root <== merkleRoot;

    // Verify nullifier is correct
    component nullifierCheck = Poseidon(3);
    nullifierCheck.inputs[0] <== providerId;
    nullifierCheck.inputs[1] <== contextHash;
    nullifierCheck.inputs[2] <== secret;

    nullifier === nullifierCheck.out;
}

component main {public [merkleRoot, nullifier, contextHash]} = IdentityAttestation(20);
```

**Purpose**: Main attestation circuit combining all components
**Complexity**: Medium (commitment + merkle proof + nullifier)
**Usage**: Full ZK proof that user owns an identity in the commitment set

### 3.2 Circuit Compilation & Setup

**Trusted Setup** (one-time, before deployment):

```bash
# 1. Install circom compiler
npm install -g circom@latest
npm install -g snarkjs@latest

# 2. Compile circuits
circom circuits/identityAttestation.circom --r1cs --wasm --sym -o build/

# 3. Download Powers of Tau (or generate)
wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_20.ptau

# 4. Groth16 setup (or use PLONK for no trusted setup)
snarkjs groth16 setup build/identityAttestation.r1cs powersOfTau28_hez_final_20.ptau circuit_0000.zkey

# 5. Contribute to ceremony (optional, for production)
snarkjs zkey contribute circuit_0000.zkey circuit_final.zkey --name="Demos contribution" -v

# 6. Export verification key
snarkjs zkey export verificationkey circuit_final.zkey verification_key.json

# 7. Export Solidity verifier (optional, for EVM smart contract verification)
snarkjs zkey export solidityverifier circuit_final.zkey Verifier.sol
```

**Build artifacts**:
- `identityAttestation.wasm` - Prover WASM module
- `identityAttestation.r1cs` - Constraint system
- `circuit_final.zkey` - Proving key
- `verification_key.json` - Verification key (goes onchain/in validator)

---

## 4. DATABASE SCHEMA CHANGES

### 4.1 GCRMain Entity Extensions

**File**: `/src/model/entities/GCRv2/GCR_Main.ts`

```typescript
@Entity("gcr_main")
export class GCRMain {
    // ... existing fields ...

    @Column({
        type: "jsonb",
        nullable: true,
        default: null
    })
    private_identities?: PrivateIdentityData

    @Column({
        type: "varchar",
        nullable: true,
        default: "public"
    })
    identity_mode?: "public" | "private" | "dual"
}

interface PrivateIdentityData {
    commitments: Array<{
        hash: string              // Poseidon(provider_id, secret)
        leaf_index: number        // Position in Merkle tree
        identity_type: "web2" | "xm"
        platform: "twitter" | "github" | "discord" | "evm" | "solana"
        timestamp: number         // When committed
    }>
    merkle_root: string          // Current root of commitment tree
    used_nullifiers: string[]    // Nullifiers already consumed
}
```

### 4.2 New Table: Private Commitment Registry

**File**: `/src/model/entities/PrivateCommitments.ts`

```typescript
import { Entity, Column, PrimaryGeneratedColumn, Index } from "typeorm"

@Entity("private_commitments")
export class PrivateCommitments {
    @PrimaryGeneratedColumn()
    id: number

    @Column({ type: "varchar", length: 66 })
    @Index()
    pubkey: string                      // User's ed25519 public key

    @Column({ type: "varchar", length: 66 })
    @Index()
    commitment_hash: string             // H(provider_id, secret)

    @Column({ type: "int" })
    leaf_index: number                  // Position in Merkle tree

    @Column({ type: "varchar", length: 20 })
    identity_type: "web2" | "xm"

    @Column({ type: "varchar", length: 20 })
    platform: "twitter" | "github" | "discord" | "evm" | "solana"

    @Column({ type: "bigint" })
    block_number: number                // Block when committed

    @Column({ type: "varchar", length: 66 })
    @Index()
    transaction_hash: string            // Commitment transaction

    @Column({ type: "timestamp" })
    created_at: Date
}
```

### 4.3 New Table: Merkle Tree State

**File**: `/src/model/entities/MerkleTreeState.ts`

```typescript
import { Entity, Column, PrimaryGeneratedColumn, Index } from "typeorm"

@Entity("merkle_tree_state")
export class MerkleTreeState {
    @PrimaryGeneratedColumn()
    id: number

    @Column({ type: "bigint" })
    @Index()
    block_number: number                // Block height

    @Column({ type: "varchar", length: 66 })
    merkle_root: string                 // Root hash at this block

    @Column({ type: "int" })
    leaf_count: number                  // Total commitments

    @Column({ type: "jsonb" })
    tree_snapshot?: {                   // Optional: store full tree state
        depth: number
        leaves: string[]
    }

    @Column({ type: "timestamp" })
    created_at: Date
}
```

### 4.4 New Table: Used Nullifiers

**File**: `/src/model/entities/UsedNullifiers.ts`

```typescript
import { Entity, Column, PrimaryGeneratedColumn, Index } from "typeorm"

@Entity("used_nullifiers")
export class UsedNullifiers {
    @PrimaryGeneratedColumn()
    id: number

    @Column({ type: "varchar", length: 66, unique: true })
    @Index()
    nullifier: string                   // H(provider_id, context, secret)

    @Column({ type: "varchar", length: 100 })
    context: string                     // What this nullifier was used for

    @Column({ type: "bigint" })
    block_number: number                // When used

    @Column({ type: "varchar", length: 66 })
    transaction_hash: string            // Attestation transaction

    @Column({ type: "timestamp" })
    used_at: Date
}
```

---

## 5. TRANSACTION TYPES

### 5.1 New Transaction Types

**Location**: Add to SDK types (coordinate with DemoSDK updates)

```typescript
// Transaction type: "identity_commitment"
interface IdentityCommitmentTransaction {
    type: "identity_commitment"
    data: [
        "identity_commitment",
        {
            commitment_hash: string          // Poseidon(provider_id, secret)
            identity_type: "web2" | "xm"
            platform: "twitter" | "github" | "discord" | "evm" | "solana"
        }
    ]
}

// Transaction type: "identity_attestation"
interface IdentityAttestationTransaction {
    type: "identity_attestation"
    data: [
        "identity_attestation",
        {
            proof: {
                pi_a: string[]               // ZK proof component A
                pi_b: string[][]             // ZK proof component B
                pi_c: string[]               // ZK proof component C
                protocol: "groth16"          // Or "plonk"
            }
            public_signals: {
                merkle_root: string          // Merkle root being proven against
                nullifier: string            // Context-specific nullifier
                context_hash: string         // Hash of context string
            }
            context: string                  // Human-readable context (e.g., "airdrop_round_1")
            identity_type: "web2" | "xm"
            platform: "twitter" | "github" | "discord" | "evm" | "solana"
        }
    ]
}
```

### 5.2 Transaction Validation Flow

**File**: `/src/libs/network/routines/transactions/handlePrivateIdentityRequest.ts` (new file)

```typescript
import { Transaction } from "@kynesyslabs/demosdk"
import { ZKProofVerifier } from "@/libs/zk/verifier"
import { MerkleTreeManager } from "@/libs/zk/merkleTree"
import { PrivateCommitments } from "@/model/entities/PrivateCommitments"
import { UsedNullifiers } from "@/model/entities/UsedNullifiers"
import { getRepository } from "typeorm"

export async function handlePrivateIdentityRequest(
    tx: Transaction,
    sender: string
): Promise<{ success: boolean; message: string }> {
    const [action, payload] = tx.content.data

    switch (action) {
        case "identity_commitment":
            return await processCommitment(payload, sender, tx)

        case "identity_attestation":
            return await processAttestation(payload, sender, tx)

        default:
            return { success: false, message: "Unknown action" }
    }
}

async function processCommitment(
    payload: any,
    sender: string,
    tx: Transaction
): Promise<{ success: boolean; message: string }> {
    const { commitment_hash, identity_type, platform } = payload

    // 1. Validate commitment format
    if (!commitment_hash || !identity_type || !platform) {
        return { success: false, message: "Invalid commitment payload" }
    }

    // 2. Check if commitment already exists
    const commitmentRepo = getRepository(PrivateCommitments)
    const existing = await commitmentRepo.findOne({
        where: { commitment_hash }
    })

    if (existing) {
        return { success: false, message: "Commitment already exists" }
    }

    // 3. Add to Merkle tree
    const merkleManager = MerkleTreeManager.getInstance()
    const leaf_index = await merkleManager.addLeaf(commitment_hash)

    // 4. Store commitment
    const commitment = commitmentRepo.create({
        pubkey: sender,
        commitment_hash,
        leaf_index,
        identity_type,
        platform,
        block_number: tx.blockNumber || 0,
        transaction_hash: tx.hash,
        created_at: new Date()
    })

    await commitmentRepo.save(commitment)

    return {
        success: true,
        message: `Commitment added at leaf index ${leaf_index}`
    }
}

async function processAttestation(
    payload: any,
    sender: string,
    tx: Transaction
): Promise<{ success: boolean; message: string }> {
    const { proof, public_signals, context, identity_type, platform } = payload

    // 1. Validate payload
    if (!proof || !public_signals || !context) {
        return { success: false, message: "Invalid attestation payload" }
    }

    const { merkle_root, nullifier, context_hash } = public_signals

    // 2. Check nullifier not already used
    const nullifierRepo = getRepository(UsedNullifiers)
    const nullifierUsed = await nullifierRepo.findOne({
        where: { nullifier }
    })

    if (nullifierUsed) {
        return { success: false, message: "Nullifier already used" }
    }

    // 3. Verify Merkle root is current or recent
    const merkleManager = MerkleTreeManager.getInstance()
    const currentRoot = merkleManager.getRoot()

    if (merkle_root !== currentRoot) {
        // Check if it's a recent historical root (within last 100 blocks)
        const isValidHistoricalRoot = await merkleManager.isValidHistoricalRoot(
            merkle_root,
            100
        )

        if (!isValidHistoricalRoot) {
            return { success: false, message: "Invalid Merkle root" }
        }
    }

    // 4. Verify ZK proof
    const verifier = new ZKProofVerifier(platform)
    const proofValid = await verifier.verify(proof, public_signals)

    if (!proofValid) {
        return { success: false, message: "Invalid ZK proof" }
    }

    // 5. Mark nullifier as used
    const usedNullifier = nullifierRepo.create({
        nullifier,
        context,
        block_number: tx.blockNumber || 0,
        transaction_hash: tx.hash,
        used_at: new Date()
    })

    await nullifierRepo.save(usedNullifier)

    return {
        success: true,
        message: "Identity attestation verified"
    }
}
```

---

## 6. ZK INFRASTRUCTURE CODE

### 6.1 Directory Structure

```
/src/libs/zk/
├── circuits/                           # Circom circuits
│   ├── identityCommitment.circom
│   ├── identityAttestation.circom
│   ├── merkleProof.circom
│   ├── ed25519Verify.circom
│   ├── evmSignatureVerify.circom
│   └── solanaSignatureVerify.circom
├── build/                              # Compiled circuits (gitignored)
│   ├── *.wasm
│   ├── *.r1cs
│   └── *.zkey
├── keys/                               # Proving/verification keys
│   ├── verification_keys/
│   │   ├── identity_attestation_vkey.json
│   │   └── ...
│   └── proving_keys/
│       └── circuit_final.zkey
├── prover.ts                           # Proof generation
├── verifier.ts                         # Proof verification
├── merkleTree.ts                       # Merkle tree management
├── commitment.ts                       # Commitment generation
├── nullifier.ts                        # Nullifier generation
├── types.ts                            # TypeScript types
└── utils.ts                            # Helper functions
```

### 6.2 Prover Implementation

**File**: `/src/libs/zk/prover.ts`

```typescript
import { groth16 } from "snarkjs"
import { buildPoseidon } from "circomlibjs"
import fs from "fs"
import path from "path"

export class ZKProver {
    private wasmPath: string
    private zkeyPath: string
    private poseidon: any

    constructor(circuitName: string) {
        this.wasmPath = path.join(__dirname, `build/${circuitName}.wasm`)
        this.zkeyPath = path.join(__dirname, `keys/proving_keys/${circuitName}_final.zkey`)
    }

    async initialize() {
        this.poseidon = await buildPoseidon()
    }

    /**
     * Generate identity commitment proof
     */
    async generateCommitment(
        providerId: string,
        secret: string
    ): Promise<string> {
        const providerIdBigInt = BigInt(providerId)
        const secretBigInt = BigInt(secret)

        const commitment = this.poseidon.F.toString(
            this.poseidon([providerIdBigInt, secretBigInt])
        )

        return commitment
    }

    /**
     * Generate nullifier
     */
    async generateNullifier(
        providerId: string,
        context: string,
        secret: string
    ): Promise<string> {
        const providerIdBigInt = BigInt(providerId)
        const secretBigInt = BigInt(secret)

        // Hash context string to BigInt
        const contextHash = this.poseidon.F.toString(
            this.poseidon([Buffer.from(context)])
        )
        const contextBigInt = BigInt(contextHash)

        const nullifier = this.poseidon.F.toString(
            this.poseidon([providerIdBigInt, contextBigInt, secretBigInt])
        )

        return nullifier
    }

    /**
     * Generate full identity attestation proof
     */
    async generateAttestationProof(
        providerId: string,
        secret: string,
        merkleProof: {
            pathElements: string[]
            pathIndices: number[]
        },
        merkleRoot: string,
        context: string
    ): Promise<{
        proof: any
        publicSignals: any
    }> {
        await this.initialize()

        // Calculate context hash
        const contextHash = this.poseidon.F.toString(
            this.poseidon([Buffer.from(context)])
        )

        // Generate nullifier
        const nullifier = await this.generateNullifier(providerId, context, secret)

        // Prepare circuit inputs
        const input = {
            // Private inputs
            providerId: providerId,
            secret: secret,
            merklePathElements: merkleProof.pathElements,
            merklePathIndices: merkleProof.pathIndices,

            // Public inputs
            merkleRoot: merkleRoot,
            nullifier: nullifier,
            contextHash: contextHash
        }

        // Generate proof
        const { proof, publicSignals } = await groth16.fullProve(
            input,
            this.wasmPath,
            this.zkeyPath
        )

        return { proof, publicSignals }
    }

    /**
     * Export proof to format suitable for transaction
     */
    static formatProofForTransaction(proof: any, publicSignals: any) {
        return {
            proof: {
                pi_a: [proof.pi_a[0], proof.pi_a[1]],
                pi_b: [
                    [proof.pi_b[0][1], proof.pi_b[0][0]],
                    [proof.pi_b[1][1], proof.pi_b[1][0]]
                ],
                pi_c: [proof.pi_c[0], proof.pi_c[1]],
                protocol: "groth16"
            },
            public_signals: {
                merkle_root: publicSignals[0],
                nullifier: publicSignals[1],
                context_hash: publicSignals[2]
            }
        }
    }
}
```

### 6.3 Verifier Implementation

**File**: `/src/libs/zk/verifier.ts`

```typescript
import { groth16 } from "snarkjs"
import fs from "fs"
import path from "path"

export class ZKProofVerifier {
    private vKeyPath: string
    private vKey: any

    constructor(platform: string) {
        this.vKeyPath = path.join(
            __dirname,
            `keys/verification_keys/${platform}_vkey.json`
        )
    }

    async initialize() {
        if (!this.vKey) {
            this.vKey = JSON.parse(fs.readFileSync(this.vKeyPath, "utf-8"))
        }
    }

    /**
     * Verify ZK proof
     */
    async verify(
        proof: {
            pi_a: string[]
            pi_b: string[][]
            pi_c: string[]
            protocol: string
        },
        publicSignals: {
            merkle_root: string
            nullifier: string
            context_hash: string
        }
    ): Promise<boolean> {
        await this.initialize()

        // Convert proof format
        const proofForSnarkjs = {
            pi_a: proof.pi_a,
            pi_b: [
                [proof.pi_b[0][1], proof.pi_b[0][0]],
                [proof.pi_b[1][1], proof.pi_b[1][0]]
            ],
            pi_c: proof.pi_c,
            protocol: proof.protocol
        }

        // Convert public signals to array
        const publicSignalsArray = [
            publicSignals.merkle_root,
            publicSignals.nullifier,
            publicSignals.context_hash
        ]

        // Verify using snarkjs
        const valid = await groth16.verify(
            this.vKey,
            publicSignalsArray,
            proofForSnarkjs
        )

        return valid
    }

    /**
     * Verify multiple proofs in batch
     */
    async verifyBatch(proofs: Array<{ proof: any; publicSignals: any }>): Promise<boolean[]> {
        await this.initialize()

        const results = await Promise.all(
            proofs.map(({ proof, publicSignals }) =>
                this.verify(proof, publicSignals)
            )
        )

        return results
    }
}
```

### 6.4 Merkle Tree Manager

**File**: `/src/libs/zk/merkleTree.ts`

```typescript
import { buildPoseidon } from "circomlibjs"
import { getRepository } from "typeorm"
import { MerkleTreeState } from "@/model/entities/MerkleTreeState"
import { PrivateCommitments } from "@/model/entities/PrivateCommitments"

export class MerkleTreeManager {
    private static instance: MerkleTreeManager
    private poseidon: any
    private tree: string[][] = []  // tree[level][index]
    private depth: number = 20     // 2^20 = 1M leaves
    private zeroValue: string = "0"
    private currentLeafIndex: number = 0

    private constructor() {}

    static getInstance(): MerkleTreeManager {
        if (!MerkleTreeManager.instance) {
            MerkleTreeManager.instance = new MerkleTreeManager()
        }
        return MerkleTreeManager.instance
    }

    async initialize() {
        this.poseidon = await buildPoseidon()

        // Initialize tree with zero values
        this.tree[0] = []
        for (let level = 1; level <= this.depth; level++) {
            this.tree[level] = []
        }

        // Load existing commitments from database
        await this.loadFromDatabase()
    }

    async loadFromDatabase() {
        const commitmentRepo = getRepository(PrivateCommitments)
        const commitments = await commitmentRepo.find({
            order: { leaf_index: "ASC" }
        })

        for (const commitment of commitments) {
            this.tree[0][commitment.leaf_index] = commitment.commitment_hash
            this.currentLeafIndex = Math.max(this.currentLeafIndex, commitment.leaf_index + 1)
        }

        // Rebuild tree from leaves
        this.rebuildTree()
    }

    async addLeaf(commitment: string): Promise<number> {
        const leafIndex = this.currentLeafIndex
        this.tree[0][leafIndex] = commitment
        this.currentLeafIndex++

        // Update path from leaf to root
        this.updatePath(leafIndex)

        // Save state to database
        await this.saveState()

        return leafIndex
    }

    private updatePath(leafIndex: number) {
        let currentIndex = leafIndex

        for (let level = 0; level < this.depth; level++) {
            const isLeft = currentIndex % 2 === 0
            const siblingIndex = isLeft ? currentIndex + 1 : currentIndex - 1
            const parentIndex = Math.floor(currentIndex / 2)

            const left = this.tree[level][isLeft ? currentIndex : siblingIndex] || this.zeroValue
            const right = this.tree[level][isLeft ? siblingIndex : currentIndex] || this.zeroValue

            const parent = this.hash(left, right)
            this.tree[level + 1][parentIndex] = parent

            currentIndex = parentIndex
        }
    }

    private rebuildTree() {
        // Rebuild all levels from leaves
        for (let level = 0; level < this.depth; level++) {
            const levelSize = Math.ceil(this.tree[level].length / 2)

            for (let i = 0; i < levelSize; i++) {
                const leftIndex = i * 2
                const rightIndex = i * 2 + 1

                const left = this.tree[level][leftIndex] || this.zeroValue
                const right = this.tree[level][rightIndex] || this.zeroValue

                this.tree[level + 1][i] = this.hash(left, right)
            }
        }
    }

    private hash(left: string, right: string): string {
        const leftBigInt = BigInt(left)
        const rightBigInt = BigInt(right)

        return this.poseidon.F.toString(
            this.poseidon([leftBigInt, rightBigInt])
        )
    }

    getRoot(): string {
        return this.tree[this.depth][0] || this.zeroValue
    }

    getMerkleProof(leafIndex: number): {
        pathElements: string[]
        pathIndices: number[]
    } {
        const pathElements: string[] = []
        const pathIndices: number[] = []

        let currentIndex = leafIndex

        for (let level = 0; level < this.depth; level++) {
            const isLeft = currentIndex % 2 === 0
            const siblingIndex = isLeft ? currentIndex + 1 : currentIndex - 1

            pathElements.push(this.tree[level][siblingIndex] || this.zeroValue)
            pathIndices.push(isLeft ? 0 : 1)

            currentIndex = Math.floor(currentIndex / 2)
        }

        return { pathElements, pathIndices }
    }

    async isValidHistoricalRoot(root: string, blocksBack: number): Promise<boolean> {
        const stateRepo = getRepository(MerkleTreeState)
        const recentStates = await stateRepo.find({
            order: { block_number: "DESC" },
            take: blocksBack
        })

        return recentStates.some(state => state.merkle_root === root)
    }

    private async saveState() {
        const stateRepo = getRepository(MerkleTreeState)

        const state = stateRepo.create({
            block_number: 0, // Will be set by block forging process
            merkle_root: this.getRoot(),
            leaf_count: this.currentLeafIndex,
            created_at: new Date()
        })

        await stateRepo.save(state)
    }
}
```

---

## 7. IMPLEMENTATION PHASES

### Phase 0: Environment Setup (1 week)

**Goal**: Set up ZK development environment and verify toolchain

**Tasks**:
1. Install Circom compiler (latest version)
2. Install snarkjs library
3. Set up circuit compilation pipeline
4. Download Powers of Tau ceremony files
5. Create initial test circuit
6. Verify proof generation and verification work

**Deliverables**:
- Working Circom compilation environment
- Test proof generated and verified
- Performance benchmark (proof gen/verify time)

**Acceptance Criteria**:
- [ ] Circom compiles circuits without errors
- [ ] snarkjs generates proofs in < 10 seconds
- [ ] Verification completes in < 1 second
- [ ] Team trained on ZK workflow

---

### Phase 1: Core ZK Infrastructure (3 weeks)

**Goal**: Build foundational ZK components from scratch

**Tasks**:

**Week 1: Circuits**
- Implement `identityCommitment.circom`
- Implement `merkleProof.circom`
- Implement `identityAttestation.circom`
- Compile and test all circuits
- Generate verification keys

**Week 2: TypeScript Infrastructure**
- Delete `/src/features/zk/iZKP/` (old code)
- Implement `prover.ts`
- Implement `verifier.ts`
- Implement `merkleTree.ts`
- Implement `commitment.ts` and `nullifier.ts`
- Write unit tests for all components

**Week 3: Integration & Testing**
- Create database migrations for new tables
- Integrate MerkleTreeManager with database
- Write integration tests
- Performance testing and optimization
- Documentation

**Deliverables**:
- Complete ZK library in `/src/libs/zk/`
- Database migrations for private identity tables
- Test suite with >90% coverage
- Performance benchmarks

**Acceptance Criteria**:
- [ ] All circuits compile successfully
- [ ] Proof generation < 10 seconds
- [ ] Proof verification < 1 second
- [ ] Merkle tree operations < 100ms
- [ ] All tests passing

---

### Phase 2: Web2 Identity Integration (3 weeks)

**Goal**: Support private Twitter, GitHub, Discord linking

**Tasks**:

**Week 1: Transaction Types & Validation**
- Add `identity_commitment` transaction type
- Add `identity_attestation` transaction type
- Implement `handlePrivateIdentityRequest.ts`
- Update transaction routing in validator

**Week 2: Platform-Specific Integration**
- Twitter: Adapt existing verification flow for commitment mode
- GitHub: Adapt gist verification for commitment mode
- Discord: Adapt message verification for commitment mode
- Create platform-specific commitment generators

**Week 3: Client SDK & Testing**
- Create client-side SDK for proof generation
- Implement commitment/attestation flows
- End-to-end testing with real accounts
- Documentation and examples

**Deliverables**:
- Private identity linking for Twitter, GitHub, Discord
- Client SDK for commitment generation
- Integration tests for each platform
- User documentation

**Acceptance Criteria**:
- [ ] User can link Twitter account privately
- [ ] User can link GitHub account privately
- [ ] User can link Discord account privately
- [ ] User can prove ownership without revealing account
- [ ] Nullifiers prevent double-proving

---

### Phase 3: EVM Cross-Chain Support (4 weeks)

**Goal**: Support private EVM wallet linking

**Tasks**:

**Week 1: ECDSA Circuit Implementation**
- Implement `evmSignatureVerify.circom`
- Test with real EVM signatures
- Optimize circuit (ECDSA is expensive)
- Compile and generate keys

**Week 2: EVM Signature Verification**
- Implement EVM address validation
- Add keccak256 hashing in circuit
- Test with multiple EVM chains (Ethereum, Polygon, Arbitrum)
- Performance optimization

**Week 3: Integration with Identity System**
- Extend `handlePrivateIdentityRequest` for EVM
- Create EVM-specific commitment flow
- Implement chain ID validation
- Update GCRIdentityRoutines

**Week 4: Testing & Optimization**
- End-to-end testing with MetaMask
- Multi-chain testing (Ethereum, Polygon, Arbitrum, etc.)
- Performance optimization (parallel proof generation)
- Security audit preparation

**Deliverables**:
- Private EVM wallet linking
- Support for all EVM chains (via chainId)
- Client SDK for EVM proof generation
- Performance benchmarks

**Acceptance Criteria**:
- [ ] User can link EVM wallet privately
- [ ] Works with Ethereum mainnet
- [ ] Works with Polygon, Arbitrum, other EVM chains
- [ ] Proof generation < 15 seconds (ECDSA is slow)
- [ ] Chain ID validation prevents cross-chain replay

---

### Phase 4: Solana Cross-Chain Support (2 weeks)

**Goal**: Support private Solana wallet linking

**Tasks**:

**Week 1: Solana Circuit**
- Implement `solanaSignatureVerify.circom` (ed25519)
- Test with Phantom wallet signatures
- Compile and generate keys
- Performance testing

**Week 2: Integration & Testing**
- Extend `handlePrivateIdentityRequest` for Solana
- Create Solana-specific commitment flow
- Client SDK integration
- End-to-end testing

**Deliverables**:
- Private Solana wallet linking
- Client SDK for Solana proof generation
- Integration tests

**Acceptance Criteria**:
- [ ] User can link Solana wallet privately
- [ ] Works with Phantom, Solflare, other wallets
- [ ] Proof generation < 10 seconds (ed25519 is fast)
- [ ] No cross-chain replay attacks

---

### Phase 5: Production Hardening (2 weeks)

**Goal**: Prepare for production deployment

**Tasks**:

**Week 1: Security**
- External security audit (coordinate with audit firm)
- Fix any vulnerabilities found
- Implement rate limiting for proof verification
- Add monitoring and alerts

**Week 2: Performance & Documentation**
- Optimize proof generation (parallel processing)
- Optimize proof verification (batch verification)
- Create user documentation
- Create developer documentation
- Migration guide for existing users

**Deliverables**:
- Security audit report
- Production-ready deployment
- Complete documentation
- Migration tools

**Acceptance Criteria**:
- [ ] Security audit completed with no critical issues
- [ ] Proof verification supports 100+ TPS
- [ ] Complete user and developer documentation
- [ ] Monitoring and alerting configured

---

## 8. CLIENT SDK EXAMPLE

**File**: `demos-zk-sdk` (new package)

```typescript
import { ZKProver } from "@demos/zk-privacy"
import { MerkleTreeManager } from "@demos/zk-privacy"

// Example: Link Twitter account privately

// Step 1: Generate secret (user keeps this locally, NEVER send to server)
const secret = generateRandomSecret() // Random 256-bit number
// User MUST backup secret or they lose access to prove ownership

// Step 2: Get Twitter ID from proof
const twitterId = "123456789" // Extracted from Twitter API

// Step 3: Generate commitment
const prover = new ZKProver("identity_attestation")
const commitment = await prover.generateCommitment(twitterId, secret)

// Step 4: Submit commitment transaction
const commitmentTx = {
    type: "identity_commitment",
    data: [
        "identity_commitment",
        {
            commitment_hash: commitment,
            identity_type: "web2",
            platform: "twitter"
        }
    ]
}
await demos.submitTransaction(commitmentTx)

// Wait for transaction to be included in block...

// Step 5 (later): Prove ownership in specific context
const context = "airdrop_round_1"

// Get Merkle proof from server
const merkleProof = await demos.getMerkleProof(commitment)
const merkleRoot = await demos.getCurrentMerkleRoot()

// Generate attestation proof (client-side, private inputs never sent)
const { proof, publicSignals } = await prover.generateAttestationProof(
    twitterId,
    secret,
    merkleProof,
    merkleRoot,
    context
)

// Submit attestation transaction
const attestationTx = {
    type: "identity_attestation",
    data: [
        "identity_attestation",
        {
            proof: ZKProver.formatProofForTransaction(proof, publicSignals).proof,
            public_signals: publicSignals,
            context: context,
            identity_type: "web2",
            platform: "twitter"
        }
    ]
}
await demos.submitTransaction(attestationTx)

// Server verifies proof and marks nullifier as used
// User has proven "I have a Twitter account" without revealing which one!
```

---

## 9. TESTING STRATEGY

### 9.1 Unit Tests

**Circuit tests** (`/src/libs/zk/tests/circuits/`):
- Test each circuit independently
- Verify constraints are correct
- Test edge cases (zero values, max values)
- Verify proof generation succeeds
- Verify invalid proofs fail

**Component tests** (`/src/libs/zk/tests/`):
- Test Prover class
- Test Verifier class
- Test MerkleTreeManager
- Test commitment generation
- Test nullifier generation

### 9.2 Integration Tests

**Transaction flow tests** (`/tests/integration/private-identity/`):
- Test full commitment flow
- Test full attestation flow
- Test nullifier prevention
- Test Merkle root validation
- Test historical root acceptance

**Platform tests**:
- Test Twitter commitment/attestation
- Test GitHub commitment/attestation
- Test Discord commitment/attestation
- Test EVM wallet commitment/attestation
- Test Solana wallet commitment/attestation

### 9.3 Performance Tests

**Benchmarks**:
- Proof generation time for each circuit
- Proof verification time
- Merkle tree insertion time
- Database query performance
- Transaction validation throughput

**Targets**:
- Proof generation: < 10 seconds (EVM < 15 seconds)
- Proof verification: < 1 second
- Merkle tree insertion: < 100ms
- Transaction throughput: > 100 TPS

### 9.4 Security Tests

**Attack vectors**:
- Nullifier reuse attack
- Merkle root manipulation
- Proof replay attack
- Cross-context proof reuse
- Commitment collision attack

**Fuzzing**:
- Random proof inputs
- Malformed transactions
- Edge case values

---

## 10. MIGRATION STRATEGY

### 10.1 Backward Compatibility

**Existing public identities**: No changes required
- Users with public identities continue to work
- No migration needed
- Incentive system unchanged

**New privacy option**: Opt-in
- Users can choose to link identities privately
- Can have both public and private identities
- No forced migration

### 10.2 Gradual Rollout

**Phase 1**: Testnet deployment
- Deploy to testnet first
- Beta testers try privacy features
- Collect feedback and fix bugs

**Phase 2**: Mainnet deployment
- Deploy to mainnet
- Initially limit to power users
- Monitor performance and security

**Phase 3**: General availability
- Open to all users
- Marketing and documentation
- Support both modes indefinitely

---

## 11. RISKS & MITIGATIONS

### 11.1 Technical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| ECDSA circuit too slow | High | Use PLONK instead of Groth16; optimize circuit |
| Merkle tree state divergence | Critical | Deterministic tree building; snapshot validation |
| ZK proof vulnerabilities | Critical | External audit; use proven libraries |
| Database performance issues | Medium | Indexing; caching; batch operations |

### 11.2 Operational Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| User loses secret | High | Clear warnings; backup instructions |
| Proof generation fails | Medium | Fallback to public mode; retry logic |
| Validator can't verify proof | High | Graceful degradation; detailed error logs |

---

## 12. SUCCESS METRICS

### 12.1 Technical Metrics

- [ ] Proof generation time < 10 seconds (EVM < 15s)
- [ ] Proof verification time < 1 second
- [ ] Transaction throughput > 100 TPS
- [ ] Zero nullifier reuse attacks
- [ ] Zero proof replay attacks
- [ ] 99.9% uptime

### 12.2 Adoption Metrics

- [ ] 10% of users try privacy mode (within 3 months)
- [ ] 100 private identities linked (within 1 month)
- [ ] 1000 private identities linked (within 3 months)
- [ ] 5000 private attestations generated (within 6 months)

---

## 13. TIMELINE SUMMARY

| Phase | Duration | Team Size | Key Deliverable |
|-------|----------|-----------|-----------------|
| Phase 0: Setup | 1 week | 1 engineer | ZK environment ready |
| Phase 1: Core ZK | 3 weeks | 2 engineers | ZK library complete |
| Phase 2: Web2 | 3 weeks | 2 engineers | Twitter, GitHub, Discord |
| Phase 3: EVM | 4 weeks | 2 engineers | EVM wallet support |
| Phase 4: Solana | 2 weeks | 1 engineer | Solana wallet support |
| Phase 5: Hardening | 2 weeks | 3 engineers | Production ready |
| **Total** | **15 weeks** | **2-3 engineers** | **Full privacy system** |

---

## 14. APPENDIX

### 14.1 Dependencies

**Required libraries**:
```json
{
  "dependencies": {
    "snarkjs": "^0.7.0",
    "circomlibjs": "^0.1.7",
    "ffjavascript": "^0.2.60"
  },
  "devDependencies": {
    "circom": "^2.1.0"
  }
}
```

### 14.2 Hardware Requirements

**Proof generation** (client-side):
- CPU: 4+ cores recommended
- RAM: 4GB minimum, 8GB recommended
- Storage: 100MB for circuit files

**Proof verification** (validator):
- CPU: 2+ cores
- RAM: 2GB
- Storage: 50MB for verification keys

### 14.3 External Resources

**Learning**:
- Circom documentation: https://docs.circom.io/
- snarkjs: https://github.com/iden3/snarkjs
- ZK-SNARK explainer: https://z.cash/technology/zksnarks/

**Audit firms**:
- Trail of Bits
- OpenZeppelin
- CertiK

**Community**:
- 0xPARC (ZK education)
- zkDAO
- Ethereum Foundation PSE team

---

## 15. CONCLUSION

This implementation plan provides a **clear, focused roadmap** for integrating ZK-SNARK privacy into Demos Network's identity system. By starting with Twitter, GitHub, Discord for Web2 and EVM, Solana for cross-chain, we can deliver meaningful privacy features in **15 weeks** while maintaining backward compatibility with the existing public identity system.

**Key decisions**:
- ✅ Build from scratch (trash old ZK code)
- ✅ Skip Telegram (defer to future)
- ✅ EVM first, then Solana
- ✅ No incentives for private identities (keep it simple)
- ✅ Dual-mode architecture (public + private coexist)

**Next steps**:
1. Approve plan and allocate team
2. Begin Phase 0 environment setup
3. Kick off Phase 1 core ZK infrastructure
4. Coordinate with SDK team for transaction type additions

This plan balances **ambition with pragmatism**, delivering a production-ready privacy system without overextending scope.
