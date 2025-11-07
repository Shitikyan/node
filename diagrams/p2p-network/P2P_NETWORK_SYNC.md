# P2P Network & Synchronization - Mermaid Diagrams

## Overview

Demos blockchain uses a peer-to-peer network architecture for block/transaction propagation, synchronization, and RPC communication. The system includes fast sync for catching up with the network, rate limiting for security, and comprehensive API endpoints for node queries.

**Key Features:**
- **Fast Sync**: Efficient blockchain synchronization from peers
- **RPC Server**: HTTP-based request/response using Bun
- **Signature Authentication**: Ed25519/ML-DSA/Falcon signature verification
- **Rate Limiting**: IP-based request throttling and identity tx limits
- **Node Call API**: Public endpoints for blockchain queries
- **Mempool Sync**: Peer-to-peer transaction pool synchronization
- **Peer Discovery**: Dynamic peer connection and gossip protocol

## 1. P2P Network Architecture Overview

```mermaid
graph TB
    subgraph "Node A: Local Node"
        RPCSRVR[RPC Server on Bun]
        HANDLERS[Endpoint Handlers]
        PEERLIST[PeerManager Singleton]
        SYNC[Sync Routine]
        MEMPOOL[Mempool v2]
        CHAIN[Blockchain Database]
        GCRSYNC[GCR State]
        RATELIMIT[Rate Limiter Middleware]

        RPCSRVR --> RATELIMIT
        RATELIMIT --> HANDLERS
        HANDLERS --> MEMPOOL
        HANDLERS --> CHAIN
        HANDLERS --> GCRSYNC
        HANDLERS --> PEERLIST
        SYNC --> CHAIN
        SYNC --> MEMPOOL
        SYNC --> GCRSYNC
        SYNC --> PEERLIST
    end

    subgraph "Node B: Remote Peer"
        PEERBRPC[RPC Server]
        PEERBCHAIN[Blockchain]
        PEERBMEMPOOL[Mempool]
    end

    subgraph "Node C: Remote Peer"
        PEERCRPC[RPC Server]
        PEERCCHAIN[Blockchain]
        PEERCMEMPOOL[Mempool]
    end

    subgraph "Client Applications"
        BROWSER[Web Browser / DApp]
        SDK[Demos SDK Client]
        CLI[CLI Tools]
    end

    subgraph "Communication Protocols"
        HTTP[HTTP / HTTPS]
        WEBSOCKET[WebSocket future]
        RPC[JSON-RPC Protocol]
    end

    BROWSER --> HTTP
    SDK --> HTTP
    CLI --> HTTP
    HTTP --> RPCSRVR

    RPCSRVR <-->|Block requests<br/>Transaction queries<br/>Mempool sync| PEERBRPC
    RPCSRVR <-->|Peer gossip<br/>Hello peer<br/>Sync blocks| PEERCRPC

    PEERBRPC <--> PEERBCHAIN
    PEERCRPC <--> PEERCCHAIN

    style RPCSRVR fill:#e1f5ff
    style HANDLERS fill:#fff4e1
    style SYNC fill:#e8f5e9
    style RATELIMIT fill:#ffcdd2
```

## 2. Fast Sync Process & Block Downloading

