# Block Creation & Validation - Mermaid Diagrams

## Overview

Blocks in Demos blockchain are created through the PoRBFT consensus mechanism. Each block contains ordered transactions, native table hashes (GCR state), signatures from shard validators, and references to previous blocks forming an immutable chain.

**Key Features:**
- **Consensus-Driven Creation**: Blocks forged during Phase 5 of consensus
- **Native Table Hashing**: GCR state integrity via cryptographic hashes
- **Multi-Signature Validation**: 67% shard agreement required
- **Chain Continuity**: previousHash links to maintain integrity
- **CVSA-Based Proposer**: Deterministic next proposer calculation
- **Timestamp Consistency**: Secretary-coordinated block timestamp
- **GCR Integration**: Native tables hashed and included

## 1. Block Structure & Architecture

```mermaid
graph TB
    subgraph "Block Structure"
        BLOCK[Block Object]
        BLOCK --> ID[id: auto-increment]
        BLOCK --> NUMBER[number: integer]
        BLOCK --> HASH[hash: SHA256 of content]
        BLOCK --> CONTENT[content: BlockContent]
        BLOCK --> STATUS[status: derived or confirmed]
        BLOCK --> PROPOSER[proposer: CVSA seed]
        BLOCK --> NEXTPROPOSER[next_proposer: calculated CVSA]
        BLOCK --> VALIDATION[validation_data: signatures]

        CONTENT --> ORDEREDTXS[ordered_transactions: hash array]
        CONTENT --> PREVHASH[previousHash: string]
        CONTENT --> TIMESTAMP[timestamp: number]
        CONTENT --> PEERLIST[peerlist: Peer array]
        CONTENT --> NATIVEHASHES[native_tables_hashes: object]
        CONTENT --> WEB2DATA[web2data: optional]
        CONTENT --> L2PS[l2ps_partecipating_nodes: Map]
        CONTENT --> ENCRYPTED[encrypted_transactions_hashes: Map]

        NATIVEHASHES --> GCRHASH[native_gcr: SHA256]
        NATIVEHASHES --> SUBNETSHASH[native_subnets_txs: SHA256]

        VALIDATION --> SIGNATURES[signatures: Map of pubkey to signature]
    end

    subgraph "Block Relationships"
        GENESIS[Block 0: Genesis]
        BLOCK1[Block 1]
        BLOCK2[Block 2]
        BLOCKN[Block N]

        GENESIS -->|previousHash| BLOCK1
        BLOCK1 -->|previousHash| BLOCK2
        BLOCK2 -->|...| BLOCKN

        GENESIS -.->|next_proposer| CVSA1[CVSA for Block 1]
        BLOCK1 -.->|next_proposer| CVSA2[CVSA for Block 2]
        BLOCK2 -.->|next_proposer| CVSAN[CVSA for Block N]
    end

    subgraph "Block States"
        CANDIDATE[Candidate Block]
        CANDIDATE --> DERIVED[Status: derived]
        DERIVED --> VOTING[Shard voting in progress]
        VOTING --> CHECKTHRESHOLD{67%<br/>votes?}

        CHECKTHRESHOLD -->|yes| CONFIRMED[Status: confirmed]
        CHECKTHRESHOLD -->|no| REJECTED[Block rejected]

        CONFIRMED --> FINALIZED[Added to blockchain]
        REJECTED --> DISCARDED[Candidate discarded]
    end

    style BLOCK fill:#e1f5ff
    style CONTENT fill:#fff4e1
    style NATIVEHASHES fill:#e8f5e9
    style CONFIRMED fill:#c8e6c9
    style REJECTED fill:#ffcdd2
    style FINALIZED fill:#c8e6c9
```

## 2. Block Creation Process (Consensus Phase 5)

