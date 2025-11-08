# Peer & Validator Management - Mermaid Diagrams

## Overview

The Demos blockchain uses a peer-to-peer network architecture where validators are a subset of online, synced peers. The system manages peer discovery, authentication, synchronization status, and validator selection.

**Key Features:**
- **PeerManager Singleton** for centralized peer management
- **Peer Gossip Protocol** for decentralized peer list synchronization
- **Hello Peer Handshake** with cryptographic verification
- **Sync Status Tracking** for blockchain state synchronization
- **Online/Offline Detection** with retry logic
- **Validator Selection** based on sync status and stake
- **Point/Reputation System** stored in GCR for incentives

## 1. PeerManager Architecture Overview

```mermaid
graph TB
    subgraph "PeerManager Singleton"
        START[PeerManager.getInstance]
        PEERLIST[peerList: Record of string, Peer]
        OFFLINE[offlinePeers: Record of string, Peer]

        START --> PEERLIST
        START --> OFFLINE
    end

    subgraph "Peer Structure"
        PEER[Peer Object]
        PEER --> CONNECTION[connection: string URL]
        PEER --> IDENTITY[identity: publicKey hex]
        PEER --> VERIFICATION[verification: status, message, timestamp]
        PEER --> SYNC[sync: status, block, block_hash]
        PEER --> STATUS[status: online, timestamp, ready]
    end

    subgraph "Initialization"
        LOAD[loadPeerList]
        FILE[demos_peer.json file]
        BOOTSTRAP[peerBootstrap routine]

        LOAD --> FILE
        FILE --> BOOTSTRAP
        BOOTSTRAP --> CREATEPEERS[Create Peer objects]
        CREATEPEERS --> ADDPEERS[Add to peerList]
    end

    subgraph "Core Operations"
        ADDPEERS --> OPERATIONS

        OPERATIONS[Core Operations]
        OPERATIONS --> GETPEERS[getPeers: authenticated peers]
        OPERATIONS --> GETALL[getAll: all peers and connections]
        OPERATIONS --> GETONLINE[getOnlinePeers: test and return]
        OPERATIONS --> ADDPEER[addPeer: add or update]
        OPERATIONS --> REMOVEPEER[removeOnlinePeer: delete]
    end

    subgraph "Peer Communication"
        GETONLINE --> SAYHELLO[sayHelloToPeer]
        SAYHELLO --> SIGN[Sign connection string]
        SAYHELLO --> RPC[Send hello_peer RPC]
        RPC --> CALLBACK[helloPeerCallback]

        CALLBACK --> RESPONSE{Response<br/>is 200?}
        RESPONSE -->|yes| ADDONLINE[Add to peerList]
        RESPONSE -->|no| ADDOFFLINE[Add to offlinePeers]
    end

    subgraph "Peer List Persistence"
        ADDPEER --> LOGLIST[logPeerList]
        LOGLIST --> JSONFILE[Write to peer_list.log]
        JSONFILE --> FORMAT[JSON format with connection, identity, auth status]
    end

    subgraph "Sync Data Management"
        ADDONLINE --> UPDATE[updateOurPeerSyncData]
        UPDATE --> OURSYNC[Update our peer sync status]
        OURSYNC --> SYNCFIELDS[syncStatus, lastBlockNumber, lastBlockHash]
    end

    style START fill:#e1f5ff
    style PEERLIST fill:#fff4e1
    style OFFLINE fill:#ffcdd2
    style SAYHELLO fill:#e8f5e9
    style ADDONLINE fill:#c8e6c9
    style ADDOFFLINE fill:#ffcdd2
```

## 2. Peer Lifecycle & Bootstrap Process

```mermaid
flowchart TD
    START([Node Startup])

    START --> LOADFILE[Load demos_peer.json]
    LOADFILE --> FILEEXISTS{File<br/>exists?}

    FILEEXISTS -->|no| CREATEEMPTY[Use empty peer list]
    FILEEXISTS -->|yes| PARSEJSON[Parse JSON peer list]

    CREATEEMPTY --> ADDSELF
    PARSEJSON --> ADDSELF[Add ourselves to peer list]

    ADDSELF --> CREATEOBJECTS[Create Peer objects for each entry]
    CREATEOBJECTS --> BOOTSTRAP[peerBootstrap routine]

    subgraph "Peer Bootstrap Process"
        BOOTSTRAP --> LOOP{For each<br/>peer}

        LOOP -->|more peers| EXTRACTINFO[Extract URL and publicKey]
        LOOP -->|done| CHECKCOUNT

        EXTRACTINFO --> CREATEBLANK[Create blank Peer object]
        CREATEBLANK --> GETIDENTITY[getPeerIdentity routine]

        GETIDENTITY --> CONNECT{Can<br/>connect?}
        CONNECT -->|no| MARKOFFLINE[Add to offlinePeers]
        CONNECT -->|yes| VERIFY[Verify cryptographic identity]

        MARKOFFLINE --> LOOP

        VERIFY --> VERIFIED{Identity<br/>verified?}
        VERIFIED -->|no| MARKOFFLINE
        VERIFIED -->|yes| SETCONNECTION[Set connection string]

        SETCONNECTION --> SAYHELLO[sayHelloToPeer]
        SAYHELLO --> HELLORESPONSE{Hello<br/>success?}

        HELLORESPONSE -->|yes| ADDTOPEERLIST[Add to peerList]
        HELLORESPONSE -->|no| ADDTOOFFLINE[Add to offlinePeers]

        ADDTOPEERLIST --> LOOP
        ADDTOOFFLINE --> LOOP
    end

    CHECKCOUNT{Valid peers<br/>greater than 0?}
    CHECKCOUNT -->|yes| SUCCESS[Bootstrap successful]
    CHECKCOUNT -->|no| LISTEN[Listen for incoming connections]

    SUCCESS --> STARTGOSSIP[Start peer gossip routine]
    LISTEN --> WAIT[Wait for peers to connect]

    STARTGOSSIP --> CONSENSUS[Ready for consensus]
    WAIT --> INCOMING[Process incoming hello_peer]
    INCOMING --> ADDNEWPEER[Add new peers as they connect]
    ADDNEWPEER --> CONSENSUS

    style START fill:#e1f5ff
    style BOOTSTRAP fill:#fff4e1
    style ADDTOPEERLIST fill:#c8e6c9
    style MARKOFFLINE fill:#ffcdd2
    style SUCCESS fill:#c8e6c9
    style LISTEN fill:#ffe0b2
```

