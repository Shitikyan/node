# L2PS Architecture - Mermaid Diagrams

## 1. Complete Transaction Flow

```mermaid
flowchart TB
    subgraph Client["CLIENT LAYER"]
        C1[Client Application]
        C2[Encrypt Transaction]
        C3[Sign with L2PS Keys]
    end

    subgraph L2PS["L2PS PARTICIPANT NODE (Non-Validator)"]
        L1[RPC Server]
        L2{Subnet Type?}
        L3[Load L2PS Instance]
        L4[Decrypt Transaction]
        L5[Verify Signature]
        L6{Valid?}
        L7[Check Duplicate]
        L8{Already Processed?}
        L9[(L2PS Mempool<br/>Encrypted Storage)]
        L10[Return Success]
        L11[Return Error]
    end

    subgraph Hash["HASH GENERATION SERVICE (Background - Every 5s)"]
        H1[L2PSHashService Timer]
        H2{Reentrancy Check}
        H3[Get Joined L2PS UIDs]
        H4[For Each UID]
        H5[Get All Transactions]
        H6[Generate Consolidated Hash]
        H7[Create L2PS Hash Update TX]
        H8[Sign Self-Directed TX]
    end

    subgraph DTR["DTR ROUTING LAYER"]
        D1[Get Validator List]
        D2[Filter Online Validators]
        D3[Randomize Order]
        D4[Try Each Validator]
        D5{Success?}
        D6[RELAY_TX Call]
    end

    subgraph Validator["VALIDATOR CONSENSUS LAYER"]
        V1[Receive Hash Update]
        V2[Validate TX Signature]
        V3{L2PS Participant?}
        V4[Store UID → Hash Mapping]
        V5[(L2PS Hash Storage)]
        V6[Include in Consensus]
        V7[Reject TX]
    end

    %% Client Flow
    C1 --> C2
    C2 --> C3
    C3 -->|Encrypted L2PS TX| L1

    %% L2PS Node Flow
    L1 --> L2
    L2 -->|L2PS Type| L3
    L3 --> L4
    L4 --> L5
    L5 --> L6
    L6 -->|Yes| L7
    L6 -->|No| L11
    L7 --> L8
    L8 -->|No| L9
    L8 -->|Yes| L11
    L9 --> L10
    L10 -->|Response| C1
    L11 -->|Error| C1

    %% Hash Service Flow
    H1 -.->|Every 5s| H2
    H2 -->|Not Running| H3
    H3 --> H4
    H4 --> H5
    L9 -.->|Read| H5
    H5 --> H6
    H6 --> H7
    H7 --> H8
    H8 --> D1

    %% DTR Flow
    D1 --> D2
    D2 --> D3
    D3 --> D4
    D4 --> D6
    D6 --> D5
    D5 -->|Yes| V1
    D5 -->|No - Try Next| D4

    %% Validator Flow
    V1 --> V2
    V2 --> V3
    V3 -->|Yes| V4
    V3 -->|No| V7
    V4 --> V5
    V5 --> V6

    %% Styling
    classDef clientStyle fill:#667eea,stroke:#764ba2,stroke-width:3px,color:#fff
    classDef l2psStyle fill:#11998e,stroke:#38ef7d,stroke-width:3px,color:#fff
    classDef hashStyle fill:#f093fb,stroke:#f5576c,stroke-width:3px,color:#fff
    classDef dtrStyle fill:#fa709a,stroke:#fee140,stroke-width:3px,color:#333
    classDef validatorStyle fill:#ee0979,stroke:#ff6a00,stroke-width:3px,color:#fff
    classDef storageStyle fill:#4facfe,stroke:#00f2fe,stroke-width:2px,color:#fff

    class C1,C2,C3 clientStyle
    class L1,L2,L3,L4,L5,L6,L7,L8,L10,L11 l2psStyle
    class L9 storageStyle
    class H1,H2,H3,H4,H5,H6,H7,H8 hashStyle
    class D1,D2,D3,D4,D5,D6 dtrStyle
    class V1,V2,V3,V4,V6,V7 validatorStyle
    class V5 storageStyle
```