```mermaid
sequenceDiagram
    participant Consensus as Consensus Routine
    participant Manager as SecretaryManager
    participant CreateBlock as createBlock Function
    participant Hashing
    participant GCR
    participant Block
    participant State as SharedState

    Note over Consensus,State: Phase 5: Forge Block

    Consensus->>State: Check if candidateBlock exists
    State->>Consensus: Return candidateBlock or null

    alt Candidate already exists
        State->>Consensus: Return existing candidateBlock
        Note right of State: Prevent duplicate block creation
    else No candidate exists
        Consensus->>CreateBlock: createBlock(params)
        Note right of Consensus: orderedTransactions<br/>commonValidatorSeed (CVSA)<br/>previousBlockHash<br/>blockNumber<br/>peerlist

        CreateBlock->>Block: new Block()
        Block->>CreateBlock: Empty block object

        CreateBlock->>CreateBlock: Set content.ordered_transactions
        Note right of CreateBlock: Map transactions to hashes only

        CreateBlock->>CreateBlock: Set content.previousHash
        CreateBlock->>CreateBlock: Set content.peerlist
        CreateBlock->>CreateBlock: Set proposer = CVSA
        CreateBlock->>CreateBlock: Set number = blockNumber

        CreateBlock->>GCR: hashNativeTables()
        GCR->>GCR: hashGCRTables()
        Note right of GCR: Hash GCRTracker table<br/>Hash GCRSubnetsTxs table
        GCR->>CreateBlock: Return native_tables_hashes

        CreateBlock->>CreateBlock: Set content.native_tables_hashes

        CreateBlock->>Manager: Get lastConsensusTime
        Manager->>CreateBlock: Return timestamp
        CreateBlock->>CreateBlock: Set content.timestamp

        CreateBlock->>Hashing: SHA256(JSON.stringify(content))
        Hashing->>CreateBlock: Return hash
        CreateBlock->>CreateBlock: Set block.hash

        Note over CreateBlock,State: Sign Block Hash

        CreateBlock->>Hashing: Sign block.hash with ed25519
        Hashing->>CreateBlock: Return signature
        CreateBlock->>CreateBlock: Initialize validation_data.signatures
        CreateBlock->>CreateBlock: Add our signature to validation_data

        Note over CreateBlock,State: Calculate Next Proposer

        CreateBlock->>CreateBlock: getCommonValidatorSeed(block)
        Note right of CreateBlock: Calculate CVSA from this block<br/>to determine next proposer
        CreateBlock->>CreateBlock: Set block.next_proposer

        CreateBlock->>State: Set candidateBlock = block
        CreateBlock->>Consensus: Return block
    end

    Consensus->>Consensus: Candidate block ready for voting
```

## 3. Block Validation & Voting (Consensus Phase 6)

```mermaid
flowchart TD
    START([Phase 6: Vote On Block])

    START --> GETCANDIDATE[Get candidateBlock from sharedState]
    GETCANDIDATE --> BROADCAST[broadcastBlockHash to shard members]

    subgraph "Broadcast Process"
        BROADCAST --> CREATEREQ[Create RPC request: proposeBlockHash]
        CREATEREQ --> REQPARAMS[params: block.hash, validation_data, our identity]

        REQPARAMS --> LOOPPEERS{For each<br/>shard member}
        LOOPPEERS -->|more| SENDREQ[Send RPC with retry: 3 times]
        LOOPPEERS -->|done| WAITALL

        SENDREQ --> LOOPPEERS
    end

    WAITALL[Wait for all RPC responses]
    WAITALL --> PROCESSRESP{For each<br/>response}

    PROCESSRESP -->|more| CHECKSTATUS{Response<br/>status 200?}
    PROCESSRESP -->|done| COUNTRESULT

    subgraph "Member Response Processing"
        CHECKSTATUS -->|yes| VERIFYSIG[Verify signature with ed25519]
        CHECKSTATUS -->|no| CONERROR[Increment con vote]

        VERIFYSIG --> SIGVALID{Signature<br/>valid?}
        SIGVALID -->|yes| ADDSIG[Add signature to block.validation_data]
        SIGVALID -->|no| SIGERROR[Log error, increment con vote]

        ADDSIG --> PROVOTE[Increment pro vote]
    end

    CONERROR --> PROCESSRESP
    SIGERROR --> PROCESSRESP
    PROVOTE --> PROCESSRESP

    COUNTRESULT[Count total valid signatures]
    COUNTRESULT --> CALCULATE[Calculate: signatures div shard size]

    CALCULATE --> THRESHOLD{Ratio greater or equal<br/>0.67 (67%)?}

    THRESHOLD -->|yes| BLOCKVALID[Block is valid]
    THRESHOLD -->|no| BLOCKINVALID[Block is invalid]

    subgraph "Shard Member Vote Logic"
        SENDREQ -.-> MEMBERRECEIVE[Member receives proposeBlockHash]
        MEMBERRECEIVE --> MEMBERCHECK1{In consensus<br/>mode?}
        MEMBERCHECK1 -->|no| MEMBERERROR1[Return error]

        MEMBERCHECK1 -->|yes| MEMBERCHECK2{In same<br/>shard?}
        MEMBERCHECK2 -->|no| MEMBERERROR2[Return error]

        MEMBERCHECK2 -->|yes| GETOURBLOCK[Get our candidateBlock]
        GETOURBLOCK --> COMPAREHASH{Our hash equals<br/>proposed hash?}

        COMPAREHASH -->|yes| SIGNHASH[Sign proposed hash]
        COMPAREHASH -->|no| MEMBERERROR3[Return hash mismatch]

        SIGNHASH --> MEMBERRETURN[Return 200 with signature]
        MEMBERERROR1 -.-> CHECKSTATUS
        MEMBERERROR2 -.-> CHECKSTATUS
        MEMBERERROR3 -.-> CHECKSTATUS
        MEMBERRETURN -.-> CHECKSTATUS
    end

    BLOCKVALID --> PROCEED[Proceed to Phase 7: Finalize]
    BLOCKINVALID --> ROLLBACK[Trigger BlockInvalidError]

    style START fill:#e1f5ff
    style BLOCKVALID fill:#c8e6c9
    style BLOCKINVALID fill:#ffcdd2
    style PROCEED fill:#c8e6c9
    style ROLLBACK fill:#ffcdd2
    style VERIFYSIG fill:#fff4e1
```