## 3. Hello Peer Handshake Protocol

```mermaid
sequenceDiagram
    participant Node as Local Node
    participant PM as PeerManager
    participant Crypto as Cryptography
    participant Remote as Remote Peer
    participant GCR as GCR System

    Note over Node,Remote: Peer wants to establish connection

    Node->>PM: sayHelloToPeer(peer)
    PM->>PM: Increment peerRoutineRunning counter

    PM->>Node: Get our connection string (exposedUrl)
    PM->>Crypto: Sign connection string with ed25519
    Crypto->>PM: Return signature

    PM->>PM: Build HelloPeerRequest
    Note right of PM: url: our connection string<br/>publicKey: our hex key<br/>signature: type and data<br/>syncData: block, hash, status

    PM->>Remote: RPC: hello_peer(request)
    Note right of PM: Retry: 3 times, 250ms delay

    Remote->>Remote: Receive hello_peer request
    Remote->>Crypto: Verify signature against publicKey

    alt Signature Valid
        Remote->>GCR: Check if peer is known
        Remote->>Remote: Update or add peer to peerList
        Remote->>Remote: Update sync data from request
        Remote->>PM: Response 200 with success
        Note left of Remote: msg: "Hello received"<br/>syncData: our sync info
    else Signature Invalid
        Remote->>PM: Response 400 with error
    end

    PM->>PM: helloPeerCallback(response, peer)

    alt Response is 200
        PM->>PM: Update peer.sync from response
        PM->>PM: addPeer(peer) to peerList
        PM->>PM: removeOfflinePeer(peer)
        Note right of PM: Peer is online and authenticated
    else Response not 200
        PM->>PM: addOfflinePeer(peer)
        PM->>PM: removeOnlinePeer(peer)
        Note right of PM: Peer is offline or failed
    end

    PM->>PM: Decrement peerRoutineRunning counter
    PM->>Node: Return peer status
```

## 4. Peer Gossip Protocol

