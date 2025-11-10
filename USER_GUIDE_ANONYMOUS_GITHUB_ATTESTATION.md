# How to Anonymously Prove You Have a GitHub Account

## ⚠️ Important: Architecture Overview

This repository contains **ONLY the backend/node implementation**. There are **three separate layers**:

```
┌──────────────────────────────────────────┐
│ 1. CLIENT APPLICATION (not in this repo)│
│    - GitHub verification (OAuth/Gist)   │
│    - Proof generation (snarkjs)         │
│    - User interface                     │
└──────────────────────────────────────────┘
                   ↓ API calls
┌──────────────────────────────────────────┐
│ 2. NODE/BACKEND (THIS REPO - zk_ids)   │
│    - API endpoints                      │
│    - Proof verification                 │
│    - Merkle tree                        │
└──────────────────────────────────────────┘
                   ↓ stores
┌──────────────────────────────────────────┐
│ 3. DATABASE (PostgreSQL)                │
│    - Commitments, nullifiers, tree      │
└──────────────────────────────────────────┘
```

**This guide explains:**
- ✅ What the node provides (backend API)
- ❌ What needs to be built (frontend client)
- 🔗 How they connect

---

## What Is Anonymous GitHub Attestation?

### The Goal
Prove **"I have a verified GitHub account"** without revealing **which** account.

### How It Works

**Traditional system:**
```
"I am @alice_dev" → ❌ Identity revealed
```

**ZK Identity system:**
```
"I am *someone* with a verified GitHub account" → ✅ Anonymous
```

### Use Cases
- 🎁 Airdrops (one per person, no Sybil)
- 🗳️ Anonymous voting (one vote per verified identity)
- ⭐ Reputation without doxxing
- 🎮 Sybil-resistant gaming

---

## System Components

### ✅ What THIS Repo Provides (Backend - zk_ids branch)

**1. API Endpoints:**
```bash
# Store commitment
POST /execute
Body: {"type": "identity", "context": "zk_commitment_add", "data": {...}}

# Submit attestation proof
POST /execute
Body: {"type": "identity", "context": "zk_attestation_add", "data": {...}}

# Get Merkle tree root
GET /zk/merkle-root

# Get Merkle proof for commitment
GET /zk/merkle/proof/{commitment_hash}

# Check if nullifier was used
GET /zk/nullifier/{nullifier_hash}
```

**2. Proof Verification:**
- Groth16 ZK-SNARK verification
- Nullifier uniqueness check
- Merkle root currency validation

**3. Merkle Tree Management:**
- 20-level Poseidon tree (1M+ capacity)
- Automatic insertion after blocks
- Proof generation

**4. Circom Circuits:**
- `identity_with_merkle.circom` - Circuit definition
- Verification keys included

**Files:**
- `src/features/zk/proof/ProofVerifier.ts` - Verification logic
- `src/features/zk/merkle/MerkleTreeManager.ts` - Tree management
- `src/libs/blockchain/gcr/gcr_routines/GCRIdentityRoutines.ts:607-765` - Transaction handlers

---

### ❌ What You Need To Build (Frontend Client)

**Not included in this repo:**

**1. GitHub Identity Verification**

Two common approaches:

**Option A: OAuth Flow**
```typescript
// Client uses GitHub OAuth
const octokit = new Octokit({ auth: githubToken });
const { data } = await octokit.users.getAuthenticated();
const githubUserId = data.id.toString(); // e.g., "12345678"
```

**Option B: Gist Proof** (see section below)
```
1. User posts specific text to a public gist
2. Client verifies gist ownership
3. Extract GitHub username from gist metadata
```

**2. Commitment Generation (Client-Side)**
```typescript
import { buildPoseidon } from 'circomlibjs';
import { randomBytes } from 'crypto';

// Generate secret (NEVER send to server!)
const secret = BigInt('0x' + randomBytes(32).toString('hex'));

// Compute commitment
const poseidon = await buildPoseidon();
const commitment = poseidon.F.toString(
  poseidon([BigInt(githubUserId), secret])
);

// Save secret securely (user's responsibility)
downloadFile('secret.txt', secret.toString());
```

**3. ZK Proof Generation (Client-Side)**
```typescript
import { groth16 } from 'snarkjs';

// Fetch Merkle proof from node
const merkleProof = await fetch(`/zk/merkle/proof/${commitment}`);

// Generate ZK proof
const { proof, publicSignals } = await groth16.fullProve(
  {
    provider_id: githubUserId,  // Private
    secret: secret,             // Private
    pathElements: merkleProof.siblings,
    pathIndices: merkleProof.pathIndices,
    context: "vote_proposal_42",
    merkle_root: merkleProof.root
  },
  'identity.wasm',
  'identity.zkey'
);
```