## 2. Architecture Layers Overview

```mermaid
graph TD
    subgraph Layer1["LAYER 1: CLIENT"]
        CL[Client Application]
        CL1[Transaction Creation]
        CL2[L2PS Encryption]
        CL3[Network Keys]
    end

    subgraph Layer2["LAYER 2: L2PS PARTICIPANTS"]
        L2PS1[RPC Reception<br/>server_rpc.ts]
        L2PS2[Transaction Handler<br/>handleL2PS.ts]
        L2PS3[L2PS Instance<br/>ParallelNetworks]
        L2PS4[Decryption Engine]
        L2PS5[L2PS Mempool<br/>l2ps_mempool.ts]
        L2PS6[Hash Service<br/>L2PSHashService.ts]

        L2PS1 --> L2PS2
        L2PS2 --> L2PS3
        L2PS3 --> L2PS4
        L2PS4 --> L2PS5
        L2PS5 -.->|Every 5s| L2PS6
    end

    subgraph Layer3["LAYER 3: DTR INFRASTRUCTURE"]
        DTR1[Validator Discovery<br/>getCommonValidatorSeed]
        DTR2[Shard Selection<br/>getShard]
        DTR3[Load Balancer<br/>Random Ordering]
        DTR4[Relay Service<br/>RELAY_TX]
        DTR5[Retry Logic<br/>RelayRetryService]

        DTR1 --> DTR2
        DTR2 --> DTR3
        DTR3 --> DTR4
        DTR4 -.->|On Failure| DTR5
    end

    subgraph Layer4["LAYER 4: VALIDATORS"]
        VAL1[Endpoint Handler<br/>endpointHandlers.ts]
        VAL2[Hash Update Validation]
        VAL3[Participant Verification]
        VAL4[Hash Storage<br/>L2PSHashes Entity]
        VAL5[Consensus Integration]

        VAL1 --> VAL2
        VAL2 --> VAL3
        VAL3 --> VAL4
        VAL4 --> VAL5
    end

    CL -->|Encrypted TX| L2PS1
    L2PS6 -->|Hash Update TX| DTR1
    DTR4 -->|UID → Hash| VAL1

    classDef clientClass fill:#667eea,stroke:#764ba2,stroke-width:2px,color:#fff
    classDef l2psClass fill:#11998e,stroke:#38ef7d,stroke-width:2px,color:#fff
    classDef dtrClass fill:#fa709a,stroke:#fee140,stroke-width:2px,color:#333
    classDef validatorClass fill:#ee0979,stroke:#ff6a00,stroke-width:2px,color:#fff

    class CL,CL1,CL2,CL3 clientClass
    class L2PS1,L2PS2,L2PS3,L2PS4,L2PS5,L2PS6 l2psClass
    class DTR1,DTR2,DTR3,DTR4,DTR5 dtrClass
    class VAL1,VAL2,VAL3,VAL4,VAL5 validatorClass
```

## 3. Privacy Model Comparison

```mermaid
graph LR
    subgraph L2PS["L2PS PARTICIPANT NODE"]
        L1[Receives Encrypted TX]
        L2[Has Decryption Keys]
        L3[Can View TX Content]
        L4[Stores Encrypted Copy]
        L5[Processes Transactions]
        L6[NOT in Consensus]

        L1 --> L2
        L2 --> L3
        L3 --> L4
        L4 --> L5
        L5 --> L6
    end

    subgraph Validator["VALIDATOR NODE"]
        V1[Receives Hash Mapping Only]
        V2[NO Decryption Keys]
        V3[ZERO TX Visibility]
        V4[Stores UID → Hash]
        V5[Validates Hash Updates]
        V6[IN Consensus]

        V1 --> V2
        V2 --> V3
        V3 --> V4
        V4 --> V5
        V5 --> V6
    end

    L2PS -.->|Complete Separation| Validator

    classDef l2psClass fill:#11998e,stroke:#38ef7d,stroke-width:3px,color:#fff
    classDef validatorClass fill:#ee0979,stroke:#ff6a00,stroke-width:3px,color:#fff

    class L1,L2,L3,L4,L5,L6 l2psClass
    class V1,V2,V3,V4,V5,V6 validatorClass
```