```mermaid
flowchart TD
    START([peerGossip triggered])

    START --> GUARD{inPeerGossip<br/>flag set?}
    GUARD -->|yes| RETURN[Return - already running]
    GUARD -->|no| SETFLAG[Set inPeerGossip true]

    SETFLAG --> GETPEERS[Get all peers from PeerManager]
    GETPEERS --> CHECKEMPTY{Peers<br/>greater than 0?}

    CHECKEMPTY -->|no| CLEANUP[Set inPeerGossip false]
    CHECKEMPTY -->|yes| SELECT[Select peers for gossip]

    SELECT --> COUNTCHECK{Peer count<br/>less or equal maxGossipPeers?}
    COUNTCHECK -->|yes| SELECTALL[Select all peers]
    COUNTCHECK -->|no| SELECTRANDOM[Select 10 random peers]

    SELECTALL --> ORDEROUS
    SELECTRANDOM --> ORDEROUS[Order our peer list by identity]

    ORDEROUS --> HASHOURS[SHA256 hash of ordered list]
    HASHOURS --> REQUESTHASHES[Request peer list hashes from selected peers]

    subgraph "Hash Request Process"
        REQUESTHASHES --> SENDREQ[Send getPeerlistHash RPC to each]
        SENDREQ --> WAITRESP[Wait for all responses]
        WAITRESP --> PROCESSRESP[Process responses]
    end

    PROCESSRESP --> COMPARE{For each<br/>response}

    COMPARE -->|more| CHECKHASH{Hash matches<br/>our hash?}
    COMPARE -->|done| CHECKDIFF

    CHECKHASH -->|yes| SKIP[Skip - peer list same]
    CHECKHASH -->|no| MARKDIFF[Mark peer as different]

    SKIP --> COMPARE
    MARKDIFF --> COMPARE

    CHECKDIFF{Different peers<br/>exist?}
    CHECKDIFF -->|no| CLEANUP
    CHECKDIFF -->|yes| REQUESTLISTS[Request full peer lists]

    subgraph "Peer List Sync Process"
        REQUESTLISTS --> SENDGETLIST[Send getPeerlist RPC to different peers]
        SENDGETLIST --> WAITLISTS[Wait for all peer list responses]
        WAITLISTS --> FILTERLISTS[Filter successful responses]
        FILTERLISTS --> CONVERTPEERS[Convert to Peer objects]
    end

    CONVERTPEERS --> ADDOURS[Add our peer list to array]
    ADDOURS --> MERGE[mergePeerlists routine]

    subgraph "Merge Process"
        MERGE --> CREATEMAP[Create Map by identity]
        CREATEMAP --> FLATTEN[Flatten all peer lists]
        FLATTEN --> BATCHLOOP{Process in<br/>batches of 10}

        BATCHLOOP -->|more| PROCESSBATCH[Process batch]
        PROCESSBATCH --> CHECKEXIST{Peer<br/>exists?}

        CHECKEXIST -->|yes| COMPAREBLOCK{New block<br/>greater than existing?}
        COMPAREBLOCK -->|yes| UPDATEPEER[Update sync data]
        COMPAREBLOCK -->|no| SKIPUPDATE[Keep existing]

        CHECKEXIST -->|no| ADDNEWPEER[Add new peer to map]

        UPDATEPEER --> YIELD[Yield to event loop]
        SKIPUPDATE --> YIELD
        ADDNEWPEER --> YIELD
        YIELD --> BATCHLOOP

        BATCHLOOP -->|done| SORTMAP[Sort by identity]
        SORTMAP --> SETPEERS[PeerManager.setPeers]
    end

    SETPEERS --> CLEANUP
    CLEANUP --> END([Gossip complete])
    RETURN -.-> END

    style START fill:#e1f5ff
    style HASHOURS fill:#fff4e1
    style MERGE fill:#e8f5e9
    style SETPEERS fill:#c8e6c9
    style CLEANUP fill:#f3e5f5
```

## 5. Validator Entrance & Management

### ⚠️ Implementation Status: 📋 PLANNED (Incomplete)

**NOTE**: The validator entrance feature is **partially implemented** with several critical components marked as TODO in the codebase:

**✅ Implemented**:
- Minimum stake validation (10^25 tokens)
- Basic transaction structure for entrance
- GCR validators table schema
- Validator status field (status: 2 for active)

**❌ NOT Implemented** (TODO in code):
- Blacklist check for banned validators
- Duplicate staking prevention (checking if already staking)
- Kicked validator check (prevent re-entry after being kicked)
- Connection URL validation
- Online status monitoring and pinging

See `src/libs/blockchain/routines/validatorsManagement.ts:19-26` for TODO comments.

---

```mermaid
flowchart TD
    START([Validator Entrance Request])

    START --> CREATETX[Create validator entrance transaction]
    CREATETX --> TXCONTENT[Transaction with amount to stake]

    TXCONTENT --> VALIDATE[ValidatorsManagement.manageValidatorEntranceTx]

    subgraph "Validation Checks"
        VALIDATE --> CHECK1{Amount greater or equal<br/>minToStake?}
        CHECK1 -->|no| FAIL1[isEntranceValid false]
        CHECK1 -->|yes| CHECK2

        CHECK2[Check if not already staking]
        CHECK2 --> TODO1[TODO: Implement check]

        TODO1 --> CHECK3[Check if not blacklisted]
        CHECK3 --> TODO2[TODO: Implement check]

        TODO2 --> CHECK4[Check if never kicked]
        CHECK4 --> TODO3[TODO: Implement check]

        TODO3 --> SUCCESS[isEntranceValid true]
    end

    FAIL1 --> REJECTTX[Reject transaction]
    SUCCESS --> ACCEPTTX[Accept transaction]

    ACCEPTTX --> ADDTOCHAIN[Add transaction to chain]
    ADDTOCHAIN --> UPDATEGCR[Update GCR validator status]

    subgraph "GCR Validator Entry"
        UPDATEGCR --> CREATERECORD[Create Validators table entry]
        CREATERECORD --> FIELDS[Set fields]

        FIELDS --> ADDRESS[address: publicKey]
        FIELDS --> STATUSFIELD[status: 2 for active]
        FIELDS --> CONNECTIONURL[connection_url: node URL]
        FIELDS --> STAKED[staked: amount]
        FIELDS --> FIRSTSEEN[first_seen: block number]
        FIELDS --> VALIDAT[valid_at: block number]
        FIELDS --> STAKE[stake: normalized amount]
    end

    STAKE --> SAVEDB[Save to database]
    SAVEDB --> CHECKSTATUS[isValidatorActive check]

    subgraph "Validator Status Check"
        CHECKSTATUS --> GETGCR[GCR.getGCRValidatorStatus]
        GETGCR --> READSTATUS[Read status field]
        READSTATUS --> COMPARE{status is 2?}

        COMPARE -->|yes| ACTIVE[Validator is active]
        COMPARE -->|no| INACTIVE[Validator is inactive]
    end

    ACTIVE --> ELIGIBLE[Eligible for consensus shard selection]
    INACTIVE --> NOTELIGIBLE[Not eligible for consensus]

    subgraph "Online Status Management"
        ELIGIBLE --> MANAGEONLINE[manageValidatorOnlineStatus]
        MANAGEONLINE --> GETCONNECTION[Get connection_string from GCR]
        GETCONNECTION --> TESTCONNECTION[TODO: Connection test]
        TESTCONNECTION --> PINGVALIDATOR[Ping validator endpoint]

        PINGVALIDATOR --> PINGRESPONSE{Response<br/>received?}
        PINGRESPONSE -->|yes| MARKONLINE[Mark as online in PeerManager]
        PINGRESPONSE -->|no| MARKOFFLINE[Mark as offline in PeerManager]
    end

    MARKONLINE --> SHARDELIGIBLE[Available for shard selection]
    MARKOFFLINE --> RETRY[Add to offline peers for retry]

    style START fill:#e1f5ff
    style SUCCESS fill:#c8e6c9
    style FAIL1 fill:#ffcdd2
    style ACTIVE fill:#c8e6c9
    style INACTIVE fill:#ffe0b2
    style SHARDELIGIBLE fill:#c8e6c9
```

