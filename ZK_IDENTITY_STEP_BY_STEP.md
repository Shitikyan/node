# ZK Identity System - Step-by-Step Guide

## Table of Contents
1. [System Overview](#system-overview)
2. [Setup and Installation](#setup-and-installation)
3. [Creating a Commitment](#creating-a-commitment)
4. [Generating a ZK Proof](#generating-a-zk-proof)
5. [Verifying an Attestation](#verifying-an-attestation)
6. [Understanding the Merkle Tree](#understanding-the-merkle-tree)
7. [Security Model](#security-model)
8. [Troubleshooting](#troubleshooting)

---

## System Overview

### What Does This System Do?

The ZK Identity system allows users to:
1. **Prove they control a verified Web2 identity** (GitHub, Twitter, etc.)
2. **Without revealing which specific identity** they control
3. **While preventing double-use** in the same context (e.g., voting twice)

### Key Concepts

| Concept | Description | Example |
|---------|-------------|---------|
| **Commitment** | Hash of your provider ID + secret | `Poseidon("github_alice", "secret123")` |
| **Secret** | Your private key (never shared) | Random 256-bit number |
| **Nullifier** | Context-specific proof of use | `Poseidon("github_alice", "secret123", "vote_42")` |
| **Context** | What you're doing | `"vote_42"`, `"airdrop_december"` |
| **Merkle Tree** | Global registry of all commitments | Binary tree with 1M+ capacity |
| **ZK Proof** | Cryptographic proof without revealing secrets | Groth16 SNARK (128 bytes) |

### Privacy Guarantees

```
Traditional System:          ZK Identity System:
┌──────────────────┐        ┌──────────────────┐
│ "I am @alice123" │        │ "I am *someone*  │
│                  │   →    │  in the registry"│
│ (Reveals identity)        │ (Hides identity) │
└──────────────────┘        └──────────────────┘
```

---

## Setup and Installation

### Prerequisites

```bash
# Required tools
- Bun runtime (v1.0+)
- Circom 2.0 compiler
- PostgreSQL database

# Check installations
bun --version
circom --version
psql --version
```

### Step 1: Install Dependencies

```bash
cd /home/user/node
bun install
```

### Step 2: Download Powers of Tau (One-time, ~140MB)

This is a trusted setup ceremony file used for ZK proof generation:

```bash
bun run zk:setup-all
```

This downloads:
- `powersOfTau28_hez_final_14.ptau` - Trusted setup parameters
- Generates verification keys
- Compiles Circom circuits

**Output Files:**
```
src/features/zk/keys/
├── verification_key_merkle.json  (Committed to repo)
├── identity.zkey                 (Local only, gitignored)
└── powersOfTau28_hez_final_14.ptau (Local only, gitignored)
```

### Step 3: Initialize Database

```bash
bun run migrate:latest
```

Creates tables:
- `identity_commitments` - Stores commitments
- `merkle_tree_state` - Tree snapshots
- `used_nullifiers` - Prevents double-use
- `accounts` - User points

### Step 4: Start the Node

```bash
bun run start
```

The server starts on `http://localhost:3000` (or configured port).

---

## Creating a Commitment

### Overview

A **commitment** is your anonymous identity in the system. It's added to the global Merkle tree so you can later prove you're "someone in the tree" without revealing who.

### Step-by-Step Process

#### Step 1: Generate Your Secret (Client-Side)

```typescript
// Client code (never send to server!)
import { randomBytes } from 'crypto';

const secret = BigInt('0x' + randomBytes(32).toString('hex'));
const providerId = "github_12345"; // Your GitHub ID
```

**Security:** Never transmit `secret` or `providerId` to the server!

#### Step 2: Compute Your Commitment (Client-Side)

```typescript
import { buildPoseidon } from 'circomlibjs';

const poseidon = await buildPoseidon();

const commitment = poseidon.F.toString(
  poseidon([BigInt(providerId), secret])
);

console.log('Your commitment:', commitment);
// Example output: "12345678901234567890123456789012345678901234567890"
```

#### Step 3: Submit Commitment to Server

```bash
curl -X POST http://localhost:3000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "type": "identity",
    "context": "zk_commitment_add",
    "data": {
      "provider": "github",
      "commitment_hash": "12345678901234567890123456789012345678901234567890",
      "timestamp": 1699999999000
    },
    "signature": "...",
    "publicKey": "..."
  }'
```

**Response:**
```json
{
  "result": 200,
  "receipt": {
    "transactionHash": "0xabc...",
    "blockNumber": 12345
  }
}
```

#### Step 4: Wait for Merkle Tree Insertion

After the next block is committed, the system automatically:
1. Finds your commitment (where `leafIndex === -1`)
2. Adds it to the global Merkle tree
3. Updates your commitment record with the `leafIndex`

**Check insertion status:**
```bash
curl http://localhost:3000/zk/merkle/proof/{your_commitment_hash}
```

If you get a proof, it's inserted! If you get an error, wait for the next block.

---

## Generating a ZK Proof

### Overview

Once your commitment is in the tree, you can generate **anonymous attestations** for different contexts (voting, airdrops, etc.).

### Step-by-Step Process

#### Step 1: Fetch Current Merkle Root

```bash
curl http://localhost:3000/zk/merkle-root
```

**Response:**
```json
{
  "rootHash": "98765432109876543210987654321098765432109876543210",
  "blockNumber": 12346,
  "leafCount": 42
}
```

Save the `rootHash` - you'll need it for the proof.

#### Step 2: Fetch Your Merkle Proof

```bash
curl http://localhost:3000/zk/merkle/proof/{your_commitment_hash}
```

**Response:**
```json
{
  "commitment": "12345678901234567890123456789012345678901234567890",
  "proof": {
    "siblings": [
      "11111111111111111111111111111111111111111111111111",
      "22222222222222222222222222222222222222222222222222",
      // ... 18 more siblings (total 20 for 20-level tree)
    ],
    "pathIndices": [0, 1, 0, 0, 1, ...], // 20 indices
    "root": "98765432109876543210987654321098765432109876543210",
    "leafIndex": 5
  }
}
```

#### Step 3: Generate ZK Proof (Client-Side)

**Circuit Inputs:**
```typescript
// circuit_inputs.json
{
  "provider_id": "github_12345",          // Private (never sent)
  "secret": "123456789...",               // Private (never sent)
  "pathElements": [...],                  // Private (from merkle proof)
  "pathIndices": [...],                   // Private (from merkle proof)
  "context": "vote_42",                   // Public
  "merkle_root": "98765432109876543210..." // Public
}
```

**Generate Proof:**
```bash
# Using snarkjs (client-side)
snarkjs groth16 fullprove \
  circuit_inputs.json \
  identity.wasm \
  identity.zkey \
  proof.json \
  public.json
```

**Output - proof.json:**
```json
{
  "pi_a": ["1234...", "5678...", "1"],
  "pi_b": [["9012...", "3456..."], ["7890...", "1234..."], ["1", "0"]],
  "pi_c": ["5678...", "9012...", "1"],
  "protocol": "groth16",
  "curve": "bn128"
}
```

**Output - public.json:**
```json
[
  "88888888888888888888888888888888888888888888888888",  // nullifier
  "98765432109876543210987654321098765432109876543210",  // merkle_root
  "31415926535897932384626433832795028841971693993751"   // context hash
]
```

#### Step 4: Submit Attestation to Server

```bash
curl -X POST http://localhost:3000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "type": "identity",
    "context": "zk_attestation_add",
    "data": {
      "nullifier_hash": "88888888888888888888888888888888888888888888888888",
      "merkle_root": "98765432109876543210987654321098765432109876543210",
      "proof": {
        "pi_a": [...],
        "pi_b": [...],
        "pi_c": [...],
        "protocol": "groth16",
        "curve": "bn128"
      },
      "public_signals": [...]
    },
    "signature": "...",
    "publicKey": "..."
  }'
```

**Success Response:**
```json
{
  "result": 200,
  "response": {
    "valid": true,
    "nullifier": "88888888888888888888888888888888888888888888888888",
    "merkleRoot": "98765432109876543210987654321098765432109876543210",
    "pointsAwarded": 10
  }
}
```

#### Step 5: Verify Points Were Awarded

```bash
curl http://localhost:3000/account/{your_address}
```

**Response:**
```json
{
  "address": "0xYourAddress",
  "points": {
    "total": 10,
    "breakdown": {
      "zkAttestation": 10
    }
  }
}
```

---

## Verifying an Attestation

### Server-Side Verification Pipeline

When you submit an attestation, the server runs **three verification steps**:

#### Step 1: Cryptographic Verification

**Purpose:** Verify the ZK proof is mathematically valid

```typescript
// ProofVerifier.ts:123
const isValid = await groth16VerifyBun(
  verificationKey,
  publicSignals,
  proof
);

if (!isValid) {
  return {
    valid: false,
    reason: "Invalid cryptographic proof"
  };
}
```

**What it checks:**
- Groth16 pairing equation: `e(pi_a, pi_b) = e(vk_alpha, vk_beta) * e(vk_gamma, C) * e(vk_delta, pi_c)`
- Proof points are on the BN254 curve
- Public signals are in valid field range

**Time:** ~5-10ms

#### Step 2: Nullifier Uniqueness Check

**Purpose:** Prevent double-attestations in the same context

```typescript
// ProofVerifier.ts:145
const existingNullifier = await UsedNullifier.findOne({
  where: { nullifierHash }
});

if (existingNullifier) {
  return {
    valid: false,
    reason: "Nullifier already used in this context"
  };
}
```

**What it checks:**
- Query `used_nullifiers` table for this nullifier hash
- Primary key constraint prevents duplicates

**Time:** ~1ms (database query)

#### Step 3: Merkle Root Currency Check

**Purpose:** Ensure proof uses current tree state (not outdated)

```typescript
// ProofVerifier.ts:167
const currentRoot = await MerkleTreeManager.getRoot();

if (proofMerkleRoot !== currentRoot) {
  return {
    valid: false,
    reason: "Proof uses outdated Merkle root"
  };
}
```

**What it checks:**
- Proof's `merkle_root` matches current tree root
- Prevents using proofs generated before new commitments added

**Time:** ~1ms (database query)

#### Step 4: Mark Nullifier as Used & Award Points

```typescript
// ProofVerifier.ts:189
await UsedNullifier.create({
  nullifierHash,
  blockNumber,
  transactionHash,
  timestamp
});

await Account.increment('points.zkAttestation', {
  by: ZK_ATTESTATION_POINTS, // Default: 10
  where: { address: accountAddress }
});

return { valid: true };
```

---

## Understanding the Merkle Tree

### Tree Structure

```
                    Root (Level 20)
                   /              \
           Level 19                Level 19
          /        \              /        \
    Level 18      Level 18   Level 18    Level 18
      ...            ...        ...          ...
     /  \           /  \       /  \         /  \
   L0   L1        L2   L3    L4   L5      L6   L7  (Leaves = Commitments)
```

**Properties:**
- **Depth:** 20 levels
- **Capacity:** 2^20 = 1,048,576 commitments
- **Hash Function:** Poseidon (ZK-friendly)
- **Arity:** Binary (each node has 2 children)

### Tree Operations

#### Adding a Commitment

```typescript
// MerkleTreeManager.ts:45
async addCommitment(commitmentHash: string): Promise<number> {
  const leafIndex = this.tree.insert(BigInt(commitmentHash));

  console.log(`Added commitment at leaf ${leafIndex}`);
  console.log(`New root: ${this.tree.root}`);

  return leafIndex;
}
```

**What happens:**
1. Insert commitment as new leaf
2. Recompute all parent hashes up to root
3. Root changes (all future proofs use new root)

#### Generating a Proof

```typescript
// MerkleTreeManager.ts:67
async generateProof(leafIndex: number): Promise<MerkleProof> {
  const proof = this.tree.createProof(leafIndex);

  return {
    siblings: proof.siblings.map(s => s.toString()),
    pathIndices: proof.pathIndices,
    root: this.tree.root.toString(),
    leafIndex
  };
}
```

**Proof Structure:**
```
Leaf (L5) at index 5:
  Level 0: L5 + sibling[0]=L4 → Hash → Parent at Level 1
  Level 1: Parent + sibling[1]=(...) → Hash → Parent at Level 2
  ...
  Level 19: Parent + sibling[19]=(...) → Hash → Root
```

**Verification:**
```typescript
// Verify proof (client or server)
function verifyMerkleProof(
  leaf: bigint,
  siblings: bigint[],
  pathIndices: number[],
  expectedRoot: bigint
): boolean {
  let currentHash = leaf;

  for (let i = 0; i < siblings.length; i++) {
    const sibling = siblings[i];
    const isLeft = pathIndices[i] === 0;

    currentHash = isLeft
      ? poseidon([currentHash, sibling])  // Current on left
      : poseidon([sibling, currentHash]); // Current on right
  }

  return currentHash === expectedRoot;
}
```

### Tree Persistence

**Snapshot Storage:**
```typescript
// merkle_tree_state table
{
  tree_id: "global",
  root_hash: "98765432109876543210...",
  block_number: 12346,
  leaf_count: 42,
  tree_snapshot: {
    // Serialized incremental tree state
    depth: 20,
    nodes: {...},
    zeroes: [...]
  }
}
```

**Loading from Database:**
```typescript
// MerkleTreeManager.ts:25
async initialize() {
  const snapshot = await MerkleTreeState.findOne({
    where: { treeId: 'global' }
  });

  if (snapshot?.treeSnapshot) {
    this.tree = IncrementalMerkleTree.import(
      snapshot.treeSnapshot
    );
  } else {
    this.tree = new IncrementalMerkleTree(
      poseidon,
      20,  // depth
      0n,  // zero value
      2    // arity (binary)
    );
  }
}
```

---

## Security Model

### Threat Model

| Attack | Mitigation |
|--------|------------|
| **Double-attestation** | Nullifier database with primary key constraint |
| **Fake identity** | Commitment must be in Merkle tree (verified in circuit) |
| **Proof replay** | Nullifier is context-specific (different per use case) |
| **Forgery** | Groth16 pairing check (computationally infeasible to forge) |
| **Identity revelation** | Secret never transmitted, provider_id only in circuit |
| **Linking attestations** | Different nullifiers per context (unlinkable) |
| **Outdated proof** | Merkle root must match current tree state |

### Cryptographic Assumptions

**Groth16 Security:**
- Based on hardness of discrete logarithm on BN254 curve
- 128-bit security level (2^128 operations to break)
- Requires trusted setup (Powers of Tau ceremony)

**Poseidon Security:**
- Designed for SNARK-friendly hashing
- 128-bit collision resistance
- Extensively analyzed by cryptography community

**Merkle Tree Security:**
- Collision resistance of Poseidon
- Tree inclusion proof computationally binding

### Privacy Guarantees

**What the server learns:**
- Commitment hash (public, but doesn't reveal identity)
- Nullifier hash (public, but unlinkable across contexts)
- Merkle root used (public, tree state)
- Context (public, what action was taken)

**What the server NEVER learns:**
- Provider ID (stays in circuit)
- Secret (stays on client)
- Which commitment corresponds to which nullifier

**Anonymity Set:**
- All users who have commitments in the tree
- Example: If 10,000 users are in tree, you're 1 of 10,000

---

## Troubleshooting

### Issue 1: Commitment Not Found in Tree

**Symptom:**
```bash
curl http://localhost:3000/zk/merkle/proof/{commitment}
# Error: Commitment not found in tree
```

**Cause:** Commitment hasn't been inserted yet (still has `leafIndex === -1`)

**Solution:**
1. Wait for next block to commit
2. Check commitment status:
   ```bash
   curl http://localhost:3000/api/commitment/{commitment_hash}
   # Should show leafIndex !== -1
   ```

### Issue 2: Proof Verification Fails (Cryptographic)

**Symptom:**
```json
{
  "valid": false,
  "reason": "Invalid cryptographic proof"
}
```

**Possible Causes:**
1. Wrong verification key (mismatch with circuit)
2. Proof corrupted during transmission
3. Public signals don't match circuit outputs

**Solution:**
1. Verify verification key path:
   ```bash
   ls src/features/zk/keys/verification_key_merkle.json
   ```
2. Re-generate proof with correct inputs
3. Check circuit outputs match public signals

### Issue 3: Nullifier Already Used

**Symptom:**
```json
{
  "valid": false,
  "reason": "Nullifier already used in this context"
}
```

**Cause:** You already attested in this context

**Solution:**
- This is expected behavior (prevents double-attestations)
- To attest again, use a different `context` parameter
- Example: `"vote_42"` → `"vote_43"`

### Issue 4: Outdated Merkle Root

**Symptom:**
```json
{
  "valid": false,
  "reason": "Proof uses outdated Merkle root"
}
```

**Cause:** New commitments added since you generated proof

**Solution:**
1. Fetch current root:
   ```bash
   curl http://localhost:3000/zk/merkle-root
   ```
2. Re-fetch your Merkle proof (will have new siblings/path)
3. Re-generate proof with new `merkle_root` and `pathElements`

### Issue 5: Circuit Compilation Fails

**Symptom:**
```bash
bun run zk:setup-all
# Error: circom: command not found
```

**Solution:**
Install Circom 2.0:
```bash
# Install Rust (required for Circom)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Circom
git clone https://github.com/iden3/circom.git
cd circom
cargo build --release
cargo install --path circom

# Verify
circom --version
# Should output: circom compiler 2.x.x
```

### Issue 6: Bun Worker Thread Crash

**Symptom:**
```
Error: Worker thread crashed during proof verification
```

**Cause:** snarkjs uses worker threads (incompatible with Bun)

**Solution:** Already handled! The system uses `BunSnarkjsWrapper` which runs single-threaded verification.

**Verify:**
```typescript
// ProofVerifier.ts should use:
import { groth16VerifyBun } from './BunSnarkjsWrapper';

// NOT:
import { groth16 } from 'snarkjs'; // ❌ Will crash in Bun
```

### Issue 7: Powers of Tau Download Fails

**Symptom:**
```bash
bun run zk:setup-all
# Error: Failed to download powersOfTau file
```

**Solution:**
Manual download:
```bash
cd src/features/zk/keys
wget https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_14.ptau

# Verify file size (should be ~140MB)
ls -lh powersOfTau28_hez_final_14.ptau
```

---

## Quick Reference

### Command Summary

```bash
# Setup (one-time)
bun install
bun run zk:setup-all
bun run migrate:latest

# Start node
bun run start

# Run tests
bun test src/features/zk/tests/

# Check Merkle tree status
curl http://localhost:3000/zk/merkle-root

# Get proof for commitment
curl http://localhost:3000/zk/merkle/proof/{commitment_hash}

# Check if nullifier used
curl http://localhost:3000/zk/nullifier/{nullifier_hash}
```

### Key Files Quick Reference

```
src/features/zk/
├── circuits/
│   ├── identity.circom                    # Basic circuit (Phase 3)
│   └── identity_with_merkle.circom        # Full circuit (Phase 5)
├── proof/
│   ├── ProofVerifier.ts                   # Main verification logic
│   └── BunSnarkjsWrapper.ts               # Bun-compatible verifier
├── merkle/
│   ├── MerkleTreeManager.ts               # Tree operations
│   └── updateMerkleTreeAfterBlock.ts      # Batch insertion
├── keys/
│   ├── verification_key_merkle.json       # Verification key (committed)
│   ├── identity.zkey                      # Proving key (gitignored)
│   └── powersOfTau28_hez_final_14.ptau   # Trusted setup (gitignored)
└── tests/
    ├── proof-verifier.test.ts             # Verification tests
    └── merkle.test.ts                     # Tree tests
```

### Environment Variables

```bash
# .env file
ZK_ATTESTATION_POINTS=10      # Points per attestation
ZK_MERKLE_TREE_DEPTH=20       # Tree depth (1M capacity)
ZK_MERKLE_TREE_ID="global"    # Tree identifier
```

---

## Example: Complete Flow

Let's walk through a complete example of creating a commitment and generating an attestation.

### Scenario: Vote on Proposal #42

**Actor:** Alice (GitHub user `alice_coder`)

#### 1. Alice Generates Commitment (Day 1)

```typescript
// Client-side (Alice's computer)
import { buildPoseidon } from 'circomlibjs';
import { randomBytes } from 'crypto';

const poseidon = await buildPoseidon();

// Alice's secret (NEVER share!)
const secret = BigInt('0x' + randomBytes(32).toString('hex'));
// Example: 12345678901234567890123456789012345678901234567890

// Alice's provider ID (NEVER send to server!)
const providerId = "github_alice_coder";

// Compute commitment
const commitment = poseidon.F.toString(
  poseidon([BigInt(providerId), secret])
);
// Example: 11111111111111111111111111111111111111111111111111

console.log('Save this secret:', secret);
console.log('Your commitment:', commitment);
```

#### 2. Alice Submits Commitment

```bash
curl -X POST http://localhost:3000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "type": "identity",
    "context": "zk_commitment_add",
    "data": {
      "provider": "github",
      "commitment_hash": "11111111111111111111111111111111111111111111111111",
      "timestamp": 1699999999000
    },
    "signature": "0xAliceSignature",
    "publicKey": "0xAlicePublicKey"
  }'
```

**Response:**
```json
{
  "result": 200,
  "receipt": {
    "transactionHash": "0xabc123",
    "blockNumber": 1000
  }
}
```

#### 3. Alice Waits for Tree Insertion (Automatic)

After block 1000 commits:
```sql
-- Database automatically updates:
UPDATE identity_commitments
SET leaf_index = 5
WHERE commitment_hash = '11111111111111111111111111111111111111111111111111';
```

#### 4. Alice Wants to Vote (Day 7)

**Fetch Merkle Root:**
```bash
curl http://localhost:3000/zk/merkle-root
```

**Response:**
```json
{
  "rootHash": "99999999999999999999999999999999999999999999999999",
  "blockNumber": 1100,
  "leafCount": 156
}
```

**Fetch Merkle Proof:**
```bash
curl http://localhost:3000/zk/merkle/proof/11111111111111111111111111111111111111111111111111
```

**Response:**
```json
{
  "commitment": "11111111111111111111111111111111111111111111111111",
  "proof": {
    "siblings": ["22222...", "33333...", ...],  // 20 siblings
    "pathIndices": [0, 1, 0, ...],              // 20 indices
    "root": "99999999999999999999999999999999999999999999999999",
    "leafIndex": 5
  }
}
```

#### 5. Alice Generates Vote Proof

```typescript
// Client-side (Alice's computer)
const circuitInputs = {
  provider_id: "github_alice_coder",
  secret: "12345678901234567890123456789012345678901234567890",
  pathElements: ["22222...", "33333...", ...],
  pathIndices: [0, 1, 0, ...],
  context: "vote_proposal_42",
  merkle_root: "99999999999999999999999999999999999999999999999999"
};

// Generate proof using snarkjs
const { proof, publicSignals } = await snarkjs.groth16.fullProve(
  circuitInputs,
  "identity.wasm",
  "identity.zkey"
);

console.log('Nullifier:', publicSignals[0]);
// 77777777777777777777777777777777777777777777777777
```

#### 6. Alice Submits Vote Attestation

```bash
curl -X POST http://localhost:3000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "type": "identity",
    "context": "zk_attestation_add",
    "data": {
      "nullifier_hash": "77777777777777777777777777777777777777777777777777",
      "merkle_root": "99999999999999999999999999999999999999999999999999",
      "proof": { ... },
      "public_signals": [ ... ]
    },
    "signature": "0xAliceSignature",
    "publicKey": "0xAlicePublicKey"
  }'
```

**Response:**
```json
{
  "result": 200,
  "response": {
    "valid": true,
    "nullifier": "77777777777777777777777777777777777777777777777777",
    "merkleRoot": "99999999999999999999999999999999999999999999999999",
    "pointsAwarded": 10
  }
}
```

#### 7. Alice Tries to Vote Again (Should Fail)

```bash
# Same attestation, same nullifier
curl -X POST http://localhost:3000/execute ...
```

**Response:**
```json
{
  "result": 400,
  "response": {
    "valid": false,
    "reason": "Nullifier already used in this context"
  }
}
```

**System protects against double-voting!** ✅

#### 8. Alice Votes on Different Proposal (Should Succeed)

```typescript
// Different context → Different nullifier
const circuitInputs2 = {
  ...circuitInputs,
  context: "vote_proposal_43"  // Changed!
};

// New nullifier will be computed:
// Poseidon("github_alice_coder", secret, "vote_proposal_43")
// = 66666666666666666666666666666666666666666666666666
```

**This works!** Different context = different nullifier = allowed.

---

## Conclusion

The ZK Identity system provides **privacy-preserving identity verification** with:

✅ **Anonymity:** No one knows which identity you used
✅ **Non-reusability:** Can't attest twice in same context
✅ **Unlinkability:** Attestations across contexts can't be linked
✅ **Verifiability:** Cryptographically proven membership in tree
✅ **Efficiency:** ~5ms verification, ~128 byte proofs

**Use cases:**
- Anonymous airdrops
- Private voting systems
- Reputation systems
- Sybil-resistant applications

---

*Generated from zk_ids branch analysis on 2025-11-10*
