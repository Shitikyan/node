# ZK Identity System - Architecture Documentation

## Overview

This system implements **anonymous identity attestation** using Groth16 ZK-SNARKs with Merkle tree membership proofs. It enables users to prove they control a verified Web2 identity (GitHub, Twitter, etc.) without revealing which specific identity, while preventing double-attestations through nullifiers.

---

## MermaidJS Architecture Diagram

```mermaid
graph TB
    subgraph "Client Side"
        User[User with Provider ID + Secret]
        ClientCircuit[Circom Circuit Execution]
        ProofGen[ZK Proof Generator]
        User -->|provider_id, secret| ClientCircuit
    end

    subgraph "Node/Server Side"
        API[API Endpoints]
        TxExecutor[Transaction Executor]
        GCRRoutines[GCR Identity Routines]
        ProofVerifier[Proof Verifier]
        MerkleManager[Merkle Tree Manager]
        BlockCommit[Block Commit Handler]
    end

    subgraph "Database Layer"
        CommitmentDB[(Identity Commitments)]
        NullifierDB[(Used Nullifiers)]
        MerkleStateDB[(Merkle Tree State)]
        AccountDB[(Account Points)]
    end

    subgraph "Cryptographic Components"
        PoseidonHash[Poseidon Hash]
        Groth16Verify[Groth16 Verifier]
        MerkleProof[Merkle Proof Generator]
    end

    ClientCircuit -->|commitment| ProofGen
    ProofGen -->|proof + public signals| API
    API -->|execute transaction| TxExecutor
    TxExecutor -->|zk_commitment_add| GCRRoutines
    TxExecutor -->|zk_attestation_add| GCRRoutines

    GCRRoutines -->|store commitment| CommitmentDB
    GCRRoutines -->|verify proof| ProofVerifier

    ProofVerifier -->|check pairing| Groth16Verify
    ProofVerifier -->|check used| NullifierDB
    ProofVerifier -->|check root| MerkleStateDB

    BlockCommit -->|after block| MerkleManager
    MerkleManager -->|add commitments| CommitmentDB
    MerkleManager -->|update tree| MerkleStateDB
    MerkleManager -->|use| PoseidonHash

    MerkleManager -->|generate proof| MerkleProof
    API -->|GET /zk/merkle/proof| MerkleManager
    API -->|GET /zk/merkle-root| MerkleManager

    ProofVerifier -->|award points| AccountDB
```

---

## Detailed Flow Diagrams

### 1. Commitment Creation Flow

```mermaid
sequenceDiagram
    participant User
    participant Client
    participant API
    participant GCRRoutines
    participant DB
    participant BlockCommit
    participant MerkleTree

    User->>Client: Provide provider_id + secret
    Client->>Client: commitment = Poseidon(provider_id, secret)
    Client->>API: POST /execute (identity, zk_commitment_add)
    API->>GCRRoutines: applyZkCommitmentAdd()
    GCRRoutines->>DB: INSERT IdentityCommitment<br/>(leafIndex = -1)
    DB-->>GCRRoutines: Success
    GCRRoutines-->>API: Transaction receipt
    API-->>Client: Commitment stored

    Note over BlockCommit: After block is committed
    BlockCommit->>MerkleTree: updateMerkleTreeAfterBlock()
    MerkleTree->>DB: SELECT commitments WHERE leafIndex = -1
    DB-->>MerkleTree: Pending commitments
    MerkleTree->>MerkleTree: Add each commitment to tree
    MerkleTree->>DB: UPDATE leafIndex for each
    MerkleTree->>DB: SAVE tree snapshot + root hash
    DB-->>MerkleTree: Saved
    MerkleTree-->>BlockCommit: Tree updated
```

### 2. Proof Generation and Verification Flow

