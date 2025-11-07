# Blockchain Core - Mermaid Diagrams

## Overview

The Blockchain Core consists of three main components:
- **Block**: Block structure and management
- **Transaction**: Transaction creation, signing, and validation
- **Chain**: Blockchain storage and retrieval
- **Mempool**: Pending transaction pool management

---

## 1. Block Structure & Lifecycle

```mermaid
graph TD
    subgraph BlockStructure["BLOCK STRUCTURE"]
        B1[Block]
        B2[Number]
        B3[Hash]
        B4[Status: derived/confirmed]
        B5[Proposer Public Key]
        B6[Next Proposer]
        B7[Validation Data]

        B1 --> B2
        B1 --> B3
        B1 --> B4
        B1 --> B5
        B1 --> B6
        B1 --> B7
    end

    subgraph BlockContent["BLOCK CONTENT"]
        BC1[Ordered Transactions]
        BC2[Encrypted TX Hashes Map]
        BC3[Per-Address TX Map]
        BC4[Web2 Data]
        BC5[Previous Hash]
        BC6[Timestamp]
        BC7[Peerlist]
        BC8[L2PS Participating Nodes]
        BC9[L2PS Banned Nodes]
        BC10[Native Tables Hashes<br/>GCR Hash<br/>Subnets TX Hash]
    end

    B1 --> BlockContent

    classDef blockClass fill:#667eea,stroke:#764ba2,stroke-width:2px,color:#fff
    classDef contentClass fill:#11998e,stroke:#38ef7d,stroke-width:2px,color:#fff

    class B1,B2,B3,B4,B5,B6,B7 blockClass
    class BC1,BC2,BC3,BC4,BC5,BC6,BC7,BC8,BC9,BC10 contentClass
```

## 2. Transaction Creation & Signing Flow

```mermaid
sequenceDiagram
    participant Client
    participant TX as Transaction Class
    participant Crypto as Cryptography
    participant Hash as Hashing Module

    Note over Client,Hash: PHASE 1: Transaction Creation

    Client->>TX: Create new Transaction()
    TX->>TX: Initialize empty content
    Client->>TX: Set content fields<br/>(type, from, to, amount, data, nonce)
    Client->>TX: Set transaction_fee

    Note over Client,Hash: PHASE 2: Signing

    Client->>TX: Transaction.sign(tx)
    TX->>Crypto: ucrypto.sign(algorithm, content)

    alt Signing Algorithms
        Crypto->>Crypto: ED25519 signature
        Note over Crypto: OR
        Crypto->>Crypto: Post-Quantum signature<br/>(ml-dsa, sl-dsa)
    end

    Crypto-->>TX: Return signature
    TX-->>Client: Signature object<br/>{type, data}

    Note over Client,Hash: PHASE 3: Hashing

    Client->>TX: Transaction.hash(tx)
    TX->>Hash: SHA256(JSON.stringify(content))
    Hash-->>TX: Transaction hash
    TX->>TX: Set tx.hash
    TX-->>Client: Hashed transaction

    Note over Client,Hash: Ready for submission
```

## 3. Transaction Validation Flow

