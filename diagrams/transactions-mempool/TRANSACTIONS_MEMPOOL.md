# Transaction Processing & Mempool - Mermaid Diagrams

## Overview

The Demos blockchain uses a sophisticated transaction processing system with a mempool (memory pool) for pending transactions. Transactions support multiple signing algorithms including post-quantum cryptography (PQC) and require rigorous validation before inclusion in blocks.

**Key Features:**
- **Multi-Algorithm Support**: Ed25519, ML-DSA (Dilithium), SL-DSA (Sphincs+)
- **Dual Signature System**: PQC transactions can include ed25519 backup signatures
- **GCR Integration**: Transactions modify global state through GCREdits
- **Mempool v2**: Block-aware transaction pool with ordering
- **Signature Verification**: Cryptographic validation before execution
- **Nonce Management**: Sequential nonce requirement per account
- **Hash Integrity**: SHA256 content hash validation

## 1. Transaction Structure & Lifecycle

```mermaid
graph TB
    subgraph "Transaction Structure"
        TX[Transaction Object]
        TX --> CONTENT[content: TransactionContent]
        TX --> SIGNATURE[signature: ISignature]
        TX --> HASH[hash: string SHA256]
        TX --> STATUS[status: string]
        TX --> BLOCKNUM[blockNumber: number]
        TX --> ED25519SIG[ed25519_signature: optional]

        CONTENT --> TYPE[type: string]
        CONTENT --> FROM[from: PQC or ed25519 address]
        CONTENT --> FROMED25519[from_ed25519_address: ed25519 address]
        CONTENT --> TO[to: recipient address]
        CONTENT --> AMOUNT[amount: bigint]
        CONTENT --> DATA[data: array of 2 elements]
        CONTENT --> GCREDITS[gcr_edits: GCREdit array]
        CONTENT --> NONCE[nonce: number]
        CONTENT --> TIMESTAMP[timestamp: number]
        CONTENT --> FEES[transaction_fee: network, rpc, additional]
    end

    subgraph "Transaction Lifecycle"
        CREATE[1. Create Transaction]
        CREATE --> FILLCONTENT[2. Fill content fields]
        FILLCONTENT --> HASHCONTENT[3. Hash content with SHA256]
        HASHCONTENT --> SIGN[4. Sign hash with private key]

        SIGN --> SIGNTYPE{Signature<br/>algorithm?}
        SIGNTYPE -->|ed25519| SINGLEALGO[Single signature]
        SIGNTYPE -->|PQC| DUALALGO[PQC signature plus optional ed25519]

        SINGLEALGO --> BROADCAST
        DUALALGO --> ADDBACKUP[Add ed25519_signature field]
        ADDBACKUP --> BROADCAST[5. Broadcast to network]

        BROADCAST --> RECEIVE[6. Received by node]
        RECEIVE --> VALIDATE[7. Validate signature and structure]

        VALIDATE --> VALIDRESULT{Valid?}
        VALIDRESULT -->|no| REJECT[Reject transaction]
        VALIDRESULT -->|yes| ADDMEMPOOL[8. Add to mempool]

        ADDMEMPOOL --> CONSENSUS[9. Wait for consensus round]
        CONSENSUS --> INCLUDED{Included<br/>in block?}

        INCLUDED -->|yes| EXECUTE[10. Execute GCR edits]
        INCLUDED -->|no| RETRY[11. Retry next block]

        EXECUTE --> EXECRESULT{Execution<br/>success?}
        EXECRESULT -->|yes| FINALIZE[12. Finalize in block]
        EXECRESULT -->|no| ROLLBACK[13. Rollback and remove]

        FINALIZE --> REMOVE[14. Remove from mempool]
        ROLLBACK --> REMOVE

        REMOVE --> STORED[15. Store in transactions table]
    end

    style CREATE fill:#e1f5ff
    style HASHCONTENT fill:#fff4e1
    style SIGN fill:#e8f5e9
    style ADDMEMPOOL fill:#c8e6c9
    style FINALIZE fill:#c8e6c9
    style REJECT fill:#ffcdd2
    style ROLLBACK fill:#ffcdd2
```

## 2. Transaction Creation & Signing

