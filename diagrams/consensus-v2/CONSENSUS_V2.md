# Consensus Mechanism v2 (PoRBFT) - Mermaid Diagrams

## Overview

Consensus v2 implements **PoRBFT** (Proof of Reputation Byzantine Fault Tolerant) consensus. The system uses deterministic shard selection, coordinated validation phases, and Byzantine fault tolerance to achieve secure decentralized consensus.

**Key Features:**
- **7 synchronized validation phases** for all shard members
- **Secretary-based coordination** using green light system
- **CVSA** (Common Validator Seed Algorithm) for deterministic shard selection
- **Byzantine fault tolerance** with 67% threshold
- **Integrated GCR operations** during consensus
- **Automatic failure recovery** and secretary failover

## 1. PoRBFT Consensus Architecture Overview

```mermaid
graph TB
    subgraph "Consensus Entry Point"
        START[consensusRoutine triggered]
        CHECK{Consensus<br/>already running?}
        START --> CHECK
        CHECK -->|yes| SKIP[Skip - already running]
        CHECK -->|no| INIT[Initialize Consensus State]
    end

    subgraph "Core Components"
        INIT --> SECMGR[SecretaryManager.getInstance<br/>blockRef plus 1]
        SECMGR --> CVSA[Get Common Validator Seed<br/>CVSA Algorithm]
        CVSA --> SHARD[Initialize Shard<br/>getShard from CVSA]
    end

    subgraph "Shard Structure"
        SHARD --> SHARDDATA[Shard Object]
        SHARDDATA --> MEMBERS[members: Peer array]
        SHARDDATA --> PHASES[validationPhases: map]
        SHARDDATA --> SECRETARY[secretaryKey: first member]
        SHARDDATA --> BLOCKREF[blockRef: N plus 1]
        SHARDDATA --> CVSAVAL[CVSA: seed string]
    end

    subgraph "Secretary System"
        SECRETARY --> CHECKSECRETARY{Are we<br/>secretary?}
        CHECKSECRETARY -->|yes| SECRETARYROUTINE[Start secretaryRoutine<br/>coordinate shard]
        CHECKSECRETARY -->|no| MEMBER[Regular member<br/>follow secretary]

        SECRETARYROUTINE --> WAITSYSTEM[Waiter System<br/>GREEN_LIGHT and SET_WAIT_STATUS]
        SECRETARYROUTINE --> GREENLIGHTLOGIC[Release waiting members<br/>when all ready]
        SECRETARYROUTINE --> TIMESTAMP[Set block timestamp<br/>Date.now]
    end

    subgraph "7 Validation Phases"
        MEMBER --> PHASE1[Phase 1: enteredConsensus]
        SECRETARYROUTINE --> PHASE1

        PHASE1 --> PHASE2[Phase 2: synchronizedTime]
        PHASE2 --> PHASE3[Phase 3: mergedMempool]
        PHASE3 --> PHASE4[Phase 4: appliedGCR]
        PHASE4 --> PHASE5[Phase 5: forgedBlock]
        PHASE5 --> PHASE6[Phase 6: votedOnBlock]
        PHASE6 --> PHASE7[Phase 7: readyToEndConsensus]
    end

    subgraph "Consensus Actions"
        PHASE1 --> ACTION1[ACTION 1: Initialize shard]
        PHASE3 --> ACTION2[ACTION 2: Merge and order mempools]
        PHASE4 --> ACTION3[ACTION 3: Apply GCR operations]
        PHASE5 --> ACTION4[ACTION 4: Forge block]
        PHASE6 --> ACTION5[ACTION 5: Vote on block]
        PHASE7 --> ACTION6[ACTION 6: Finalize or rollback]
    end

    subgraph "Block Validation & Finalization"
        ACTION5 --> COLLECTVOTES[Collect votes from shard]
        COLLECTVOTES --> CHECKVOTES{Votes greater or equal<br/>67% threshold?}

        CHECKVOTES -->|yes| VALID[Block Valid]
        CHECKVOTES -->|no| INVALID[Block Invalid]

        VALID --> FINALIZE[Finalize block<br/>add to chain]
        INVALID --> ROLLBACK[Rollback GCR edits]

        FINALIZE --> CLEANUP[Cleanup consensus state]
        ROLLBACK --> CLEANUP

        CLEANUP --> END[End consensus routine]
    end

    subgraph "Failure Handling"
        WAITSYSTEM -->|timeout| CHECKOFFLINE[Check offline nodes]
        CHECKOFFLINE --> REMOVEOFFLINE[Remove from shard]
        REMOVEOFFLINE --> RELEASEWAITING[Release waiting members]

        SECRETARY -->|goes offline| ELECTNEW[Elect second member<br/>as new secretary]
        ELECTNEW --> NEWSECRETARYROUTINE[New secretary<br/>starts routine]
    end

    style START fill:#e1f5ff
    style SECMGR fill:#fff4e1
    style CVSA fill:#e8f5e9
    style SECRETARYROUTINE fill:#f3e5f5
    style VALID fill:#c8e6c9
    style INVALID fill:#ffcdd2
    style FINALIZE fill:#c8e6c9
    style ROLLBACK fill:#ffcdd2
```

## 2. Complete Consensus Routine Lifecycle