```mermaid
sequenceDiagram
    participant LocalNode as Local Node Sync
    participant PeerMgr as PeerManager
    participant Peer1 as Peer 1
    participant Peer2 as Peer 2
    participant Chain as Local Blockchain
    participant GCR as Local GCR State

    Note over LocalNode,GCR: Fast Sync Initialization

    LocalNode->>Chain: Get our lastBlockNumber
    Chain->>LocalNode: Return localBlockNumber

    LocalNode->>PeerMgr: Get all peers
    PeerMgr->>LocalNode: Return peer list

    loop For each peer
        LocalNode->>Peer1: RPC: getLastBlockNumber
        Peer1->>LocalNode: Return peerBlockNumber
        LocalNode->>Peer2: RPC: getLastBlockNumber
        Peer2->>LocalNode: Return peerBlockNumber
    end

    LocalNode->>LocalNode: Find highest block peer
    LocalNode->>LocalNode: Calculate gap: peerMax minus localBlock

    alt Gap is 0
        LocalNode->>LocalNode: Already synced, exit
    else Gap greater than 0
        LocalNode->>LocalNode: Start sync process

        Note over LocalNode,GCR: Verify Genesis and Last Block Integrity

        LocalNode->>Peer1: RPC: getBlockByNumber 0
        Peer1->>LocalNode: Return genesis block
        LocalNode->>Chain: Get our genesis hash
        Chain->>LocalNode: Return ourGenesisHash
        LocalNode->>LocalNode: Compare genesis hashes

        alt Genesis mismatch
            LocalNode->>LocalNode: EXIT: Different network
        else Genesis match
            LocalNode->>Peer1: RPC: getBlockByNumber lastLocal
            Peer1->>LocalNode: Return block at lastLocal
            LocalNode->>Chain: Get our block hash at lastLocal
            Chain->>LocalNode: Return ourLastHash
            LocalNode->>LocalNode: Verify hash coherence
        end

        Note over LocalNode,GCR: Download Missing Blocks

        loop For each missing block from localBlock+1 to peerMax
            LocalNode->>Peer1: RPC: getBlockByNumber N
            Peer1->>LocalNode: Return block N

            alt Block not found or peer unreachable
                LocalNode->>LocalNode: Switch to next highest peer
                LocalNode->>Peer2: RPC: getBlockByNumber N
                Peer2->>LocalNode: Return block N
            end

            LocalNode->>LocalNode: Validate block structure
            LocalNode->>LocalNode: Verify previousHash matches
            LocalNode->>LocalNode: Verify block hash correct

            LocalNode->>Chain: Insert block into blockchain
            Chain->>LocalNode: Block inserted

            Note over LocalNode,GCR: Download Transactions for Block

            loop For each tx hash in block
                LocalNode->>Peer1: RPC: getTxByHash hash
                Peer1->>LocalNode: Return transaction
                LocalNode->>LocalNode: Validate tx signature
                LocalNode->>LocalNode: Validate tx hash
            end

            LocalNode->>GCR: Apply GCR edits from transactions
            GCR->>GCR: Update balances, nonces, identities
            GCR->>LocalNode: State updated

            LocalNode->>GCR: Calculate native_tables_hashes
            GCR->>LocalNode: Return calculated hashes
            LocalNode->>LocalNode: Compare with block hashes

            alt Hashes mismatch
                LocalNode->>LocalNode: State corruption, reject block
            else Hashes match
                LocalNode->>Chain: Save transactions to database
                LocalNode->>GCR: Save GCR state to database
                LocalNode->>LocalNode: Merge peerlist from block
                LocalNode->>LocalNode: Increment localBlockNumber
            end
        end

        LocalNode->>LocalNode: Sync complete, set syncStatus = true
    end
```

## 3. RPC Server Architecture & Request Processing

```mermaid
flowchart TD
    START([Client sends HTTP POST request])

    START --> RATELIMIT[Rate Limiter Middleware]

    RATELIMIT --> CHECKIP{Client IP<br/>whitelisted?}
    CHECKIP -->|yes| PARSEPARSE
    CHECKIP -->|no| CHECKLIMIT{Request<br/>limit exceeded?}

    CHECKLIMIT -->|yes| BLOCK[Return 429 Rate Limit Exceeded]
    CHECKLIMIT -->|no| PARSEPARSE

    PARSEPARSE[Parse JSON body]
    PARSEPARSE --> VALIDRPC{Valid<br/>RPCRequest?}

    VALIDRPC -->|no| BADREQUEST[Return 400 Invalid Request]
    VALIDRPC -->|yes| CHECKMETHOD{Method requires<br/>authentication?}

    CHECKMETHOD -->|no| PROCESSDIRECT
    CHECKMETHOD -->|yes| GETHEAD[Get headers: signature and identity]

    GETHEAD --> VALIDATEHEAD[Validate headers]

    subgraph "Header Validation"
        VALIDATEHEAD --> CHECKEXIST{Signature and<br/>identity exist?}
        CHECKEXIST -->|no| HEADERR1[Return 401 Missing Headers]

        CHECKEXIST -->|yes| PARSEID[Parse identity algorithm:pubkey]
        PARSEID --> VERIFYSIG[Verify signature with ucrypto]

        VERIFYSIG --> SIGVALID{Signature<br/>valid?}
        SIGVALID -->|no| HEADERR2[Return 401 Invalid Signature]
        SIGVALID -->|yes| EXTRACTSENDER[Extract sender identity]
    end

    EXTRACTSENDER --> PROCESSDIRECT[Process payload]

    subgraph "Payload Processing Switch"
        PROCESSDIRECT --> SWITCHMETHOD{payload.method}

        SWITCHMETHOD -->|ping| PONG[Return pong]
        SWITCHMETHOD -->|execute| EXECUTE[manageExecution]
        SWITCHMETHOD -->|nativeBridge| NATIVEBRIDGE[manageNativeBridge]
        SWITCHMETHOD -->|hello_peer| HELLOPEER[manageHelloPeer]
        SWITCHMETHOD -->|mempool| MEMPOOL[handleMempool]
        SWITCHMETHOD -->|peerlist| PEERLIST[handlePeerlist]
        SWITCHMETHOD -->|auth| AUTH[manageAuth]
        SWITCHMETHOD -->|nodeCall| NODECALL[manageNodeCall]
        SWITCHMETHOD -->|login_request| LOGINREQ[handleLoginRequest]
        SWITCHMETHOD -->|login_response| LOGINRESP[handleLoginResponse]
        SWITCHMETHOD -->|consensus_routine| CONSENSUS[manageConsensusRoutines]
        SWITCHMETHOD -->|gcr_routine| GCRR[manageGCRRoutines]
        SWITCHMETHOD -->|bridge| BRIDGE[manageBridges]
        SWITCHMETHOD -->|web2ProxyRequest| WEB2[handleWeb2ProxyRequest]
        SWITCHMETHOD -->|rate-limit/unblock| UNBLOCK[RateLimiter unblock]
        SWITCHMETHOD -->|getCampaignData| CAMPAIGN[GCR.getCampaignData]
        SWITCHMETHOD -->|awardPoints| AWARD[GCR.awardPoints]
        SWITCHMETHOD -->|default| NOTIMPL[Return 501 Not Implemented]
    end

    PONG --> RETURNRESP[Return RPCResponse]
    EXECUTE --> RETURNRESP
    NATIVEBRIDGE --> RETURNRESP
    HELLOPEER --> RETURNRESP
    MEMPOOL --> RETURNRESP
    PEERLIST --> RETURNRESP
    AUTH --> RETURNRESP
    NODECALL --> RETURNRESP
    LOGINREQ --> RETURNRESP
    LOGINRESP --> RETURNRESP
    CONSENSUS --> RETURNRESP
    GCRR --> RETURNRESP
    BRIDGE --> RETURNRESP
    WEB2 --> RETURNRESP
    UNBLOCK --> RETURNRESP
    CAMPAIGN --> RETURNRESP
    AWARD --> RETURNRESP
    NOTIMPL --> RETURNRESP

    RETURNRESP --> JSONRESP[JSON response to client]
    JSONRESP --> END([Request complete])

    BLOCK --> END
    BADREQUEST --> END
    HEADERR1 --> END
    HEADERR2 --> END

    style START fill:#e1f5ff
    style RATELIMIT fill:#ffcdd2
    style PROCESSDIRECT fill:#fff4e1
    style RETURNRESP fill:#c8e6c9
    style END fill:#c8e6c9
```