## 4. Block Finalization & Chain Addition

```mermaid
flowchart TD
    START([Block Valid: 67%+ Votes])

    START --> PREPARE[Prepare finalization]
    PREPARE --> SAVEGCR[Save GCR changes to database]

    subgraph "GCR State Finalization"
        SAVEGCR --> TRACKER[Save GCRTracker entries]
        TRACKER --> SUBNETS[Save GCRSubnetsTxs entries]
        SUBNETS --> HASHES[Save GCRHashes for block]

        HASHES --> HASHBLOCK[Create GCRHashes entry]
        HASHBLOCK --> SETNUMBER[Set blockNumber]
        HASHBLOCK --> SETHASHES[Set gcr_hash and subnets_txs_hash]
        HASHBLOCK --> SETTIMESTAMP[Set timestamp]
    end

    SETTIMESTAMP --> SAVETXS[Save transactions to database]

    subgraph "Transaction Finalization"
        SAVETXS --> LOOPTXS{For each<br/>transaction}

        LOOPTXS -->|more| CREATETXENTRY[Create Transactions entry]
        LOOPTXS -->|done| REMOVEFROMMEMPOOL

        CREATETXENTRY --> SETBLOCKNUM[Set blockNumber]
        CREATETXENTRY --> SETSIGNATURE[Set signature]
        CREATETXENTRY --> SETHASH[Set hash]
        CREATETXENTRY --> SETCONTENT[Set content JSON]
        CREATETXENTRY --> SETSTATUS[Set status: confirmed]

        SETSTATUS --> SAVETX[Save to transactions table]
        SAVETX --> LOOPTXS
    end

    REMOVEFROMMEMPOOL[Remove transactions from mempool]
    REMOVEFROMMEMPOOL --> GETHASHES[Get transaction hashes]
    GETHASHES --> DELETEMEMPOOL[Mempool.removeTransactionsByHashes]

    DELETEMEMPOOL --> SAVEBLOCK[Save block to database]

    subgraph "Block Database Save"
        SAVEBLOCK --> CREATEBLOCKENTRY[Create Blocks entry]
        CREATEBLOCKENTRY --> SETID[Set auto-increment id]
        CREATEBLOCKENTRY --> SETNUMBERB[Set number]
        CREATEBLOCKENTRY --> SETHASHB[Set hash]
        CREATEBLOCKENTRY --> SETCONTENTB[Set content JSON]
        CREATEBLOCKENTRY --> SETSTATUSB[Set status: confirmed]
        CREATEBLOCKENTRY --> SETPROPOSERB[Set proposer: CVSA]
        CREATEBLOCKENTRY --> SETNEXTPROPOSERB[Set next_proposer]
        CREATEBLOCKENTRY --> SETVALIDATIONB[Set validation_data JSON]

        SETVALIDATIONB --> INSERTDB[INSERT INTO blocks table]
    end

    INSERTDB --> UPDATESTATE[Update SharedState]

    subgraph "State Updates"
        UPDATESTATE --> UPDATELASTBLOCK[lastBlockNumber = block.number]
        UPDATESTATE --> UPDATELASTHASH[lastBlockHash = block.hash]
        UPDATESTATE --> UPDATESYNC[syncStatus = true]
        UPDATESTATE --> CLEARCANDIDATE[candidateBlock = null]
    end

    CLEARCANDIDATE --> BROADCAST[Broadcast block to network]

    subgraph "Block Propagation"
        BROADCAST --> SENDPEERS[Send to all peers]
        SENDPEERS --> PEERSYNC[Peers sync and validate]
        PEERSYNC --> PEERADD[Peers add to their chain]
    end

    PEERADD --> COMPLETE[Block finalization complete]
    COMPLETE --> END([Block permanently in blockchain])

    style START fill:#e1f5ff
    style SAVEGCR fill:#fff4e1
    style SAVETXS fill:#e8f5e9
    style SAVEBLOCK fill:#c8e6c9
    style COMPLETE fill:#c8e6c9
    style END fill:#c8e6c9
```