## 6. Peer Connection & RPC System

```mermaid
sequenceDiagram
    participant Caller
    participant Peer
    participant Crypto
    participant Axios as HTTP Client
    participant Remote as Remote Node

    Note over Caller,Remote: Peer.call() - Generic RPC Call

    Caller->>Peer: call(request, isAuthenticated)
    Peer->>Peer: Log: Making RPC call

    alt isAuthenticated is true
        Peer->>Crypto: getIdentity(signingAlgorithm)
        Crypto->>Peer: Return publicKey
        Peer->>Peer: Convert to hex

        Peer->>Crypto: sign(signingAlgorithm, publicKey)
        Crypto->>Peer: Return signature
        Peer->>Peer: Convert signature to hex
    else isAuthenticated is false
        Peer->>Peer: pubkey = empty
        Peer->>Peer: signature = empty
    end

    Peer->>Peer: Check if peer is local node
    alt isLocalNode is true
        Peer->>Peer: Use internal connection string
    else isLocalNode is false
        Peer->>Peer: Use external connection string
    end

    Peer->>Axios: POST request with headers
    Note right of Peer: Headers:<br/>Content-Type: application/json<br/>identity: algorithm:pubkey<br/>signature: hex signature<br/>Timeout: 3000ms

    Axios->>Remote: HTTP POST with JSON-RPC request
    Remote->>Remote: Process request
    Remote->>Remote: Verify signature if authenticated
    Remote->>Remote: Execute method
    Remote->>Axios: Return RPCResponse

    alt Request successful
        Axios->>Peer: Response with status 200
        Peer->>Peer: Check response.data.result
        alt result is 200
            Peer->>Peer: Log: Response OK
        else result not 200
            Peer->>Peer: Log: Response not OK
        end
        Peer->>Caller: Return response.data
    else Request failed
        Axios->>Peer: Throw error
        Peer->>Peer: Log error with details
        Peer->>Caller: Return error response
        Note left of Peer: result: 500<br/>response: error<br/>require_reply: false
    end

    Note over Caller,Remote: Peer.longCall() - Call with Retries

    Caller->>Peer: longCall(request, auth, sleepTime, retries)
    Peer->>Peer: tries = 0

    loop While tries less than retries
        Peer->>Peer: call(request, auth)
        Peer->>Peer: Check response.result

        alt result is 200 or in allowedErrors
            Peer->>Caller: Return response immediately
        else result is error
            Peer->>Peer: Increment tries
            Peer->>Peer: Sleep for sleepTime ms
        end
    end

    Peer->>Peer: Max retries reached
    Peer->>Peer: Log error with method name
    Peer->>Caller: Return error response
    Note left of Peer: result: 400<br/>response: "Max retries reached"<br/>extra: last response
```

## 7. Online/Offline Status Management