```mermaid
flowchart TD
    START([Consensus Routine Triggered])

    START --> GUARD{inConsensusLoop<br/>flag set?}
    GUARD -->|yes| RETURN[Return - already running]
    GUARD -->|no| SETFLAG[Set inConsensusLoop true]

    SETFLAG --> GETBLOCKREF[blockRef = lastBlockNumber plus 1]
    GETBLOCKREF --> CREATEMGR[SecretaryManager.getInstance<br/>blockRef, initialize]

    CREATEMGR --> TRYCATCH{Try-Catch-Finally Block}

    subgraph "TRY Block - Main Consensus Flow"
        TRYCATCH --> INITSTATE[initializeConsensusState]
        INITSTATE --> INITSHARD[initializeShard<br/>Phase 1]

        INITSHARD --> CHECKINSH{Are we<br/>in shard?}
        CHECKINSH -->|no| THROW1[Throw NotInShardError]
        CHECKINSH -->|yes| UPDATE1[updateValidatorPhase 1]

        UPDATE1 --> MERGEMEM[mergeAndOrderMempools<br/>Phase 3]
        MERGEMEM --> TEMPPOOL[Store tempMempool]

        TEMPPOOL --> APPLYGCR[applyGCREditsFromMergedMempool<br/>Phase 4]
        APPLYGCR --> CHECKFAILED{Failed<br/>txs exist?}

        CHECKFAILED -->|yes| PRUNEMEMPOOL[Remove failed txs<br/>from mempool]
        CHECKFAILED -->|no| GETTIMESTAMP
        PRUNEMEMPOOL --> GETTIMESTAMP

        GETTIMESTAMP[Get secretary block timestamp]
        GETTIMESTAMP --> TIMESTAMPOK{Timestamp<br/>available?}

        TIMESTAMPOK -->|no| REQUESTTS[Request from secretary]
        TIMESTAMPOK -->|yes| FORGE
        REQUESTTS --> TSAVAIL{Timestamp<br/>resolved?}
        TSAVAIL -->|no| THROW2[Return - cannot resolve]
        TSAVAIL -->|yes| FORGE

        FORGE[forgeBlock<br/>Phase 5]
        FORGE --> VOTE[voteOnBlock<br/>Phase 6]

        VOTE --> COLLECTVOTES[Collect pro and con votes]
        COLLECTVOTES --> CHECKVALID{isBlockValid<br/>pro greater or equal 67%?}

        CHECKVALID -->|yes| FINALIZE[finalizeBlock<br/>add to chain]
        CHECKVALID -->|no| THROW3[Throw BlockInvalidError]

        FINALIZE --> UPDATE7[updateValidatorPhase 7]
    end

    subgraph "CATCH Block - Error Handling"
        THROW1 --> CATCH
        THROW2 --> CATCH
        THROW3 --> CATCH

        CATCH{Error Type?}

        CATCH -->|NotInShardError| LOG1[Log: Not in shard<br/>waiting for block]
        CATCH -->|ForgingEndedError| LOG2[Log: Forging ended<br/>exit routine]
        CATCH -->|BlockInvalidError| ROLLBACKGCR[Rollback GCR edits<br/>from successful txs]
        CATCH -->|other| CRASH[Log error<br/>process.exit 1]

        ROLLBACKGCR --> REMOVETXS[Remove successful txs<br/>from mempool]
        REMOVETXS --> LOG3[Log: Block invalid<br/>rolled back]
    end

    subgraph "FINALLY Block - Cleanup"
        UPDATE7 --> FINALLY
        LOG1 --> FINALLY
        LOG2 --> FINALLY
        LOG3 --> FINALLY
        CRASH --> FINALLY

        FINALLY[Finally - Always Executed]
        FINALLY --> CLEANUP[cleanupConsensusState<br/>set inConsensusLoop false]
        CLEANUP --> ENDMGR[manager.endConsensusRoutine<br/>stop secretary routine]
    end

    ENDMGR --> END([Consensus Routine Complete])
    RETURN -.-> END

    style START fill:#e1f5ff
    style CREATEMGR fill:#fff4e1
    style FINALIZE fill:#c8e6c9
    style ROLLBACKGCR fill:#ffcdd2
    style THROW3 fill:#ffcdd2
    style CLEANUP fill:#f3e5f5
```

## 3. 7 Validation Phases Synchronization