## 4. Sequence Diagram: Transaction Lifecycle

```mermaid
sequenceDiagram
    participant Client
    participant L2PS as L2PS Node
    participant Mempool as L2PS Mempool
    participant HashSvc as Hash Service
    participant DTR
    participant Validator

    Note over Client,Validator: PHASE 1: Transaction Submission (t=0ms)

    Client->>Client: Encrypt transaction with L2PS keys
    Client->>L2PS: Send encrypted L2PS TX
    L2PS->>L2PS: Load L2PS network instance
    L2PS->>L2PS: Decrypt transaction
    L2PS->>L2PS: Verify signature

    alt Valid Transaction
        L2PS->>Mempool: Check for duplicate (original_hash)
        Mempool-->>L2PS: Not found
        L2PS->>Mempool: Store encrypted TX
        Mempool-->>L2PS: Stored
        L2PS->>Client: Success (t=200ms)
    else Invalid Transaction
        L2PS->>Client: Error (signature/duplicate)
    end

    Note over Client,Validator: PHASE 2: Hash Generation (t=5s, Background)

    loop Every 5 seconds
        HashSvc->>HashSvc: Check reentrancy flag
        HashSvc->>Mempool: Get all TXs for each L2PS UID
        Mempool-->>HashSvc: Return processed TXs
        HashSvc->>HashSvc: Generate consolidated hash
        HashSvc->>HashSvc: Create L2PSHashUpdate TX
        HashSvc->>HashSvc: Sign self-directed TX

        Note over HashSvc,Validator: PHASE 3: DTR Relay (t=5.2s)

        HashSvc->>DTR: Send hash update TX
        DTR->>DTR: Get validator list (CVSA)
        DTR->>DTR: Filter online validators
        DTR->>DTR: Randomize order

        loop For each validator
            DTR->>Validator: RELAY_TX (hash update)

            alt Validator Accepts
                Validator->>Validator: Validate signature
                Validator->>Validator: Check L2PS participation
                Validator->>Validator: Store UID → Hash
                Validator-->>DTR: Success (200)
                Note over DTR: Stop trying, relay successful
            else Validator Rejects
                Validator-->>DTR: Error
                Note over DTR: Try next validator
            end
        end
    end

    Note over Client,Validator: PRIVACY GUARANTEE
    Note over L2PS,Mempool: L2PS nodes see full TX content
    Note over Validator: Validators see ONLY hash mappings
```

## 5. Data Flow Diagram

```mermaid
flowchart LR
    subgraph Input["INPUT DATA"]
        I1[Raw Transaction]
        I2[From Address]
        I3[To Address]
        I4[Amount/Data]
    end

    subgraph Encryption["ENCRYPTION LAYER"]
        E1[L2PS Network Keys]
        E2[Encrypt Transaction]
        E3[Original Hash]
        E4[Encrypted Payload]
    end

    subgraph L2PSNode["L2PS NODE PROCESSING"]
        P1[Decrypt with L2PS Keys]
        P2[Extract Original TX]
        P3[Verify Signature]
        P4[Store Encrypted Copy]
    end

    subgraph HashGen["HASH GENERATION"]
        H1[Collect All L2PS TXs]
        H2[Sort by Hash & Timestamp]
        H3[Concatenate Hashes]
        H4[SHA256 Consolidated]
        H5[UID + Count + Hashes]
    end

    subgraph ValidatorData["VALIDATOR RECEIVES"]
        V1[L2PS UID]
        V2[Consolidated Hash]
        V3[Transaction Count]
        V4[ZERO Content Visibility]
    end

    I1 --> E2
    I2 --> E2
    I3 --> E2
    I4 --> E2
    E1 --> E2
    E2 --> E3
    E2 --> E4

    E4 --> P1
    E1 --> P1
    P1 --> P2
    P2 --> P3
    P3 --> P4

    P4 -.->|Every 5s| H1
    H1 --> H2
    H2 --> H3
    H3 --> H5
    H5 --> H4

    H4 --> V1
    H4 --> V2
    H1 --> V3
    V1 --> V4
    V2 --> V4
    V3 --> V4

    classDef inputClass fill:#667eea,stroke:#764ba2,stroke-width:2px,color:#fff
    classDef encClass fill:#4facfe,stroke:#00f2fe,stroke-width:2px,color:#fff
    classDef processClass fill:#11998e,stroke:#38ef7d,stroke-width:2px,color:#fff
    classDef hashClass fill:#f093fb,stroke:#f5576c,stroke-width:2px,color:#fff
    classDef valClass fill:#ee0979,stroke:#ff6a00,stroke-width:2px,color:#fff

    class I1,I2,I3,I4 inputClass
    class E1,E2,E3,E4 encClass
    class P1,P2,P3,P4 processClass
    class H1,H2,H3,H4,H5 hashClass
    class V1,V2,V3,V4 valClass
```