```mermaid
sequenceDiagram
    participant User
    participant SDK as Demos SDK
    participant Crypto
    participant Node

    Note over User,Node: Transaction Creation

    User->>SDK: Create transaction request
    SDK->>SDK: Initialize Transaction object
    SDK->>SDK: Set content.type (e.g., "native")
    SDK->>SDK: Set content.from (user address)
    SDK->>SDK: Set content.from_ed25519_address
    SDK->>SDK: Set content.to (recipient)
    SDK->>SDK: Set content.amount
    SDK->>SDK: Set content.data
    SDK->>SDK: Set content.gcr_edits
    SDK->>SDK: Get nonce from GCR
    SDK->>SDK: Set content.nonce
    SDK->>SDK: Set content.timestamp = Date.now()
    SDK->>SDK: Set content.transaction_fee

    Note over User,Node: Hash Calculation

    SDK->>Crypto: SHA256(JSON.stringify(content))
    Crypto->>SDK: Return hash
    SDK->>SDK: Set transaction.hash

    Note over User,Node: Signature Generation

    User->>SDK: Sign transaction with private key
    SDK->>Crypto: Get signing algorithm (ed25519, ml-dsa, sl-dsa)

    alt Ed25519 Signing
        Crypto->>Crypto: Sign hash with ed25519 private key
        Crypto->>SDK: Return signature
        SDK->>SDK: Set transaction.signature
        Note right of SDK: type: "ed25519"<br/>data: hex signature
    else PQC Signing (ml-dsa or sl-dsa)
        Crypto->>Crypto: Sign hash with PQC private key
        Crypto->>SDK: Return PQC signature
        SDK->>SDK: Set transaction.signature
        Note right of SDK: type: "ml-dsa" or "sl-dsa"<br/>data: hex signature

        SDK->>SDK: Should add backup ed25519 signature?
        alt Add Backup Signature
            Crypto->>Crypto: Sign hash with ed25519 private key
            Crypto->>SDK: Return ed25519 signature
            SDK->>SDK: Set transaction.ed25519_signature
            Note right of SDK: Hex ed25519 signature<br/>of transaction hash
        end
    end

    Note over User,Node: Broadcast Transaction

    SDK->>Node: POST /transaction with tx
    Node->>Node: Validate structure
    Node->>Node: Validate signatures
    Node->>Node: Check nonce
    Node->>Node: Add to mempool
    Node->>SDK: Return confirmationBlock
    SDK->>User: Transaction submitted successfully
```

## 3. Signature Validation Process

```mermaid
flowchart TD
    START([validateSignature called])

    START --> CHECKSENDER{Sender<br/>provided?}
    CHECKSENDER -->|yes| VERIFYSENDER{content.from<br/>matches sender?}
    CHECKSENDER -->|no| CHECKPQC

    VERIFYSENDER -->|no| FAIL1[Return: Signer does not match sender]
    VERIFYSENDER -->|yes| CHECKPQC

    CHECKPQC{Signature type<br/>is PQC?}
    CHECKPQC -->|no ed25519| SETED25519TRUE[ed25519SignatureVerified = true]
    CHECKPQC -->|yes ml-dsa or sl-dsa| HASBACKUP{Has<br/>ed25519_signature?}

    HASBACKUP -->|no| CHECKGCR[Check GCR for PQC identity]
    HASBACKUP -->|yes| VERIFYED25519BACKUP

    subgraph "GCR PQC Identity Check"
        CHECKGCR --> GETIDENTITIES[IdentityManager.getIdentities<br/>from_ed25519_address, pqc]
        GETIDENTITIES --> GETPQCTYPE[Get indexed pubkeys for signature.type]
        GETPQCTYPE --> FINDPUBKEY{Find PQC pubkey<br/>matching content.from?}

        FINDPUBKEY -->|not found| FAIL2[Return: PQC signer not in GCR<br/>and no ed25519 backup]
        FINDPUBKEY -->|found| VERIFYGCRIDENTITY[Verify GCR identity ed25519 signature]

        VERIFYGCRIDENTITY --> IDENTITYVALID{GCR identity<br/>signature valid?}
        IDENTITYVALID -->|yes| SETED25519TRUEGCR[ed25519SignatureVerified = true]
        IDENTITYVALID -->|no| FAIL3[Return: GCR identity signature invalid]
    end

    subgraph "Backup Ed25519 Verification"
        VERIFYED25519BACKUP[Verify ed25519_signature field]
        VERIFYED25519BACKUP --> VERIFYED25519HASH[ucrypto.verify ed25519<br/>message: tx.hash<br/>publicKey: from_ed25519_address<br/>signature: ed25519_signature]

        VERIFYED25519HASH --> ED25519VALID{Signature<br/>valid?}
        ED25519VALID -->|yes| SETED25519TRUEBACKUP[ed25519SignatureVerified = true]
        ED25519VALID -->|no| FAIL4[Return: Ed25519 backup signature invalid]
    end

    SETED25519TRUE --> VERIFYMAIN
    SETED25519TRUEGCR --> VERIFYMAIN
    SETED25519TRUEBACKUP --> VERIFYMAIN

    VERIFYMAIN[Verify main signature]
    VERIFYMAIN --> VERIFYMAINDETAILS[ucrypto.verify<br/>algorithm: signature.type<br/>message: tx.hash<br/>publicKey: content.from<br/>signature: signature.data]

    VERIFYMAINDETAILS --> MAINVALID{Main signature<br/>valid?}

    MAINVALID -->|yes| SUCCESS[Return: success true<br/>Transaction signature verified]
    MAINVALID -->|no| FAIL5[Return: success false<br/>Main signature verification failed]

    style START fill:#e1f5ff
    style SUCCESS fill:#c8e6c9
    style FAIL1 fill:#ffcdd2
    style FAIL2 fill:#ffcdd2
    style FAIL3 fill:#ffcdd2
    style FAIL4 fill:#ffcdd2
    style FAIL5 fill:#ffcdd2
    style VERIFYMAIN fill:#fff4e1
```