```mermaid
sequenceDiagram
    participant Node as Local Node
    participant Secretary
    participant Shard as Other Shard Members

    Note over Node,Shard: All nodes start consensus routine concurrently

    rect rgb(200, 230, 255)
        Note over Node,Shard: Phase 1: Entered Consensus
        Node->>Node: Initialize shard and manager
        Node->>Secretary: setValidatorPhase 1
        Secretary->>Secretary: Update phase tracking
        Secretary->>Secretary: Check if all members at phase 1
        alt All members ready
            Secretary->>Node: greenlight phase 1
            Secretary->>Shard: greenlight phase 1
        else Some members not ready
            Secretary->>Secretary: Wait for SET_WAIT_STATUS
        end
        Node->>Node: Proceed to next phase
    end

    rect rgb(230, 255, 230)
        Note over Node,Shard: Phase 2: Synchronized Time (skipped in v2)
        Node->>Secretary: setValidatorPhase 2
        Secretary->>Node: greenlight phase 2
    end

    rect rgb(255, 245, 230)
        Note over Node,Shard: Phase 3: Merged Mempool
        Node->>Shard: Send local mempool
        Shard->>Node: Receive remote mempools
        Node->>Node: Merge all mempools
        Node->>Node: Order transactions by timestamp
        Node->>Secretary: setValidatorPhase 3
        Secretary->>Secretary: Wait for all members
        Secretary->>Node: greenlight phase 3
        Secretary->>Shard: greenlight phase 3
    end

    rect rgb(245, 230, 255)
        Note over Node,Shard: Phase 4: Applied GCR
        Node->>Node: Apply GCR edits from mempool
        Node->>Node: Track successful and failed txs
        Node->>Node: Prune failed txs from mempool
        Node->>Secretary: setValidatorPhase 4
        Secretary->>Node: greenlight phase 4
    end

    rect rgb(255, 235, 245)
        Note over Node,Shard: Phase 5: Forged Block
        Node->>Node: Create block with ordered txs
        Node->>Node: Hash native tables (GCR)
        Node->>Node: Sign block hash
        Node->>Node: Calculate next proposer (CVSA)
        Node->>Secretary: setValidatorPhase 5
        Secretary->>Node: greenlight phase 5
    end

    rect rgb(230, 245, 255)
        Note over Node,Shard: Phase 6: Voted On Block
        Node->>Shard: Broadcast block hash and signature
        Shard->>Node: Return signatures if hash matches
        Node->>Node: Verify all incoming signatures
        Node->>Node: Add valid signatures to block
        Node->>Node: Count pro and con votes
        Node->>Secretary: setValidatorPhase 6
        Secretary->>Node: greenlight phase 6
    end

    rect rgb(200, 255, 230)
        Note over Node,Shard: Phase 7: Ready to End Consensus
        Node->>Node: Check if block valid (67% votes)
        alt Block Valid
            Node->>Node: Finalize block - add to chain
        else Block Invalid
            Node->>Node: Rollback GCR edits
            Node->>Node: Remove txs from mempool
        end
        Node->>Secretary: setValidatorPhase 7
        Secretary->>Secretary: Stop secretary routine
        Secretary->>Node: greenlight phase 7
        Note over Node,Shard: End consensus routine
    end
```

## 4. CVSA - Common Validator Seed Algorithm

```mermaid
flowchart TD
    START([CVSA Calculation])

    START --> INPUT{Input<br/>provided?}
    INPUT -->|lastBlock provided| USELAST[Use provided lastBlock]
    INPUT -->|no input| GETLAST[Chain.getLastBlock]

    USELAST --> BLOCKCOUNT
    GETLAST --> BLOCKCOUNT[blockCount = 3]

    BLOCKCOUNT --> ARRAY[lastFewBlocks = empty array]
    ARRAY --> ADDLAST[Add lastBlock to array]

    ADDLAST --> LOOP{array.length<br/>less than 3?}
    LOOP -->|yes| GETPREV[Get block N minus array.length]
    LOOP -->|no| GENESIS

    GETPREV --> EXISTS{Block<br/>exists?}
    EXISTS -->|yes| ADDTOARRAY[Add to array]
    EXISTS -->|no| GENESIS
    ADDTOARRAY --> LOOP

    GENESIS[Get genesis block hash]
    GENESIS --> GENEXISTS{Genesis<br/>exists?}

    GENEXISTS -->|no and lastBlock is 0| USELASTGEN[Use lastBlock.hash as genesis]
    GENEXISTS -->|no and lastBlock not 0| THROW[Throw: Genesis not found]
    GENEXISTS -->|yes| BUILD
    USELASTGEN --> BUILD

    BUILD["Build hash string<br/>hash1:number1 | hash2:number2 | hash3:number3 | genesis:genesisHash"]

    BUILD --> EXAMPLE["Example<br/>abc123:100 | def456:99 | ghi789:98 | genesis:000genesis"]

    EXAMPLE --> SHA256[Calculate SHA256 of hash string]
    SHA256 --> RESULT[commonValidatorSeed]

    RESULT --> SECURITY[Security Properties]

    subgraph "Security Guarantees"
        SECURITY --> PROP1[Block hashes commit to<br/>complete block content]
        SECURITY --> PROP2[Genesis hash anchors<br/>entire chain history]
        SECURITY --> PROP3[Block numbers ensure<br/>sequential integrity]
        SECURITY --> PROP4[SHA256 provides<br/>collision resistance]

        PROP1 --> ATTACK1[Attack: Block Content Manipulation<br/>PREVENTED - changes hash]
        PROP2 --> ATTACK2[Attack: Genesis Substitution<br/>PREVENTED - different CVSA]
        PROP3 --> ATTACK3[Attack: Block Number Manipulation<br/>PREVENTED - breaks sequence]
        PROP4 --> ATTACK4[Attack: Chain Fork<br/>REQUIRES Byzantine majority 67%]
    end

    RESULT --> USAGE[Usage: Deterministic Shard Selection]
    USAGE --> END([Return CVSA and lastBlockNumber])

    style START fill:#e1f5ff
    style RESULT fill:#c8e6c9
    style SHA256 fill:#fff4e1
    style SECURITY fill:#f3e5f5
    style ATTACK1 fill:#ffcdd2
    style ATTACK2 fill:#ffcdd2
    style ATTACK3 fill:#ffcdd2
    style ATTACK4 fill:#ffe0b2
```