## 5. Block Rollback on Validation Failure

```mermaid
flowchart TD
    START([Block Invalid: Less than 67% Votes])

    START --> THROWERROR[Throw BlockInvalidError]
    THROWERROR --> CATCHBLOCK[Catch in consensus routine]

    CATCHBLOCK --> LOGTXS[Log: Block validation failed]
    LOGTXS --> GETSUCCESSFUL[Get successfulTxs array]

    GETSUCCESSFUL --> ROLLBACKSTART[Start GCR rollback]

    subgraph "GCR Rollback Process"
        ROLLBACKSTART --> LOOPSUCCESSFUL{For each<br/>successful tx}

        LOOPSUCCESSFUL -->|more txs| GETTX[Get transaction object]
        LOOPSUCCESSFUL -->|done| ROLLBACKCOMPLETE

        GETTX --> GETEDITS[Get tx.content.gcr_edits]
        GETEDITS --> APPLYROLLBACK[HandleGCR.applyToTx with isRollback true]

        APPLYROLLBACK --> REVERSEEDITS[Reverse each GCREdit]

        subgraph "Edit Reversal Logic"
            REVERSEEDITS --> EDITTYPE{Edit<br/>type?}

            EDITTYPE -->|balance add| BALANCEREMOVE[Reverse: Remove balance]
            EDITTYPE -->|balance remove| BALANCEADD[Reverse: Add balance back]
            EDITTYPE -->|nonce increment| NONCEDECREMENT[Reverse: Decrement nonce]
            EDITTYPE -->|identity add| IDENTITYREMOVE[Reverse: Remove identity]

            BALANCEREMOVE --> ROLLBACKSUCCESS
            BALANCEADD --> ROLLBACKSUCCESS
            NONCEDECREMENT --> ROLLBACKSUCCESS
            IDENTITYREMOVE --> ROLLBACKSUCCESS

            ROLLBACKSUCCESS[Rollback successful for edit]
            ROLLBACKSUCCESS --> LOOPSUCCESSFUL
        end
    end

    ROLLBACKCOMPLETE[All GCR edits rolled back]
    ROLLBACKCOMPLETE --> REMOVEMEMPOOL[Remove successful txs from mempool]

    REMOVEMEMPOOL --> GETHASHES[Get tx hashes]
    GETHASHES --> DELETE[Mempool.removeTransactionsByHashes]

    DELETE --> CLEARSTATE[Clear SharedState]

    subgraph "State Cleanup"
        CLEARSTATE --> CLEARCANDIDATE[candidateBlock = null]
        CLEARSTATE --> KEEPBLOCKNUMBER[Keep lastBlockNumber unchanged]
        CLEARSTATE --> KEEPBLOCKHASH[Keep lastBlockHash unchanged]
    end

    KEEPBLOCKHASH --> NOTIFYUSER[Log: Transactions discarded]
    NOTIFYUSER --> USERRESUBMIT[Users must resubmit transactions]

    USERRESUBMIT --> NEXTROUND[Wait for next consensus round]
    NEXTROUND --> END([Consensus round complete])

    style START fill:#e1f5ff
    style ROLLBACKSTART fill:#fff4e1
    style REVERSEEDITS fill:#e8f5e9
    style ROLLBACKCOMPLETE fill:#ffe0b2
    style NOTIFYUSER fill:#ffe0b2
    style END fill:#f3e5f5
```