**4. User Interface**
- Forms, buttons, status displays
- Secret download/storage
- Transaction signing (Web3 wallet)

---

## GitHub Gist Verification Approach

### What Is It?

Instead of OAuth, users can prove GitHub ownership by **posting a specific gist** that contains a challenge string.

### How It Works

**1. Client generates challenge:**
```typescript
const challenge = `zk-identity-proof-${Date.now()}-${randomHex()}`;
// Example: "zk-identity-proof-1699999999000-8f3a9b2c1d5e"
```

**2. User posts gist:**
```markdown
# ZK Identity Proof

This gist proves I own this GitHub account for ZK Identity attestation.

Challenge: zk-identity-proof-1699999999000-8f3a9b2c1d5e
Timestamp: 2024-11-15T10:30:00Z
```

**3. Client verifies gist:**
```typescript
async function verifyGist(gistId: string, challenge: string) {
  const response = await fetch(`https://api.github.com/gists/${gistId}`);
  const gist = await response.json();

  // Extract GitHub username
  const githubUsername = gist.owner.login;

  // Verify challenge string is in gist content
  const content = Object.values(gist.files)[0].content;
  if (!content.includes(challenge)) {
    throw new Error('Challenge not found in gist');
  }

  // Verify timestamp is recent (< 10 minutes)
  const timestamp = extractTimestamp(content);
  if (Date.now() - timestamp > 600000) {
    throw new Error('Gist too old');
  }

  return githubUsername;
}
```

**4. Client proceeds with commitment generation:**
```typescript
const githubUserId = await verifyGist(gistId, challenge);
const { commitment, secret } = await generateCommitment(githubUserId);
// ... submit to node
```

### Advantages of Gist Approach
- ✅ No OAuth required (no app registration)
- ✅ User stays in control (can delete gist after)
- ✅ Publicly verifiable (anyone can check the gist)
- ✅ Works without server-side GitHub API

### Disadvantages
- ❌ User must manually create gist
- ❌ Slightly more friction
- ❌ Gist is public (though reveals nothing sensitive)

---

## Complete Flow (End-to-End)

### Step 1: Generate Commitment (Client-Side)

**What the client does:**
1. Verify GitHub identity (OAuth or Gist)
2. Generate random secret
3. Compute commitment = Poseidon(githubId, secret)
4. Download secret file for user
5. Sign transaction with wallet
6. Send to node API

**API call:**
```bash
curl -X POST http://localhost:3000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "type": "identity",
    "context": "zk_commitment_add",
    "data": {
      "provider": "github",
      "commitment_hash": "12345678901234567890...",
      "timestamp": 1699999999000
    },
    "signature": "0x...",
    "publicKey": "0x..."
  }'
```

**What the node does:**
1. Validates commitment format
2. Stores in `identity_commitments` (leafIndex = -1)
3. Returns transaction receipt

**Code:** `GCRIdentityRoutines.ts:607-660`

---

### Step 2: Merkle Tree Insertion (Node Automatic)

**What the node does:**
1. After block commits, finds pending commitments
2. Adds to Merkle tree in order
3. Updates leafIndex for each
4. Saves tree snapshot to database

**Code:** `src/features/zk/merkle/updateMerkleTreeAfterBlock.ts`

**No client action needed** - automatic

---

### Step 3: Generate Proof (Client-Side)

**What the client does:**

**A. Fetch data from node:**
```bash
# Get current Merkle root
curl http://localhost:3000/zk/merkle-root
# Returns: {"rootHash": "98765...", "blockNumber": 1000, "leafCount": 42}

# Get Merkle proof for your commitment
curl http://localhost:3000/zk/merkle/proof/12345678901234567890...
# Returns: {"proof": {"siblings": [...], "pathIndices": [...], ...}}
```

**B. Generate ZK proof:**
```typescript
const circuitInputs = {
  provider_id: githubUserId,      // Private - never sent
  secret: savedSecret,            // Private - never sent
  pathElements: merkleProof.siblings,
  pathIndices: merkleProof.pathIndices,
  context: "vote_proposal_42",    // Public
  merkle_root: rootHash           // Public
};