## 4. Block & Transaction Propagation

```mermaid
sequenceDiagram
    participant ProducerNode as Block Producer (Secretary)
    participant Shard as Shard Members
    participant Network as P2P Network
    participant ObserverNodes as Observer Nodes

    Note over ProducerNode,ObserverNodes: Block Creation Phase (Consensus Phase 5-7)

    ProducerNode->>ProducerNode: Create candidate block
    ProducerNode->>ProducerNode: Hash native tables
    ProducerNode->>ProducerNode: Calculate block hash
    ProducerNode->>ProducerNode: Sign block hash

    Note over ProducerNode,Shard: Phase 6: Vote on Block

    ProducerNode->>Shard: RPC: proposeBlockHash with hash and validation_data
    Shard->>Shard: Verify in same shard
    Shard->>Shard: Get our candidateBlock
    Shard->>Shard: Compare hashes

    alt Hash matches
        Shard->>Shard: Sign block hash
        Shard->>ProducerNode: Return 200 with signature
    else Hash mismatch
        Shard->>ProducerNode: Return error
    end

    ProducerNode->>ProducerNode: Collect signatures
    ProducerNode->>ProducerNode: Calculate vote percentage

    alt Greater or equal 67 percent
        ProducerNode->>ProducerNode: Block valid

        Note over ProducerNode,ObserverNodes: Phase 7: Finalize Block

        ProducerNode->>ProducerNode: Save GCR state
        ProducerNode->>ProducerNode: Save transactions
        ProducerNode->>ProducerNode: Save block to database
        ProducerNode->>ProducerNode: Update sharedState

        Note over ProducerNode,ObserverNodes: Block Propagation to Network

        ProducerNode->>Network: Broadcast block to all peers
        Network->>ObserverNodes: Forward block

        ObserverNodes->>ObserverNodes: Receive block notification
        ObserverNodes->>Network: RPC: getBlockByHash hash
        Network->>ObserverNodes: Return full block

        ObserverNodes->>ObserverNodes: Validate block structure
        ObserverNodes->>ObserverNodes: Verify previousHash
        ObserverNodes->>ObserverNodes: Verify signatures (67 percent check)

        loop For each tx hash in block
            ObserverNodes->>Network: RPC: getTxByHash hash
            Network->>ObserverNodes: Return transaction
            ObserverNodes->>ObserverNodes: Validate signature
        end

        ObserverNodes->>ObserverNodes: Apply GCR edits
        ObserverNodes->>ObserverNodes: Calculate native hashes
        ObserverNodes->>ObserverNodes: Compare hashes

        alt Hashes match
            ObserverNodes->>ObserverNodes: Save block and txs
            ObserverNodes->>ObserverNodes: Update lastBlockNumber
            ObserverNodes->>ObserverNodes: Set syncStatus = true
        else Hashes mismatch
            ObserverNodes->>ObserverNodes: Reject block, request again
        end
    else Less than 67 percent
        ProducerNode->>ProducerNode: Block invalid, rollback GCR
    end

    Note over ProducerNode,ObserverNodes: Transaction Propagation During Consensus

    ProducerNode->>ProducerNode: User submits transaction
    ProducerNode->>ProducerNode: Validate and add to mempool

    Note over ProducerNode,Shard: Consensus Phase 1: Merge Mempool

    ProducerNode->>Shard: RPC: mempool with transactions array
    Shard->>Shard: Receive transactions
    Shard->>Shard: Validate each transaction
    Shard->>Shard: Add valid txs to local mempool
    Shard->>ProducerNode: Return 200 with merged mempool
```