## 5. Shard Selection & Secretary Election

```mermaid
flowchart TD
    START([getShard with CVSA seed])

    START --> GETPEERS[PeerManager.getInstance<br/>getOnlinePeers]
    GETPEERS --> FILTERSYNCED[Filter peers<br/>where sync.status is true]

    FILTERSYNCED --> CHECKCOUNT{Peer count<br/>less than shardSize?}
    CHECKCOUNT -->|yes| ADJUSTSIZE[maxShardSize = peer count]
    CHECKCOUNT -->|no| USECONFIGURED[maxShardSize = configured value]

    ADJUSTSIZE --> INITRANDOM
    USECONFIGURED --> INITRANDOM[Initialize Alea PRNG<br/>with CVSA seed]

    INITRANDOM --> COPY[availablePeers = copy of peers]
    COPY --> SORT[Sort availablePeers by identity<br/>lexicographic order]

    SORT --> LOOPSTART[shard = empty array]
    LOOPSTART --> LOOPCHECK{i less than maxShardSize<br/>and peers available?}

    LOOPCHECK -->|no| VALIDATE
    LOOPCHECK -->|yes| RANDOM[index = floor of<br/>random times availablePeers.length]

    RANDOM --> SELECT[Add availablePeers at index to shard]
    SELECT --> REMOVE[Remove selected peer from availablePeers]
    REMOVE --> INCREMENT[i plus plus]
    INCREMENT --> LOOPCHECK

    VALIDATE{Shard size<br/>less than 3?}
    VALIDATE -->|yes| WARN[Log warning:<br/>Security issue with small shard]
    VALIDATE -->|no| SECRETARY
    WARN --> SECRETARY

    SECRETARY[Secretary Election]
    SECRETARY --> FIRST[Secretary = shard member at index 0]

    FIRST --> PROPERTIES[Shard Properties]

    subgraph "Shard Object Structure"
        PROPERTIES --> PROP1[CVSA: seed string]
        PROPERTIES --> PROP2[members: Peer array]
        PROPERTIES --> PROP3[secretaryKey: first member identity]
        PROPERTIES --> PROP4[blockRef: N plus 1]
        PROPERTIES --> PROP5[validationPhases: map of member states]
    end

    subgraph "Deterministic Properties"
        FIRST --> DET1[Same CVSA seed produces<br/>same shard selection]
        DET1 --> DET2[All synced nodes<br/>calculate identical CVSA]
        DET2 --> DET3[Secretary always first<br/>in deterministic order]
        DET3 --> DET4[Malicious nodes produce<br/>different CVSA if unsynced]
    end

    subgraph "Secretary Responsibilities"
        SECRETARY --> RESP1[Coordinate validation phases]
        RESP1 --> RESP2[Track member progress]
        RESP2 --> RESP3[Release green lights]
        RESP3 --> RESP4[Set block timestamp]
        RESP4 --> RESP5[Handle offline nodes]
        RESP5 --> RESP6[Manage semaphore system]
    end

    PROP5 --> RETURN([Return shard array])

    style START fill:#e1f5ff
    style INITRANDOM fill:#fff4e1
    style SECRETARY fill:#f3e5f5
    style FIRST fill:#c8e6c9
    style WARN fill:#ffe0b2
```

## 6. Secretary-Member Coordination (Green Light System)