## 6. Native Tables Hashing (GCR State Integrity)

```mermaid
flowchart TD
    START([hashNativeTables called])

    START --> PROXY[Proxy to hashGCRTables]
    PROXY --> GETDB[Get database connection]

    GETDB --> TRACKERHASH[Hash GCRTracker table]

    subgraph "GCRTracker Hashing"
        TRACKERHASH --> QUERYTRACKER[Query all GCRTracker entries]
        QUERYTRACKER --> ORDERTRACKER[Order by pubkey ASC]
        ORDERTRACKER --> SERIALIZETRACKER[Serialize to JSON string]
        SERIALIZETRACKER --> SHA256TRACKER[Calculate SHA256]
        SHA256TRACKER --> GCRHASH[native_gcr hash result]
    end

    GCRHASH --> SUBNETSHASH[Hash GCRSubnetsTxs table]

    subgraph "GCRSubnetsTxs Hashing"
        SUBNETSHASH --> QUERYSUBNETS[Query all GCRSubnetsTxs entries]
        QUERYSUBNETS --> ORDERSUBNETS[Order by id ASC]
        ORDERSUBNETS --> SERIALIZESUBNETS[Serialize to JSON string]
        SERIALIZESUBNETS --> SHA256SUBNETS[Calculate SHA256]
        SHA256SUBNETS --> SUBNETSHASHRESULT[native_subnets_txs hash result]
    end

    SUBNETSHASHRESULT --> CREATEOBJ[Create NativeTablesHashes object]
    CREATEOBJ --> SETGCR[Set native_gcr field]
    CREATEOBJ --> SETSUBNETS[Set native_subnets_txs field]

    SETSUBNETS --> RETURN[Return hashes object]
    RETURN --> ADDTOBLOCK[Add to block.content.native_tables_hashes]

    subgraph "Hash Purpose"
        ADDTOBLOCK --> PURPOSE1[Verify GCR state consistency]
        PURPOSE1 --> PURPOSE2[Detect state tampering]
        PURPOSE2 --> PURPOSE3[Enable state sync verification]
        PURPOSE3 --> PURPOSE4[Audit trail for state changes]
    end

    PURPOSE4 --> VERIFYLATER[Peers verify hashes when syncing]

    subgraph "Hash Verification"
        VERIFYLATER --> PEERRECV[Peer receives block]
        PEERRECV --> PEERHASH[Peer calculates own hashes]
        PEERHASH --> PEERCOMPARE{Hashes<br/>match?}

        PEERCOMPARE -->|yes| STATEVALID[GCR state is valid]
        PEERCOMPARE -->|no| STATEINVALID[State mismatch - reject block]
    end

    STATEVALID --> END([Hash verification complete])
    STATEINVALID --> END

    style START fill:#e1f5ff
    style SHA256TRACKER fill:#fff4e1
    style SHA256SUBNETS fill:#fff4e1
    style STATEVALID fill:#c8e6c9
    style STATEINVALID fill:#ffcdd2
```

## 7. Block Header & Chain Continuity