```mermaid
sequenceDiagram
    participant User
    participant Client
    participant API
    participant ProofVerifier
    participant Groth16
    participant NullifierDB
    participant MerkleDB
    participant AccountDB

    User->>Client: Request attestation for context
    Client->>API: GET /zk/merkle-root
    API-->>Client: {rootHash, blockNumber}

    Client->>API: GET /zk/merkle/proof/{commitment}
    API-->>Client: {siblings, pathIndices, leafIndex}

    Client->>Client: Generate ZK proof using circuit:<br/>- provider_id (private)<br/>- secret (private)<br/>- pathElements (private)<br/>- pathIndices (private)<br/>- context (public)<br/>- merkle_root (public)

    Client->>Client: Circuit outputs:<br/>- nullifier<br/>- verified commitment in tree

    Client->>API: POST /execute (identity, zk_attestation_add)<br/>{proof, publicSignals}

    API->>ProofVerifier: verifyIdentityAttestation()

    Note over ProofVerifier: Step 1: Cryptographic Verification
    ProofVerifier->>Groth16: groth16VerifyBun(vkey, publicSignals, proof)
    Groth16->>Groth16: Check pairing equation:<br/>e(pi_a, pi_b) = e(vk_alpha, vk_beta) * ...
    Groth16-->>ProofVerifier: Valid/Invalid

    alt Proof Invalid
        ProofVerifier-->>API: {valid: false, reason: "cryptographic"}
        API-->>Client: Verification failed
    end

    Note over ProofVerifier: Step 2: Nullifier Check
    ProofVerifier->>NullifierDB: SELECT * WHERE nullifier_hash = ?
    NullifierDB-->>ProofVerifier: Result

    alt Nullifier Already Used
        ProofVerifier-->>API: {valid: false, reason: "double-attestation"}
        API-->>Client: Already attested
    end

    Note over ProofVerifier: Step 3: Merkle Root Check
    ProofVerifier->>MerkleDB: Get current root hash
    MerkleDB-->>ProofVerifier: Current root

    alt Root Mismatch
        ProofVerifier-->>API: {valid: false, reason: "stale proof"}
        API-->>Client: Proof outdated
    end

    Note over ProofVerifier: All checks passed
    ProofVerifier->>NullifierDB: INSERT used_nullifier
    ProofVerifier->>AccountDB: Award ZK_ATTESTATION_POINTS
    ProofVerifier-->>API: {valid: true}
    API-->>Client: Attestation successful!
```

### 3. Component Architecture

```mermaid
graph TB
    subgraph "Circom Circuits"
        BasicCircuit[identity.circom<br/>Phase 3: Basic Proof]
        MerkleCircuit[identity_with_merkle.circom<br/>Phase 5: Tree Membership]

        BasicCircuit -->|outputs| Commitment1[commitment]
        BasicCircuit -->|outputs| Nullifier1[nullifier]

        MerkleCircuit -->|outputs| Commitment2[commitment]
        MerkleCircuit -->|outputs| Nullifier2[nullifier]
        MerkleCircuit -->|verifies| MerkleRoot[merkle_root match]
    end

    subgraph "Proof System"
        VKey[Verification Key<br/>verification_key_merkle.json]
        Verifier[BunSnarkjsWrapper<br/>Groth16 Verifier]

        VKey -->|loaded by| Verifier
    end

    subgraph "Tree Management"
        TreeManager[MerkleTreeManager<br/>20-level Poseidon tree]
        TreeUpdate[updateMerkleTreeAfterBlock<br/>Batch insertion]

        TreeUpdate -->|uses| TreeManager
        TreeManager -->|generates| ProofPath[Merkle Proofs]
    end

    subgraph "Verification Pipeline"
        Pipeline[ProofVerifier]
        Step1[1. Cryptographic Check]
        Step2[2. Nullifier Uniqueness]
        Step3[3. Root Currency]

        Pipeline -->|runs| Step1
        Step1 -->|if valid| Step2
        Step2 -->|if unique| Step3
        Step3 -->|if current| Success[Award Points]
    end

    subgraph "API Layer"
        Execute[POST /execute]
        GetRoot[GET /zk/merkle-root]
        GetProof[GET /zk/merkle/proof/:hash]
        CheckNullifier[GET /zk/nullifier/:hash]

        Execute -->|routes to| Pipeline
        GetRoot -->|queries| TreeManager
        GetProof -->|queries| TreeManager
    end

    MerkleCircuit -.->|proof verified by| Verifier
    TreeManager -.->|provides data for| MerkleCircuit
```

### 4. Data Model Relationships