```mermaid
flowchart TD
    Start[Receive Transaction]

    Start --> Struct{Structured?}
    Struct -->|No| E1[Error: Invalid structure]
    Struct -->|Yes| ValidateSig

    ValidateSig[Validate Signature]
    ValidateSig --> CheckSender{Sender matches?}
    CheckSender -->|No| E2[Error: Sender mismatch]
    CheckSender -->|Yes| CheckSigType

    CheckSigType{Signature Type?}
    CheckSigType -->|ED25519| VerifyED
    CheckSigType -->|PQC| CheckGCR

    CheckGCR{PQC in GCR?}
    CheckGCR -->|No| CheckED25519Sig{Has ED25519<br/>backup sig?}
    CheckED25519Sig -->|No| E3[Error: PQC not in GCR]
    CheckED25519Sig -->|Yes| VerifyED
    CheckGCR -->|Yes| VerifyPQC

    VerifyED[Verify ED25519 Signature]
    VerifyPQC[Verify PQC Signature]

    VerifyED --> SigValid{Valid?}
    VerifyPQC --> SigValid

    SigValid -->|No| E4[Error: Invalid signature]
    SigValid -->|Yes| CheckHash

    CheckHash[Check Hash Coherence]
    CheckHash --> HashMatch{Hash matches<br/>content?}
    HashMatch -->|No| E5[Error: Hash mismatch]
    HashMatch -->|Yes| CreateConfirmation

    CreateConfirmation[Create Confirmation Object]
    CreateConfirmation --> SignConfirmation[Sign Confirmation]
    SignConfirmation --> Success[Return Valid Confirmation]

    E1 --> End[Return Error]
    E2 --> End
    E3 --> End
    E4 --> End
    E5 --> End
    Success --> End

    classDef errorClass fill:#ff6b6b,stroke:#ee5a6f,stroke-width:2px,color:#fff
    classDef successClass fill:#51cf66,stroke:#37b24d,stroke-width:2px,color:#fff
    classDef processClass fill:#4dabf7,stroke:#1c7ed6,stroke-width:2px,color:#fff

    class E1,E2,E3,E4,E5,End errorClass
    class Success,CreateConfirmation,SignConfirmation successClass
    class Start,Struct,ValidateSig,CheckSender,CheckSigType,CheckGCR,CheckED25519Sig,VerifyED,VerifyPQC,SigValid,CheckHash,HashMatch processClass
```

## 4. Chain Operations Architecture

```mermaid
graph TB
    subgraph ChainClass["CHAIN CLASS"]
        C1[Setup & Init]
        C2[Database Repositories]
        C3[Query Methods]
    end

    subgraph Getters["GETTER OPERATIONS"]
        G1[getLastBlockNumber]
        G2[getLastBlockHash]
        G3[getBlockByNumber]
        G4[getBlockByHash]
        G5[getBlocks - range]
        G6[getGenesisBlock]
        G7[getTxByHash]
        G8[getTransactionHistory]
    end

    subgraph Setters["SETTER OPERATIONS"]
        S1[insertBlock]
        S2[insertTransaction]
        S3[updateBlockStatus]
        S4[storeValidationData]
    end

    subgraph Database["DATABASE TABLES"]
        DB1[(Blocks Table)]
        DB2[(Transactions Table)]
        DB3[(GCR Tables)]
    end

    subgraph Cache["SHARED STATE CACHE"]
        Cache1[lastBlockNumber]
        Cache2[lastBlockHash]
        Cache3[lastBlock]
    end

    C1 --> C2
    C2 --> C3

    C3 --> Getters
    C3 --> Setters

    Getters --> DB1
    Getters --> DB2
    Setters --> DB1
    Setters --> DB2
    Setters --> DB3

    G1 -.->|Cache hit| Cache1
    G2 -.->|Cache hit| Cache2
    S1 -.->|Updates| Cache1
    S1 -.->|Updates| Cache2
    S1 -.->|Updates| Cache3

    classDef chainClass fill:#667eea,stroke:#764ba2,stroke-width:2px,color:#fff
    classDef getterClass fill:#11998e,stroke:#38ef7d,stroke-width:2px,color:#fff
    classDef setterClass fill:#f093fb,stroke:#f5576c,stroke-width:2px,color:#fff
    classDef dbClass fill:#4facfe,stroke:#00f2fe,stroke-width:2px,color:#fff
    classDef cacheClass fill:#feca57,stroke:#ff9ff3,stroke-width:2px,color:#333

    class C1,C2,C3 chainClass
    class G1,G2,G3,G4,G5,G6,G7,G8 getterClass
    class S1,S2,S3,S4 setterClass
    class DB1,DB2,DB3 dbClass
    class Cache1,Cache2,Cache3 cacheClass
```