```mermaid
graph TB
    subgraph "Block Header Structure"
        HEADER[Block Header]
        HEADER --> HEADERNUMBER[number: integer]
        HEADER --> HEADERHASH[hash: string]
        HEADER --> HEADERSTATUS[status: confirmed or derived]
        HEADER --> HEADERPREV[previousHash: string]
        HEADER --> HEADERTIMESTAMP[timestamp: number]
    end

    subgraph "Chain Continuity Verification"
        VERIFY[Verify Block N]
        VERIFY --> GETPREV[Get Block N minus 1]
        GETPREV --> COMPAREHASH{Block N previousHash<br/>equals Block N minus 1 hash?}

        COMPAREHASH -->|yes| CONTINUOUS[Chain is continuous]
        COMPAREHASH -->|no| BROKEN[Chain is broken]

        CONTINUOUS --> CHECKNUMBER{Block N number<br/>equals N minus 1 number plus 1?}
        CHECKNUMBER -->|yes| VALIDCHAIN[Valid chain continuity]
        CHECKNUMBER -->|no| NUMBERMISMATCH[Number sequence broken]
    end

    subgraph "Genesis Block Special Case"
        GENESIS[Block 0: Genesis]
        GENESIS --> GENESISNUMBER[number: 0]
        GENESIS --> GENESISHASH[hash: calculated from content]
        GENESIS --> GENESISPREV[previousHash: null or placeholder]
        GENESIS --> GENESISTIMESTAMP[timestamp: network start time]

        GENESIS -.-> HARDCODED[Genesis block hardcoded in code]
        GENESIS -.-> CHECKSUM[Genesis hash verified on startup]
    end

    subgraph "Block Retrieval Operations"
        GETOPS[Chain Retrieval Operations]

        GETOPS --> GETLAST[getLastBlock]
        GETOPS --> GETBYNUMBER[getBlockByNumber n]
        GETOPS --> GETBYHASH[getBlockByHash hash]
        GETOPS --> GETGENESIS[getGenesisBlock]
        GETOPS --> GETRANGE[getBlocks start, limit]

        GETLAST --> QUERYLAST[ORDER BY number DESC LIMIT 1]
        GETBYNUMBER --> QUERYNUMBER[WHERE number equals n]
        GETBYHASH --> QUERYHASH[WHERE hash equals hash]
        GETGENESIS --> QUERYGENESIS[WHERE number equals 0]
        GETRANGE --> QUERYRANGE[WHERE number less than start, LIMIT]
    end

    subgraph "Block Hash Calculation"
        HASHCALC[Hash Calculation]
        HASHCALC --> GETCONTENT[Get block.content object]
        GETCONTENT --> STRINGIFY[JSON.stringify content]
        STRINGIFY --> SHA256[Calculate SHA256]
        SHA256 --> BLOCKHASH[block.hash]

        BLOCKHASH -.-> INCLUDES[Includes all content fields]
        INCLUDES -.-> ORDEREDTXS[ordered_transactions]
        INCLUDES -.-> PREVHASH[previousHash]
        INCLUDES -.-> TIMESTAMP[timestamp]
        INCLUDES -.-> PEERLIST[peerlist]
        INCLUDES -.-> NATIVEHASHES[native_tables_hashes]
    end

    style HEADER fill:#e1f5ff
    style CONTINUOUS fill:#c8e6c9
    style VALIDCHAIN fill:#c8e6c9
    style BROKEN fill:#ffcdd2
    style NUMBERMISMATCH fill:#ffcdd2
    style GENESIS fill:#fff4e1
    style SHA256 fill:#e8f5e9
```

## 8. Block Database Schema & Indexing

```mermaid
erDiagram
    BLOCKS {
        integer id PK
        integer number UK
        varchar hash UK
        json content
        varchar status
        varchar proposer
        varchar next_proposer
        json validation_data
    }

    TRANSACTIONS {
        integer id PK
        integer blockNumber FK
        varchar hash UK
        varchar signature
        varchar ed25519_signature
        varchar status
        json content
        varchar type
        varchar from
        varchar from_ed25519_address
        varchar to
        integer amount
        integer nonce
        bigint timestamp
    }

    GCR_HASHES {
        integer id PK
        integer blockNumber FK
        varchar gcr_hash
        varchar subnets_txs_hash
        bigint timestamp
    }

    GCR_MAIN {
        varchar pubkey PK
        bigint balance
        integer nonce
        jsonb identities
        jsonb points
    }

    MEMPOOL_V2 {
        varchar hash PK
        integer blockNumber
        bigint timestamp
        json content
    }

    BLOCKS ||--o{ TRANSACTIONS : contains
    BLOCKS ||--|| GCR_HASHES : has_state_hash
    BLOCKS ||--o{ MEMPOOL_V2 : references
    TRANSACTIONS }o--|| GCR_MAIN : modifies
    BLOCKS }|--|| BLOCKS : previousHash_links_to
```