## 6. Component Interaction Diagram

```mermaid
graph TB
    subgraph Files["FILE STRUCTURE"]
        F1[server_rpc.ts<br/>RPC Entry Point]
        F2[handleL2PS.ts<br/>TX Handler]
        F3[parallelNetworks.ts<br/>L2PS Manager]
        F4[L2PSMempool.ts<br/>Entity]
        F5[l2ps_mempool.ts<br/>Manager]
        F6[L2PSHashService.ts<br/>Hash Generator]
        F7[endpointHandlers.ts<br/>Validator Handler]
        F8[manageNodeCall.ts<br/>NodeCall Router]
    end

    subgraph DB["DATABASE"]
        D1[(l2ps_mempool<br/>Table)]
        D2[(l2ps_hashes<br/>Table)]
    end

    subgraph Services["SERVICES"]
        S1[Singleton Instance]
        S2[5s Timer]
        S3[Reentrancy Lock]
    end

    F1 -->|Routes L2PS TX| F2
    F2 -->|Loads Network| F3
    F2 -->|Stores TX| F5
    F5 -->|Uses Entity| F4
    F4 -->|Writes to| D1

    S1 -->|Controls| F6
    S2 -->|Triggers| F6
    S3 -->|Protects| F6

    F6 -->|Reads from| D1
    F6 -->|Creates TX| F8
    F8 -->|RELAY_TX| F7
    F7 -->|Stores Hash| D2

    classDef fileClass fill:#667eea,stroke:#764ba2,stroke-width:2px,color:#fff
    classDef dbClass fill:#4facfe,stroke:#00f2fe,stroke-width:2px,color:#fff
    classDef serviceClass fill:#f093fb,stroke:#f5576c,stroke-width:2px,color:#fff

    class F1,F2,F3,F4,F5,F6,F7,F8 fileClass
    class D1,D2 dbClass
    class S1,S2,S3 serviceClass
```

## 7. State Machine: Transaction States

```mermaid
stateDiagram-v2
    [*] --> Received: Client sends TX

    Received --> Decrypting: Load L2PS instance
    Decrypting --> Verifying: Decrypt successful
    Decrypting --> Failed: Decrypt failed

    Verifying --> CheckingDuplicate: Signature valid
    Verifying --> Failed: Signature invalid

    CheckingDuplicate --> Storing: Not duplicate
    CheckingDuplicate --> Failed: Already processed

    Storing --> Processed: Stored in mempool
    Storing --> Failed: Storage error

    Processed --> AwaitingHash: Waiting for hash service

    state HashService {
        [*] --> Idle
        Idle --> Generating: 5s timer triggers
        Generating --> Hashing: Reentrancy check passed
        Generating --> Idle: Already running
        Hashing --> Creating: Hash calculated
        Creating --> Relaying: TX created
        Relaying --> Idle: Relay complete
    }

    AwaitingHash --> HashService: Background process
    HashService --> Relayed: Hash update sent to validators

    Relayed --> [*]: Complete
    Failed --> [*]: Error returned to client

    note right of Processed
        TX stored encrypted
        Client receives success
    end note

    note right of Relayed
        Validators receive only
        UID → Hash mapping
    end note
```

## 8. Implementation Status

