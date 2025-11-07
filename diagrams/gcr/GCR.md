# Global Change Registry (GCR) - Mermaid Diagrams

## Overview

The Global Change Registry (GCR) is a critical component of the Demos blockchain that manages mutable global state including balances, identities, nonces, and incentives. While not stored directly in blocks, every GCR modification is cryptographically traceable through Operations derived from Transactions.

## 1. GCR Architecture & Components

```mermaid
graph TB
    subgraph "Transaction Layer"
        TX[Transaction]
        GCREDIT[GCR Edits Array]
        TX -->|contains| GCREDIT
    end

    subgraph "GCR Core - handleGCR.ts"
        HANDLER[HandleGCR Class]
        APPLY[apply method]
        APPLYTOTX[applyToTx method]
        ROLLBACK[rollback method]

        HANDLER --> APPLY
        HANDLER --> APPLYTOTX
        HANDLER --> ROLLBACK
    end

    subgraph "GCR Routines"
        BALANCE[GCRBalanceRoutines<br/>src/libs/blockchain/gcr/gcr_routines/GCRBalanceRoutines.ts]
        NONCE[GCRNonceRoutines<br/>src/libs/blockchain/gcr/gcr_routines/GCRNonceRoutines.ts]
        IDENTITY[GCRIdentityRoutines<br/>src/libs/blockchain/gcr/gcr_routines/GCRIdentityRoutines.ts]

        BALANCE -->|add/remove/rollback| BALANCEDB[(GCR_Main)]
        NONCE -->|increment/decrement| BALANCEDB
        IDENTITY -->|XM/Web2/PQC| BALANCEDB
    end

    subgraph "Identity Management"
        IDMGR[IdentityManager<br/>src/libs/blockchain/gcr/gcr_routines/identityManager.ts]
        CHAINS[Supported Chains]

        IDMGR --> CHAINS

        CHAINS --> SOLANA[Solana]
        CHAINS --> EVM[EVM]
        CHAINS --> EGLD[MultiversX]
        CHAINS --> TON[TON]
        CHAINS --> XRPL[XRPL]
        CHAINS --> IBC[IBC]
        CHAINS --> NEAR[NEAR]
        CHAINS --> BTC[Bitcoin]
    end

    subgraph "Incentive System"
        INCENTIVE[IncentiveManager<br/>src/libs/blockchain/gcr/gcr_routines/IncentiveManager.ts]
        POINTS[PointSystem]

        INCENTIVE -->|awards points| POINTS
        POINTS -->|Web3 Wallets| BALANCEDB
        POINTS -->|Twitter/GitHub/Telegram/Discord| BALANCEDB
        POINTS -->|Referral Code| BALANCEDB
    end

    subgraph "Database Tables"
        GCRDB[(GCR_Main<br/>pubkey, balance, nonce, identities)]
        TRACKER[(GCRTracker<br/>publicKey, hash)]
        HASHES[(GCRHashes<br/>block, hash)]
        SUBNETS[(GCRSubnetsTxs<br/>tx_hash, subnet_id)]
    end

    subgraph "State Management"
        ENSURE[ensureGCRForUser<br/>src/libs/blockchain/gcr/gcr_routines/ensureGCRForUser.ts]
        STATESAVE[GCRStateSaverHelper<br/>src/libs/blockchain/gcr/gcr_routines/gcrStateSaverHelper.ts]
        HASH[hashGCR<br/>src/libs/blockchain/gcr/gcr_routines/hashGCR.ts]
        JSONB[GCRJsonbHandler<br/>src/libs/blockchain/gcr/gcr_routines/gcrJSONBHandler.ts]

        ENSURE -->|create if missing| GCRDB
        STATESAVE -->|updateGCRTracker| TRACKER
        HASH -->|hashGCRTables| HASHES
        JSONB -->|JSONB operations| GCRDB
    end

    GCREDIT -->|routed by type| APPLY
    APPLY -->|balance edit| BALANCE
    APPLY -->|nonce edit| NONCE
    APPLY -->|identity edit| IDENTITY

    IDENTITY -->|verify signatures| IDMGR
    IDENTITY -->|award points| INCENTIVE

    BALANCE -.->|persist| GCRDB
    NONCE -.->|persist| GCRDB
    IDENTITY -.->|persist| GCRDB

    GCRDB -->|track changes| TRACKER
    TRACKER -->|hash history| HASHES

    style TX fill:#e1f5ff
    style HANDLER fill:#fff4e1
    style BALANCE fill:#e8f5e9
    style NONCE fill:#e8f5e9
    style IDENTITY fill:#e8f5e9
    style GCRDB fill:#f3e5f5
    style IDMGR fill:#fff3e0
    style INCENTIVE fill:#fce4ec
```

## 2. GCREdit Processing Flow