```mermaid
stateDiagram-v2
    [*] --> Member_WaitPhase: Member completes phase work

    state "Member State" as Member {
        Member_WaitPhase: Member sets waitStatus = true
        Member_SendPhase: Send setValidatorPhase to secretary
        Member_CreateWaiter: Create GREEN_LIGHT waiter with timeout
        Member_WaitGreenLight: Wait for green light or timeout

        Member_WaitPhase --> Member_SendPhase
        Member_SendPhase --> Member_CreateWaiter
        Member_CreateWaiter --> Member_WaitGreenLight

        state Member_WaitGreenLight {
            [*] --> Waiting
            Waiting --> Resolved: Secretary sends greenlight
            Waiting --> Timeout: 30s timeout expires
            Waiting --> PreHeld: Greenlight arrived early
        }
    end

    state "Secretary State" as Secretary {
        Sec_ReceivePhase: Receive setValidatorPhase from member
        Sec_UpdateTracking: Update validationPhases map
        Sec_CheckBehind: Check if member behind us
        Sec_ReleaseBehind: Release if behind
        Sec_CheckAllReady: Check if all members ready
        Sec_ReleaseAll: Release all waiting members
        Sec_WaitMore: Wait for more members

        Sec_ReceivePhase --> Sec_UpdateTracking
        Sec_UpdateTracking --> Sec_CheckBehind

        state Sec_CheckBehind {
            [*] --> Check
            Check --> Behind: Member phase less than ours
            Check --> SameOrAhead: Member phase greater or equal
            Behind --> [*]: Release member immediately
            SameOrAhead --> CheckReady
        }

        Sec_CheckBehind --> Sec_CheckAllReady
        Sec_CheckAllReady --> Sec_ReleaseAll: All at same phase
        Sec_CheckAllReady --> Sec_WaitMore: Some not ready

        state Sec_ReleaseAll {
            [*] --> ResolveWaiter
            ResolveWaiter: Resolve SET_WAIT_STATUS waiter
            ResolveWaiter --> SendGreenlights
            SendGreenlights: Send greenlight RPC to all members
            SendGreenlights --> UpdateWaitStatus
            UpdateWaitStatus: Set waitStatus = false for all
            UpdateWaitStatus --> [*]
        }

        state Sec_WaitMore {
            [*] --> WaitSETWAIT
            WaitSETWAIT: Wait for SET_WAIT_STATUS
            WaitSETWAIT --> TimeoutCheck: 15s timeout
            WaitSETWAIT --> NextMember: Another member updates

            state TimeoutCheck {
                [*] --> PingOffline
                PingOffline: Ping missing members
                PingOffline --> RemoveOffline: Remove offline nodes
                RemoveOffline --> ReleaseRemaining: Release online members
                ReleaseRemaining --> [*]
            }
        }
    end

    state "Greenlight Received" as Received {
        Recv_CheckPhase: Check if phase matches
        Recv_UpdateTimestamp: Update blockTimestamp if newer
        Recv_ResolveWaiter: Resolve GREEN_LIGHT waiter
        Recv_SetWaitFalse: Set waitStatus = false

        [*] --> Recv_CheckPhase
        Recv_CheckPhase --> Recv_UpdateTimestamp: Phase matches
        Recv_CheckPhase --> Recv_PreHold: Phase higher than ours
        Recv_CheckPhase --> Recv_Ignore: Phase lower than ours
        Recv_UpdateTimestamp --> Recv_ResolveWaiter
        Recv_ResolveWaiter --> Recv_SetWaitFalse
        Recv_SetWaitFalse --> [*]

        Recv_PreHold: PreHold for future phase
        Recv_Ignore: Ignore stale greenlight
    }

    state "Secretary Failover" as Failover {
        Detect_Offline: Member timeout waiting for greenlight
        Ping_Secretary: Ping secretary twice
        Check_Response: Check if online
        Elect_New: Elect second member as secretary
        Start_New_Routine: New secretary starts routine
        Sync_Phases: New secretary requests all member phases

        [*] --> Detect_Offline
        Detect_Offline --> Ping_Secretary
        Ping_Secretary --> Check_Response
        Check_Response --> Elect_New: Both pings fail
        Check_Response --> [*]: Secretary responds
        Elect_New --> Start_New_Routine
        Start_New_Routine --> Sync_Phases
        Sync_Phases --> [*]
    }

    Member_WaitGreenLight --> Received: Greenlight arrives
    Member_WaitGreenLight --> Failover: Timeout expires
    Sec_ReleaseAll --> Received: Members receive
    Failover --> Secretary: New secretary elected

    Received --> [*]: Proceed to next phase

    note right of Secretary
        Secretary Routine Loop:
        1. Wait for SET_WAIT_STATUS
        2. Check if all members ready
        3. Release if ready, else timeout
        4. Handle offline nodes
        5. Repeat until phase 7
    end note

    note right of Member
        Member Coordination:
        1. Complete phase work
        2. Send phase to secretary
        3. Wait for greenlight
        4. Proceed or handle timeout
    end note
```

## 7. Mempool Merging & Transaction Ordering

```mermaid
flowchart TD
    START([mergeAndOrderMempools])

    START --> GETLOCAL[Get local mempool<br/>Mempool.getMempool blockRef]
    GETLOCAL --> LOG1[Log: Our mempool retrieved]

    LOG1 --> CREATEPROMISES[Create array of RPC promises]
    CREATEPROMISES --> LOOP{For each<br/>shard member}

    LOOP -->|yes| CREATECALL[Create longCall RPC request]
    CREATECALL --> ADDPROMISE[Add to promises array]
    ADDPROMISE --> LOOP

    subgraph "RPC Call Structure"
        CREATECALL --> METHOD["method: mempool"]
        CREATECALL --> PARAMS["params: local mempool data"]
        CREATECALL --> RETRY["retry: 3 times, 250ms delay"]
    end

    LOOP -->|no| SENDALL[Promise.all - wait for all responses]

    SENDALL --> PROCESSRESP{For each<br/>response}

    PROCESSRESP -->|more| CHECKSTATUS{Response<br/>result is 200?}
    PROCESSRESP -->|done| UPDATE

    CHECKSTATUS -->|yes| RECEIVEMEM[Mempool.receive<br/>remote mempool]
    CHECKSTATUS -->|no| LOGERROR[Log error response]

    RECEIVEMEM --> MERGE[Merge into local mempool<br/>avoid duplicates by hash]
    LOGERROR --> PROCESSRESP
    MERGE --> PROCESSRESP

    UPDATE[updateValidatorPhase 3]
    UPDATE --> GETMERGED[Get merged mempool<br/>Mempool.getMempool blockRef]

    GETMERGED --> ORDER[orderTransactions]

    subgraph "Transaction Ordering"
        ORDER --> SORT[Sort by timestamp ascending]
        SORT --> EXAMPLE["Example<br/>tx1 timestamp 1000<br/>tx2 timestamp 1001<br/>tx3 timestamp 999<br/>Result: tx3, tx1, tx2"]
    end

    SORT --> RETURN([Return ordered transactions])

    subgraph "Mempool Structure"
        GETLOCAL --> STRUCTURE["Mempool Data<br/>transactions array<br/>each tx has hash and timestamp"]
        MERGE --> DEDUP[Deduplication by hash<br/>if hash exists skip]
        DEDUP --> STORE[Store in mempool_v2 table<br/>with blockNumber reference]
    end

    style START fill:#e1f5ff
    style MERGE fill:#c8e6c9
    style ORDER fill:#fff4e1
    style RETURN fill:#c8e6c9
```