const { proof, publicSignals } = await groth16.fullProve(
  circuitInputs,
  'identity.wasm',
  'identity.zkey'
);

// publicSignals[0] = nullifier (unique per context)
// publicSignals[1] = merkle_root
// publicSignals[2] = context hash
```

**C. Submit to node:**
```bash
curl -X POST http://localhost:3000/execute \
  -d '{
    "type": "identity",
    "context": "zk_attestation_add",
    "data": {
      "nullifier_hash": "77777...",
      "merkle_root": "98765...",
      "proof": {...},
      "public_signals": [...]
    }
  }'
```

---

### Step 4: Verify Proof (Node Automatic)

**What the node does:**

**1. Cryptographic Verification:**
```typescript
const isValid = await groth16VerifyBun(vkey, publicSignals, proof);
// Checks Groth16 pairing equation
```

**2. Nullifier Check:**
```sql
SELECT * FROM used_nullifiers WHERE nullifier_hash = ?
-- If found → reject (already used)
```

**3. Root Check:**
```sql
SELECT root_hash FROM merkle_tree_state ORDER BY block_number DESC LIMIT 1
-- Compare with proof's merkle_root
-- If mismatch → reject (outdated proof)
```

**4. Success:**
```typescript
// Mark nullifier as used
INSERT INTO used_nullifiers (nullifier_hash, block_number, tx_hash, timestamp)

// Award points
UPDATE accounts SET points.zkAttestation += 10 WHERE address = ...

// Return success
return { valid: true, pointsAwarded: 10 }
```

**Code:** `ProofVerifier.ts:verifyIdentityAttestation()`

---

## API Reference (What The Node Provides)

### POST /execute (Add Commitment)

**Request:**
```json
{
  "type": "identity",
  "context": "zk_commitment_add",
  "data": {
    "provider": "github",
    "commitment_hash": "string (hex or bigint)",
    "timestamp": 1699999999000
  },
  "signature": "0x...",
  "publicKey": "0x..."
}
```

**Response (Success):**
```json
{
  "result": 200,
  "receipt": {
    "transactionHash": "0xabc...",
    "blockNumber": 1000
  }
}
```

**Response (Error):**
```json
{
  "result": 400,
  "error": "Invalid commitment hash format"
}
```

---

### POST /execute (Submit Attestation)

**Request:**
```json
{
  "type": "identity",
  "context": "zk_attestation_add",
  "data": {
    "nullifier_hash": "string",
    "merkle_root": "string",
    "proof": {
      "pi_a": ["...", "...", "1"],
      "pi_b": [["...", "..."], ["...", "..."], ["1", "0"]],
      "pi_c": ["...", "...", "1"],
      "protocol": "groth16",
      "curve": "bn128"
    },
    "public_signals": ["nullifier", "merkle_root", "context_hash"]
  },
  "signature": "0x...",
  "publicKey": "0x..."
}
```

**Response (Valid):**
```json
{
  "result": 200,
  "response": {
    "valid": true,
    "nullifier": "77777...",
    "merkleRoot": "98765...",
    "pointsAwarded": 10
  }
}
```

**Response (Invalid):**
```json
{
  "result": 400,
  "response": {
    "valid": false,
    "reason": "Invalid cryptographic proof" |
             "Nullifier already used" |
             "Stale proof"
  }
}
```

---

### GET /zk/merkle-root

**Response:**
```json
{
  "rootHash": "98765432109876543210...",
  "blockNumber": 1000,
  "leafCount": 42
}
```

---

### GET /zk/merkle/proof/{commitment_hash}

**Response (Found):**
```json
{
  "commitment": "12345...",
  "proof": {
    "siblings": ["11111...", "22222...", ...],  // 20 elements
    "pathIndices": [0, 1, 0, 1, ...],          // 20 elements
    "root": "98765...",
    "leafIndex": 5
  }
}
```

**Response (Not Found):**
```json
{
  "error": "Commitment not found in tree"
}
```

---

### GET /zk/nullifier/{nullifier_hash}

**Response (Used):**
```json
{
  "used": true,
  "nullifierHash": "77777...",
  "blockNumber": 1000,
  "transactionHash": "0xabc...",
  "timestamp": 1699999999000
}
```

**Response (Not Used):**
```json
{
  "used": false,
  "nullifierHash": "77777..."
}
```

---

## Client Implementation Example

### Minimal TypeScript Client

```typescript
import { buildPoseidon } from 'circomlibjs';
import { randomBytes } from 'crypto';
import { groth16 } from 'snarkjs';