## 5. Peer Discovery & Connection Management

```mermaid
flowchart TD
    START([Node startup])

    START --> LOADCONFIG[Load bootstrap peers from config]
    LOADCONFIG --> INITPM[Initialize PeerManager singleton]

    INITPM --> CONNECTBOOT{Have bootstrap<br/>peers?}
    CONNECTBOOT -->|yes| LOOPBOOT[Loop through bootstrap peers]
    CONNECTBOOT -->|no| WAITINCOMING[Wait for incoming connections]

    LOOPBOOT --> CREATEPEER[Create Peer object from connection string]
    CREATEPEER --> HELLOPEER[Send hello_peer RPC]

    HELLOPEER --> HEPRESP{Response<br/>200?}
    HEPRESP -->|yes| VERIFYSIG[Verify peer signature]
    HEPRESP -->|no| SKIPBOOT[Skip this bootstrap peer]

    VERIFYSIG --> SIGOK{Signature<br/>valid?}
    SIGOK -->|yes| ADDPEER[Add peer to PeerManager]
    SIGOK -->|no| SKIPBOOT

    ADDPEER --> REQPEERLIST[Request peer's peerlist]
    REQPEERLIST --> MERGELIST[Merge peerlist]

    MERGELIST --> LOOPPEERLIST{For each new<br/>peer in list}
    LOOPPEERLIST -->|more| HELLOPEER2[Send hello_peer to new peer]
    LOOPPEERLIST -->|done| STARTGOSSIP

    HELLOPEER2 --> HEPRESP2{Response<br/>200?}
    HEPRESP2 -->|yes| ADDPEER2[Add to PeerManager]
    HEPRESP2 -->|no| SKIP2[Skip peer]

    ADDPEER2 --> LOOPPEERLIST
    SKIP2 --> LOOPPEERLIST
    SKIPBOOT --> LOOPBOOT

    STARTGOSSIP[Start peer gossip routine]

    subgraph "Peer Gossip Protocol (Every 30s)"
        STARTGOSSIP --> GETALLPEERS[Get all peers from PeerManager]
        GETALLPEERS --> LOOPGOSSIP{For each<br/>peer}

        LOOPGOSSIP -->|more| SENDGOSSIP[RPC: peerlist with our peers]
        LOOPGOSSIP -->|done| SLEEPGOSSIP[Sleep 30 seconds]

        SENDGOSSIP --> RECEIVEGOSSIP[Receive peer's peerlist]
        RECEIVEGOSSIP --> MERGERECV[Merge received peerlist]
        MERGERECV --> LOOPGOSSIP

        SLEEPGOSSIP --> GETALLPEERS
    end

    WAITINCOMING --> RECVINCOMING[Receive incoming hello_peer]
    RECVINCOMING --> AUTHPEER[Authenticate peer signature]
    AUTHPEER --> ADDTOMANAGER[Add to PeerManager]
    ADDTOMANAGER --> SENDOURPEERS[Send our peerlist]

    style START fill:#e1f5ff
    style ADDPEER fill:#c8e6c9
    style STARTGOSSIP fill:#fff4e1
```

## 6. Request Authentication & Signature Validation