## 5. Block Insertion Flow

```mermaid
sequenceDiagram
    participant Validator
    participant Chain
    participant Block
    participant GCR
    participant Mempool
    participant Database

    Note over Validator,Database: PHASE 1: Pre-Insertion Validation

    Validator->>Chain: insertBlock(block, txs, gcrSnapshot)
    Chain->>Chain: Check block number continuity
    Chain->>Chain: Validate previous hash

    alt Block already exists
        Chain-->>Validator: Error: Block exists
    else Continue
        Chain->>Block: Verify block structure
        Block-->>Chain: Structure valid
    end

    Note over Validator,Database: PHASE 2: Transaction Processing

    loop For each transaction
        Chain->>Chain: Validate transaction
        Chain->>GCR: Process GCR edits
        GCR->>GCR: Update balances/identities
        GCR-->>Chain: GCR updated
    end

    Note over Validator,Database: PHASE 3: Native Tables Processing

    Chain->>GCR: Process native operations
    GCR->>GCR: Update native tables
    GCR->>GCR: Calculate GCR hash
    GCR-->>Chain: Native hash

    Note over Validator,Database: PHASE 4: Database Commit

    Chain->>Database: Save block
    Database-->>Chain: Block saved

    Chain->>Database: Save transactions
    Database-->>Chain: Transactions saved

    Chain->>GCR: Commit GCR state
    GCR->>Database: Save GCR updates
    Database-->>GCR: GCR committed

    Note over Validator,Database: PHASE 5: Cleanup

    Chain->>Mempool: Remove processed transactions
    Mempool->>Database: Delete from mempool
    Database-->>Mempool: Deleted

    Chain->>Chain: Update shared state cache
    Chain-->>Validator: Block inserted successfully
```

## 6. Mempool Management

```mermaid
flowchart TD
    subgraph MempoolOps["MEMPOOL OPERATIONS"]
        M1[Add Transaction]
        M2[Get Mempool]
        M3[Remove Transactions]
        M4[Check Transaction Exists]
    end

    subgraph AddTX["ADD TRANSACTION FLOW"]
        A1[Receive TX]
        A2{TX in blockchain?}
        A3{TX in mempool?}
        A4[Determine block number]
        A5{In consensus loop?}
        A6[Use SecretaryManager.lastBlockRef + 1]
        A7[Use Chain.getLastBlockNumber + 1]
        A8[Save to mempool]
        A9[Return confirmation block]
    end

    subgraph GetMempool["GET MEMPOOL FLOW"]
        GM1[Query mempool]
        GM2{Block number<br/>specified?}
        GM3[Get all transactions]
        GM4[Get TXs <= blockNumber]
        GM5[Order by timestamp, block, hash]
        GM6[Return transactions]
    end

    subgraph Validation["TRANSACTION VALIDATION"]
        V1[Check coherence]
        V2[Validate signature]
        V3{Valid?}
        V4[Add to mempool]
        V5[Reject TX]
    end

    M1 --> A1
    A1 --> A2
    A2 -->|Yes| E1[Error: TX exists]
    A2 -->|No| A3
    A3 -->|Yes| E2[Error: TX in mempool]
    A3 -->|No| A4
    A4 --> A5
    A5 -->|Yes| A6
    A5 -->|No| A7
    A6 --> A8
    A7 --> A8
    A8 --> A9

    M2 --> GM1
    GM1 --> GM2
    GM2 -->|No| GM3
    GM2 -->|Yes| GM4
    GM3 --> GM5
    GM4 --> GM5
    GM5 --> GM6

    A1 --> V1
    V1 --> V2
    V2 --> V3
    V3 -->|Yes| V4
    V3 -->|No| V5

    classDef mempoolClass fill:#667eea,stroke:#764ba2,stroke-width:2px,color:#fff
    classDef addClass fill:#11998e,stroke:#38ef7d,stroke-width:2px,color:#fff
    classDef getClass fill:#f093fb,stroke:#f5576c,stroke-width:2px,color:#fff
    classDef validClass fill:#4dabf7,stroke:#1c7ed6,stroke-width:2px,color:#fff
    classDef errorClass fill:#ff6b6b,stroke:#ee5a6f,stroke-width:2px,color:#fff

    class M1,M2,M3,M4 mempoolClass
    class A1,A2,A3,A4,A5,A6,A7,A8,A9 addClass
    class GM1,GM2,GM3,GM4,GM5,GM6 getClass
    class V1,V2,V3,V4,V5 validClass
    class E1,E2 errorClass
```