```mermaid
flowchart TD
    START([Transaction with GCR Edits])

    START --> CHECKTX{Check if<br/>TX exists<br/>in chain?}
    CHECKTX -->|exists| REJECT[Return: TX already executed]
    CHECKTX -->|new| LOOP[Loop through GCR Edits]

    LOOP --> EDITTYPE{Edit Type?}

    EDITTYPE -->|balance| BALANCEROUTE[GCRBalanceRoutines.apply]
    EDITTYPE -->|nonce| NONCEROUTE[GCRNonceRoutines.apply]
    EDITTYPE -->|identity| IDENTITYROUTE[GCRIdentityRoutines.apply]
    EDITTYPE -->|assign| ASSIGNROUTE[Not Implemented]
    EDITTYPE -->|subnetsTx| SUBNETSROUTE[Not Implemented]
    EDITTYPE -->|unknown| INVALIDTYPE[Return: Invalid GCREdit type]

    subgraph "Balance Processing"
        BALANCEROUTE --> BALANCEOP{Operation?}
        BALANCEOP -->|add| BALADD[Add amount to balance]
        BALANCEOP -->|remove| BALREM{Balance >= Amount?}
        BALREM -->|yes| BALSUBTRACT[Subtract from balance]
        BALREM -->|no| BALFAIL[Return: Insufficient balance]

        BALANCEOP -->|isRollback?| BALREVERSE[Reverse operation<br/>add→remove<br/>remove→add]
        BALREVERSE --> BALANCEOP

        BALADD --> BALSAVE{Simulate?}
        BALSUBTRACT --> BALSAVE
        BALSAVE -->|no| BALPERSIST[Save to DB]
        BALSAVE -->|yes| BALSKIP[Skip save]
        BALPERSIST --> BALSUCCESS[Return: Success]
        BALSKIP --> BALSUCCESS
    end

    subgraph "Nonce Processing"
        NONCEROUTE --> NONCEOP{Operation?}
        NONCEOP -->|add| NONCEADD[Increment nonce]
        NONCEOP -->|remove| NONCEREM{Nonce >= Amount?}
        NONCEREM -->|yes| NONCESUB[Decrement nonce]
        NONCEREM -->|no| NONCEFAIL[Return: Insufficient nonce]

        NONCEOP -->|isRollback?| NONCEREVERSE[Reverse operation]
        NONCEREVERSE --> NONCEOP

        NONCEADD --> NONCESAVE{Simulate?}
        NONCESUB --> NONCESAVE
        NONCESAVE -->|no| NONCEPERSIST[Save to DB]
        NONCESAVE -->|yes| NONCESKIP[Skip save]
        NONCEPERSIST --> NONCESUCCESS[Return: Success]
        NONCESKIP --> NONCESUCCESS
    end

    subgraph "Identity Processing"
        IDENTITYROUTE --> IDENTITYSUBTYPE{Identity<br/>Subtype?}
        IDENTITYSUBTYPE -->|xm_add| XMADD[applyXmIdentityAdd]
        IDENTITYSUBTYPE -->|xm_remove| XMREM[applyXmIdentityRemove]
        IDENTITYSUBTYPE -->|web2_add| WEB2ADD[applyWeb2IdentityAdd]
        IDENTITYSUBTYPE -->|web2_remove| WEB2REM[applyWeb2IdentityRemove]
        IDENTITYSUBTYPE -->|pqc_add| PQCADD[applyPqcIdentityAdd]
        IDENTITYSUBTYPE -->|pqc_remove| PQCREM[applyPqcIdentityRemove]

        XMADD --> VERIFYSIG[Verify Signature]
        WEB2ADD --> VERIFYPROOF{Context?}
        VERIFYPROOF -->|telegram| TELVERIFY[Telegram dual signature]
        VERIFYPROOF -->|other| SHA256VERIFY[SHA256 proof hash]

        PQCADD --> VERIFYPQC[Verify PQC Signature]

        VERIFYSIG --> CHECKSIG{Valid?}
        TELVERIFY --> CHECKSIG
        SHA256VERIFY --> CHECKSIG
        VERIFYPQC --> CHECKSIG

        CHECKSIG -->|no| IDENTITYFAIL[Return: Signature verification failed]
        CHECKSIG -->|yes| CHECKFIRST{First time<br/>linking?}

        CHECKFIRST -->|yes| AWARDPOINTS[IncentiveManager awards points]
        CHECKFIRST -->|no| SKIPPOINTS[Skip incentive]

        AWARDPOINTS --> IDENTITYSAVE[Save identity to GCR]
        SKIPPOINTS --> IDENTITYSAVE

        XMREM --> REMOVEIDENTITY[Remove from identities]
        WEB2REM --> REMOVEIDENTITY
        PQCREM --> REMOVEIDENTITY

        REMOVEIDENTITY --> DEDUCTPOINTS[Deduct incentive points]

        IDENTITYSAVE --> IDENTITYSUCCESS[Return: Success]
        DEDUCTPOINTS --> IDENTITYSUCCESS
    end

    BALSUCCESS --> TRACK[Track applied edit]
    NONCESUCCESS --> TRACK
    IDENTITYSUCCESS --> TRACK
    BALFAIL --> ROLLBACKALL[Rollback all applied edits]
    NONCEFAIL --> ROLLBACKALL
    IDENTITYFAIL --> ROLLBACKALL
    INVALIDTYPE --> ROLLBACKALL

    TRACK --> MOREEDIT{More edits<br/>to process?}
    MOREEDIT -->|yes| LOOP
    MOREEDIT -->|no| UPDATETRACKER[Update GCRTracker<br/>with new hash]

    ROLLBACKALL --> REVERSE[Reverse all tracked edits<br/>in reverse order]
    REVERSE --> FAILURE[Return: Failure]

    UPDATETRACKER --> SUCCESS[Return: All edits applied successfully]

    REJECT -.-> END([End])
    FAILURE -.-> END
    SUCCESS -.-> END

    style START fill:#e1f5ff
    style BALANCEROUTE fill:#e8f5e9
    style NONCEROUTE fill:#e8f5e9
    style IDENTITYROUTE fill:#e8f5e9
    style SUCCESS fill:#c8e6c9
    style FAILURE fill:#ffcdd2
    style REJECT fill:#ffcdd2
```

## 3. Transaction to GCR Operations Lifecycle