```mermaid
flowchart TD
    START([RPC request received])

    START --> CHECKNOAUTH{Method in<br/>noAuthMethods?}
    CHECKNOAUTH -->|yes| PROCESS[Process without auth]
    CHECKNOAUTH -->|no| GETHEADERS[Get headers from request]

    GETHEADERS --> HASSIG{Has signature<br/>header?}
    HASSIG -->|no| ERROR1[Return 401: Missing signature]

    HASSIG -->|yes| HASID{Has identity<br/>header?}
    HASID -->|no| ERROR2[Return 401: Missing identity]

    HASID -->|yes| PARSEID[Parse identity header]

    subgraph "Identity Format Parsing"
        PARSEID --> SPLITID[Split by colon]
        SPLITID --> CHECKFORMAT{Format is<br/>algorithm:pubkey?}

        CHECKFORMAT -->|yes| EXTRACTALG[Extract algorithm and pubkey]
        CHECKFORMAT -->|no| DEFAULTED[Default to ed25519]

        EXTRACTALG --> CHECKSUPPORTED{Algorithm<br/>supported?}
        CHECKSUPPORTED -->|yes| CONSTRUCTSIG
        CHECKSUPPORTED -->|no| ERROR3[Return 401: Unsupported algorithm]

        DEFAULTED --> CONSTRUCTSIG[Construct signedObject]
    end

    CONSTRUCTSIG --> HEXTOBIN[Convert hex signature and pubkey to Uint8Array]
    HEXTOBIN --> PREPAREMSG[Prepare message: encode pubkey]

    PREPAREMSG --> CALLVERIFY[Call ucrypto.verify with signedObject]

    subgraph "Cryptographic Verification"
        CALLVERIFY --> VERIFYSIG{Signature<br/>valid?}

        VERIFYSIG -->|yes| SIGVALID[Log: Signature validated]
        VERIFYSIG -->|no| SIGINVALID[Log: Invalid signature]

        SIGVALID --> CHECKPROTECTED{Method in<br/>PROTECTED_ENDPOINTS?}
        SIGINVALID --> ERROR4[Return 401: Invalid signature]

        CHECKPROTECTED -->|yes| CHECKSUDO{Sender is<br/>SUDO_PUBKEY?}
        CHECKPROTECTED -->|no| SETAUTHSENDER

        CHECKSUDO -->|yes| SETAUTHSENDER[Set authenticated sender]
        CHECKSUDO -->|no| ERROR5[Return 401: Unauthorized sender]
    end

    SETAUTHSENDER --> PROCESS
    PROCESS --> CALLHANDLER[Call appropriate handler with sender]
    CALLHANDLER --> RETURNRESP[Return RPCResponse]
    RETURNRESP --> END([Request complete])

    ERROR1 --> END
    ERROR2 --> END
    ERROR3 --> END
    ERROR4 --> END
    ERROR5 --> END

    style START fill:#e1f5ff
    style CALLVERIFY fill:#fff4e1
    style SIGVALID fill:#c8e6c9
    style SIGINVALID fill:#ffcdd2
    style PROCESS fill:#c8e6c9
```

## 7. Node Call API & Public Endpoints

```mermaid
graph TB
    subgraph "Public GET Endpoints (No Auth)"
        ROOT["/"]
        INFO["/info"]
        VERSION["/version"]
        PUBKEY["/publickey"]
        CONNSTR["/connectionstring"]
        PEERLIST["/peerlist"]
        LOGS["/public_logs"]
        DIAG["/diagnostics"]
        MCP["/mcp"]
        GENESIS["/genesis"]
        RATELIMITSTATS["/rate-limit/stats"]
    end

    subgraph "Node Call Messages (POST / via nodeCall)"
        GETPEERINFO["getPeerInfo"]
        GETPEERLIST["getPeerlist"]
        GETPEERLISTHASH["getPeerlistHash"]
        GETLASTBLOCKNUM["getLastBlockNumber"]
        GETLASTBLOCK["getLastBlock"]
        GETLASTBLOCKHASH["getLastBlockHash"]
        GETBLOCKBYNUM["getBlockByNumber"]
        GETBLOCKBYHASH["getBlockByHash"]
        GETBLOCKS["getBlocks"]
        GETTXBYHASH["getTxByHash"]
        GETTXS["getTransactions"]
        GETMEMPOOL["getMempool"]
        GETADDRESSINFO["getAddressInfo"]
        GETADDRESSNONCE["getAddressNonce"]
        GETNATIVESTATUS["getNativeStatus"]
        GETNATIVEPROPS["getNativeProperties"]
        GETNATIVESUBNETS["getNativeSubnetsTxs"]
        GETTXHISTORY["getTransactionHistory"]
        GETTWEET["getTweet"]
        GETPEERTIME["getPeerTime"]
    end

    subgraph "Backend Services"
        CHAINSVC[Chain Service]
        GCRSVC[GCR Service]
        MEMPOOLSVC[Mempool Service]
        PEERSVC[PeerManager Service]
        STATESVC[SharedState Service]
        LOGSVC[Logger Service]
        IDENTITYSVC[Identity Services]
    end

    ROOT --> STATESVC
    INFO --> STATESVC
    VERSION --> STATESVC
    PUBKEY --> STATESVC
    CONNSTR --> STATESVC
    PEERLIST --> PEERSVC
    LOGS --> LOGSVC
    DIAG --> LOGSVC
    MCP --> STATESVC
    GENESIS --> CHAINSVC
    RATELIMITSTATS --> STATESVC

    GETPEERINFO --> STATESVC
    GETPEERLIST --> PEERSVC
    GETPEERLISTHASH --> PEERSVC
    GETLASTBLOCKNUM --> CHAINSVC
    GETLASTBLOCK --> CHAINSVC
    GETLASTBLOCKHASH --> CHAINSVC
    GETBLOCKBYNUM --> CHAINSVC
    GETBLOCKBYHASH --> CHAINSVC
    GETBLOCKS --> CHAINSVC
    GETTXBYHASH --> CHAINSVC
    GETTXS --> CHAINSVC
    GETMEMPOOL --> MEMPOOLSVC
    GETADDRESSINFO --> GCRSVC
    GETADDRESSNONCE --> GCRSVC
    GETNATIVESTATUS --> GCRSVC
    GETNATIVEPROPS --> GCRSVC
    GETNATIVESUBNETS --> GCRSVC
    GETTXHISTORY --> CHAINSVC
    GETTWEET --> IDENTITYSVC
    GETPEERTIME --> STATESVC

    style ROOT fill:#e3f2fd
    style INFO fill:#e3f2fd
    style VERSION fill:#e3f2fd
    style PUBKEY fill:#e3f2fd
    style CONNSTR fill:#e3f2fd
    style PEERLIST fill:#e3f2fd
    style LOGS fill:#e3f2fd
    style DIAG fill:#e3f2fd
    style MCP fill:#e3f2fd
    style GENESIS fill:#e3f2fd
    style RATELIMITSTATS fill:#e3f2fd

    style CHAINSVC fill:#c8e6c9
    style GCRSVC fill:#c8e6c9
    style MEMPOOLSVC fill:#c8e6c9
    style PEERSVC fill:#c8e6c9
```