## 4. Mempool Architecture & Operations

```mermaid
graph TB
    subgraph "Mempool v2 Structure"
        MEMPOOL[Mempool Singleton]
        MEMPOOL --> REPO[Repository: MempoolTx]
        MEMPOOL --> DB[Database Table: mempool_v2]

        DB --> FIELDS[Table Fields]
        FIELDS --> HASH[hash: unique varchar]
        FIELDS --> BLOCKNUMBER[blockNumber: integer]
        FIELDS --> TIMESTAMP[timestamp: bigint]
        FIELDS --> NONCE[nonce: integer]
        FIELDS --> REFBLOCK[reference_block: integer]
        FIELDS --> TXDATA[Full transaction data JSON]
    end

    subgraph "Core Operations"
        OPS[Mempool Operations]

        OPS --> GETMEMPOOL[getMempool blockNumber]
        OPS --> ADDTX[addTransaction tx]
        OPS --> REMOVETXS[removeTransactionsByHashes]
        OPS --> RECEIVE[receive incoming array]
        OPS --> CHECKHASH[checkTransactionByHash]
        OPS --> GETHASHMAP[getMempoolHashMap blockNumber]
    end

    subgraph "getMempool Logic"
        GETMEMPOOL --> QUERY[Query database]
        QUERY --> FILTER{blockNumber<br/>provided?}

        FILTER -->|yes| LESSTHANEQ[WHERE blockNumber less or equal provided]
        FILTER -->|no| GETALL[Get all mempool transactions]

        LESSTHANEQ --> ORDER[ORDER BY timestamp ASC, reference_block ASC, hash ASC]
        GETALL --> ORDER
        ORDER --> RETURNTXS[Return transaction array]
    end

    subgraph "addTransaction Logic"
        ADDTX --> CHECKCHAIN[Chain.checkTxExists hash]
        CHECKCHAIN --> INCHAIN{Already<br/>in chain?}

        INCHAIN -->|yes| ERRORCHAIN[Return: Transaction already executed]
        INCHAIN -->|no| CHECKMEMPOOL[checkTransactionByHash]

        CHECKMEMPOOL --> INMEMPOOL{Already<br/>in mempool?}
        INMEMPOOL -->|yes| ERRORMEMPOOL[Return: Transaction already in mempool]
        INMEMPOOL -->|no| DETERMINEBLOCK

        DETERMINEBLOCK{inConsensusLoop<br/>flag set?}
        DETERMINEBLOCK -->|yes| NEXTBLOCK[blockNumber = SecretaryManager.lastBlockRef plus 1]
        DETERMINEBLOCK -->|no| CURRENTBLOCK[blockNumber = getLastBlockNumber plus 1]

        NEXTBLOCK --> SAVE
        CURRENTBLOCK --> SAVE[Save to database]

        SAVE --> SAVESUCCESS{Save<br/>success?}
        SAVESUCCESS -->|yes| RETURNBLOCK[Return: confirmationBlock]
        SAVESUCCESS -->|no| HANDLEERROR[Handle QueryFailedError]
        HANDLEERROR --> RETURNERROR[Return: Error message]
    end

    subgraph "receive Logic for Consensus"
        RECEIVE --> VALIDATEINCOMING[Validate each incoming tx]
        VALIDATEINCOMING --> CHECKCOHERENT[isCoherent: hash matches content]
        CHECKCOHERENT --> CHECKSIG[validateSignature]

        CHECKSIG --> ALLVALID{All txs<br/>valid?}
        ALLVALID -->|no| RETURNFAIL[Return: success false]
        ALLVALID -->|yes| CHECKCONSENSUS{inConsensusLoop?}

        CHECKCONSENSUS -->|no| RETURNFAIL
        CHECKCONSENSUS -->|yes| GETEXISTING[getMempoolHashMap for blockNumber]

        GETEXISTING --> FILTERDUPES[Filter out duplicate hashes]
        FILTERDUPES --> SAVEEACH[Save each unique tx]
        SAVEEACH --> GETFINAL[getMempool blockNumber]
        GETFINAL --> FILTERDIFF[Filter out incoming hashes]
        FILTERDIFF --> RETURNOURS[Return: success true, our transactions]
    end

    style MEMPOOL fill:#e1f5ff
    style ADDTX fill:#fff4e1
    style RECEIVE fill:#e8f5e9
    style RETURNBLOCK fill:#c8e6c9
    style RETURNOURS fill:#c8e6c9
    style ERRORCHAIN fill:#ffcdd2
    style ERRORMEMPOOL fill:#ffcdd2
    style RETURNFAIL fill:#ffcdd2
```

## 5. Transaction Hash & Coherence Validation