```mermaid
sequenceDiagram
    participant User
    participant TX as Transaction
    participant HandleGCR
    participant Routines as GCR Routines
    participant DB as Database
    participant Tracker as GCRTracker
    participant Incentive as IncentiveManager

    User->>TX: Create transaction with GCR edits
    TX->>TX: Sign transaction
    TX->>HandleGCR: Submit to applyToTx()

    HandleGCR->>DB: Check if TX exists
    alt TX already exists
        DB-->>HandleGCR: TX found
        HandleGCR-->>User: Error: TX already executed
    else New TX
        DB-->>HandleGCR: TX not found

        loop For each GCR edit
            HandleGCR->>HandleGCR: Route by edit type

            alt Balance Edit
                HandleGCR->>Routines: GCRBalanceRoutines.apply()
                Routines->>DB: Get current balance
                DB-->>Routines: Balance: 1000

                alt Add operation
                    Routines->>Routines: newBalance = 1000 + 500
                else Remove operation
                    Routines->>Routines: Check sufficient balance
                    alt Insufficient
                        Routines-->>HandleGCR: Error: Insufficient balance
                        HandleGCR->>HandleGCR: Trigger rollback
                    else Sufficient
                        Routines->>Routines: newBalance = 1000 - 500
                    end
                end

                Routines->>DB: Save new balance
                Routines-->>HandleGCR: Success

            else Nonce Edit
                HandleGCR->>Routines: GCRNonceRoutines.apply()
                Routines->>DB: Get current nonce
                DB-->>Routines: Nonce: 42
                Routines->>Routines: Increment/decrement nonce
                Routines->>DB: Save new nonce
                Routines-->>HandleGCR: Success

            else Identity Edit
                HandleGCR->>Routines: GCRIdentityRoutines.apply()

                alt XM Identity
                    Routines->>Routines: Verify cross-chain signature
                    Routines->>Routines: Check first-time linking
                    alt First time
                        Routines->>Incentive: walletLinked()
                        Incentive->>DB: Award points
                        Incentive-->>Routines: Points awarded
                    end
                    Routines->>DB: Save XM identity

                else Web2 Identity
                    Routines->>Routines: Verify proof/attestation
                    alt Telegram
                        Routines->>Routines: Dual signature validation
                    else Other
                        Routines->>Routines: SHA256 proof validation
                    end
                    Routines->>Routines: Check first-time linking
                    alt First time
                        Routines->>Incentive: twitterLinked() / githubLinked() / etc
                        Incentive->>DB: Award points
                        Incentive-->>Routines: Points awarded
                    end
                    Routines->>DB: Save Web2 identity

                else PQC Identity
                    Routines->>Routines: Verify PQC signature (ML-DSA/SL-DSA)
                    Routines->>DB: Save PQC identity
                end

                Routines-->>HandleGCR: Success
            end

            HandleGCR->>HandleGCR: Track applied edit
        end

        HandleGCR->>Tracker: Update GCRTracker hash
        Tracker->>DB: Calculate hash of GCR state
        DB-->>Tracker: Hash: 0xabc123...
        Tracker->>DB: Save hash to gcr_tracker

        HandleGCR-->>User: Success: All edits applied
    end
```

## 4. Identity Management Architecture

```mermaid
graph TB
    subgraph "Identity Types"
        IDTYPES[GCR Identities]
        XM[XM - Cross-Chain]
        WEB2[Web2 - Social]
        PQC[PQC - Post-Quantum]

        IDTYPES --> XM
        IDTYPES --> WEB2
        IDTYPES --> PQC
    end

    subgraph "XM Cross-Chain Identities"
        XM --> XMVERIFY[Signature Verification]

        XMVERIFY --> SOLANA[Solana<br/>Ed25519 signature]
        XMVERIFY --> EVM[EVM<br/>ECDSA signature]
        XMVERIFY --> EGLD[MultiversX<br/>Ed25519 signature]
        XMVERIFY --> TON[TON<br/>Ed25519 signature]
        XMVERIFY --> XRPL[XRPL<br/>ECDSA signature]
        XMVERIFY --> IBC[IBC/Cosmos<br/>signature]
        XMVERIFY --> NEAR[NEAR<br/>Ed25519 signature]
        XMVERIFY --> BTC[Bitcoin<br/>ECDSA signature]

        SOLANA --> XMDATA[XM Identity Data]
        EVM --> XMDATA
        EGLD --> XMDATA
        TON --> XMDATA
        XRPL --> XMDATA
        IBC --> XMDATA
        NEAR --> XMDATA
        BTC --> XMDATA

        XMDATA -->|structure| XMSTRUCT["chain: string<br/>subchain: string<br/>address: string<br/>signature: string<br/>publicKey: optional"]
    end

    subgraph "Web2 Social Identities"
        WEB2 --> WEB2TYPES[Web2 Platforms]

        WEB2TYPES --> TWITTER[Twitter<br/>OAuth proof + SHA256]
        WEB2TYPES --> GITHUB[GitHub<br/>OAuth proof + SHA256]
        WEB2TYPES --> TELEGRAM[Telegram<br/>Dual signature]
        WEB2TYPES --> DISCORD[Discord<br/>OAuth proof + SHA256]

        TWITTER --> WEB2VERIFY{Verification Type}
        GITHUB --> WEB2VERIFY
        DISCORD --> WEB2VERIFY

        WEB2VERIFY -->|standard| SHA256[SHA256 Hash Verification<br/>sha256 proof match]

        TELEGRAM --> TELVERIFY[Telegram Attestation<br/>User + Bot signature]

        SHA256 --> WEB2DATA[Web2 Identity Data]
        TELVERIFY --> WEB2DATA

        WEB2DATA -->|structure| WEB2STRUCT["context: string<br/>username: string<br/>userId: string<br/>proof: string<br/>proofHash: string<br/>timestamp: Date"]
    end

    subgraph "PQC Post-Quantum Identities"
        PQC --> PQCTYPES[PQC Algorithms]

        PQCTYPES --> MLDSA[ML-DSA<br/>Dilithium<br/>NIST standard]
        PQCTYPES --> SLDSA[SL-DSA<br/>Sphincs+<br/>NIST standard]

        MLDSA --> PQCVERIFY[PQC Signature Verification<br/>ucrypto.verify]
        SLDSA --> PQCVERIFY

        PQCVERIFY --> PQCDATA[PQC Identity Data]

        PQCDATA -->|structure| PQCSTRUCT["algorithm: ml-dsa or sl-dsa<br/>address: string<br/>signature: string<br/>timestamp: Date"]
    end

    subgraph "First-Time Linking Incentives"
        XMDATA --> FIRSTCHECK{First time<br/>linking?}
        WEB2DATA --> FIRSTCHECK

        FIRSTCHECK -->|yes| INCENTIVE[IncentiveManager]
        FIRSTCHECK -->|no| NOINCENTIVE[Skip incentive]

        INCENTIVE --> WALLETLINKED[walletLinked<br/>XM chains]
        INCENTIVE --> TWITTERLINKED[twitterLinked<br/>Twitter OAuth]
        INCENTIVE --> GITHUBLINKED[githubLinked<br/>GitHub OAuth]
        INCENTIVE --> TELEGRAMLINKED[telegramLinked<br/>Telegram attestation]
        INCENTIVE --> DISCORDLINKED[discordLinked<br/>Discord OAuth]

        WALLETLINKED --> POINTS[PointSystem.awardPoints]
        TWITTERLINKED --> POINTS
        GITHUBLINKED --> POINTS
        TELEGRAMLINKED --> POINTS
        DISCORDLINKED --> POINTS

        POINTS --> GCRPOINTS[GCR_Main.points field]
    end

    subgraph "Identity Storage"
        XMSTRUCT -.->|stored in| GCRID[(GCR_Main.identities)]
        WEB2STRUCT -.->|stored in| GCRID
        PQCSTRUCT -.->|stored in| GCRID

        GCRID -->|JSONB structure| IDSTRUCT["xm: by chain and subchain<br/>web2: by context<br/>pqc: by algorithm"]
    end

    style IDTYPES fill:#e1f5ff
    style XM fill:#e8f5e9
    style WEB2 fill:#fff3e0
    style PQC fill:#f3e5f5
    style INCENTIVE fill:#fce4ec
    style GCRID fill:#f3e5f5
```