## 8. Mempool Synchronization Between Peers

```mermaid
sequenceDiagram
    participant Node1 as Node 1 (has new txs)
    participant Node2 as Node 2 (shard member)
    participant Node3 as Node 3 (shard member)
    participant Mempool1 as Node1 Mempool
    participant Mempool2 as Node2 Mempool
    participant Mempool3 as Node3 Mempool

    Note over Node1,Mempool3: Scenario: Node1 receives new transaction

    Node1->>Mempool1: User submits transaction
    Mempool1->>Mempool1: Validate transaction
    Mempool1->>Mempool1: Add to mempool
    Mempool1->>Node1: Transaction added

    Note over Node1,Mempool3: Consensus Phase 1: Mempool Merge

    Node1->>Node1: Check if in consensus mode
    Node1->>Node1: Get shard members

    loop For each shard member
        Node1->>Node2: RPC: mempool with transactions array
        Node1->>Node3: RPC: mempool with transactions array
    end

    Note over Node2,Mempool2: Node2 processes mempool request

    Node2->>Mempool2: Receive transactions array
    Mempool2->>Mempool2: Loop through received txs

    loop For each transaction
        Mempool2->>Mempool2: Check if tx already in mempool by hash

        alt Transaction not in mempool
            Mempool2->>Mempool2: Validate transaction structure
            Mempool2->>Mempool2: Verify signature
            Mempool2->>Mempool2: Verify hash
            Mempool2->>Mempool2: Check reference block validity

            alt All validations pass
                Mempool2->>Mempool2: Add to mempool
                Mempool2->>Mempool2: Increment added count
            else Validation fails
                Mempool2->>Mempool2: Skip transaction
                Mempool2->>Mempool2: Log error
            end
        else Transaction already exists
            Mempool2->>Mempool2: Skip duplicate
        end
    end

    Mempool2->>Node2: Return merged mempool snapshot
    Node2->>Node1: Return 200 with merged mempool

    Note over Node3,Mempool3: Node3 processes similarly

    Node3->>Mempool3: Receive and validate transactions
    Mempool3->>Mempool3: Add new valid transactions
    Mempool3->>Node3: Return merged mempool
    Node3->>Node1: Return 200 with merged mempool

    Node1->>Node1: All shard members synced

    Note over Node1,Mempool3: Later: Consensus selects transactions

    Node1->>Mempool1: Get ordered transactions
    Mempool1->>Node1: Return transactions sorted by timestamp

    Node1->>Node1: Create block with ordered txs
    Node1->>Node1: After block finalization, remove txs from mempool

    Node2->>Mempool2: Remove finalized transactions
    Node3->>Mempool3: Remove finalized transactions
```

## 9. Rate Limiting & Security Middleware