## 8. Block Forging & Voting

```mermaid
sequenceDiagram
    participant Node as Local Node
    participant Manager as SecretaryManager
    participant GCR as GCR System
    participant Block as Block Creation
    participant Shard as Shard Members

    Note over Node,Shard: Phase 5 - Forge Block

    Node->>Node: Get previous block hash
    Node->>Node: Calculate CVSA for current block
    Node->>Block: createBlock(orderedTxs, CVSA, prevHash, blockNumber)

    Block->>GCR: hashGCRTables()
    GCR->>GCR: Hash GCRTracker table (SHA256)
    GCR->>GCR: Hash GCRSubnetsTxs table (SHA256)
    GCR->>Block: Return native_tables_hashes

    Block->>Manager: Get lastConsensusTime
    Manager->>Block: Return secretary block timestamp
    Block->>Block: Set block.content.timestamp

    Block->>Block: Create block.content structure
    Note right of Block: ordered_transactions: hashes<br/>previousHash<br/>peerlist<br/>timestamp<br/>native_tables_hashes

    Block->>Block: Calculate block.hash = SHA256(content)
    Block->>Block: Sign block hash with ed25519
    Block->>Block: Add signature to validation_data

    Block->>Node: Calculate next proposer (CVSA of this block)
    Node->>Node: Set block.next_proposer
    Node->>Node: Store as candidateBlock in sharedState

    Node->>Manager: updateValidatorPhase(5)
    Manager->>Node: Wait for greenlight

    Note over Node,Shard: Phase 6 - Vote On Block

    Node->>Shard: broadcastBlockHash(block, shard)
    Note right of Node: RPC: proposeBlockHash<br/>params: hash, validation_data, ourId

    loop For each shard member
        Shard->>Shard: Check if in consensus mode
        Shard->>Shard: Verify we are in same shard
        Shard->>Shard: Compare our block.hash with proposed

        alt Hashes match
            Shard->>Shard: Sign block hash
            Shard->>Node: Return 200 with signature
            Node->>Node: Verify signature with ed25519
            alt Signature valid
                Node->>Node: Add signature to block.validation_data
                Node->>Node: Increment pro vote count
            else Signature invalid
                Node->>Node: Log error - reject signature
            end
        else Hashes do not match
            Shard->>Node: Return error code
            Node->>Node: Increment con vote count
        end
    end

    Node->>Node: Wait for all promises to resolve
    Node->>Node: Count total valid signatures
    Node->>Manager: updateValidatorPhase(6)

    Note over Node,Shard: Determine Block Validity

    Node->>Node: Calculate: signatureCount / shardSize
    Node->>Node: Check if ratio greater or equal 0.67 (67%)

    alt Block Valid (67%+ votes)
        Node->>Node: Mark block as valid
        Note right of Node: Proceed to finalization
    else Block Invalid (less than 67%)
        Node->>Node: Mark block as invalid
        Note right of Node: Trigger rollback
    end
```

## 9. GCR Integration in Consensus