```mermaid
stateDiagram-v2
    [*] --> Unknown: Peer discovered

    state "Unknown Status" as Unknown {
        [*] --> NotTested
        NotTested: Peer in demos_peer.json
        NotTested: No connection attempted yet
    }

    Unknown --> Testing: peerBootstrap or sayHelloToPeer

    state "Connection Testing" as Testing {
        [*] --> SendPing
        SendPing: Send hello_peer RPC
        SendPing --> WaitResponse: Wait for response (3 retries, 250ms)
        WaitResponse --> CheckSignature: Verify cryptographic signature

        state CheckSignature {
            [*] --> ValidSignature
            [*] --> InvalidSignature

            ValidSignature: Signature matches publicKey
            InvalidSignature: Signature verification failed
        }
    }

    Testing --> Online: Signature valid and response 200
    Testing --> Offline: No response or invalid signature

    state "Online" as Online {
        [*] --> InPeerList
        InPeerList: Added to peerList
        InPeerList --> UpdateSync: Periodically update sync data
        UpdateSync --> CheckReady: Check if ready for consensus

        state CheckReady {
            [*] --> Ready
            [*] --> NotReady

            Ready: synced and verified and online
            NotReady: missing one or more requirements
        }

        CheckReady --> InPeerList
    }

    state "Offline" as Offline {
        [*] --> InOfflineList
        InOfflineList: Added to offlinePeers
        InOfflineList --> ScheduleRetry: Add to retry queue
        ScheduleRetry --> WaitRetry: Wait for retry interval
        WaitRetry --> [*]: Will retry later
    }

    Online --> Offline: Timeout in consensus or RPC failure
    Offline --> Testing: Retry connection after interval

    state "Consensus Timeout Detection" as ConsensusTimeout {
        [*] --> SecretaryWait
        SecretaryWait: Secretary waits for member phase
        SecretaryWait --> Timeout: 15s timeout expires
        Timeout --> PingMember: Secretary pings member
        PingMember --> NoResponse: Member does not respond
        NoResponse --> RemoveFromShard: Remove from current shard
        RemoveFromShard --> [*]: Mark as offline
    }

    state "Gossip Update" as GossipUpdate {
        [*] --> ReceivePeerList
        ReceivePeerList: Peer list received from gossip
        ReceivePeerList --> ComparePeer: Check peer in our list

        state ComparePeer {
            [*] --> NewerSync
            [*] --> OlderSync

            NewerSync: Received peer has higher block
            OlderSync: Our peer has higher block
        }

        ComparePeer --> UpdateOrKeep: Update or keep existing
    }

    Online --> ConsensusTimeout: Consensus routine running
    ConsensusTimeout --> Offline

    Online --> GossipUpdate: Peer gossip running
    Offline --> GossipUpdate: Peer gossip running
    GossipUpdate --> Online: Peer reported as online
    GossipUpdate --> Offline: Peer reported as offline

    note right of Online
        Online peers are:
        - In peerList
        - Authenticated (verified signature)
        - Have sync data
        - Can participate in consensus
    end note

    note right of Offline
        Offline peers are:
        - In offlinePeers
        - Failed connection or signature
        - Scheduled for retry
        - Cannot participate in consensus
    end note
```

## 8. Sync Status Tracking

```mermaid
flowchart TD
    START([Sync Status Management])

    START --> OURNODE[Our Node Sync Data]

    subgraph "Our Sync Data"
        OURNODE --> SHAREDSTATE[getSharedState]
        SHAREDSTATE --> SYNCSTATUS[syncStatus: boolean]
        SHAREDSTATE --> LASTBLOCK[lastBlockNumber: number]
        SHAREDSTATE --> LASTHASH[lastBlockHash: string]
    end

    LASTHASH --> UPDATE[updateOurPeerSyncData]

    subgraph "Update Our Peer Entry"
        UPDATE --> GETOURPEER[Get our peer from peerList]
        GETOURPEER --> SETFIELDS[Set sync fields]

        SETFIELDS --> SETSTATUS[peer.sync.status = syncStatus]
        SETFIELDS --> SETBLOCK[peer.sync.block = lastBlockNumber]
        SETFIELDS --> SETHASH[peer.sync.block_hash = lastBlockHash]
    end

    SETHASH --> BROADCAST[Broadcast in hello_peer]

    subgraph "Sending Sync Data"
        BROADCAST --> BUILDREQUEST[Build HelloPeerRequest]
        BUILDREQUEST --> ADDSYNC[Add syncData field]

        ADDSYNC --> SYNCOBJ["syncData:<br/>block, block_hash, status"]
        SYNCOBJ --> SENDTOPEERS[Send to all peers in hello_peer]
    end

    SENDTOPEERS --> RECEIVE[Receive sync data from peers]

    subgraph "Receiving Sync Data"
        RECEIVE --> HELLOCALLBACK[helloPeerCallback]
        HELLOCALLBACK --> EXTRACTSYNC[Extract response.extra.syncData]

        EXTRACTSYNC --> UPDATESYNC{syncData<br/>present?}
        UPDATESYNC -->|yes| SETPEER[peer.sync = response syncData]
        UPDATESYNC -->|no| SKIPSYNC[Keep existing sync data]

        SETPEER --> ADDPEER[addPeer to peerList]
    end

    ADDPEER --> MERGE[Merge from peer gossip]

    subgraph "Gossip Sync Merge"
        MERGE --> COMPARESYNC{Received peer<br/>block greater?}

        COMPARESYNC -->|yes| UPDATEFROMGOSSIP[Update sync fields]
        COMPARESYNC -->|no| KEEPEXISTING[Keep our data]

        UPDATEFROMGOSSIP --> SETGOSSIPFIELDS[Set block, block_hash, status]
    end

    SETGOSSIPFIELDS --> CONSENSUS[Use in consensus]
    KEEPEXISTING --> CONSENSUS

    subgraph "Consensus Shard Selection"
        CONSENSUS --> GETONLINE[getOnlinePeers]
        GETONLINE --> FILTER[Filter by sync.status is true]

        FILTER --> SYNCED[Synced peers only]
        SYNCED --> SHARD[Eligible for shard selection]

        SHARD --> CVSA[Used in CVSA algorithm]
        CVSA --> SELECTED[Deterministic shard members]
    end

    SELECTED --> MONITOR[Monitor during consensus]

    subgraph "Sync Monitoring"
        MONITOR --> CHECKLAG{Peer falls<br/>behind?}

        CHECKLAG -->|yes| PHASE[Phase-based catch-up]
        CHECKLAG -->|no| CONTINUE[Continue in shard]

        PHASE --> IMMEDIATE[Secretary releases immediately]
        IMMEDIATE --> CATCHUP[Member catches up to current phase]
        CATCHUP --> REJOIN[Rejoins at current phase]
    end

    REJOIN --> END([Sync tracking complete])

    style START fill:#e1f5ff
    style UPDATE fill:#fff4e1
    style FILTER fill:#e8f5e9
    style SELECTED fill:#c8e6c9
    style IMMEDIATE fill:#ffe0b2
```