```mermaid
flowchart TD
    START([HTTP request received])

    START --> MIDDLEWARE[Rate Limiter Middleware]
    MIDDLEWARE --> GETIP[Extract client IP from request]

    GETIP --> CHECKWHITELIST{IP in<br/>whitelist?}
    CHECKWHITELIST -->|yes| ALLOW[Allow request, skip limits]
    CHECKWHITELIST -->|no| GETIPDATA[Get IP data from rate limiter map]

    GETIPDATA --> IPEXISTS{IP data<br/>exists?}
    IPEXISTS -->|no| CREATEIPDATA[Create new IP data entry]
    IPEXISTS -->|yes| CHECKBLOCKED

    CREATEIPDATA --> INITDATA[Initialize: count=0, lastSeen=now, blocked=false]
    INITDATA --> CHECKBLOCKED

    CHECKBLOCKED{IP<br/>blocked?}
    CHECKBLOCKED -->|yes| RETURNBLOCKED[Return 429: Rate limit exceeded]
    CHECKBLOCKED -->|no| CHECKGLOBAL[Check global request limit]

    subgraph "Global Request Rate Limiting"
        CHECKGLOBAL --> CHECKWINDOW{Within same<br/>time window?}
        CHECKWINDOW -->|yes| INCREMENT[Increment request count]
        CHECKWINDOW -->|no| RESETWINDOW[Reset window, count=1]

        INCREMENT --> OVERLIMIT{Count greater<br/>than limit?}
        OVERLIMIT -->|yes| BLOCKIP[Mark IP as blocked]
        OVERLIMIT -->|no| ALLOWGLOBAL

        BLOCKIP --> RETURNBLOCKED
        RESETWINDOW --> ALLOWGLOBAL[Update lastSeen timestamp]
    end

    ALLOWGLOBAL --> PARSEMETHOD[Parse request method]
    PARSEMETHOD --> CHECKEXECUTE{Method is<br/>execute?}

    CHECKEXECUTE -->|no| ALLOW
    CHECKEXECUTE -->|yes| CHECKEXTRA{Extra is<br/>confirmTx?}

    CHECKEXTRA -->|no| ALLOW
    CHECKEXTRA -->|yes| CHECKIDENTITY{Transaction<br/>type is identity?}

    CHECKIDENTITY -->|no| ALLOW
    CHECKIDENTITY -->|yes| IDENTITYLIMIT[Identity transaction rate limit]

    subgraph "Identity Transaction Per Block Limit"
        IDENTITYLIMIT --> CHECKBLOCK{Same<br/>block number?}
        CHECKBLOCK -->|yes| INCIDENTITY[Increment identity tx count]
        CHECKBLOCK -->|no| RESETBLOCK[Reset block, count=1]

        INCIDENTITY --> IDENTITYOVER{Count greater or equal<br/>txPerBlock limit?}
        IDENTITYOVER -->|yes| BLOCKIDENTITY[Block IP]
        IDENTITYOVER -->|no| ALLOW

        BLOCKIDENTITY --> RETURNIDENTITYBLOCK[Return 429: Identity tx limit exceeded]
        RESETBLOCK --> UPDATEBLOCKNUM[Update lastSeenBlockNumber]
        UPDATEBLOCKNUM --> ALLOW
    end

    ALLOW --> PROCESS[Process request normally]
    PROCESS --> LOGACCESS[Log access in IP data]
    LOGACCESS --> END([Request complete])

    RETURNBLOCKED --> END
    RETURNIDENTITYBLOCK --> END

    style START fill:#e1f5ff
    style CHECKWHITELIST fill:#fff4e1
    style ALLOW fill:#c8e6c9
    style BLOCKIP fill:#ffcdd2
    style BLOCKIDENTITY fill:#ffcdd2
    style PROCESS fill:#c8e6c9
```

## 10. Complete Network Communication Flow