## 5. Balance Operations with Rollback

```mermaid
stateDiagram-v2
    [*] --> CheckEditType: GCREdit received

    CheckEditType --> BalanceEdit: type is balance
    CheckEditType --> [*]: other types

    state BalanceEdit {
        [*] --> CheckRollback

        CheckRollback --> ReverseOperation: isRollback is true
        CheckRollback --> NormalOperation: isRollback is false

        ReverseOperation --> DetermineOp: Swap add and remove
        NormalOperation --> DetermineOp

        DetermineOp --> AddOperation: operation is add
        DetermineOp --> RemoveOperation: operation is remove

        state AddOperation {
            [*] --> GetCurrentBalance_Add
            GetCurrentBalance_Add --> CalculateNewBalance_Add: balance = 1000
            CalculateNewBalance_Add --> ValidateNewBalance_Add: newBalance = 1000 + 500
            ValidateNewBalance_Add --> SaveBalance_Add: valid
            SaveBalance_Add --> [*]: Success
        }

        state RemoveOperation {
            [*] --> GetCurrentBalance_Rem
            GetCurrentBalance_Rem --> CheckSufficient: balance = 1000
            CheckSufficient --> CalculateNewBalance_Rem: balance >= amount
            CheckSufficient --> InsufficientBalance: balance < amount (PROD only)
            CalculateNewBalance_Rem --> SaveBalance_Rem: newBalance = 1000 - 500
            SaveBalance_Rem --> [*]: Success
            InsufficientBalance --> [*]: Error
        }

        AddOperation --> CheckSimulate
        RemoveOperation --> CheckSimulate

        CheckSimulate --> SkipPersist: simulate is true
        CheckSimulate --> PersistToDB: simulate is false

        PersistToDB --> UpdateTracker: gcrMainRepository.save()
        SkipPersist --> ReturnSuccess
        UpdateTracker --> ReturnSuccess

        ReturnSuccess --> [*]
    }

    BalanceEdit --> TransactionRollback: Edit failed
    BalanceEdit --> [*]: Success

    state TransactionRollback {
        [*] --> ReverseEdits: Reverse applied edits order
        ReverseEdits --> ReapplyWithRollback: appliedEdits.reverse()

        ReapplyWithRollback --> ReapplyEdit1: edit.isRollback = true
        ReapplyEdit1 --> ReapplyEdit2
        ReapplyEdit2 --> ReapplyEditN

        ReapplyEditN --> [*]: All edits rolled back
    }

    TransactionRollback --> [*]: Rollback complete

    note right of AddOperation
        Add operation:
        - Retrieve current balance
        - Add amount to balance
        - Save to GCR_Main
        - No validation needed

        File: GCRBalanceRoutines.ts:8-60
    end note

    note right of RemoveOperation
        Remove operation:
        - Retrieve current balance
        - Check sufficient balance (PROD)
        - Subtract amount from balance
        - Save to GCR_Main

        File: GCRBalanceRoutines.ts:8-60
    end note

    note right of TransactionRollback
        Rollback mechanism:
        - Reverse array of applied edits
        - Set isRollback = true
        - Reapply in reverse order
        - Operations swap add and remove

        File: handleGCR.ts:383-420
    end note
```

## 6. Nonce Management Flow