## 7. Transaction Types & Structure

```mermaid
graph TB
    subgraph TXTypes["TRANSACTION TYPES"]
        T1[standard - Token transfer]
        T2[delegated - Delegated execution]
        T3[subnet - Subnet operation]
        T4[l2ps - L2PS transaction]
        T5[l2ps_hash_update - L2PS hash update]
        T6[web2_request - Web2 API call]
        T7[contract - Smart contract call]
    end

    subgraph TXContent["TRANSACTION CONTENT"]
        TC1[Type]
        TC2[From address]
        TC3[From ED25519 address]
        TC4[To address]
        TC5[Amount]
        TC6[Data - array of 2 elements]
        TC7[GCR Edits]
        TC8[Nonce]
        TC9[Timestamp]
        TC10[Transaction Fees<br/>- network_fee<br/>- rpc_fee<br/>- additional_fee]
    end

    subgraph TXMeta["TRANSACTION METADATA"]
        TM1[Signature<br/>- type - algorithm<br/>- data - hex string]
        TM2[ED25519 Signature - backup]
        TM3[Hash - SHA256 of content]
        TM4[Status]
        TM5[Block Number]
    end

    TXTypes --> TC1
    TXContent --> TXMeta

    classDef typeClass fill:#667eea,stroke:#764ba2,stroke-width:2px,color:#fff
    classDef contentClass fill:#11998e,stroke:#38ef7d,stroke-width:2px,color:#fff
    classDef metaClass fill:#f093fb,stroke:#f5576c,stroke-width:2px,color:#fff

    class T1,T2,T3,T4,T5,T6,T7 typeClass
    class TC1,TC2,TC3,TC4,TC5,TC6,TC7,TC8,TC9,TC10 contentClass
    class TM1,TM2,TM3,TM4,TM5 metaClass
```

## 8. Complete Transaction Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Created: Client creates TX

    Created --> Signed: Sign with private key
    Signed --> Hashed: Calculate hash
    Hashed --> Submitted: Submit to RPC

    Submitted --> Validating: RPC validates

    state Validating {
        [*] --> CheckStructure
        CheckStructure --> CheckSignature
        CheckSignature --> CheckHash
        CheckHash --> [*]
    }

    Validating --> Rejected: Validation failed
    Validating --> InMempool: Valid TX

    InMempool --> AwaitingConsensus: Waiting for proposer

    state ConsensusProcessing {
        [*] --> ProposerSelection
        ProposerSelection --> BlockCreation
        BlockCreation --> BlockValidation
        BlockValidation --> BlockInsertion
        BlockInsertion --> [*]
    }

    AwaitingConsensus --> ConsensusProcessing: Block proposed

    ConsensusProcessing --> InBlock: Block confirmed

    InBlock --> Executed: GCR updates applied

    Executed --> [*]: Transaction complete

    Rejected --> [*]: Error returned

    note right of InMempool
        TX stored in mempool
        Assigned to block number
    end note

    note right of InBlock
        TX permanently stored
        Removed from mempool
    end note