```mermaid
stateDiagram-v2
    [*] --> NodeStartup: Boot node

    state "Node Startup" as NodeStartup {
        [*] --> LoadConfig
        LoadConfig: Load configuration
        LoadConfig --> InitRPCServer: Initialize RPC server
        InitRPCServer --> InitPeerManager: Initialize PeerManager
        InitPeerManager --> LoadBootstrap: Load bootstrap peers
        LoadBootstrap --> [*]: Ready
    }

    NodeStartup --> PeerDiscovery: Connect to network

    state "Peer Discovery" as PeerDiscovery {
        [*] --> HelloBootstrap
        HelloBootstrap: Send hello_peer to bootstrap
        HelloBootstrap --> VerifyBootstrap: Verify signatures
        VerifyBootstrap --> RequestPeerlist: Request peerlist
        RequestPeerlist --> MergePeers: Merge received peers
        MergePeers --> HelloNewPeers: Hello peer to new peers
        HelloNewPeers --> [*]: Peer discovery complete
    }

    PeerDiscovery --> Synchronization: Start sync

    state "Blockchain Synchronization" as Synchronization {
        [*] --> QueryPeers
        QueryPeers: Query peer block numbers
        QueryPeers --> CompareBlocks: Compare with local
        CompareBlocks --> CheckGap: Calculate block gap

        CheckGap --> Synced: Gap is 0
        CheckGap --> StartSync: Gap greater than 0

        StartSync --> VerifyIntegrity: Verify genesis and last block
        VerifyIntegrity --> DownloadBlocks: Download missing blocks
        DownloadBlocks --> DownloadTxs: Download transactions
        DownloadTxs --> ApplyGCR: Apply GCR edits
        ApplyGCR --> VerifyHashes: Verify native hashes
        VerifyHashes --> SaveBlock: Save block and txs
        SaveBlock --> CheckComplete: More blocks?

        CheckComplete --> DownloadBlocks: Yes
        CheckComplete --> Synced: No
    }

    Synchronization --> OperationalMode: Sync complete

    state "Operational Mode" as OperationalMode {
        [*] --> AcceptRequests
        AcceptRequests: RPC server accepting requests
        AcceptRequests --> ProcessAuth: Authenticate request
        ProcessAuth --> DispatchHandler: Dispatch to handler
        DispatchHandler --> ReturnResponse: Return response
        ReturnResponse --> AcceptRequests

        AcceptRequests --> ConsensusMode: Enter consensus
        ConsensusMode --> MergeMempool: Merge mempool with shard
        MergeMempool --> CreateBlock: Create block
        CreateBlock --> VoteBlock: Vote on block
        VoteBlock --> FinalizeBlock: Finalize valid block
        FinalizeBlock --> PropagateBlock: Propagate to network
        PropagateBlock --> AcceptRequests

        AcceptRequests --> PeerGossip: Periodic gossip
        PeerGossip --> UpdatePeerlist: Update peerlist
        UpdatePeerlist --> AcceptRequests
    }

    OperationalMode --> Synchronization: Detect out of sync
    OperationalMode --> [*]: Shutdown

    note right of PeerDiscovery
        Peer Discovery Features:
        - Hello peer handshake
        - Cryptographic verification
        - Peerlist merging
        - Recursive peer discovery
    end note

    note right of Synchronization
        Sync Features:
        - Fast sync from highest peer
        - Genesis verification
        - Integrity checks
        - GCR state rebuilding
        - Native hash verification
    end note

    note right of OperationalMode
        Operational Features:
        - RPC request handling
        - Consensus participation
        - Block propagation
        - Mempool synchronization
        - Peer gossip protocol
        - Rate limiting
    end note
```

---

## Key File References

### Synchronization Files
- **Sync**: `src/libs/blockchain/routines/Sync.ts` (545 lines - fast sync, block downloading, integrity verification)
- **Sync GCR Tables**: Sync.ts:432 (apply GCR edits during sync)
- **Ask Txs For Block**: Sync.ts:450 (download transactions for block)
- **Merge Peerlist**: Sync.ts:477 (merge peerlist from block)

### RPC Server Files
- **Server RPC**: `src/libs/network/server_rpc.ts` (520 lines - Bun HTTP server, request processing, authentication)
- **Validate Headers**: server_rpc.ts:80 (signature verification)
- **Process Payload**: server_rpc.ts:144 (method dispatch switch case)
- **Rate Limiter**: `src/libs/network/middleware/rateLimiter.ts` (rate limiting middleware)

### Endpoint Handler Files
- **Endpoint Handlers**: `src/libs/network/endpointHandlers.ts` (681 lines - transaction validation, execution, mempool, peerlist)
- **Handle Validate Transaction**: endpointHandlers.ts:80 (transaction validation workflow)
- **Handle Execute Transaction**: endpointHandlers.ts:169 (transaction execution workflow)
- **Handle Mempool**: endpointHandlers.ts:629 (mempool merge logic)
- **Handle Peerlist**: endpointHandlers.ts:659 (peerlist merge logic)

### Node Call API Files
- **Manage Node Call**: `src/libs/network/manageNodeCall.ts` (250+ lines - public API endpoints)
- **Node Call Interface**: manageNodeCall.ts:28 (NodeCall message structure)

### Network Client Files
- **Network Client**: `src/client/libs/network.ts` (30 lines - Socket.io RPC connection)

---

## P2P Network & Synchronization Principles

1. **Fast Sync Efficiency**: Download missing blocks sequentially from highest peer with integrity checks

2. **Genesis Verification**: Always verify genesis block matches before syncing from peer

3. **GCR State Rebuilding**: Apply GCR edits from transactions and verify native hashes

4. **Peer Switching**: If peer becomes unreachable during sync, switch to next highest peer

5. **Request Authentication**: All authenticated methods verify ed25519/ML-DSA/Falcon signatures

6. **Rate Limiting**: IP-based global limits and per-block identity transaction limits

7. **Mempool Synchronization**: Shard members merge mempools in consensus Phase 1

8. **Block Propagation**: Finalized blocks broadcast to network, observers download and verify

9. **Peer Gossip**: Periodic peerlist exchange (every 30s) for network discovery

10. **Public API**: Unauthenticated GET endpoints for blockchain queries and info