```mermaid
flowchart TD
    START([GCR Nonce Edit])

    START --> VALIDATETYPE{Edit type<br/>is nonce?}
    VALIDATETYPE -->|no| INVALID[Return: Invalid type]
    VALIDATETYPE -->|yes| CHECKROLLBACK{isRollback?}

    CHECKROLLBACK -->|yes| REVERSE[Reverse operation<br/>swap add and remove]
    CHECKROLLBACK -->|no| GETACCOUNT
    REVERSE --> GETACCOUNT

    GETACCOUNT[Get GCR account by pubkey]
    GETACCOUNT --> ACCOUNTEXISTS{Account<br/>exists?}

    ACCOUNTEXISTS -->|no| CREATE[Create new GCR account<br/>HandleGCR.createAccount]
    ACCOUNTEXISTS -->|yes| GETCURRENT[Get current nonce]
    CREATE --> GETCURRENT

    GETCURRENT --> OPERATION{Operation<br/>type?}

    OPERATION -->|add| ADD[Increment nonce<br/>nonce plus amount]
    OPERATION -->|remove| CHECKSUFFICIENT{nonce greater or equal<br/>to amount?}

    CHECKSUFFICIENT -->|no| INSUFFICENT[Return: Insufficient nonce]
    CHECKSUFFICIENT -->|yes| REMOVE[Decrement nonce<br/>nonce minus amount]

    ADD --> SIMULATE{Simulate<br/>mode?}
    REMOVE --> SIMULATE

    SIMULATE -->|yes| SKIPSAVE[Skip database save]
    SIMULATE -->|no| PERSIST[Save to GCR_Main<br/>gcrMainRepository.save]

    SKIPSAVE --> SUCCESS[Return: Nonce applied successfully]
    PERSIST --> SUCCESS

    INVALID -.-> END([End])
    INSUFFICENT -.-> END
    SUCCESS -.-> END

    style START fill:#e1f5ff
    style SUCCESS fill:#c8e6c9
    style INVALID fill:#ffcdd2
    style INSUFFICENT fill:#ffcdd2
    style SIMULATE fill:#fff4e1
```

**Key Nonce Concepts:**

1. **Nonce Purpose**: Prevents replay attacks by ensuring transactions are processed in order
2. **Operations**:
   - `add`: Increment nonce (typically after successful transaction)
   - `remove`: Decrement nonce (rare, used in rollbacks)
3. **Rollback Support**: Operations are reversed when `isRollback = true`
4. **Validation**: Ensures sufficient nonce before decrementing (production only)
5. **Simulation**: Allows testing without persisting changes

**File References:**
- Implementation: `src/libs/blockchain/gcr/gcr_routines/GCRNonceRoutines.ts`
- Database Entity: `src/model/entities/GCRv2/GCR_Main.ts` (nonce field)

## 7. Native Operations Handling

```mermaid
flowchart TD
    START([Transaction with<br/>type: native])

    START --> EXTRACT["Extract native payload<br/>from tx.content.data"]
    EXTRACT --> PARSE["Parse INativePayload<br/>native and payload"]

    PARSE --> OPERATION{nativeOperation<br/>type?}

    OPERATION -->|send| SEND[Native Token Send]
    OPERATION -->|other| UNKNOWN[Unknown operation<br/>Log error]

    subgraph "Send Native Tokens"
        SEND --> EXTRACTARGS["Extract arguments<br/>to address and amount"]

        EXTRACTARGS --> CREATEEDITS[Create 2 GCREdits]

        CREATEEDITS --> EDIT1["Edit 1<br/>Remove from sender"]
        CREATEEDITS --> EDIT2["Edit 2<br/>Add to receiver"]

        EDIT1 --> EDIT1DETAILS["Edit 1 Details<br/>type: balance<br/>operation: remove<br/>account: sender<br/>amount: value<br/>txhash: hash<br/>isRollback: false"]

        EDIT2 --> EDIT2DETAILS["Edit 2 Details<br/>type: balance<br/>operation: add<br/>account: receiver<br/>amount: value<br/>txhash: hash<br/>isRollback: false"]

        EDIT1DETAILS --> ARRAYEDITS["Array of edits<br/>edit1 and edit2"]
        EDIT2DETAILS --> ARRAYEDITS
    end

    ARRAYEDITS --> RETURNEDIT[Return GCREdit array]
    UNKNOWN --> RETURNEDIT

    RETURNEDIT --> APPLYTOTX[HandleGCR.applyToTx]

    APPLYTOTX --> LOOPEDITS[Loop through edits]

    LOOPEDITS --> APPLYEDIT1["Apply Edit 1<br/>Remove balance"]
    APPLYEDIT1 --> CHECKEDIT1{Edit 1<br/>success?}

    CHECKEDIT1 -->|no| ROLLBACK[Rollback all edits]
    CHECKEDIT1 -->|yes| APPLYEDIT2["Apply Edit 2<br/>Add balance"]

    APPLYEDIT2 --> CHECKEDIT2{Edit 2<br/>success?}
    CHECKEDIT2 -->|no| ROLLBACK
    CHECKEDIT2 -->|yes| UPDATETRACKER[Update GCRTracker hash]

    ROLLBACK --> FAILURE[Return: Transfer failed]
    UPDATETRACKER --> SUCCESS[Return: Transfer successful]

    FAILURE -.-> END([End])
    SUCCESS -.-> END

    style START fill:#e1f5ff
    style SEND fill:#e8f5e9
    style SUCCESS fill:#c8e6c9
    style FAILURE fill:#ffcdd2
    style ROLLBACK fill:#ffcdd2
```

**Native Operations Explanation:**

1. **Purpose**: Handle native token transfers (DEMOS token)
2. **Transaction Type**: `type: "native"`
3. **Payload Structure**:
   ```typescript
   {
     nativeOperation: "send",
     args: [to_address, amount]
   }
   ```
4. **Atomic Transfer**: Creates 2 GCREdits:
   - Remove from sender (must succeed first)
   - Add to receiver (only if removal succeeds)
5. **Rollback Safety**: If any edit fails, all previous edits are rolled back