```mermaid
flowchart TD
    START([Transaction Received])

    START --> EXTRACT[Extract transaction fields]
    EXTRACT --> CONTENT[content object]
    EXTRACT --> HASH[hash string]
    EXTRACT --> SIGNATURE[signature object]

    CONTENT --> ISCOHERENT[isCoherent validation]

    subgraph "Hash Coherence Check"
        ISCOHERENT --> STRINGIFY[JSON.stringify content]
        STRINGIFY --> CALCSHA256[Calculate SHA256 hash]
        CALCSHA256 --> DERIVEHASH[derivedHash result]

        DERIVEHASH --> COMPARE{derivedHash<br/>equals tx.hash?}
        COMPARE -->|yes| COHERENT[Transaction is coherent]
        COMPARE -->|no| INCOHERENT[Transaction is NOT coherent]
    end

    COHERENT --> STRUCTURED[structured validation]

    subgraph "Structure Validation"
        STRUCTURED --> CHECKFIELDS{All required<br/>fields present?}

        CHECKFIELDS --> HASTYPE{content.type<br/>exists?}
        CHECKFIELDS --> HASFROM{content.from<br/>exists?}
        CHECKFIELDS --> HASTO{content.to<br/>exists?}
        CHECKFIELDS --> HASAMOUNT{content.amount<br/>exists?}
        CHECKFIELDS --> HASNONCE{content.nonce<br/>exists?}
        CHECKFIELDS --> HASTIMESTAMP{content.timestamp<br/>exists?}
        CHECKFIELDS --> HASHASH{hash<br/>exists?}
        CHECKFIELDS --> HASSIG{signature<br/>exists?}

        HASTYPE -->|no| INVALID
        HASFROM -->|no| INVALID
        HASTO -->|no| INVALID
        HASAMOUNT -->|no| INVALID
        HASNONCE -->|no| INVALID
        HASTIMESTAMP -->|no| INVALID
        HASHASH -->|no| INVALID
        HASSIG -->|no| INVALID

        HASTYPE -->|yes| ALLPRESENT
        HASFROM -->|yes| ALLPRESENT
        HASTO -->|yes| ALLPRESENT
        HASAMOUNT -->|yes| ALLPRESENT
        HASNONCE -->|yes| ALLPRESENT
        HASTIMESTAMP -->|yes| ALLPRESENT
        HASHASH -->|yes| ALLPRESENT
        HASSIG -->|yes| ALLPRESENT

        ALLPRESENT[All fields present]
        ALLPRESENT --> VALIDATETO[validateToField content.to]
    end

    subgraph "TO Field Validation"
        VALIDATETO --> TOEXISTS{TO field<br/>exists?}
        TOEXISTS -->|no| INVALID[Return: invalid]
        TOEXISTS -->|yes| CONVERTBUFFER[convertToBuffer TO]

        CONVERTBUFFER --> BUFFERTYPE{Buffer<br/>type?}
        BUFFERTYPE -->|hex string| PARSEHEX[Parse hex to buffer]
        BUFFERTYPE -->|Buffer object| USEDIRECT[Use directly]
        BUFFERTYPE -->|JSON Buffer| PARSEJSON[Parse from JSON]

        PARSEHEX --> CHECKLEN
        USEDIRECT --> CHECKLEN
        PARSEJSON --> CHECKLEN[Check buffer length]

        CHECKLEN --> IS32BYTES{Length<br/>equals 32?}
        IS32BYTES -->|no| INVALID
        IS32BYTES -->|yes| VALIDED25519[Valid Ed25519 public key format]
    end

    VALIDED25519 --> VALID[Return: valid true]
    INCOHERENT --> INVALID
    INVALID --> REJECT[Reject transaction]

    VALID --> NEXTSTEP[Proceed to signature validation]

    style START fill:#e1f5ff
    style COHERENT fill:#c8e6c9
    style VALID fill:#c8e6c9
    style INCOHERENT fill:#ffcdd2
    style INVALID fill:#ffcdd2
    style REJECT fill:#ffcdd2
    style CALCSHA256 fill:#fff4e1
```

## 6. Mempool Integration with Consensus