## 9. Point/Reputation System

```mermaid
flowchart TD
    START([User Reputation Management])

    START --> GCRSTORAGE[Points stored in GCR_Main table]

    subgraph "GCR Points Structure"
        GCRSTORAGE --> TOTALPOINTS[totalPoints: number]
        GCRSTORAGE --> BREAKDOWN[breakdown object]

        BREAKDOWN --> WEB3[web3Wallets: Map of chain to points]
        BREAKDOWN --> SOCIAL[socialAccounts: twitter, github, telegram, discord]
        BREAKDOWN --> REFERRALS[referrals: number]
        BREAKDOWN --> DEMOS[demosFollow: number]

        GCRSTORAGE --> LASTUPDATED[lastUpdated: Date]
    end

    LASTUPDATED --> POINTVALUES[Point Values Configuration]

    subgraph "Point Award Values"
        POINTVALUES --> LINKWEB3[LINK_WEB3_WALLET: 0.5]
        POINTVALUES --> LINKTWITTER[LINK_TWITTER: 2]
        POINTVALUES --> LINKGITHUB[LINK_GITHUB: 1]
        POINTVALUES --> LINKTELEGRAM[LINK_TELEGRAM: 1]
        POINTVALUES --> LINKDISCORD[LINK_DISCORD: 1]
        POINTVALUES --> FOLLOWDEMOS[FOLLOW_DEMOS: 1]
    end

    LINKDISCORD --> TRIGGER[Incentive Triggers]

    subgraph "Identity Linking Hooks"
        TRIGGER --> IDENTITYLINK[User links identity in GCR]
        IDENTITYLINK --> CALLHOOK[IncentiveManager hook called]

        CALLHOOK --> HOOKTYPE{Hook<br/>type?}

        HOOKTYPE -->|walletLinked| AWARDWEB3[awardWeb3WalletPoints]
        HOOKTYPE -->|twitterLinked| AWARDTWITTER[awardTwitterPoints]
        HOOKTYPE -->|githubLinked| AWARDGITHUB[awardGithubPoints]
        HOOKTYPE -->|telegramLinked| AWARDTELEGRAM[awardTelegramPoints]
        HOOKTYPE -->|discordLinked| AWARDDISCORD[awardDiscordPoints]
    end

    AWARDDISCORD --> CHECKDUPE[Check if already awarded]

    subgraph "Award Process"
        CHECKDUPE --> GETUSER[getUserPointsInternal]
        GETUSER --> CHECKEXIST{Points already<br/>exist for this identity?}

        CHECKEXIST -->|yes| SKIPPOINTS[Skip - points already awarded]
        CHECKEXIST -->|no| ADDPOINTS[addPointsToGCR]

        ADDPOINTS --> UPDATETOTAL[totalPoints plus equals points]
        ADDPOINTS --> UPDATEBREAKDOWN[Update breakdown field]
        ADDPOINTS --> SETTIMESTAMP[Set lastUpdated to now]
    end

    SETTIMESTAMP --> REFERRALCHECK[Check referral code]

    subgraph "Referral Processing"
        REFERRALCHECK --> HASREFERRAL{Referral code<br/>provided?}

        HASREFERRAL -->|yes| CHECKELIGIBLE{User<br/>eligible?}
        HASREFERRAL -->|no| SAVE

        CHECKELIGIBLE -->|yes| PROCESSREFERRAL[Referrals.processReferral]
        CHECKELIGIBLE -->|no| SAVE

        PROCESSREFERRAL --> FINDREFERRER[Find referrer by code]
        FINDREFERRER --> REFERREREXISTS{Referrer<br/>exists?}

        REFERREREXISTS -->|yes| AWARDREFERRER[Award points to referrer]
        REFERREREXISTS -->|no| SAVE

        AWARDREFERRER --> UPDATECOUNT[Increment totalReferrals]
        UPDATECOUNT --> ADDREFEREE[Add referee to referrals array]
        ADDREFEREE --> SETREFERRED[Set referredBy for user]
    end

    SETREFERRED --> SAVE[Save GCR_Main to database]
    SAVE --> TWITTERCHECK[Check Twitter follow]

    subgraph "Demos Follow Bonus"
        TWITTERCHECK --> HASTWITTERID{Has Twitter<br/>identity?}

        HASTWITTERID -->|yes| CHECKFOLLOW[Twitter.checkFollow username]
        HASTWITTERID -->|no| RESPONSE

        CHECKFOLLOW --> FOLLOWING{Is following<br/>@DemosBlockchain?}

        FOLLOWING -->|yes| AWARDFOLLOW[Award FOLLOW_DEMOS points]
        FOLLOWING -->|no| RESPONSE

        AWARDFOLLOW --> ADDTOBREAKDOWN[breakdown.demosFollow plus equals 1]
        ADDTOBREAKDOWN --> ADDTOTOTAL[totalPoints plus equals 1]
    end

    ADDTOTOTAL --> RESPONSE[Return RPCResponse]
    SKIPPOINTS --> RESPONSE

    RESPONSE --> GETPOINTS[getPoints API]

    subgraph "Points Retrieval"
        GETPOINTS --> FETCHGCR[Fetch GCR_Main by pubkey]
        FETCHGCR --> FETCHIDENTITIES[Fetch linked identities from IdentityManager]

        FETCHIDENTITIES --> BUILDRESPONSE[Build UserPoints response]

        BUILDRESPONSE --> RESPFIELDS[Response fields]
        RESPFIELDS --> USERID[userId: pubkey]
        RESPFIELDS --> REFERRALCODE[referralCode: string]
        RESPFIELDS --> TOTALPOINTSRESP[totalPoints: number]
        RESPFIELDS --> BREAKDOWNRESP[breakdown: object]
        RESPFIELDS --> LINKEDWALLETS[linkedWallets: array of addresses]
        RESPFIELDS --> LINKEDSOCIALS[linkedSocials: twitter, discord]
        RESPFIELDS --> LASTUPDATEDRESP[lastUpdated: Date]
        RESPFIELDS --> FLAGGED[flagged and flaggedReason if any]
    end

    FLAGGED --> RETURN[Return to client]
    RETURN --> END([Points system complete])

    style START fill:#e1f5ff
    style GCRSTORAGE fill:#fff4e1
    style ADDPOINTS fill:#e8f5e9
    style AWARDREFERRER fill:#c8e6c9
    style AWARDFOLLOW fill:#c8e6c9
    style RETURN fill:#f3e5f5
```

