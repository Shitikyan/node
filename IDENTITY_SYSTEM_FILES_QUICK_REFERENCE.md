# Identity System - Quick File Reference

## Critical Files for ZK-SNARK Integration Evaluation

### Database & State Management
```
/src/model/entities/GCRv2/GCR_Main.ts              [MAIN STATE TABLE]
  - Stores ALL user data: balances, identities, points
  - JSONB column: identities (contains xm, web2, pqc)
  - Currently PUBLIC - all data visible to network
  
/src/model/entities/types/IdentityTypes.ts        [IDENTITY SCHEMA]
  - SavedXmIdentity (Web3)
  - SavedPqcIdentity (Post-quantum)
  - StoredIdentities (all three types)
  
/src/model/entities/Transactions.ts               [TRANSACTION STORAGE]
  - Stores blockchain transactions
  - Links to content via TransactionContent type (from SDK)
```

### Identity Verification Core
```
/src/libs/abstraction/index.ts                    [MAIN VERIFICATION]
  - verifyWeb2Proof() - routes to correct parser
  - verifyTelegramProof() - dual-signature validation
  - Core switching logic for all social platforms

/src/libs/abstraction/web2/
  ├── twitter.ts                                   [TWITTER PROOF]
  │   - Fetches tweet, validates signature
  ├── github.ts                                    [GITHUB PROOF]
  │   - Fetches gist, validates gist owner
  ├── discord.ts                                   [DISCORD PROOF]
  │   - Fetches Discord message, validates author
  └── parsers.ts                                   [PROOF PARSER BASE]
      - Base class for proof extraction

/src/libs/blockchain/gcr/gcr_routines/
  ├── GCRIdentityRoutines.ts                      [CRITICAL - APPLY OPS]
  │   - applyXmIdentityAdd/Remove()
  │   - applyWeb2IdentityAdd/Remove()
  │   - applyPqcIdentityAdd/Remove()
  │   - All identity data is saved to GCR (PUBLIC)
  │
  ├── identityManager.ts                          [VERIFY & MANAGE]
  │   - verifyPayload() - verify XM signatures
  │   - verifyPqcPayload() - verify PQC signatures
  │   - filterConnections() - chain validation
  │
  └── IncentiveManager.ts                         [POINTS SYSTEM]
      - twitterLinked(), githubLinked(), etc.
      - Awards/deducts points on identity changes
```

### Transaction Processing
```
/src/libs/network/routines/transactions/
  └── handleIdentityRequest.ts                    [IDENTITY TX HANDLER]
      - Routes identity transactions by method
      - Calls appropriate verifier
      - Returns success/failure

/src/libs/blockchain/routines/
  ├── validateTransaction.ts                      [TX VALIDATION]
  │   - Verifies transaction signatures
  │   - Creates ValidityData
  │
  └── validatorsManagement.ts                     [VALIDATOR LOGIC]
      - Minimum stake requirements
      - Validator status checking
```

### Cryptography
```
/src/libs/crypto/
  ├── cryptography.ts                             [ED25519 - PRIMARY]
  │   - BIP39 mnemonic → ED25519 key generation
  │   - saveToHex(), loadIdentity()
  │
  └── pqc/enigma.ts                               [PQC - SUPERDIITHIUM]
      - SuperDilithium signing
      - NOT YET integrated into main flow
      
/src/features/postQuantumCryptography/
  └── enigma_lite.ts                              [HYBRID CRYPTO]
      - RSA-OAEP key encapsulation (NOT quantum safe)
      - AES-GCM for data (quantum-safe hash)

/src/features/zk/iZKP/
  └── zk.ts                                       [BASIC ZK PROOF]
      - Prover/Verifier classes
      - Very basic, not production-ready
```

### Social Account Linking
```
/src/libs/identity/tools/
  ├── twitter.ts                                  [TWITTER INTEGRATION]
  │   - TwitterBotDetector (15-point threshold)
  │   - Score-based bot detection
  │
  ├── discord.ts                                  [DISCORD INTEGRATION]
  │   - Discord API message fetching
  │   - Snowflake ID validation
  │
  └── crosschain.ts                               [CROSS-CHAIN TOOLS]
      - Address validation for different chains
```

---

## Data Flow Diagrams

### Identity Linking Flow
```
User Transaction
  ↓
handleIdentityRequest()  [/libs/network/routines/transactions/]
  ↓
[Verify by method]
├─ xm_identity_assign    → IdentityManager.verifyPayload()
├─ web2_identity_assign  → verifyWeb2Proof()
└─ pqc_identity_assign   → IdentityManager.verifyPqcPayload()
  ↓
[If verified: create GCREdit operation]
  ↓
GCRIdentityRoutines.apply()
  ├─ applyXmIdentityAdd()
  ├─ applyWeb2IdentityAdd()
  └─ applyPqcIdentityAdd()
  ↓
[Save to GCRMain]
  ├─ identities.xm[chain][subchain] = [SavedXmIdentity]
  ├─ identities.web2[context] = [Web2GCRData]
  └─ identities.pqc[algorithm] = [SavedPqcIdentity]
  ↓
[Data is now PUBLIC in GCR]
  ↓
Award incentive points
  └─ IncentiveManager.twitterLinked(), etc.
```