```mermaid
sequenceDiagram
    participant User
    participant Node as Local Node
    participant Mempool
    participant Consensus as Consensus Routine
    participant Shard as Shard Members
    participant GCR

    Note over User,GCR: Transaction Submission

    User->>Node: Submit transaction via RPC
    Node->>Node: Validate signature and structure
    Node->>Mempool: addTransaction(tx)
    Mempool->>Mempool: Check if already exists
    Mempool->>Mempool: Determine blockNumber
    Note right of Mempool: If inConsensusLoop:<br/>blockNumber = lastBlockRef + 1<br/>Else:<br/>blockNumber = lastBlockNumber + 1
    Mempool->>Mempool: Save to mempool_v2 table
    Mempool->>Node: Return confirmationBlock
    Node->>User: Transaction will be in block N

    Note over User,GCR: Consensus Round Begins

    Consensus->>Consensus: consensusRoutine triggered
    Consensus->>Consensus: Phase 1: Initialize shard
    Consensus->>Consensus: Phase 2: Synchronize time

    Note over User,GCR: Phase 3: Merge Mempools

    Consensus->>Mempool: getMempool(blockRef)
    Mempool->>Consensus: Return local mempool txs

    Consensus->>Shard: Send mempool RPC to all members
    Note right of Consensus: RPC: mempool<br/>params: local mempool data<br/>retry: 3 times

    loop For each shard member
        Shard->>Shard: Receive mempool RPC
        Shard->>Mempool: receive(incoming txs)
        Mempool->>Mempool: Validate each tx
        Mempool->>Mempool: Filter duplicates
        Mempool->>Mempool: Save unique txs
        Mempool->>Shard: Return our unique txs
        Shard->>Consensus: Response with mempool delta
    end

    Consensus->>Consensus: Merge all responses
    Consensus->>Mempool: getMempool(blockRef)
    Mempool->>Consensus: Return merged mempool

    Consensus->>Consensus: orderTransactions by timestamp
    Consensus->>Consensus: Phase 3 complete

    Note over User,GCR: Phase 4: Apply GCR Edits

    Consensus->>Consensus: For each tx in merged mempool
    loop For each transaction
        Consensus->>GCR: Apply tx.content.gcr_edits
        GCR->>GCR: Process edits
        alt Edit successful
            GCR->>Consensus: Success
            Consensus->>Consensus: Add to successfulTxs
        else Edit failed
            GCR->>Consensus: Failure
            Consensus->>Consensus: Add to failedTxs
        end
    end

    Consensus->>Mempool: removeTransactionsByHashes(failedTxs)
    Mempool->>Mempool: Delete failed txs
    Consensus->>Consensus: Phase 4 complete

    Note over User,GCR: Phases 5-6: Forge and Vote

    Consensus->>Consensus: Phase 5: Forge block with successful txs
    Consensus->>Consensus: Phase 6: Vote on block
    Consensus->>Consensus: Check if 67%+ votes

    alt Block Valid
        Consensus->>Consensus: Phase 7: Finalize block
        Consensus->>Mempool: removeTransactionsByHashes(successfulTxs)
        Mempool->>Mempool: Delete from mempool
        Consensus->>Consensus: Add txs to block
        Consensus->>Consensus: Save block to chain
        Note right of Consensus: Transactions now in blockchain
    else Block Invalid
        Consensus->>GCR: Rollback all successful GCR edits
        GCR->>GCR: Reverse state changes
        Consensus->>Mempool: removeTransactionsByHashes(successfulTxs)
        Mempool->>Mempool: Delete from mempool
        Note right of Consensus: Transactions discarded<br/>Users must resubmit
    end
```

## 7. Nonce Management & Validation

```mermaid
flowchart TD
    START([Transaction Creation])

    START --> GETACCOUNT[Get sender account from GCR]
    GETACCOUNT --> READNONCE[Read current nonce from GCR_Main]

    READNONCE --> ACCOUNTEXISTS{Account<br/>exists?}
    ACCOUNTEXISTS -->|no| NONCE0[Current nonce = 0]
    ACCOUNTEXISTS -->|yes| CURRENTNONCE[Current nonce from GCR]

    NONCE0 --> SETNEXTNONCE
    CURRENTNONCE --> SETNEXTNONCE[Set tx.content.nonce = current nonce plus 1]

    SETNEXTNONCE --> CREATETX[Create and sign transaction]
    CREATETX --> BROADCAST[Broadcast to network]

    BROADCAST --> NODEVALIDATE[Node validates transaction]

    subgraph "Nonce Validation in Consensus"
        NODEVALIDATE --> CONSENSUSSTART[Consensus begins]
        CONSENSUSSTART --> PHASE4[Phase 4: Apply GCR edits]

        PHASE4 --> GCRCHECK[HandleGCR.apply nonce edit]
        GCRCHECK --> GETEXPECTED[Get expected nonce from GCR]

        GETEXPECTED --> COMPARENONCE{tx.nonce equals<br/>expected plus 1?}

        COMPARENONCE -->|yes| VALIDNONCE[Valid nonce]
        COMPARENONCE -->|no| INVALIDNONCE[Invalid nonce]

        VALIDNONCE --> UPDATEGCR[GCR_Main.nonce = tx.nonce]
        UPDATEGCR --> SUCCESS[Transaction succeeds]

        INVALIDNONCE --> REJECT[Transaction fails]
    end

    subgraph "Nonce Scenarios"
        SUCCESS --> SCENARIO1
        REJECT --> SCENARIO2

        SCENARIO1[Scenario 1: Sequential Success]
        SCENARIO1 --> SEQ1[Account nonce: 5]
        SEQ1 --> SEQ2[Submit tx with nonce 6: SUCCESS]
        SEQ2 --> SEQ3[Account nonce now: 6]
        SEQ3 --> SEQ4[Submit tx with nonce 7: SUCCESS]

        SCENARIO2[Scenario 2: Out of Order]
        SCENARIO2 --> OOO1[Account nonce: 5]
        OOO1 --> OOO2[Submit tx with nonce 8: FAIL]
        OOO2 --> OOO3[Nonce must be 6, not 8]

        SCENARIO2 --> SCENARIO3
        SCENARIO3[Scenario 3: Duplicate Nonce]
        SCENARIO3 --> DUP1[Account nonce: 5]
        DUP1 --> DUP2[Submit tx with nonce 6: SUCCESS]
        DUP2 --> DUP3[Account nonce now: 6]
        DUP3 --> DUP4[Submit another tx with nonce 6: FAIL]
        DUP4 --> DUP5[Nonce 6 already used]

        SCENARIO3 --> SCENARIO4
        SCENARIO4[Scenario 4: Rollback Behavior]
        SCENARIO4 --> RB1[Account nonce: 5]
        RB1 --> RB2[Submit tx with nonce 6: in mempool]
        RB2 --> RB3[Consensus fails, block invalid]
        RB3 --> RB4[GCR rollback: nonce stays 5]
        RB4 --> RB5[Tx removed from mempool]
        RB5 --> RB6[User must resubmit with nonce 6]
    end

    style START fill:#e1f5ff
    style VALIDNONCE fill:#c8e6c9
    style SUCCESS fill:#c8e6c9
    style INVALIDNONCE fill:#ffcdd2
    style REJECT fill:#ffcdd2
    style UPDATEGCR fill:#fff4e1
```