```mermaid
gantt
    title L2PS Implementation Status
    dateFormat YYYY-MM-DD
    section Phase 1: Core
    L2PS Mempool Entity        :done, p1a, 2025-06-01, 2025-06-05
    L2PS Mempool Manager       :done, p1b, 2025-06-05, 2025-06-10
    Transaction Handler        :done, p1c, 2025-06-10, 2025-06-15

    section Phase 2: Hash Service
    L2PSHashService Design     :done, p2a, 2025-06-15, 2025-06-20
    Hash Generation Logic      :done, p2b, 2025-06-20, 2025-06-25
    Reentrancy Protection      :done, p2c, 2025-06-25, 2025-06-28

    section Phase 3a: DTR
    SDK Transaction Type       :done, p3a, 2025-06-28, 2025-07-02
    Validator Relay            :done, p3b, 2025-07-02, 2025-07-05
    Hash Update Handler        :done, p3c, 2025-07-05, 2025-07-10

    section Phase 3b: Storage
    L2PS Hash Entity           :active, p3d, 2025-07-10, 2025-07-15
    Hash Storage Manager       :p3e, 2025-07-15, 2025-07-18

    section Phase 3c: Sync
    NodeCall Endpoints         :p3f, 2025-07-18, 2025-07-22
    Sync Utilities             :p3g, 2025-07-22, 2025-07-28
    Sync Integration           :p3h, 2025-07-28, 2025-08-05
```

## 9. Error Handling Flow

```mermaid
flowchart TD
    Start[Transaction Received]

    Start --> Load{Load L2PS<br/>Instance?}
    Load -->|Success| Decrypt
    Load -->|Not Found| E1[Error: L2PS not joined]

    Decrypt{Decrypt TX?}
    Decrypt -->|Success| Verify
    Decrypt -->|Failed| E2[Error: Decryption failed]

    Verify{Verify<br/>Signature?}
    Verify -->|Valid| CheckDup
    Verify -->|Invalid| E3[Error: Invalid signature]

    CheckDup{Already<br/>Processed?}
    CheckDup -->|No| Store
    CheckDup -->|Yes| E4[Error: Duplicate TX]

    Store{Store in<br/>Mempool?}
    Store -->|Success| Success[Return 200 OK]
    Store -->|Failed| E5[Error: Storage failed]

    E1 --> Return400[Return 400 Error]
    E2 --> Return400
    E3 --> Return400
    E4 --> Return409[Return 409 Conflict]
    E5 --> Return500[Return 500 Error]

    Success --> Client[Client Receives Response]
    Return400 --> Client
    Return409 --> Client
    Return500 --> Client

    classDef errorClass fill:#ff6b6b,stroke:#ee5a6f,stroke-width:2px,color:#fff
    classDef successClass fill:#51cf66,stroke:#37b24d,stroke-width:2px,color:#fff
    classDef processClass fill:#4dabf7,stroke:#1c7ed6,stroke-width:2px,color:#fff

    class E1,E2,E3,E4,E5,Return400,Return409,Return500 errorClass
    class Success,Client successClass
    class Start,Load,Decrypt,Verify,CheckDup,Store processClass
```

## 10. Database Schema

```mermaid
erDiagram
    L2PSMempool ||--o{ L2PSTransaction : contains
    L2PSHashes ||--o{ HashMapping : stores

    L2PSMempool {
        string hash PK
        string l2ps_uid
        string original_hash
        jsonb encrypted_tx
        string status
        bigint timestamp
        integer block_number
    }

    L2PSTransaction {
        string type
        object content
        string signature
        string hash
    }

    L2PSHashes {
        string l2ps_uid PK
        string hash
        integer transaction_count
        integer block_number
        bigint timestamp
    }

    HashMapping {
        string uid
        string consolidated_hash
        integer count
    }
```

---

## How to View These Diagrams

### Option 1: GitHub/GitLab
Push this file to GitHub or GitLab - they render Mermaid natively.

### Option 2: VS Code
Install the "Markdown Preview Mermaid Support" extension.

### Option 3: Online Viewer
Copy any diagram to https://mermaid.live

### Option 4: HTML Export
Use the provided HTML file (next section) to view all diagrams in browser.