**Database Indexes:**
- **BLOCKS table indexes:** idx_blocks_number, idx_blocks_hash
- **TRANSACTIONS table indexes:** idx_transactions_hash, idx_transactions_blockNumber, idx_transactions_from_ed25519_address, idx_transactions_to

```

## 9. Block Sync & Propagation

```mermaid
sequenceDiagram
    participant New as New Node
    participant Peers
    participant Chain
    participant GCR
    participant Mempool

    Note over New,Mempool: Node joins network and needs to sync

    New->>Peers: Request last block number
    Peers->>New: Return lastBlockNumber

    New->>Chain: Get our lastBlockNumber
    Chain->>New: Return local lastBlockNumber

    New->>New: Calculate gap: peer number minus local number

    alt Gap is 0
        New->>New: Already synced
    else Gap greater than 0
        New->>New: Start sync process

        loop For each missing block
            New->>Peers: Request block N
            Peers->>New: Return block N

            New->>New: Validate block structure
            New->>New: Verify previousHash matches
            New->>New: Verify block hash is correct

            New->>New: Get block.content.ordered_transactions
            loop For each transaction hash
                New->>Peers: Request transaction by hash
                Peers->>New: Return transaction
                New->>New: Validate transaction signature
                New->>New: Validate transaction hash
            end

            New->>GCR: Apply GCR edits from transactions
            GCR->>GCR: Update balances, nonces, identities
            GCR->>New: GCR edits applied

            New->>GCR: Calculate native_tables_hashes
            GCR->>New: Return calculated hashes

            New->>New: Compare with block.content.native_tables_hashes
            alt Hashes match
                New->>New: GCR state is valid
            else Hashes do not match
                New->>New: GCR state mismatch - reject block
                New->>New: Request block again or find new peer
            end

            New->>Chain: Save block to database
            Chain->>Chain: INSERT INTO blocks
            Chain->>New: Block saved

            New->>Chain: Save transactions to database
            Chain->>Chain: INSERT INTO transactions
            Chain->>New: Transactions saved

            New->>GCR: Save GCR state
            GCR->>GCR: Save GCRTracker, GCRHashes
            GCR->>New: State saved

            New->>New: Increment local lastBlockNumber
        end

        New->>New: Sync complete
        New->>New: Set syncStatus = true
    end

    New->>Mempool: Clear old mempool entries
    Mempool->>Mempool: Remove txs from old blocks
    New->>New: Ready for consensus