## 8. Transaction Types & GCREdit Generation

```mermaid
graph TB
    subgraph "Transaction Types"
        TYPES[Transaction Types]
        TYPES --> NATIVE[native: Token transfer]
        TYPES --> IDENTITY[identity_link: Link XM/Web2/PQC]
        TYPES --> VALIDATOR[validator_entrance: Become validator]
        TYPES --> CUSTOM[custom: Application-specific]
    end

    subgraph "Native Transaction GCREdits"
        NATIVE --> NATIVEGEN[Generate GCR edits]

        NATIVEGEN --> EDIT1[Edit 1: Remove from sender balance]
        EDIT1 --> E1TYPE[type: balance]
        E1TYPE --> E1OP[operation: remove]
        E1TYPE --> E1ACCOUNT[account: tx.content.from]
        E1TYPE --> E1AMOUNT[amount: tx.content.amount]
        E1TYPE --> E1HASH[txhash: tx.hash]

        NATIVEGEN --> EDIT2[Edit 2: Add to recipient balance]
        EDIT2 --> E2TYPE[type: balance]
        E2TYPE --> E2OP[operation: add]
        E2TYPE --> E2ACCOUNT[account: tx.content.to]
        E2TYPE --> E2AMOUNT[amount: tx.content.amount]
        E2TYPE --> E2HASH[txhash: tx.hash]

        NATIVEGEN --> EDIT3[Edit 3: Increment sender nonce]
        EDIT3 --> E3TYPE[type: nonce]
        E3TYPE --> E3OP[operation: increment]
        E3TYPE --> E3ACCOUNT[account: tx.content.from]
        E3TYPE --> E3HASH[txhash: tx.hash]
    end

    subgraph "Identity Link Transaction GCREdits"
        IDENTITY --> IDENTITYGEN[Generate GCR edits]

        IDENTITYGEN --> IEDIT1[Edit 1: Add identity]
        IEDIT1 --> IE1TYPE[type: identity]
        IE1TYPE --> IE1OP[operation: add or link]
        IE1TYPE --> IE1ACCOUNT[account: tx.content.from]
        IE1TYPE --> IE1DATA[data: identity proof]
        IE1TYPE --> IE1HASH[txhash: tx.hash]

        IDENTITYGEN --> IEDIT2[Edit 2: Award points via IncentiveManager]
        IEDIT2 --> IE2TYPE[type: balance]
        IE2TYPE --> IE2OP[operation: add]
        IE2TYPE --> IE2ACCOUNT[account: tx.content.from]
        IE2TYPE --> IE2AMOUNT[amount: incentive points]

        IDENTITYGEN --> IEDIT3[Edit 3: Increment nonce]
        IEDIT3 --> IE3TYPE[type: nonce]
        IE3TYPE --> IE3OP[operation: increment]
        IE3TYPE --> IE3ACCOUNT[account: tx.content.from]
    end

    subgraph "GCREdit Processing"
        E1HASH --> APPLY[HandleGCR.apply]
        E2HASH --> APPLY
        E3HASH --> APPLY
        IE1HASH --> APPLY
        IE2AMOUNT --> APPLY
        IE3ACCOUNT --> APPLY

        APPLY --> ROUTER{GCREdit<br/>type?}

        ROUTER -->|balance| BALROUTINE[GCRBalanceRoutines.apply]
        ROUTER -->|nonce| NONCEROUTINE[GCRNonceRoutines.apply]
        ROUTER -->|identity| IDROUTINE[GCRIdentityRoutines.apply]

        BALROUTINE --> BALOPERATION{operation?}
        BALOPERATION -->|add| BALADD[Add to GCR_Main.balance]
        BALOPERATION -->|remove| BALREMOVE[Remove from GCR_Main.balance]

        BALADD --> BALSUCCESS[Return success]
        BALREMOVE --> BALCHECK{Sufficient<br/>balance?}
        BALCHECK -->|yes| BALSUCCESS
        BALCHECK -->|no| BALFAIL[Return failure]

        NONCEROUTINE --> NONCEOP{operation?}
        NONCEOP -->|increment| NONCEINCREMENT[GCR_Main.nonce plus plus]
        NONCEOP -->|check| NONCECHECK[Validate expected nonce]

        IDROUTINE --> IDVERIFY[Verify identity proof]
        IDVERIFY --> IDVALID{Proof<br/>valid?}
        IDVALID -->|yes| IDSAVE[Save to GCR_Main.identities]
        IDVALID -->|no| IDFAIL[Return failure]
    end

    style NATIVE fill:#e1f5ff
    style IDENTITY fill:#fff4e1
    style APPLY fill:#e8f5e9
    style BALSUCCESS fill:#c8e6c9
    style IDSAVE fill:#c8e6c9
    style BALFAIL fill:#ffcdd2
    style IDFAIL fill:#ffcdd2
```