## 10. Complete Peer-to-Validator Flow

```mermaid
flowchart TD
    START([New Node Joins Network])

    START --> GENESIS[Load genesis block]
    GENESIS --> KEYPAIR[Generate or load ed25519 keypair]
    KEYPAIR --> PUBLICKEY[Derive publicKey hex]

    PUBLICKEY --> LOADPEERS[Load demos_peer.json]
    LOADPEERS --> BOOTSTRAP[Run peerBootstrap]

    subgraph "Peer Discovery"
        BOOTSTRAP --> TESTPEERS[Test each peer connection]
        TESTPEERS --> VERIFYPEERS[Verify cryptographic identities]
        VERIFYPEERS --> HELLOS[Send hello_peer to all]
        HELLOS --> AUTHENTICATED[Build authenticated peer list]
    end

    AUTHENTICATED --> STARTGOSSIP[Start peer gossip routine]

    subgraph "Peer Synchronization"
        STARTGOSSIP --> GOSSIPHASH[Hash our peer list]
        GOSSIPHASH --> SENDHASHREQUESTS[Send hash to 10 random peers]
        SENDHASHREQUESTS --> COMPAREHASHES[Compare hashes]
        COMPAREHASHES --> REQUESTLISTS[Request full lists from different peers]
        REQUESTLISTS --> MERGELISTS[Merge all peer lists]
        MERGELISTS --> UPDATEPEERLIST[Update local peer list]
    end

    UPDATEPEERLIST --> STARTSYNC[Start blockchain sync]

    subgraph "Blockchain Synchronization"
        STARTSYNC --> GETLASTBLOCK[Get our last block number]
        GETLASTBLOCK --> QUERYPEERS[Query peers for their last block]
        QUERYPEERS --> FINDHIGHEST[Find peer with highest block]
        FINDHIGHEST --> REQUESTBLOCKS[Request missing blocks]
        REQUESTBLOCKS --> VALIDATEBLOCKS[Validate and add blocks]
        VALIDATEBLOCKS --> UPDATESYNCSTATUS[Update sync.status true]
    end

    UPDATESYNCSTATUS --> BROADCASTSYNC[Broadcast sync status in hello_peer]
    BROADCASTSYNC --> ELIGIBLE[Eligible for consensus]

    ELIGIBLE --> STAKEDECISION{Want to become<br/>validator?}

    STAKEDECISION -->|no| PARTICIPATEP2P[Participate as peer only]
    STAKEDECISION -->|yes| CREATESTAKETX[Create validator entrance tx]

    subgraph "Validator Entrance"
        CREATESTAKETX --> SETAMOUNT[Set amount greater or equal minToStake]
        SETAMOUNT --> SIGNTX[Sign transaction]
        SIGNTX --> BROADCASTTX[Broadcast to network]
        BROADCASTTX --> VALIDATETX[ValidatorsManagement.manageValidatorEntranceTx]

        VALIDATETX --> CHECKS{All checks<br/>pass?}
        CHECKS -->|no| REJECTTX[Transaction rejected]
        CHECKS -->|yes| ACCEPTTX[Transaction accepted]

        ACCEPTTX --> ADDTOCHAIN[Add to blockchain]
        ADDTOCHAIN --> UPDATEGCR[Update GCR validators table]
        UPDATEGCR --> SETSTATUS[Set status to 2 for active]
    end

    SETSTATUS --> NOWVALIDATOR[Now a validator]

    subgraph "Consensus Participation"
        NOWVALIDATOR --> CONSENSUSROUND[Wait for consensus round]
        CONSENSUSROUND --> GETLASTBLOCKNUM[Get lastBlockNumber]
        GETLASTBLOCKNUM --> CVSA[Calculate CVSA seed]

        CVSA --> GETONLINEPEERS[Get online synced peers]
        GETONLINEPEERS --> FILTERSYNCED[Filter by sync.status true]
        FILTERSYNCED --> SHARDSELECT[Deterministic shard selection]

        SHARDSELECT --> INSHARD{Are we in<br/>shard?}

        INSHARD -->|no| WAITNEXTBLOCK[Wait for next block]
        INSHARD -->|yes| PARTICIPATECONSENSUS[Participate in PoRBFT]

        PARTICIPATECONSENSUS --> PHASES[Execute 7 validation phases]
        PHASES --> VOTE[Vote on block]
        VOTE --> BLOCKRESULT{Block<br/>valid?}

        BLOCKRESULT -->|yes| FINALIZE[Finalize block]
        BLOCKRESULT -->|no| ROLLBACK[Rollback GCR edits]

        FINALIZE --> UPDATEOURPOINTS[Earn reputation points]
        UPDATEOURPOINTS --> WAITNEXTROUND

        ROLLBACK --> WAITNEXTROUND[Wait for next consensus round]
        WAITNEXTBLOCK --> WAITNEXTROUND
    end

    WAITNEXTROUND --> CONSENSUSROUND

    PARTICIPATEP2P --> RELAY[Relay transactions and blocks]
    RELAY --> HELLOPEER[Respond to hello_peer]
    HELLOPEER --> GOSSIPPART[Participate in gossip]
    GOSSIPPART --> SYNCHELP[Help new peers sync]

    REJECTTX --> PARTICIPATEP2P

    style START fill:#e1f5ff
    style AUTHENTICATED fill:#fff4e1
    style UPDATESYNCSTATUS fill:#e8f5e9
    style SETSTATUS fill:#c8e6c9
    style PARTICIPATECONSENSUS fill:#c8e6c9
    style FINALIZE fill:#c8e6c9
    style ROLLBACK fill:#ffcdd2
```