```mermaid
erDiagram
    IDENTITY_COMMITMENTS {
        string commitment_hash PK
        int leaf_index "default -1"
        string provider
        int block_number
        string transaction_hash
        bigint timestamp
    }

    MERKLE_TREE_STATE {
        string tree_id PK
        string root_hash
        int block_number
        int leaf_count
        jsonb tree_snapshot
    }

    USED_NULLIFIERS {
        string nullifier_hash PK
        int block_number
        string transaction_hash
        bigint timestamp
    }

    ACCOUNTS {
        string address PK
        jsonb points
    }

    ZK_PROOFS {
        string proof_id PK
        string nullifier_hash FK
        string merkle_root
        jsonb proof_data
        jsonb public_signals
    }

    IDENTITY_COMMITMENTS ||--o{ MERKLE_TREE_STATE : "inserted_into"
    USED_NULLIFIERS ||--|| ZK_PROOFS : "marks"
    ZK_PROOFS }o--|| MERKLE_TREE_STATE : "references_root"
    USED_NULLIFIERS }o--|| ACCOUNTS : "awards_points_to"
```

### 5. Cryptographic Primitives Flow

```mermaid
graph LR
    subgraph "Inputs"
        ProviderID[Provider ID<br/>e.g., GitHub username]
        Secret[Secret<br/>User's private key]
        Context[Context<br/>e.g., vote_123]
    end

    subgraph "Poseidon Hashing"
        Hash1[Poseidon Hash]
        Hash2[Poseidon Hash]
        Hash3[Poseidon Hash - Tree]
    end

    subgraph "Outputs"
        Commitment[Commitment<br/>Public, in tree]
        Nullifier[Nullifier<br/>Unique per context]
        TreeNode[Tree Nodes<br/>Internal hashes]
    end

    ProviderID -->|input| Hash1
    Secret -->|input| Hash1
    Hash1 -->|output| Commitment

    ProviderID -->|input| Hash2
    Secret -->|input| Hash2
    Context -->|input| Hash2
    Hash2 -->|output| Nullifier

    Commitment -->|leaf| Hash3
    Hash3 -->|parent| Hash3
    Hash3 -->|output| TreeNode

    subgraph "Groth16 Circuit"
        CircuitInput[Private: provider_id, secret, path<br/>Public: context, merkle_root]
        CircuitLogic[Verify:<br/>1. commitment = H(provider_id, secret)<br/>2. nullifier = H(provider_id, secret, context)<br/>3. merkleProof valid<br/>4. merkleProof.root == merkle_root]
        CircuitOutput[Outputs:<br/>nullifier, merkle_root]

        CircuitInput --> CircuitLogic
        CircuitLogic --> CircuitOutput
    end

    Commitment -.->|proves knowledge of| CircuitInput
    Nullifier -.->|computed by| CircuitLogic
```

---

## System Components Detail

### Core Components

| Component | Location | Responsibility |
|-----------|----------|----------------|
| **identity_with_merkle.circom** | `src/features/zk/circuits/` | Circuit definition for ZK proofs with tree membership |
| **ProofVerifier** | `src/features/zk/proof/ProofVerifier.ts` | 3-step verification pipeline |
| **BunSnarkjsWrapper** | `src/features/zk/proof/BunSnarkjsWrapper.ts` | Bun-compatible Groth16 verifier |
| **MerkleTreeManager** | `src/features/zk/merkle/MerkleTreeManager.ts` | Global tree management (20 levels, Poseidon) |
| **updateMerkleTreeAfterBlock** | `src/features/zk/merkle/updateMerkleTreeAfterBlock.ts` | Batch commitment insertion after blocks |
| **GCRIdentityRoutines** | `src/libs/blockchain/gcr/gcr_routines/GCRIdentityRoutines.ts` | Transaction handlers for commitments and attestations |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/execute` | POST | Submit commitment or attestation transaction |
| `/zk/merkle-root` | GET | Get current tree root for proof generation |
| `/zk/merkle/proof/:hash` | GET | Get Merkle proof for specific commitment |
| `/zk/nullifier/:hash` | GET | Check if nullifier has been used |
| `/` (with `method: "verifyProof"`) | POST | Quick proof verification |

### Database Tables

| Table | Purpose |
|-------|---------|
| **identity_commitments** | Stores all commitments with leaf indices |
| **merkle_tree_state** | Persists tree snapshot and root hash |
| **used_nullifiers** | Prevents double-attestations (PK on hash) |
| **accounts** | Stores user points awarded for attestations |

---

## Key Cryptographic Properties

### Privacy Guarantees
- **Provider ID Hidden:** Never transmitted, only used in circuit
- **Unlinkability:** Different nullifiers per context prevent tracking
- **Anonymity Set:** All users in global tree (can't determine which identity)

### Security Guarantees
- **Double-Attestation Prevention:** Nullifier PK constraint + database check
- **Proof Soundness:** Groth16 pairing verification (256-bit security)
- **Replay Protection:** Context-bound nullifiers
- **Membership Proof:** Merkle path verification in circuit

### Performance Characteristics
- **Tree Capacity:** 2^20 = 1,048,576 commitments
- **Proof Size:** ~128 bytes (3 curve points)
- **Verification Time:** ~5-10ms per proof
- **Tree Update:** Batch after each block (deterministic order)

---

## Configuration

### Environment Variables
```bash
ZK_ATTESTATION_POINTS=10      # Points awarded per valid attestation
ZK_MERKLE_TREE_DEPTH=20       # Tree levels (1M+ capacity)
ZK_MERKLE_TREE_ID="global"    # Tree identifier
```

### Setup Requirements
```bash
# One-time setup
bun run zk:setup-all