```

## 9. Database Schema

```mermaid
erDiagram
    Blocks ||--|{ Transactions : contains
    Blocks ||--|| GCRHashes : references
    Blocks {
        int number PK
        string hash
        string status
        jsonb content
        string proposer
        string next_proposer
        jsonb validation_data
        timestamp created_at
    }

    Transactions {
        string hash PK
        string type
        string from
        string from_ed25519_address
        string to
        decimal amount
        jsonb data
        jsonb gcr_edits
        int nonce
        bigint timestamp
        jsonb transaction_fee
        jsonb signature
        string ed25519_signature
        int blockNumber FK
    }

    Mempool ||--o{ MempoolTx : stores
    MempoolTx {
        string hash PK
        string type
        string from
        string to
        decimal amount
        jsonb content
        jsonb signature
        bigint timestamp
        int nonce
        int blockNumber
        int reference_block
    }

    GCRHashes {
        int block_number PK
        string gcr_hash
        string subnets_hash
        timestamp updated_at
    }
```

## 10. Block Proposal & Validation

```mermaid
flowchart TD
    subgraph Proposer["BLOCK PROPOSER"]
        P1[Check if validator]
        P2[Check if turn to propose]
        P3[Get mempool TXs]
        P4[Process transactions]
        P5[Calculate GCR hash]
        P6[Calculate subnets hash]
        P7[Create block]
        P8[Sign block]
        P9[Broadcast to validators]
    end

    subgraph Validators["VALIDATORS"]
        V1[Receive block proposal]
        V2[Validate block structure]
        V3[Verify proposer signature]
        V4[Validate each transaction]
        V5[Recalculate hashes]
        V6{Hashes match?}
        V7[Sign validation]
        V8[Send validation back]
        V9[Reject block]
    end

    subgraph Consensus["CONSENSUS"]
        CO1[Collect validations]
        CO2{Enough signatures?}
        CO3[Block confirmed]
        CO4[Insert to chain]
        CO5[Broadcast confirmed block]
        CO6[Try different proposer]
    end

    P1 --> P2
    P2 --> P3
    P3 --> P4
    P4 --> P5
    P5 --> P6
    P6 --> P7
    P7 --> P8
    P8 --> P9

    P9 --> V1
    V1 --> V2
    V2 --> V3
    V3 --> V4
    V4 --> V5
    V5 --> V6
    V6 -->|Yes| V7
    V6 -->|No| V9
    V7 --> V8

    V8 --> CO1
    V9 --> CO6
    CO1 --> CO2
    CO2 -->|Yes| CO3
    CO2 -->|No| CO6
    CO3 --> CO4
    CO4 --> CO5

    classDef proposerClass fill:#667eea,stroke:#764ba2,stroke-width:2px,color:#fff
    classDef validatorClass fill:#11998e,stroke:#38ef7d,stroke-width:2px,color:#fff
    classDef consensusClass fill:#f093fb,stroke:#f5576c,stroke-width:2px,color:#fff

    class P1,P2,P3,P4,P5,P6,P7,P8,P9 proposerClass
    class V1,V2,V3,V4,V5,V6,V7,V8,V9 validatorClass
    class CO1,CO2,CO3,CO4,CO5,CO6 consensusClass
```

---

## Key Concepts

### Block Status
- **derived**: Block proposed but not yet confirmed by validators
- **confirmed**: Block validated by consensus and permanently stored

### Transaction Fees
- **network_fee**: Fee paid to network validators
- **rpc_fee**: Fee paid to RPC node that processed transaction
- **additional_fee**: Optional additional fees

### Signature Types
- **ed25519**: Standard elliptic curve signature
- **ml-dsa**: Post-quantum ML-DSA (Dilithium)
- **sl-dsa**: Post-quantum SL-DSA (Sphincs+)

### GCR Edits
Transactions can carry GCR (Global Consensus Registry) edits that modify:
- Account balances
- Identity information
- Token metadata
- NFT ownership
- Native subnet states

### Mempool Block Assignment
Transactions are assigned to specific block numbers:
- During consensus: Uses `SecretaryManager.lastBlockRef + 1`
- Outside consensus: Uses `Chain.getLastBlockNumber() + 1`