```mermaid
flowchart TD
    START([applyGCREditsFromMergedMempool])

    START --> INIT[Initialize arrays<br/>successfulTxs and failedTxs]
    INIT --> LOOP{For each tx<br/>in mempool}

    LOOP -->|more txs| CHECKEXISTS{Does tx<br/>exist in chain?}
    LOOP -->|done| PHASE4

    CHECKEXISTS -->|yes| ADDFAILED[Add tx.hash to failedTxs]
    CHECKEXISTS -->|no| GETEDITS[Extract tx.content.gcr_edits]

    ADDFAILED --> LOOP

    GETEDITS --> LOOPEDITS{For each<br/>GCREdit}

    LOOPEDITS -->|more edits| APPLYEDIT[HandleGCR.apply edit, tx]
    LOOPEDITS -->|done| LOOP

    APPLYEDIT --> CHECKRESULT{Apply<br/>successful?}

    CHECKRESULT -->|yes| ADDSUCCESS[Add tx.hash to successfulTxs]
    CHECKRESULT -->|no| ADDFAIL[Add tx.hash to failedTxs]

    ADDSUCCESS --> LOOPEDITS
    ADDFAIL --> LOOPEDITS

    PHASE4[updateValidatorPhase 4]
    PHASE4 --> RETURNRESULT([Return successfulTxs, failedTxs])

    subgraph "Caller Processing"
        RETURNRESULT --> CHECKCALLER{Failed txs<br/>exist?}
        CHECKCALLER -->|yes| PRUNE[Remove failed txs from mempool]
        CHECKCALLER -->|no| CONTINUE
        PRUNE --> CONTINUE[Continue to forge block]
    end

    subgraph "Rollback on Block Invalid"
        CONTINUE --> FORGE[Forge block with successful txs]
        FORGE --> VOTE[Vote on block]
        VOTE --> INVALID{Block<br/>invalid?}

        INVALID -->|yes| ROLLBACKSTART[rollbackGCREditsFromTxs]
        INVALID -->|no| FINALIZE[Finalize block]

        ROLLBACKSTART --> ROLLBACKLOOP{For each<br/>successful tx}
        ROLLBACKLOOP -->|more| ROLLBACKAPPLY[HandleGCR.applyToTx<br/>tx, isRollback true]
        ROLLBACKLOOP -->|done| REMOVETXS

        ROLLBACKAPPLY --> ROLLBACKCHECK{Rollback<br/>success?}
        ROLLBACKCHECK -->|yes| TRACKROLLBACK[Track rollback success]
        ROLLBACKCHECK -->|no| TRACKFAIL[Track rollback failure]

        TRACKROLLBACK --> ROLLBACKLOOP
        TRACKFAIL --> ROLLBACKLOOP

        REMOVETXS[Remove successful txs from mempool]
        REMOVETXS --> ROLLBACKDONE[Rollback complete]
    end

    subgraph "GCREdit Routing"
        APPLYEDIT --> ROUTETYPE{Edit<br/>type?}

        ROUTETYPE -->|balance| BALROUTINE[GCRBalanceRoutines.apply]
        ROUTETYPE -->|nonce| NONCEROUTINE[GCRNonceRoutines.apply]
        ROUTETYPE -->|identity| IDROUTINE[GCRIdentityRoutines.apply]

        BALROUTINE --> OPERATION{Operation?}
        OPERATION -->|add| BALADD[Add to balance]
        OPERATION -->|remove| BALCHECK{Sufficient<br/>balance?}
        BALCHECK -->|yes| BALREM[Remove from balance]
        BALCHECK -->|no| BALFAIL[Return failure]

        BALADD --> BALSAVE[Save to GCR_Main]
        BALREM --> BALSAVE
        BALSAVE --> BALSUCCESS[Return success]
    end

    style START fill:#e1f5ff
    style APPLYEDIT fill:#fff4e1
    style RETURNRESULT fill:#c8e6c9
    style ROLLBACKSTART fill:#ffcdd2
    style FINALIZE fill:#c8e6c9
```

## 10. Failure Handling & Recovery