---

## Key File References

### Peer Management Files
- **PeerManager**: `src/libs/peer/PeerManager.ts` (424 lines - singleton peer manager)
- **Peer**: `src/libs/peer/Peer.ts` (347 lines - peer connection and RPC methods)
- **Peer Bootstrap**: `src/libs/peer/routines/peerBootstrap.ts` (104 lines - peer verification on startup)
- **Peer Gossip**: `src/libs/peer/routines/peerGossip.ts` (285 lines - gossip protocol implementation)

### Validator Management Files
- **Validators Management**: `src/libs/blockchain/routines/validatorsManagement.ts` (43 lines - validator entrance validation)
  - ⚠️ **STATUS**: 📋 **PLANNED** - Core entrance logic has TODO comments
  - Currently implements: minimum stake validation
  - NOT implemented: blacklist check, kicked check, duplicate staking check
- **Validators Entity**: `src/model/entities/Validators.ts` (26 lines - database schema)

### Point/Reputation System Files
- **Point System**: `src/features/incentive/PointSystem.ts` (983 lines - comprehensive point management)
- **Incentive Manager**: `src/libs/blockchain/gcr/gcr_routines/IncentiveManager.ts` (138 lines - hooks for identity linking)

### Related Files
- **GCR Main Entity**: `src/model/entities/GCRv2/GCR_Main.ts` (points stored in GCR)
- **Referrals**: `src/features/incentive/referrals.ts` (referral code management)

---

## Peer & Validator Management Principles

1. **Decentralized Peer Discovery**: Gossip protocol ensures all nodes have consistent peer lists

2. **Cryptographic Authentication**: All peers verified with ed25519 signatures before trust

3. **Sync-Based Eligibility**: Only synced peers (sync.status = true) can participate in consensus

4. **Online/Offline Resilience**: Automatic retry logic for offline peers, timeout detection during consensus

5. **Deterministic Validator Selection**: CVSA algorithm ensures all nodes select same shard members

6. **Reputation-Based Incentives**: Points awarded for identity linking, stored in GCR, encourage network participation

7. **Minimal Stake Requirement**: 10^25 minimum stake to become validator (configurable in genesis)

8. **Peer List Persistence**: Peer list saved to demos_peerlist.json and peer_list.log for recovery

9. **RPC-Based Communication**: All peer communication via JSON-RPC with timeout and retry logic

10. **Separation of Concerns**: Peers handle networking, validators handle consensus, GCR handles state