const NODE_URL = 'http://localhost:3000';

// 1. Generate commitment
async function createCommitment(githubUserId: string) {
  const poseidon = await buildPoseidon();
  const secret = BigInt('0x' + randomBytes(32).toString('hex'));

  const commitment = poseidon.F.toString(
    poseidon([BigInt(githubUserId), secret])
  );

  return { commitment, secret: secret.toString() };
}

// 2. Submit commitment to node
async function submitCommitment(commitment: string, wallet: any) {
  const tx = {
    type: 'identity',
    context: 'zk_commitment_add',
    data: {
      provider: 'github',
      commitment_hash: commitment,
      timestamp: Date.now()
    }
  };

  const signature = await wallet.signMessage(JSON.stringify(tx));

  const res = await fetch(`${NODE_URL}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...tx, signature, publicKey: wallet.address })
  });

  return res.json();
}

// 3. Generate and submit attestation
async function submitAttestation(
  githubUserId: string,
  secret: string,
  context: string
) {
  // Fetch Merkle root
  const rootRes = await fetch(`${NODE_URL}/zk/merkle-root`);
  const { rootHash } = await rootRes.json();

  // Recompute commitment
  const poseidon = await buildPoseidon();
  const commitment = poseidon.F.toString(
    poseidon([BigInt(githubUserId), BigInt(secret)])
  );

  // Fetch Merkle proof
  const proofRes = await fetch(`${NODE_URL}/zk/merkle/proof/${commitment}`);
  const merkleProof = await proofRes.json();

  // Generate ZK proof
  const inputs = {
    provider_id: githubUserId,
    secret: secret,
    pathElements: merkleProof.proof.siblings,
    pathIndices: merkleProof.proof.pathIndices,
    context: context,
    merkle_root: rootHash
  };

  const { proof, publicSignals } = await groth16.fullProve(
    inputs,
    './identity.wasm',
    './identity.zkey'
  );

  // Submit attestation
  const attestation = {
    type: 'identity',
    context: 'zk_attestation_add',
    data: {
      nullifier_hash: publicSignals[0],
      merkle_root: publicSignals[1],
      proof,
      public_signals: publicSignals
    }
  };

  const res = await fetch(`${NODE_URL}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(attestation)
  });

  return res.json();
}
```

---

## Required Files

### For Node (Already Included)
```
src/features/zk/
├── circuits/identity_with_merkle.circom
├── keys/verification_key_merkle.json
├── proof/ProofVerifier.ts
└── merkle/MerkleTreeManager.ts
```

### For Client (Generate from Node)
```bash
# On node server
bun run zk:setup-all

# This creates:
# - identity.wasm (circuit WASM)
# - identity.zkey (proving key)

# Copy these to your client app
```

---

## Privacy Model

### What The Node Sees
- ✅ Commitment hashes (random numbers)
- ✅ Nullifier hashes (random numbers)
- ✅ Merkle tree state
- ✅ Transaction metadata

### What The Node CANNOT See
- ❌ GitHub usernames
- ❌ User secrets
- ❌ Which commitment → which user
- ❌ Which nullifier → which commitment
- ❌ Linkage across contexts

---

## Configuration

### Node Environment Variables
```bash
ZK_ATTESTATION_POINTS=10
ZK_MERKLE_TREE_DEPTH=20
ZK_MERKLE_TREE_ID="global"
```

### Node Setup
```bash
bun install
bun run zk:setup-all
bun run migrate:latest
bun run start
```

---

## Summary

| Component | Who Implements | Status |
|-----------|---------------|---------|
| GitHub verification | CLIENT | ❌ Not built |
| Commitment generation | CLIENT | ❌ Not built |
| Proof generation | CLIENT | ❌ Not built |
| User interface | CLIENT | ❌ Not built |
| API endpoints | NODE | ✅ zk_ids branch |
| Proof verification | NODE | ✅ zk_ids branch |
| Merkle tree | NODE | ✅ zk_ids branch |
| Database | NODE | ✅ zk_ids branch |

**Bottom line:** The backend is ready. A frontend client needs to be built.

---

## Additional Documentation
- 📄 `ZK_IDENTITY_ARCHITECTURE.md` - Technical details
- 📄 `ZK_IDENTITY_STEP_BY_STEP.md` - Implementation guide
- 🌐 `zk_identity_diagrams.html` - Visual diagrams

---

*This repo provides the NODE/BACKEND only. A separate CLIENT application is required.*