```mermaid
stateDiagram-v2
    [*] --> Normal: Consensus running normally

    state "Normal Operation" as Normal {
        [*] --> AllOnline
        AllOnline: All shard members online
        AllOnline --> PhaseSync: Members progress through phases
        PhaseSync --> GreenLight: Secretary releases green lights
        GreenLight --> NextPhase: All proceed together
        NextPhase --> AllOnline
    }

    Normal --> MemberOffline: Member timeout detected
    Normal --> SecretaryOffline: Secretary timeout detected
    Normal --> MemberLate: Member slow or stuck
    Normal --> NetworkIssue: Network partition

    state "Member Offline Detection" as MemberOffline {
        [*] --> SecretaryWait
        SecretaryWait: Secretary waits for SET_WAIT_STATUS
        SecretaryWait --> Timeout: 15s timeout expires
        Timeout --> IdentifyMissing: Get list of non-waiting members
        IdentifyMissing --> PingMissing: Ping each missing member

        state PingMissing {
            [*] --> SendPing
            SendPing: member.connect()
            SendPing --> CheckResponse: Wait for response
            CheckResponse --> Online: Response received
            CheckResponse --> Offline: No response
        }

        PingMissing --> ProcessResults: Collect ping results
        ProcessResults --> RemoveOffline: Remove offline members from shard
        RemoveOffline --> UpdatePhases: Delete validationPhases for offline
        UpdatePhases --> ReleaseOnline: Release remaining online members
        ReleaseOnline --> [*]: Continue consensus
    }

    state "Secretary Offline Detection" as SecretaryOffline {
        [*] --> MemberTimeout
        MemberTimeout: Member timeout waiting for greenlight
        MemberTimeout --> PingSecretary: Ping secretary
        PingSecretary --> FirstPing: First attempt
        FirstPing --> SecondPing: Retry for false negative

        state SecondPing {
            [*] --> Check
            Check --> StillOffline: Both pings fail
            Check --> FalseAlarm: Second ping succeeds
            FalseAlarm --> [*]: Continue waiting
        }

        SecondPing --> ElectNew: Secretary confirmed offline
        ElectNew: Elect second member as new secretary
        ElectNew --> CheckIfUs: Are we the new secretary?

        state CheckIfUs {
            [*] --> WeAreSecretary
            [*] --> WeAreNotSecretary

            WeAreSecretary --> StartRoutine: Start secretaryRoutine
            StartRoutine --> SyncState: Request phases from all members
            SyncState --> InheritTimestamp: Use original secretary timestamp
            InheritTimestamp --> [*]: Resume coordination

            WeAreNotSecretary --> UpdateSecretary: Update secretary reference
            UpdateSecretary --> ResendPhase: Send phase to new secretary
            ResendPhase --> [*]: Wait for new greenlight
        }
    end

    state "Member Late or Stuck" as MemberLate {
        [*] --> Behind
        Behind: Member phase less than current phase
        Behind --> SecretaryReceives: Secretary receives old phase
        SecretaryReceives --> ImmediateRelease: Release member immediately
        ImmediateRelease --> MemberCatchesUp: Member proceeds to current phase
        MemberCatchesUp --> [*]: Rejoins at current phase
    }

    state "Network Partition" as NetworkIssue {
        [*] --> PartitionDetected
        PartitionDetected: Members cannot reach each other
        PartitionDetected --> SplitShard: Shard splits into partitions

        state SplitShard {
            [*] --> Partition1
            [*] --> Partition2

            Partition1: Partition with secretary
            Partition1 --> RemoveUnreachable1: Remove unreachable members
            RemoveUnreachable1 --> ContinueIfQuorum1: Check if 67% threshold met
            ContinueIfQuorum1 --> Success1: Continue consensus
            ContinueIfQuorum1 --> Fail1: Abort - insufficient members

            Partition2: Partition without secretary
            Partition2 --> ElectNewSecretary: Elect new secretary from partition
            ElectNewSecretary --> RemoveUnreachable2: Remove unreachable members
            RemoveUnreachable2 --> ContinueIfQuorum2: Check if 67% threshold met
            ContinueIfQuorum2 --> Success2: Continue consensus
            ContinueIfQuorum2 --> Fail2: Abort - insufficient members
        }

        SplitShard --> Rejoin: Network heals
        Rejoin --> Resync: Nodes resync blockchain state
        Resync --> [*]: Return to normal
    }

    state "Block Invalid Rollback" as BlockInvalid {
        [*] --> VotingComplete
        VotingComplete: Less than 67% votes for block
        VotingComplete --> RollbackGCR: Rollback all successful GCR edits
        RollbackGCR --> ReverseEdits: Apply edits with isRollback true
        ReverseEdits --> RemoveTxs: Remove txs from mempool
        RemoveTxs --> CleanupState: Cleanup consensus state
        CleanupState --> [*]: Wait for next consensus round
    }

    MemberOffline --> Normal: Members removed, continue
    SecretaryOffline --> Normal: New secretary elected
    MemberLate --> Normal: Member catches up
    NetworkIssue --> Normal: Network heals

    Normal --> BlockInvalid: Block voting fails
    BlockInvalid --> [*]: Consensus complete

    note right of MemberOffline
        Timeout Detection:
        - Secretary waits 15s for SET_WAIT_STATUS
        - Members wait 30s for GREEN_LIGHT
        - Double ping for false negatives
    end note

    note right of SecretaryOffline
        Secretary Failover:
        - Second member becomes secretary
        - Inherits block timestamp
        - Syncs member phases
        - Continues coordination
    end note

    note right of BlockInvalid
        Byzantine Fault Tolerance:
        - Requires 67% agreement
        - Rollback on failure
        - All or nothing semantics
    end note
```

---

## Key File References

### Core Consensus Files
- **PoRBFT Main**: `src/libs/consensus/v2/PoRBFT.ts` (consensus routine entry point)
- **Secretary Manager**: `src/libs/consensus/v2/types/secretaryManager.ts` (1,005 lines - coordination logic)

### Consensus Routines
- **CVSA**: `src/libs/consensus/v2/routines/getCommonValidatorSeed.ts` (133 lines)
- **Shard Selection**: `src/libs/consensus/v2/routines/getShard.ts` (58 lines - deterministic member selection)
- **Block Creation**: `src/libs/consensus/v2/routines/createBlock.ts` (74 lines)
- **Mempool Merge**: `src/libs/consensus/v2/routines/mergeMempools.ts` (35 lines)
- **Transaction Ordering**: `src/libs/consensus/v2/routines/orderTransactions.ts` (28 lines)
- **Block Voting**: `src/libs/consensus/v2/routines/broadcastBlockHash.ts` (130 lines)

### Type Definitions
- **Interfaces**: `src/libs/consensus/v2/interfaces.ts` (validation data, consensus responses)
- **Validation Phases**: `src/libs/consensus/v2/types/validationStatusTypes.ts` (55 lines - 7 phases)
- **Shard Types**: `src/libs/consensus/v2/types/shardTypes.ts` (shard structure definition)

---

## PoRBFT Architecture Principles

1. **Deterministic Shard Selection**: CVSA algorithm ensures all synced nodes calculate identical shard membership

2. **Byzantine Fault Tolerance**: 67% vote threshold provides resistance to up to 33% malicious validators

3. **Secretary Coordination**: First shard member coordinates phases using green light semaphore system

4. **7 Phase Synchronization**: All validators proceed through phases together, preventing desynchronization

5. **Automatic Failure Recovery**: System handles offline validators, secretary failover, and network partitions

6. **GCR Integration**: State changes applied during consensus, rolled back on block invalidity

7. **Cryptographic Security**: Block hashes, signatures, and CVSA provide tamper-proof coordination

8. **Waiter System**: Semaphore-based coordination (GREEN_LIGHT, SET_WAIT_STATUS) enables async coordination

9. **Block Timestamp Consistency**: Secretary sets canonical timestamp, all members use same value

10. **Next Proposer Calculation**: Each block calculates CVSA for next block, enabling smooth rotation