**File References:**
- Implementation: `src/libs/blockchain/gcr/gcr_routines/handleNativeOperations.ts`
- Type definitions: `@kynesyslabs/demosdk/types` (INativePayload)

## 8. GCR Database Schema

```mermaid
erDiagram
    GCR_Main ||--o{ GCRTracker : "tracked by"
    GCR_Main ||--o{ GCRHashes : "hashed in"
    GCR_Main {
        text pubkey PK "Ed25519 public key"
        jsonb assignedTxs "Array of transaction hashes"
        integer nonce "Transaction nonce"
        bigint balance "Native token balance"
        jsonb identities "XM, Web2, PQC identities"
        jsonb points "Incentive points breakdown"
        jsonb referralInfo "Referral code and tracking"
        boolean flagged "Account flagged for review"
        text flaggedReason "Reason for flagging"
        boolean reviewed "Manual review status"
        timestamp createdAt "Account creation time"
        timestamp updatedAt "Last update time"
    }

    GCRTracker {
        integer id PK "Auto-increment ID"
        text publicKey "User public key"
        text hash "SHA256 hash of GCR state"
    }

    GCRHashes {
        integer id PK "Auto-increment ID"
        integer block "Block number"
        text hash "Combined hash of native tables"
    }

    GCRSubnetsTxs {
        text tx_hash PK "Transaction hash"
        text subnet_id "L2PS subnet identifier"
        text status "processed, pending, failed"
        text block_hash "Block hash"
        integer block_number "Block number"
        json tx_data "Encrypted transaction data"
    }

    GlobalChangeRegistry {
        integer id PK "Legacy table ID"
        text publicKey "User public key"
        jsonb details "Legacy GCR status"
        jsonb extended "Legacy extended data"
    }
```

**JSONB Field Structures:**

### GCR_Main.identities
```typescript
{
  xm: {
    [chain: string]: {
      [subchain: string]: Array<{
        address: string,
        signature: string,
        publicKey?: string,
        timestamp: Date
      }>
    }
  },
  web2: {
    [context: string]: Array<{
      username: string,
      userId: string,
      proof: string | TelegramSignedAttestation,
      proofHash: string,
      timestamp: Date
    }>
  },
  pqc: {
    [algorithm: string]: Array<{
      address: string,
      signature: string,
      timestamp: Date
    }>
  }
}
```

### GCR_Main.points
```typescript
{
  totalPoints: number,
  breakdown: {
    web3Wallets: { [chain: string]: number },
    socialAccounts: {
      twitter: number,
      github: number,
      discord: number,
      telegram: number
    },
    referrals: number,
    demosFollow: number,
    weeklyChallenge: Array<{
      date: string,
      points: number
    }>
  },
  lastUpdated: Date
}
```

### GCR_Main.referralInfo
```typescript
{
  totalReferrals: number,
  referredBy?: string,
  referralCode: string,
  referrals: Array<{
    referredUserId: string,
    referredAt: string,
    pointsAwarded: number
  }>
}
```

**Table Purposes:**

1. **GCR_Main**: Primary account state (balances, identities, points)
2. **GCRTracker**: Per-user state hashing for change detection
3. **GCRHashes**: Per-block combined hash of all native tables
4. **GCRSubnetsTxs**: L2PS subnet transaction storage (synced with chain)
5. **GlobalChangeRegistry**: Legacy table (being phased out)

## 9. GCR State Tracking & Hashing

```mermaid
flowchart TD
    subgraph "Hash Generation Flow"
        START([GCR State Change])

        START --> UPDATEUSER[Update GCR_Main record]
        UPDATEUSER --> TRIGGER[Trigger GCRStateSaverHelper]

        TRIGGER --> HASHUSER[Hash user's GCR state]
        HASHUSER --> STRINGIFY[JSON.stringify(userData)]
        STRINGIFY --> SHA256USER[SHA256 hash]

        SHA256USER --> UPSERT[Upsert to GCRTracker<br/>publicKey, hash]
        UPSERT --> USERTRACKED[User state tracked]
    end

    subgraph "Block-Level Hashing"
        BLOCKEND[Block consensus complete]

        BLOCKEND --> HASHTABLES[Hash all native tables]

        HASHTABLES --> HASHGCR[Hash GCRTracker table]
        HASHTABLES --> HASHSUBNETS[Hash GCRSubnetsTxs table]

        HASHGCR --> ORDERGCR[Order by publicKey ASC]
        ORDERGCR --> STRINGIFYGCR[JSON.stringify all records]
        STRINGIFYGCR --> SHA256GCR[SHA256 hash]

        HASHSUBNETS --> ORDERSUBNETS[Order by tx_hash ASC]
        ORDERSUBNETS --> STRINGIFYSUBNETS[JSON.stringify all records]
        STRINGIFYSUBNETS --> SHA256SUBNETS[SHA256 hash]

        SHA256GCR --> COMBINE[Combine hashes]
        SHA256SUBNETS --> COMBINE

        COMBINE --> NATIVEHASH["Combined Hash Object<br/>native_gcr: hash1<br/>native_subnets_txs: hash2"]

        NATIVEHASH --> INSERTGCRHASH[Insert to GCRHashes<br/>block, hash]
        INSERTGCRHASH --> BLOCKTRACKED[Block state tracked]
    end

    subgraph "Hash Verification"
        VERIFY[Node syncing/<br/>Validator checking]

        VERIFY --> FETCHHASH[Fetch GCRHashes for block N]
        FETCHHASH --> RECALCULATE[Recalculate hashes from tables]

        RECALCULATE --> COMPARE{Hashes<br/>match?}

        COMPARE -->|yes| VALID[State is valid]
        COMPARE -->|no| INVALID[State mismatch!<br/>Resync needed]
    end

    USERTRACKED -.->|contributes to| BLOCKEND
    BLOCKTRACKED --> VERIFY

    VALID --> END([End])
    INVALID --> RESYNC[Trigger state resync]
    RESYNC --> END

    style START fill:#e1f5ff
    style BLOCKEND fill:#fff4e1
    style VALID fill:#c8e6c9
    style INVALID fill:#ffcdd2
    style NATIVEHASH fill:#f3e5f5
```