## 9. Transaction Database Schema & Indexing

```mermaid
erDiagram
    TRANSACTIONS {
        integer id PK
        integer blockNumber
        varchar signature
        varchar ed25519_signature
        varchar status
        varchar hash UK
        json content
        varchar type
        varchar from
        varchar from_ed25519_address
        varchar to
        integer amount
        integer nonce
        bigint timestamp
        integer networkFee
        integer rpcFee
        integer additionalFee
    }

    MEMPOOL_V2 {
        varchar hash PK
        integer blockNumber
        bigint timestamp
        integer nonce
        integer reference_block
        json content
        json signature
        varchar ed25519_signature
        varchar status
    }

    BLOCKS {
        integer number PK
        varchar hash UK
        json content
        json validation_data
    }

    GCR_MAIN {
        varchar pubkey PK
        bigint balance
        integer nonce
        jsonb identities
        jsonb points
    }

    TRANSACTIONS ||--o{ BLOCKS : "included_in"
    MEMPOOL_V2 ||--o{ BLOCKS : "waiting_for"
    TRANSACTIONS ||--o| GCR_MAIN : "modifies_state"
    MEMPOOL_V2 ||--o| GCR_MAIN : "will_modify"
```

**Database Indexes:**
- **TRANSACTIONS table indexes:** idx_transactions_hash, idx_transactions_blockNumber, idx_transactions_from_ed25519_address, idx_transactions_to
- **MEMPOOL_V2 table indexes:** idx_mempool_hash, idx_mempool_blockNumber, idx_mempool_timestamp