# Downloads:
# - Powers of Tau ceremony file (140MB)
# - Generates verification keys
# - Compiles circuits
```

### Key Files
- `src/features/zk/keys/verification_key_merkle.json` - Verification key (committed)
- `src/features/zk/keys/identity.zkey` - Proving key (gitignored, local)
- `src/features/zk/keys/powersOfTau28_hez_final_14.ptau` - Trusted setup (gitignored)

---

## Use Cases

### 1. Anonymous Airdrops
- Users prove they have verified identity without revealing which one
- Nullifier prevents claiming multiple times
- Anonymity set = all verified users

### 2. Private Voting
- One vote per identity per proposal
- Context = proposal ID (different nullifier per proposal)
- Vote cannot be linked to specific user

### 3. Reputation Systems
- Prove identity quality (e.g., GitHub with X followers)
- Without revealing exact account
- Accumulate points anonymously

---

## Testing

### Test Files
- `src/features/zk/tests/proof-verifier.test.ts` - Verification pipeline tests
- `src/features/zk/tests/merkle.test.ts` - Tree operations tests
- `src/tests/test_identity_verification.ts` - Circuit tests
- `src/tests/test_production_verification.ts` - Production proof validation

### Run Tests
```bash
bun test src/features/zk/tests/
```

---

## Future Enhancements

### Planned Features
- **Multiple Trees:** Separate trees per provider for privacy tiers
- **Recursive Proofs:** Aggregate multiple attestations
- **Range Proofs:** Prove account age or follower count ranges
- **Revocation:** Support for revoking compromised commitments

### Scalability Optimizations
- **Off-chain Tree:** Move tree to IPFS/Arweave for reduced DB load
- **Batch Verification:** Verify multiple proofs in single pairing
- **Lazy Tree Updates:** Update tree on-demand vs. after every block

---

## References

- **Groth16 Paper:** https://eprint.iacr.org/2016/260.pdf
- **Circom Documentation:** https://docs.circom.io/
- **Poseidon Hash:** https://www.poseidon-hash.info/
- **snarkjs Library:** https://github.com/iden3/snarkjs
- **Incremental Merkle Trees:** https://github.com/privacy-scaling-explorations/zk-kit

---

## Architecture Decisions

### Why Groth16?
- **Proof Size:** Smallest proof size (~128 bytes) vs. Plonk (~512 bytes)
- **Verification Speed:** Fastest verification (~5ms) vs. STARKs (~50ms)
- **Maturity:** Battle-tested in production (Zcash, Filecoin, Tornado Cash)

### Why Poseidon?
- **ZK-Friendly:** Designed for SNARK circuits (fewer constraints)
- **Performance:** ~10x faster than SHA256 in circuits
- **Security:** 128-bit security level, extensively analyzed

### Why 20-level Tree?
- **Capacity:** 1M+ users = sufficient for medium-scale deployments
- **Proof Size:** 20 siblings = reasonable proof generation time
- **Gas Efficiency:** Could verify on-chain if needed (20 hashes)

### Why Global Tree?
- **Maximum Anonymity:** All users in same anonymity set
- **Simplicity:** Single source of truth for commitments
- **Flexibility:** Context parameter allows per-use-case nullifiers

---

*Generated from zk_ids branch analysis*