**Key Hashing Concepts:**

1. **User-Level Tracking** (`GCRTracker`):
   - Every GCR_Main change triggers hash update
   - SHA256 of entire user record
   - Fast change detection per user
   - File: `gcrStateSaverHelper.ts:25-51`

2. **Block-Level Tracking** (`GCRHashes`):
   - Snapshot of all native tables at block N
   - Deterministic ordering (ASC by primary key)
   - Combined hash of:
     - `native_gcr`: GCRTracker table hash
     - `native_subnets_txs`: GCRSubnetsTxs table hash
   - File: `hashGCR.ts:70-103`

3. **Hash Structure** (`NativeTablesHashes`):
   ```typescript
   {
     native_gcr: string,       // SHA256 of GCRTracker
     native_subnets_txs: string // SHA256 of GCRSubnetsTxs
   }
   ```

4. **Cryptographic Security**:
   - Every GCR property traces back to Operations
   - Operations derive from Transactions
   - Transactions are in blocks with consensus
   - **Result**: GCR is cryptographically secure despite being mutable

5. **Use Cases**:
   - **Sync validation**: Verify node state matches network
   - **Consensus verification**: Validators check state agreement
   - **Rollback detection**: Identify unauthorized state changes
   - **State snapshots**: Quick state export/import

## 10. Complete GCR Update Lifecycle

```mermaid
stateDiagram-v2
    [*] --> TxCreated: User creates transaction

    state TxCreated {
        [*] --> DefineGCREdits
        DefineGCREdits --> SignTx
        SignTx --> BroadcastTx
        BroadcastTx --> [*]
    }

    TxCreated --> TxReceived: Network receives TX

    state TxReceived {
        [*] --> ValidateSignature
        ValidateSignature --> CheckNonce
        CheckNonce --> AddToMempool
        AddToMempool --> [*]
    }

    TxReceived --> TxInBlock: Proposer includes in block

    state TxInBlock {
        [*] --> BlockProposed
        BlockProposed --> ValidatorValidation
        ValidatorValidation --> ConsensusReached
        ConsensusReached --> [*]
    }

    TxInBlock --> GCRProcessing: Block confirmed

    state GCRProcessing {
        [*] --> ExtractGCREdits

        ExtractGCREdits --> CheckTxExists
        CheckTxExists --> AlreadyExecuted: TX found
        CheckTxExists --> NewTransaction: TX not found

        AlreadyExecuted --> [*]: Reject

        state NewTransaction {
            [*] --> ProcessEdits

            state ProcessEdits {
                [*] --> ProcessEdit

                state ProcessEdit {
                    [*] --> RouteByType
                    RouteByType --> BalanceRoutine: type balance
                    RouteByType --> NonceRoutine: type nonce
                    RouteByType --> IdentityRoutine: type identity

                    state BalanceRoutine {
                        [*] --> CheckRollback_B
                        CheckRollback_B --> ReverseOp_B: isRollback
                        CheckRollback_B --> NormalOp_B: !isRollback
                        ReverseOp_B --> ExecuteBalance
                        NormalOp_B --> ExecuteBalance
                        ExecuteBalance --> ValidateBalance
                        ValidateBalance --> Success_B: valid
                        ValidateBalance --> Failed_B: invalid
                        Success_B --> [*]
                        Failed_B --> [*]
                    }

                    state NonceRoutine {
                        [*] --> CheckRollback_N
                        CheckRollback_N --> ReverseOp_N: isRollback
                        CheckRollback_N --> NormalOp_N: !isRollback
                        ReverseOp_N --> ExecuteNonce
                        NormalOp_N --> ExecuteNonce
                        ExecuteNonce --> Success_N
                        Success_N --> [*]
                    }

                    state IdentityRoutine {
                        [*] --> DetermineSubtype
                        DetermineSubtype --> XMIdentity: xm add or remove
                        DetermineSubtype --> Web2Identity: web2 add or remove
                        DetermineSubtype --> PQCIdentity: pqc add or remove

                        XMIdentity --> VerifyXMSignature
                        Web2Identity --> VerifyWeb2Proof
                        PQCIdentity --> VerifyPQCSignature

                        VerifyXMSignature --> CheckFirstLink
                        VerifyWeb2Proof --> CheckFirstLink
                        VerifyPQCSignature --> CheckFirstLink

                        CheckFirstLink --> AwardIncentive: first time
                        CheckFirstLink --> SkipIncentive: already linked

                        AwardIncentive --> SaveIdentity
                        SkipIncentive --> SaveIdentity

                        SaveIdentity --> Success_I
                        Success_I --> [*]
                    }

                    BalanceRoutine --> CheckResult
                    NonceRoutine --> CheckResult
                    IdentityRoutine --> CheckResult

                    CheckResult --> TrackApplied: success
                    CheckResult --> TriggerRollback: failure

                    TrackApplied --> [*]
                    TriggerRollback --> [*]
                }

                ProcessEdit --> MoreEdits: edit processed

                MoreEdits --> ProcessEdit: yes
                MoreEdits --> AllEditsApplied: no

                AllEditsApplied --> [*]
            }

            ProcessEdits --> EditsFailed: any edit failed
            ProcessEdits --> EditsSuccess: all succeeded

            state EditsFailed {
                [*] --> ReverseAppliedEdits
                ReverseAppliedEdits --> ReapplyWithRollback
                ReapplyWithRollback --> RollbackComplete
                RollbackComplete --> [*]
            }

            EditsFailed --> [*]: TX rejected
            EditsSuccess --> UpdateState
        }

        UpdateState --> PersistGCRMain
        PersistGCRMain --> HashUserState
        HashUserState --> UpdateGCRTracker
        UpdateGCRTracker --> [*]
    }

    GCRProcessing --> StateTracked: GCR updated

    state StateTracked {
        [*] --> UserHashUpdated
        UserHashUpdated --> BlockComplete
        BlockComplete --> [*]
    }

    StateTracked --> BlockHashing: Block finalized

    state BlockHashing {
        [*] --> HashAllTables
        HashAllTables --> CombineHashes
        CombineHashes --> InsertGCRHash
        InsertGCRHash --> [*]
    }

    BlockHashing --> [*]: State finalized

    note right of GCRProcessing
        Core GCR processing:
        - Extract GCR edits from TX
        - Route each edit by type
        - Apply with rollback support
        - Track applied edits
        - Rollback on any failure

        Files:
        - handleGCR.ts:240-420
        - GCRBalanceRoutines.ts
        - GCRNonceRoutines.ts
        - GCRIdentityRoutines.ts
    end note

    note right of StateTracked
        State tracking:
        - User hash: SHA256 of GCR_Main record
        - Stored in GCRTracker table
        - Block hash: Combined native table hashes
        - Stored in GCRHashes table

        Files:
        - gcrStateSaverHelper.ts:25-51
        - hashGCR.ts:70-103
    end note

    note right of IdentityRoutine
        Identity incentives:
        - XM: walletLinked (per chain)
        - Web2: twitterLinked, githubLinked,
          telegramLinked, discordLinked
        - Only awarded on first-time link
        - Points stored in GCR_Main.points

        File: IncentiveManager.ts
    end note
```