### Web2 Proof Verification (Twitter Example)
```
Proof URL: https://twitter.com/username/status/12345
  ↓
TwitterProofParser.readData()
  ├─ Extract username & tweet ID
  ├─ Fetch tweet via Twitter API
  ├─ Verify author matches username
  └─ Return payload: {message, signature, type}
  ↓
ucrypto.verify()
  ├─ Algorithm: "ed25519"
  ├─ Message: extracted payload message
  ├─ PublicKey: sender's ed25519 address
  └─ Signature: extracted signature
  ↓
[Signature verified] → Identity linked & stored publicly
```

### Telegram Dual-Signature Flow
```
TelegramSignedAttestation
├─ payload:
│  ├─ telegram_user_id
│  ├─ username
│  ├─ challenge (signed by user)
│  ├─ public_key (user's ed25519)
│  ├─ signature (user signed challenge)
│  └─ bot_address (bot's ed25519)
│
└─ signature: (bot signed entire payload)
   ├─ type: "ed25519"
   └─ data: hex signature
  ↓
Verify user signature: user_pubkey signs challenge ✓
  ↓
Verify bot signature: bot_address signs payload ✓
  ↓
Check bot authorization: bot_address in genesis block ✓
  ↓
Store in GCRMain.identities.web2["telegram"]
```

---

## Key Statistics

| Metric | Details |
|--------|---------|
| **Identity Types** | 3 (XM/Web3, Web2/Social, PQC) |
| **Supported Social Platforms** | 4 (Twitter, GitHub, Discord, Telegram) |
| **Supported Blockchains** | 8+ (EVM, Solana, IBC, TON, XRPL, NEAR, Aptos, BTC) |
| **Primary Cryptography** | ED25519 |
| **PQC Algorithm** | SuperDilithium (not integrated) |
| **Data Visibility** | 100% PUBLIC (stored in GCR JSONB) |
| **Bot Detection Score Threshold** | 15 (Twitter) |
| **Minimum Validator Stake** | 10000000000000000000000000 |
| **ZK Implementation Maturity** | Very basic/experimental |

---

## Integration Points for ZK-SNARK System

### 1. Point of Privacy Insertion
```
Option A: Pre-Verification Privacy
  User → ZK Proof System → Identity Verification → GCR

Option B: Post-Verification Privacy  
  User → Identity Verification → ZK Proof Commitment → Private GCR

Option C: Parallel Systems
  User → Public Identity (current) + Private Commitment (new)
```

### 2. Database Changes Needed
```
New table: gcr_private_commitments
├─ commitment_hash (Merkle root of identities)
├─ proof_of_ownership (ZK proof)
├─ encrypted_balance
└─ encrypted_points

Extend GCRMain:
├─ privacy_mode: "public" | "private" | "dual"
├─ commitment_address: optional
└─ private_proof: optional
```

### 3. Transaction Type Changes
```
Current: identity_assign
New: identity_assign_zk (for private)

New transaction fields:
├─ proof (ZK-SNARK circuit proof)
├─ commitment (hash of identity)
├─ witness (encrypted)
└─ salt (for privacy)
```

### 4. Verification Changes
```
Current: verifyWeb2Proof()
  └─ Signature verification

New: verifyZKWeb2Proof()
  ├─ Generate ZK circuit
  ├─ Verify ZK proof
  ├─ Verify commitment
  └─ Verify proof-of-solvency
```

---

## Important Notes for ZK Integration

1. **ALL CURRENT DATA IS PUBLIC**
   - Every identity link visible to network
   - No selective disclosure
   - Points and balance transparent
   - This is a fundamental change needed for privacy

2. **ED25519 IS USED EVERYWHERE**
   - All proofs verify against ed25519 signatures
   - ZK system must work with ed25519 (possible with SNARKs)
   - Do NOT rely on RSA (not quantum-safe)

3. **INCENTIVE SYSTEM DEPENDENCY**
   - Points awarded on identity linking
   - Would need to redesign for privacy
   - How to award hidden identity points?

4. **GCR IS MISSION-CRITICAL**
   - All state stored here
   - Must maintain consistency
   - Rollbacks possible via isRollback flag

5. **DUAL-SIGNATURE MODEL EXISTS**
   - Telegram implementation shows pattern
   - Could extend to ZK (user + prover signature)
   - Already handles complex attestations