```

## 10. Complete Block Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> NotCreated: Consensus round begins

    state "Block Not Created" as NotCreated {
        [*] --> WaitingPhases
        WaitingPhases: Phases 1-4 executing
        WaitingPhases --> ReadyToForge: Phase 5 begins
        ReadyToForge --> [*]
    }

    NotCreated --> Creating: Phase 5 starts

    state "Block Creation" as Creating {
        [*] --> InitializeBlock
        InitializeBlock: new Block()
        InitializeBlock --> FillContent: Set content fields
        FillContent --> HashNativeTables: Hash GCR state
        HashNativeTables --> CalculateHash: SHA256 of content
        CalculateHash --> SignHash: Sign with ed25519
        SignHash --> CalculateNextProposer: Determine next CVSA
        CalculateNextProposer --> [*]: Candidate block ready
    }

    Creating --> Candidate: Block created

    state "Candidate Block" as Candidate {
        [*] --> Stored
        Stored: Stored in sharedState.candidateBlock
        Stored --> Broadcasting: Phase 6 begins
        Broadcasting --> [*]
    }

    Candidate --> Voting: Phase 6 in progress

    state "Block Voting" as Voting {
        [*] --> BroadcastHash
        BroadcastHash: Send hash to all shard members
        BroadcastHash --> CollectSignatures: Wait for responses
        CollectSignatures --> VerifySignatures: Validate ed25519 signatures
        VerifySignatures --> CountVotes: Tally pro and con votes
        CountVotes --> [*]: Voting complete
    }

    Voting --> Validated: 67%+ votes
    Voting --> Invalid: Less than 67% votes

    state "Block Validated" as Validated {
        [*] --> SaveGCR
        SaveGCR: Persist GCR state changes
        SaveGCR --> SaveTransactions: Write txs to database
        SaveTransactions --> RemoveFromMempool: Clear mempool
        RemoveFromMempool --> SaveBlock: Write block to database
        SaveBlock --> UpdateState: Update sharedState
        UpdateState --> [*]: Finalization complete
    }

    state "Block Invalid" as Invalid {
        [*] --> RollbackGCR
        RollbackGCR: Reverse all GCR edits
        RollbackGCR --> RemoveTxs: Clear mempool
        RemoveTxs --> ClearCandidate: Remove from sharedState
        ClearCandidate --> [*]: Cleanup complete
    }

    Validated --> Finalized: Block added to chain

    state "Block Finalized" as Finalized {
        [*] --> InChain
        InChain: Permanently in blockchain
        InChain --> Confirmed: Status = confirmed
        Confirmed --> Immutable: Cannot be modified
        Immutable --> [*]
    }

    Invalid --> Discarded: Block discarded

    state "Block Discarded" as Discarded {
        [*] --> NotInChain
        NotInChain: Not added to blockchain
        NotInChain --> UsersResubmit: Transactions must be resubmitted
        UsersResubmit --> [*]
    }

    Finalized --> [*]: Consensus round complete
    Discarded --> [*]: Consensus round complete

    note right of Creating
        Block Creation Requirements:
        - Ordered transactions from mempool
        - CVSA seed for proposer
        - Previous block hash
        - Current block number
        - Peer list
        - Native tables hashes
        - Secretary timestamp
    end note

    note right of Voting
        Voting Rules:
        - Each shard member votes independently
        - Vote = signature if hash matches
        - 67% threshold for Byzantine fault tolerance
        - Invalid blocks trigger GCR rollback
    end note

    note right of Finalized
        Finalization Steps:
        1. Save GCR state
        2. Save transactions
        3. Remove from mempool
        4. Save block to database
        5. Update sharedState
        6. Broadcast to network
    end note
```

---

## Key File References

### Block Management Files
- **Block**: `src/libs/blockchain/block.ts` (73 lines - block structure)
- **Blocks Entity**: `src/model/entities/Blocks.ts` (32 lines - database schema)
- **Chain**: `src/libs/blockchain/chain.ts` (400+ lines - blockchain operations)

### Block Creation Files
- **Create Block**: `src/libs/consensus/v2/routines/createBlock.ts` (74 lines - block forging)
- **Hash GCR**: `src/libs/blockchain/gcr/gcr_routines/hashGCR.ts` (native tables hashing)
- **CVSA**: `src/libs/consensus/v2/routines/getCommonValidatorSeed.ts` (next proposer calculation)

### Consensus Integration
- **PoRBFT**: `src/libs/consensus/v2/PoRBFT.ts` (Phase 5-7 block operations)
- **Broadcast Block Hash**: `src/libs/consensus/v2/routines/broadcastBlockHash.ts` (voting)

---

## Block Creation & Validation Principles

1. **Consensus-Driven**: Blocks only created during consensus Phase 5 by shard members

2. **Content Hash Integrity**: Block hash is SHA256 of stringified content

3. **Previous Hash Linking**: Each block references previous block hash for chain continuity

4. **Native Tables Hashing**: GCR state hashed and included for state verification

5. **Multi-Signature Validation**: 67% of shard must sign block for finalization

6. **CVSA-Based Proposer**: Deterministic next proposer calculation from block content

7. **Timestamp Consistency**: All shard members use secretary-coordinated timestamp

8. **GCR Rollback Support**: Failed blocks trigger automatic state reversal

9. **Immutable Once Finalized**: Blocks in chain cannot be modified or deleted

10. **Database Persistence**: Blocks, transactions, and GCR hashes stored with indexing