```

## 10. Complete Transaction Flow with Error Handling

```mermaid
stateDiagram-v2
    [*] --> Created: User creates transaction

    state "Transaction Created" as Created {
        [*] --> FillContent
        FillContent: Fill content fields
        FillContent --> HashContent: Calculate SHA256
        HashContent --> SignHash: Sign with private key
        SignHash --> [*]: Transaction ready
    }

    Created --> Broadcast: Submit to network

    state "Broadcast & Validation" as Broadcast {
        [*] --> ReceiveRPC
        ReceiveRPC: Node receives RPC request
        ReceiveRPC --> ValidateStructure: Check structure
        ValidateStructure --> ValidateHash: Check hash coherence

        state ValidateHash {
            [*] --> CalcHash
            CalcHash: Calculate SHA256 of content
            CalcHash --> CompareHash: Compare with tx.hash
            CompareHash --> HashMatch: Hashes match
            CompareHash --> HashMismatch: Hashes do not match
        }

        ValidateHash --> ValidateSignature: Hash valid

        state ValidateSignature {
            [*] --> CheckSender
            CheckSender: Verify signer matches sender
            CheckSender --> CheckPQC: Check if PQC
            CheckPQC --> VerifyEd25519: Verify ed25519 component
            VerifyEd25519 --> VerifyMain: Verify main signature
            VerifyMain --> SigValid: Signatures valid
            VerifyMain --> SigInvalid: Signature verification failed
        }

        ValidateSignature --> CheckChain: Signatures valid

        state CheckChain {
            [*] --> QueryChain
            QueryChain: Check if tx.hash in blockchain
            QueryChain --> AlreadyExecuted: Found in chain
            QueryChain --> NotInChain: Not in chain
        }

        CheckChain --> CheckMempool: Not in chain

        state CheckMempool {
            [*] --> QueryMempool
            QueryMempool: Check if tx.hash in mempool
            QueryMempool --> AlreadyQueued: Found in mempool
            QueryMempool --> NotInMempool: Not in mempool
        }

        CheckMempool --> AddToMempool: Not in mempool
        AddToMempool --> [*]: Added successfully
    }

    state "Error States" as Errors {
        HashMismatch --> RejectedHash: Hash mismatch error
        SigInvalid --> RejectedSig: Signature invalid error
        AlreadyExecuted --> RejectedDupe: Already executed error
        AlreadyQueued --> RejectedMempool: Already in mempool error
    }

    Broadcast --> InMempool: Added to mempool
    Broadcast --> Errors: Validation failed

    state "Waiting in Mempool" as InMempool {
        [*] --> QueuedForBlock
        QueuedForBlock: Assigned to blockNumber N
        QueuedForBlock --> WaitingConsensus: Waiting for consensus round
        WaitingConsensus --> [*]: In mempool
    }

    InMempool --> ConsensusBegins: Consensus round N starts

    state "Consensus Processing" as ConsensusBegins {
        [*] --> MempoolMerge
        MempoolMerge: Phase 3 - Merge mempools
        MempoolMerge --> OrderTxs: Order by timestamp
        OrderTxs --> ApplyGCR: Phase 4 - Apply GCR edits

        state ApplyGCR {
            [*] --> ProcessEdit
            ProcessEdit: For each GCREdit in tx
            ProcessEdit --> EditSuccess: Edit applied
            ProcessEdit --> EditFailed: Edit failed
        }

        ApplyGCR --> TxResult: All edits processed

        state TxResult {
            [*] --> AllSuccess
            [*] --> AnyFailed
            AllSuccess: All edits successful
            AnyFailed: At least one edit failed
        }

        TxResult --> ForgeBlock: All successful
        TxResult --> MarkFailed: Any failed

        MarkFailed --> RemoveFromMempool: Remove failed tx
        RemoveFromMempool --> [*]: Not included

        ForgeBlock: Phase 5 - Create block
        ForgeBlock --> VoteBlock: Phase 6 - Vote on block
        VoteBlock --> BlockResult: Count votes

        state BlockResult {
            [*] --> Count67Percent
            Count67Percent: Check if 67%+ votes
            Count67Percent --> BlockValid: Valid
            Count67Percent --> BlockInvalid: Invalid
        }
    }

    ConsensusBegins --> Finalized: Block valid (67%+ votes)
    ConsensusBegins --> RolledBack: Block invalid

    state "Transaction Finalized" as Finalized {
        [*] --> RemoveMempool
        RemoveMempool: Remove from mempool
        RemoveMempool --> AddToBlock: Add to block
        AddToBlock --> SaveChain: Save block to blockchain
        SaveChain --> PermanentRecord: Permanent record in transactions table
        PermanentRecord --> [*]: Transaction complete
    }

    state "Transaction Rolled Back" as RolledBack {
        [*] --> RollbackGCR
        RollbackGCR: Reverse all GCR edits
        RollbackGCR --> RemoveMempoolRB: Remove from mempool
        RemoveMempoolRB --> NotifyUser: User must resubmit
        NotifyUser --> [*]: Transaction discarded
    }

    Errors --> [*]: Transaction rejected
    Finalized --> [*]: Success
    RolledBack --> [*]: Discarded

    note right of InMempool
        Mempool Properties:
        - Transactions ordered by timestamp
        - Assigned to specific blockNumber
        - Merged during consensus Phase 3
        - Removed after finalization or rollback
    end note

    note right of ConsensusBegins
        Consensus Guarantees:
        - All or nothing execution
        - 67% Byzantine threshold
        - Automatic GCR rollback on failure
        - Failed txs removed from mempool
    end note
```

---

## Key File References

### Transaction Processing Files
- **Transaction**: `src/libs/blockchain/transaction.ts` (400+ lines - transaction creation, signing, validation)
- **Transactions Entity**: `src/model/entities/Transactions.ts` (61 lines - database schema)

### Mempool Management Files
- **Mempool v2**: `src/libs/blockchain/mempool_v2.ts` (209 lines - mempool operations)
- **Mempool Entity**: `src/model/entities/Mempool.ts` (database schema for mempool_v2)

### Related Files
- **GCR Handler**: `src/libs/blockchain/gcr/handleGCR.ts` (GCREdit processing)
- **Identity Manager**: `src/libs/blockchain/gcr/gcr_routines/identityManager.ts` (PQC identity verification)
- **Consensus Integration**: `src/libs/consensus/v2/PoRBFT.ts` (mempool merge in Phase 3)

---

## Transaction & Mempool Principles

1. **Multi-Algorithm Support**: Ed25519, ML-DSA (Dilithium), SL-DSA (Sphincs+) with dual signature option

2. **Hash Integrity**: SHA256 of content must match tx.hash for coherence

3. **Signature Verification**: Two-step process - ed25519 verification then main algorithm verification

4. **Nonce Sequencing**: Each account has sequential nonce, must increment by 1

5. **Block Assignment**: Transactions assigned to blockNumber based on consensus state

6. **Mempool Merging**: During consensus Phase 3, all shard members merge mempools

7. **GCREdit Execution**: Phase 4 applies state changes, failed transactions removed

8. **Timestamp Ordering**: Transactions ordered by timestamp within mempool

9. **Duplicate Prevention**: Hash uniqueness checked in both chain and mempool

10. **Rollback Support**: Failed blocks trigger automatic GCR rollback and mempool cleanup