---

## Key File References

### Core GCR Files
- **GCR Main Class**: `src/libs/blockchain/gcr/gcr.ts` (40,673 bytes)
- **HandleGCR**: `src/libs/blockchain/gcr/handleGCR.ts` (18,809 bytes)

### GCR Routines
- **Balance**: `src/libs/blockchain/gcr/gcr_routines/GCRBalanceRoutines.ts` (3,216 bytes)
- **Nonce**: `src/libs/blockchain/gcr/gcr_routines/GCRNonceRoutines.ts` (2,204 bytes)
- **Identity**: `src/libs/blockchain/gcr/gcr_routines/GCRIdentityRoutines.ts` (27,607 bytes)
- **Incentives**: `src/libs/blockchain/gcr/gcr_routines/IncentiveManager.ts` (3,729 bytes)
- **Identity Manager**: `src/libs/blockchain/gcr/gcr_routines/identityManager.ts` (10,599 bytes)
- **Hashing**: `src/libs/blockchain/gcr/gcr_routines/hashGCR.ts` (3,830 bytes)
- **State Saver**: `src/libs/blockchain/gcr/gcr_routines/gcrStateSaverHelper.ts` (2,160 bytes)
- **JSONB Handler**: `src/libs/blockchain/gcr/gcr_routines/gcrJSONBHandler.ts` (2,505 bytes)
- **Ensure User**: `src/libs/blockchain/gcr/gcr_routines/ensureGCRForUser.ts` (1,031 bytes)
- **Native Operations**: `src/libs/blockchain/gcr/gcr_routines/handleNativeOperations.ts` (2,541 bytes)
- **Manage Native**: `src/libs/blockchain/gcr/gcr_routines/manageNative.ts` (2,775 bytes)
- **Apply Operation**: `src/libs/blockchain/gcr/gcr_routines/applyGCROperation.ts` (1,587 bytes)

### Database Entities
- **GCR_Main**: `src/model/entities/GCRv2/GCR_Main.ts` (75 lines)
- **GCRTracker**: `src/model/entities/GCR/GCRTracker.ts` (23 lines)
- **GCRHashes**: `src/model/entities/GCRv2/GCRHashes.ts` (17 lines)
- **GCRSubnetsTxs**: `src/model/entities/GCRv2/GCRSubnetsTxs.ts` (29 lines)
- **GlobalChangeRegistry**: `src/model/entities/GCR/GlobalChangeRegistry.ts` (43 lines - legacy)

### Type Definitions
- **GCROperations**: `src/libs/blockchain/gcr/types/GCROperations.ts`
- **GCREdit**: `@kynesyslabs/demosdk/types` (balance, nonce, identity, assign, subnetsTx)
- **Transaction**: `@kynesyslabs/demosdk/types` (content.gcr_edits field)

---

## GCR Architecture Principles

1. **Cryptographic Security**: Every GCR property traces back to Operations, which derive from Transactions in consensus-validated blocks

2. **Atomic Operations**: All GCR edits in a transaction must succeed together or all fail together (rollback support)

3. **Idempotency**: Transactions are checked for existence before processing to prevent duplicate execution

4. **State Tracking**: User-level and block-level hashing enables efficient sync validation and rollback detection

5. **Incentive Integration**: First-time identity linking automatically awards points through IncentiveManager

6. **Multi-Chain Support**: Cross-chain (XM) identities support 8 chains: Solana, EVM, MultiversX, TON, XRPL, IBC, NEAR, Bitcoin

7. **Post-Quantum Ready**: PQC identity support for ML-DSA (Dilithium) and SL-DSA (Sphincs+) algorithms

8. **JSONB Flexibility**: Complex nested data structures stored efficiently in PostgreSQL JSONB fields

9. **Rollback Safety**: Every operation can be reversed if needed, maintaining consistency

10. **Simulation Mode**: Test GCR edits without persisting to database (used in pre-consensus validation)
