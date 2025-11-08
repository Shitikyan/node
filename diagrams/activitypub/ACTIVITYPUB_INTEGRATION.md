# ActivityPub Integration - Comprehensive Diagrams

## ⚠️ IMPLEMENTATION STATUS: EXPERIMENTAL / LEGACY CODE

**CRITICAL**: This documentation describes **experimental code that is NOT actively used** in the blockchain. The ActivityPub integration code exists but has **0 imports** in production code and approximately **70% of documented features are unimplemented**.

### Implementation Status:
- **Data Types & Interfaces**: ✅ **IMPLEMENTED** - TypeScript interfaces in `feditypes.ts`
- **SQLite Storage Class**: ✅ **IMPLEMENTED** - Basic FediStore class in `fedistore.ts`
- **Express Server Skeleton**: ✅ **IMPLEMENTED** - Basic server setup in `fediverse.ts`
- **REST API**: ❌ **NOT IMPLEMENTED** - GET/PUT endpoints documented but not coded
- **Federation Protocol**: ❌ **NOT IMPLEMENTED** - WebFinger, HTTP signatures missing
- **Actor Discovery**: ❌ **NOT IMPLEMENTED** - WebFinger lookup not implemented
- **Inbox/Outbox Delivery**: ❌ **NOT IMPLEMENTED** - Message federation missing
- **HTTP Signatures**: ❌ **NOT IMPLEMENTED** - Request signing/verification missing
- **Collection Management**: ⚠️ **PARTIAL** - Some basic operations, getAllItems() missing
- **Follow Workflow**: ❌ **NOT IMPLEMENTED** - Accept/Reject flow missing
- **Social Interactions**: ❌ **NOT IMPLEMENTED** - Like, Announce, Reply missing

### What's Actually Implemented:
Located in `src/features/activitypub/`:
- ✅ `feditypes.ts` - TypeScript interfaces for ActivityPub objects (Actor, Activity, Object, Collection types)
- ✅ `fedistore.ts` - SQLite storage class with table creation and basic CRUD operations
- ✅ `fediverse.ts` - Express.js server skeleton with port 3000 listener
- ❌ Missing: getAllItems() method
- ❌ Missing: Federation protocol implementation
- ❌ Missing: HTTP signature verification
- ❌ Missing: WebFinger actor discovery
- ❌ Missing: Inbox/Outbox delivery logic

### Integration Status:
**NOT INTEGRATED**: These files are **not imported or used** by any production blockchain code. This is standalone experimental code for future ActivityPub federation exploration.

---

This document provides comprehensive Mermaid diagrams for the ActivityPub Integration **planned features** in Demos blockchain.

## Table of Contents
1. [ActivityPub Architecture Overview](#1-activitypub-architecture-overview)
2. [Actor Model & Collections](#2-actor-model--collections)
3. [SQLite Storage Schema](#3-sqlite-storage-schema)
4. [REST API Endpoints](#4-rest-api-endpoints)
5. [ActivityStreams Object Model](#5-activitystreams-object-model)
6. [Inbox/Outbox Message Flow](#6-inboxoutbox-message-flow)
7. [Federation Protocol](#7-federation-protocol)
8. [Collection Management Operations](#8-collection-management-operations)
9. [Data Persistence & Retrieval](#9-data-persistence--retrieval)
10. [Complete ActivityPub Lifecycle](#10-complete-activitypub-lifecycle)

---

## 1. ActivityPub Architecture Overview

```mermaid
graph TB
    subgraph "ActivityPub Integration Layer"
        AP[ActivityPub Server]
        FS[FediStore SQLite]
        FT[FediTypes Interfaces]
    end

    subgraph "Express.js Server"
        Router[Express Router]
        GET[GET /:collection/:id]
        PUT[PUT /:collection/:id]
        GETALL[GET /:collection]
    end

    subgraph "Storage Layer"
        DB[(SQLite Database)]
        Tables[Collections Tables]
        Indices[Indexes & Keys]
    end

    subgraph "ActivityStreams Protocol"
        Context[@context: activitystreams]
        Objects[ActivityPub Objects]
        Activities[Activities]
    end

    subgraph "Collections"
        Actors[Actors]
        Objects2[Objects]
        Activities2[Activities]
        Inboxes[Inboxes]
        Outboxes[Outboxes]
        Followers[Followers]
        Following[Following]
        Liked[Liked]
        Collections2[Collections]
        Blocked[Blocked]
        Rejections[Rejections]
        Rejecteds[Rejecteds]
        Shares[Shares]
        Likes[Likes]
    end

    AP --> Router
    Router --> GET
    Router --> PUT
    Router --> GETALL

    AP --> FS
    FS --> DB
    DB --> Tables
    Tables --> Actors
    Tables --> Objects2
    Tables --> Activities2
    Tables --> Inboxes
    Tables --> Outboxes
    Tables --> Followers
    Tables --> Following
    Tables --> Liked
    Tables --> Collections2
    Tables --> Blocked
    Tables --> Rejections
    Tables --> Rejecteds
    Tables --> Shares
    Tables --> Likes

    FT --> Context
    Context --> Objects
    Context --> Activities

    GET --> FS
    PUT --> FS
    GETALL --> FS

    style AP fill:#e1f5ff
    style FS fill:#fff4e1
    style DB fill:#e8f5e9
    style Context fill:#f3e5f5
```

---

## 2. Actor Model & Collections

```mermaid
classDiagram
    class ActivityPubObject {
        +string @context
        +string type
        +string id
        +string actor
        +string object
    }

    class Actor {
        +string name
        +string inbox
        +string outbox
        +string followers
        +string following
        +string liked
        +string preferredUsername
        +string summary
        +PublicKey publicKey
    }

    class PublicKey {
        +string id
        +string owner
        +string publicKeyPem
    }

    class Collection {
        +string type "Collection"
        +number totalItems
        +array items
        +string first
        +string last
    }

    class OrderedCollection {
        +string type "OrderedCollection"
        +number totalItems
        +array orderedItems
        +string first
        +string last
    }

    class Activity {
        +string type
        +string actor
        +string object
        +string target
        +string to
        +string cc
        +string published
    }

    class Note {
        +string type "Note"
        +string attributedTo
        +string content
        +string published
        +string to
        +string cc
        +string inReplyTo
    }

    ActivityPubObject <|-- Actor
    ActivityPubObject <|-- Collection
    ActivityPubObject <|-- Activity
    ActivityPubObject <|-- Note
    Collection <|-- OrderedCollection
    Actor --> PublicKey
    Activity --> Actor : references
    Note --> Actor : attributedTo

    note for Actor "Represents federated users\nwith inbox/outbox endpoints"
    note for Collection "Container for multiple\nActivityPub objects"
    note for Activity "Actions performed by actors\n(Create, Follow, Like, etc.)"
```

---

## 3. SQLite Storage Schema

```mermaid
erDiagram
    ACTORS {
        TEXT id PK
        TEXT type
        TEXT name
        TEXT inbox
        TEXT outbox
        TEXT followers
        TEXT following
        TEXT liked
    }

    OBJECTS {
        TEXT id PK
        TEXT type
        TEXT attributedTo
        TEXT content
    }

    ACTIVITIES {
        TEXT id PK
        TEXT type
        TEXT actor
        TEXT object
    }

    INBOXES {
        TEXT id PK
        TEXT owner
        TEXT content
    }

    OUTBOXES {
        TEXT id PK
        TEXT owner
        TEXT content
    }

    FOLLOWERS {
        TEXT id PK
        TEXT owner
        TEXT actor
    }

    FOLLOWINGS {
        TEXT id PK
        TEXT owner
        TEXT actor
    }

    LIKEDS {
        TEXT id PK
        TEXT owner
        TEXT object
    }

    COLLECTIONS {
        TEXT id PK
        TEXT owner
        TEXT items
    }

    BLOCKEDS {
        TEXT id PK
        TEXT owner
        TEXT actor
    }

    REJECTIONS {
        TEXT id PK
        TEXT owner
        TEXT activity
    }

    REJECTEDS {
        TEXT id PK
        TEXT owner
        TEXT activity
    }

    SHARES {
        TEXT id PK
        TEXT owner
        TEXT object
    }

    LIKES {
        TEXT id PK
        TEXT owner
        TEXT object
    }

    ACTORS ||--o{ INBOXES : "owner"
    ACTORS ||--o{ OUTBOXES : "owner"
    ACTORS ||--o{ FOLLOWERS : "owner"
    ACTORS ||--o{ FOLLOWINGS : "owner"
    ACTORS ||--o{ LIKEDS : "owner"
    ACTORS ||--o{ BLOCKEDS : "owner"
    ACTORS ||--o{ COLLECTIONS : "owner"
```

---

## 4. REST API Endpoints

```mermaid
sequenceDiagram
    participant Client
    participant ExpressApp as Express.js Server
    participant Router as API Router
    participant Storage as ActivityPubStorage
    participant SQLite as SQLite DB

    Note over ExpressApp: Server listening on port 3000

    rect rgb(200, 220, 240)
        Note over Client,SQLite: GET Single Item Flow
        Client->>ExpressApp: GET /:collection/:id
        ExpressApp->>Router: Route to handler
        Router->>Storage: getItem(collection, id)
        Storage->>SQLite: SELECT * FROM collection WHERE id=?
        SQLite-->>Storage: Return row
        Storage-->>Router: Return item object
        Router-->>Client: 200 OK with JSON
    end

    rect rgb(220, 240, 200)
        Note over Client,SQLite: PUT Item Flow
        Client->>ExpressApp: PUT /:collection/:id + JSON body
        ExpressApp->>Router: Route to handler
        Router->>Router: Parse req.body
        Router->>Storage: saveItem(collection, req.body)
        Storage->>SQLite: INSERT INTO collection(id, data) VALUES(?, ?)
        SQLite-->>Storage: Confirm insert
        Storage-->>Router: Success callback
        Router-->>Client: 200 OK with JSON
    end

    rect rgb(240, 220, 200)
        Note over Client,SQLite: GET Collection Flow
        Client->>ExpressApp: GET /:collection
        ExpressApp->>Router: Route to handler
        Router->>Storage: getAllItems(collection)
        Storage->>SQLite: SELECT * FROM collection
        SQLite-->>Storage: Return all rows
        Storage-->>Router: Return items array
        Router-->>Client: 200 OK with JSON array
    end

    rect rgb(240, 200, 220)
        Note over Client,Router: Error Handling
        Client->>ExpressApp: GET /invalid/unknown
        ExpressApp->>Router: Route to handler
        Router->>Storage: getItem('invalid', 'unknown')
        Storage-->>Router: Callback with null
        Router-->>Client: 404 Not Found
    end
```

---

## 5. ActivityStreams Object Model

```mermaid
graph TB
    subgraph "ActivityStreams Context"
        Context["@context: https://www.w3.org/ns/activitystreams"]
    end

    subgraph "Core Object Types"
        Person[Person/Actor]
        Note[Note/Article]
        Image[Image/Document]
        Video[Video]
        Audio[Audio]
    end

    subgraph "Activity Types"
        Create[Create Activity]
        Follow[Follow Activity]
        Like[Like Activity]
        Announce[Announce/Share]
        Delete[Delete Activity]
        Update[Update Activity]
        Accept[Accept Activity]
        Reject[Reject Activity]
        Block[Block Activity]
    end

    subgraph "Collection Types"
        OrderedColl[OrderedCollection]
        CollPage[CollectionPage]
        OrderedPage[OrderedCollectionPage]
    end

    subgraph "Properties"
        ID[id: unique URI]
        Type[type: object type]
        Actor[actor: performing entity]
        Object[object: target entity]
        Target[target: destination]
        To[to: primary recipients]
        CC[cc: copied recipients]
        Published[published: timestamp]
        Content[content: HTML/text]
    end

    Context --> Person
    Context --> Note
    Context --> Image
    Context --> Create
    Context --> Follow
    Context --> Like
    Context --> OrderedColl

    Create --> ID
    Create --> Type
    Create --> Actor
    Create --> Object
    Create --> To
    Create --> CC
    Create --> Published

    Note --> Content
    Note --> Actor
    Note --> Published

    Person --> OrderedColl
    OrderedColl --> CollPage
    OrderedColl --> OrderedPage

    style Context fill:#f3e5f5
    style Create fill:#e1f5ff
    style Person fill:#fff4e1
    style OrderedColl fill:#e8f5e9
```

---

## 6. Inbox/Outbox Message Flow

```mermaid
sequenceDiagram
    participant LocalActor as Local Actor
    participant Outbox as Outbox
    participant LocalServer as Local ActivityPub Server
    participant RemoteServer as Remote ActivityPub Server
    participant Inbox as Remote Inbox
    participant RemoteActor as Remote Actor

    rect rgb(200, 220, 240)
        Note over LocalActor,RemoteActor: Outbound Activity Flow
        LocalActor->>LocalActor: Create Activity (e.g., Note)
        LocalActor->>LocalServer: POST /outbox with Activity
        LocalServer->>LocalServer: Validate Activity
        LocalServer->>LocalServer: Add @context, id, published
        LocalServer->>Outbox: Save to outboxes table
        LocalServer->>LocalServer: Determine recipients (to, cc)
        LocalServer->>RemoteServer: HTTP POST to remote inbox
        RemoteServer->>RemoteServer: Verify HTTP signature
        RemoteServer->>Inbox: Save to inboxes table
        RemoteServer->>RemoteActor: Deliver to local recipient
        RemoteServer-->>LocalServer: 202 Accepted
    end

    rect rgb(220, 240, 200)
        Note over LocalActor,RemoteActor: Inbound Activity Flow
        RemoteActor->>RemoteActor: Create Activity
        RemoteActor->>RemoteServer: POST to outbox
        RemoteServer->>LocalServer: HTTP POST to /inbox
        LocalServer->>LocalServer: Verify HTTP signature
        LocalServer->>LocalServer: Validate Activity structure
        LocalServer->>Inbox: Save to inboxes table
        LocalServer->>LocalActor: Deliver notification
        LocalServer-->>RemoteServer: 202 Accepted
    end

    rect rgb(240, 220, 200)
        Note over LocalActor,Outbox: Retrieve Activities
        LocalActor->>LocalServer: GET /outbox
        LocalServer->>Outbox: Query outboxes table
        Outbox-->>LocalServer: Return OrderedCollection
        LocalServer-->>LocalActor: Return activities list
    end
```

---

## 7. Federation Protocol

```mermaid
stateDiagram-v2
    [*] --> ActorDiscovery: Remote actor mention

    ActorDiscovery --> WebFingerLookup: Query actor identifier
    WebFingerLookup --> FetchActorProfile: Get actor URL
    FetchActorProfile --> VerifyPublicKey: Retrieve publicKey

    VerifyPublicKey --> CreateActivity: Actor verified
    VerifyPublicKey --> [*]: Verification failed

    CreateActivity --> SignRequest: Generate HTTP signature
    SignRequest --> DeliverToInbox: POST to remote inbox

    DeliverToInbox --> ReceiveResponse: 202 Accepted
    DeliverToInbox --> RetryDelivery: Network error
    DeliverToInbox --> PermanentFailure: 4xx/5xx error

    RetryDelivery --> DeliverToInbox: Exponential backoff
    RetryDelivery --> PermanentFailure: Max retries exceeded

    ReceiveResponse --> UpdateFollowerStatus: Follow/Accept activity
    ReceiveResponse --> StoreRemoteActivity: Other activities

    UpdateFollowerStatus --> [*]
    StoreRemoteActivity --> [*]
    PermanentFailure --> [*]

    state DeliverToInbox {
        [*] --> ValidateURL
        ValidateURL --> SignHeaders
        SignHeaders --> HTTPPost
        HTTPPost --> [*]
    }

    state CreateActivity {
        [*] --> GenerateID
        GenerateID --> AddContext
        AddContext --> SetTimestamp
        SetTimestamp --> AddRecipients
        AddRecipients --> [*]
    }

    note right of VerifyPublicKey
        Public key verification
        using actor's publicKeyPem
    end note

    note right of SignRequest
        HTTP Signature header
        with (request-target), host,
        date, digest
    end note
```

---

## 8. Collection Management Operations

```mermaid
flowchart TD
    Start([Collection Operation Request]) --> CheckType{Collection Type?}

    CheckType -->|Followers| FollowerOps[Follower Operations]
    CheckType -->|Following| FollowingOps[Following Operations]
    CheckType -->|Liked| LikedOps[Liked Operations]
    CheckType -->|Inbox| InboxOps[Inbox Operations]
    CheckType -->|Outbox| OutboxOps[Outbox Operations]
    CheckType -->|Blocked| BlockedOps[Blocked Operations]
    CheckType -->|Shares| SharesOps[Shares Operations]
    CheckType -->|Likes| LikesOps[Likes Operations]

    FollowerOps --> AddFollower{Add or Remove?}
    AddFollower -->|Add| InsertFollower[INSERT INTO followers]
    AddFollower -->|Remove| DeleteFollower[DELETE FROM followers]
    InsertFollower --> UpdateFollowerCount[Update totalItems count]
    DeleteFollower --> UpdateFollowerCount

    FollowingOps --> AddFollowing{Add or Remove?}
    AddFollowing -->|Add| InsertFollowing[INSERT INTO followings]
    AddFollowing -->|Remove| DeleteFollowing[DELETE FROM followings]
    InsertFollowing --> UpdateFollowingCount[Update totalItems count]
    DeleteFollowing --> UpdateFollowingCount

    LikedOps --> AddLike{Add or Remove?}
    AddLike -->|Add| InsertLiked[INSERT INTO likeds]
    AddLike -->|Remove| DeleteLiked[DELETE FROM likeds]
    InsertLiked --> UpdateLikedCount[Update totalItems count]
    DeleteLiked --> UpdateLikedCount

    InboxOps --> ReceiveActivity[Receive Activity]
    ReceiveActivity --> ValidateActivity{Valid Activity?}
    ValidateActivity -->|Yes| InsertInbox[INSERT INTO inboxes]
    ValidateActivity -->|No| RejectActivity[Return 400 Bad Request]
    InsertInbox --> NotifyActor[Notify local actor]

    OutboxOps --> PublishActivity[Publish Activity]
    PublishActivity --> GenerateID[Generate unique ID]
    GenerateID --> InsertOutbox[INSERT INTO outboxes]
    InsertOutbox --> FederateActivity[Federate to remote servers]

    BlockedOps --> BlockUser{Block or Unblock?}
    BlockUser -->|Block| InsertBlocked[INSERT INTO blockeds]
    BlockUser -->|Unblock| DeleteBlocked[DELETE FROM blockeds]
    InsertBlocked --> FilterContent[Filter blocked content]
    DeleteBlocked --> RemoveFilter[Remove content filter]

    SharesOps --> ShareObject[Share Object]
    ShareObject --> CreateAnnounce[Create Announce activity]
    CreateAnnounce --> InsertShare[INSERT INTO shares]
    InsertShare --> FederateAnnounce[Federate Announce]

    LikesOps --> LikeObject[Like Object]
    LikeObject --> CreateLike[Create Like activity]
    CreateLike --> InsertLike[INSERT INTO likes]
    InsertLike --> FederateLike[Federate Like]

    UpdateFollowerCount --> Success([Operation Complete])
    UpdateFollowingCount --> Success
    UpdateLikedCount --> Success
    NotifyActor --> Success
    FederateActivity --> Success
    FilterContent --> Success
    RemoveFilter --> Success
    FederateAnnounce --> Success
    FederateLike --> Success
    RejectActivity --> Failure([Operation Failed])

    style Start fill:#e1f5ff
    style Success fill:#c8e6c9
    style Failure fill:#ffcdd2
    style CheckType fill:#fff9c4
    style ValidateActivity fill:#fff9c4
```

---

## 9. Data Persistence & Retrieval

```mermaid
sequenceDiagram
    participant App as Application
    participant Storage as ActivityPubStorage
    participant DB as SQLite Database
    participant FS as File System

    rect rgb(200, 220, 240)
        Note over App,FS: Initialization Flow
        App->>Storage: new ActivityPubStorage(dbPath)
        Storage->>DB: new sqlite3.Database(dbPath)
        DB->>FS: Open/Create database file
        FS-->>DB: Database handle
        DB-->>Storage: Database connection
        Storage->>Storage: createTables()
        Storage->>DB: CREATE TABLE IF NOT EXISTS actors...
        Storage->>DB: CREATE TABLE IF NOT EXISTS objects...
        Storage->>DB: CREATE TABLE IF NOT EXISTS activities...
        Storage->>DB: CREATE TABLE IF NOT EXISTS inboxes...
        Storage->>DB: CREATE TABLE IF NOT EXISTS outboxes...
        Storage->>DB: CREATE TABLE IF NOT EXISTS followers...
        Storage->>DB: CREATE TABLE IF NOT EXISTS followings...
        Storage->>DB: CREATE TABLE IF NOT EXISTS likeds...
        Storage->>DB: CREATE TABLE IF NOT EXISTS blockeds...
        Storage->>DB: CREATE TABLE IF NOT EXISTS rejections...
        Storage->>DB: CREATE TABLE IF NOT EXISTS shares...
        Storage->>DB: CREATE TABLE IF NOT EXISTS likes...
        DB-->>Storage: Tables created
    end

    rect rgb(220, 240, 200)
        Note over App,DB: Save Item Flow
        App->>Storage: saveItem(collection, id, item)
        Storage->>Storage: Serialize item to JSON
        Storage->>Storage: Extract fields from item
        Storage->>DB: INSERT OR REPLACE INTO collection
        DB->>DB: Execute prepared statement
        DB-->>Storage: Success/Error
        Storage-->>App: Callback(error)
    end

    rect rgb(240, 220, 200)
        Note over App,DB: Get Single Item Flow
        App->>Storage: getItem(collection, id, callback)
        Storage->>DB: SELECT * FROM collection WHERE id=?
        DB->>DB: Execute query
        DB-->>Storage: Return row or null
        Storage->>Storage: Deserialize row to object
        Storage-->>App: Callback(item)
    end

    rect rgb(240, 240, 200)
        Note over App,DB: Get All Items Flow
        App->>Storage: getAllItems(collection, callback)
        Storage->>DB: SELECT * FROM collection
        DB->>DB: Execute query
        DB-->>Storage: Return rows array
        Storage->>Storage: Map rows to objects
        Storage-->>App: Callback(items[])
    end

    rect rgb(220, 220, 240)
        Note over App,DB: Delete Item Flow
        App->>Storage: deleteItem(collection, id, callback)
        Storage->>DB: DELETE FROM collection WHERE id=?
        DB->>DB: Execute delete
        DB-->>Storage: Rows affected
        Storage-->>App: Callback(error)
    end

    rect rgb(240, 200, 200)
        Note over Storage,FS: Close Database
        App->>Storage: close()
        Storage->>DB: db.close()
        DB->>FS: Close file handle
        FS-->>DB: Closed
        DB-->>Storage: Closed
    end
```

---

## 10. Complete ActivityPub Lifecycle

```mermaid
stateDiagram-v2
    [*] --> ServerInit: Initialize ActivityPub Server

    ServerInit --> DatabaseSetup: Create SQLite storage
    DatabaseSetup --> TableCreation: Create all collections tables
    TableCreation --> ExpressStartup: Start Express.js server
    ExpressStartup --> ListeningState: Server listening on port 3000

    ListeningState --> ActorCreation: User creates actor
    ActorCreation --> StoreActor: Save actor to actors table
    StoreActor --> InitCollections: Initialize empty collections
    InitCollections --> ActorReady: Actor ready for federation

    ActorReady --> OutboundActivity: Actor creates content
    ActorReady --> InboundActivity: Receive remote activity

    state OutboundActivity {
        [*] --> CreateObject: Create Note/Article
        CreateObject --> CreateActivity: Wrap in Create activity
        CreateActivity --> SaveOutbox: Save to outboxes table
        SaveOutbox --> DetermineRecipients: Parse to/cc fields
        DetermineRecipients --> FederateRemote: POST to remote inboxes
        FederateRemote --> [*]
    }

    state InboundActivity {
        [*] --> ReceiveHTTP: Receive HTTP POST
        ReceiveHTTP --> VerifySignature: Verify HTTP signature
        VerifySignature --> ValidateStructure: Validate ActivityStreams
        ValidateStructure --> ProcessActivity: Determine activity type
        ProcessActivity --> SaveInbox: Save to inboxes table
        SaveInbox --> UpdateCollections: Update relevant collections
        UpdateCollections --> NotifyUser: Notify local actor
        NotifyUser --> [*]
    }

    OutboundActivity --> ActorReady: Activity sent
    InboundActivity --> ActorReady: Activity processed

    ActorReady --> FollowWorkflow: Follow/Accept flow

    state FollowWorkflow {
        [*] --> SendFollow: Send Follow activity
        SendFollow --> WaitAccept: Wait for Accept/Reject
        WaitAccept --> ReceiveAccept: Receive Accept
        WaitAccept --> ReceiveReject: Receive Reject
        ReceiveAccept --> AddFollowing: Add to followings table
        ReceiveReject --> RemoveRequest: Clean up request
        AddFollowing --> [*]
        RemoveRequest --> [*]
    }

    FollowWorkflow --> ActorReady: Follow complete

    ActorReady --> InteractionFlow: Like/Announce/Reply

    state InteractionFlow {
        [*] --> ChooseAction: Select interaction type
        ChooseAction --> LikeAction: Like object
        ChooseAction --> AnnounceAction: Announce/Share
        ChooseAction --> ReplyAction: Reply to object

        LikeAction --> CreateLike: Create Like activity
        CreateLike --> SaveLike: Save to likes table
        SaveLike --> FederateLike: Send to object author

        AnnounceAction --> CreateAnnounce: Create Announce activity
        CreateAnnounce --> SaveShare: Save to shares table
        SaveShare --> FederateAnnounce: Send to followers

        ReplyAction --> CreateNote: Create Note object
        CreateNote --> SetInReplyTo: Set inReplyTo property
        SetInReplyTo --> FederateReply: Send to participants

        FederateLike --> [*]
        FederateAnnounce --> [*]
        FederateReply --> [*]
    }

    InteractionFlow --> ActorReady: Interaction complete

    ActorReady --> QueryCollections: GET collection

    state QueryCollections {
        [*] --> IdentifyCollection: Parse collection name
        IdentifyCollection --> QueryDB: SELECT from table
        QueryDB --> FormatResponse: Format as OrderedCollection
        FormatResponse --> ReturnJSON: Return JSON response
        ReturnJSON --> [*]
    }

    QueryCollections --> ActorReady: Query complete

    ActorReady --> Shutdown: Server shutdown
    Shutdown --> CloseDatabase: Close SQLite connection
    CloseDatabase --> StopExpress: Stop Express server
    StopExpress --> [*]

    note right of ServerInit
        Initialize with SQLite path
        Create ActivityPubStorage instance
    end note

    note right of ActorReady
        Central state - actor can
        send/receive activities,
        manage collections
    end note

    note right of FollowWorkflow
        Federation handshake
        between local and remote actors
    end note

    note right of InteractionFlow
        Social interactions
        (Like, Share, Reply)
    end note
```

---

## Summary

These diagrams provide comprehensive coverage of the ActivityPub Integration **planned architecture**. Note that approximately **70% of these features are NOT YET IMPLEMENTED**.

1. **Architecture Overview** - 📋 **PLANNED** - Complete system architecture with Express.js, SQLite, and 14 collections
2. **Actor Model** - ✅ **IMPLEMENTED** - TypeScript class hierarchy for ActivityPub objects (interfaces defined)
3. **Storage Schema** - ✅ **IMPLEMENTED** - Complete SQLite database schema with all 14 tables (table creation code exists)
4. **REST API** - ❌ **NOT IMPLEMENTED** - GET/PUT endpoints documented but not coded
5. **Object Model** - ✅ **IMPLEMENTED** - ActivityStreams vocabulary and object types (TypeScript interfaces)
6. **Message Flow** - ❌ **NOT IMPLEMENTED** - Inbox/Outbox message delivery sequences
7. **Federation Protocol** - ❌ **NOT IMPLEMENTED** - State machine for federated actor discovery and activity delivery
8. **Collection Management** - ⚠️ **PARTIAL** - Flowchart for all 8 collection types, getAllItems() missing
9. **Data Persistence** - ⚠️ **PARTIAL** - Basic CRUD operations with SQLite, getAllItems() missing
10. **Complete Lifecycle** - ❌ **NOT IMPLEMENTED** - End-to-end state machine from initialization to shutdown

---

### 🧪 Experimental Features Status

#### ✅ Currently Implemented (30%):
- **TypeScript Interfaces** (`feditypes.ts`):
  - Actor, Activity, Object, Collection type definitions
  - ActivityStreams vocabulary types
  - Full type safety for ActivityPub objects

- **SQLite Storage** (`fedistore.ts`):
  - FediStore class with database initialization
  - Table creation for all 14 collections
  - Basic CRUD operations: getItem(), saveItem(), deleteItem()
  - Database schema with proper relationships

- **Express Server Skeleton** (`fediverse.ts`):
  - Basic Express.js server setup
  - Port 3000 listener
  - Server initialization code

#### ❌ Not Yet Implemented (70%):
- **REST API Endpoints**:
  - GET /:collection/:id (documented but not coded)
  - PUT /:collection/:id (documented but not coded)
  - GET /:collection - getAllItems() method missing

- **Federation Protocol**:
  - WebFinger actor discovery
  - HTTP signature generation and verification
  - Remote inbox delivery
  - Remote outbox fetching

- **ActivityPub Core Features**:
  - Inbox/Outbox message handling
  - Follow/Accept/Reject workflow
  - Actor profile discovery
  - Remote activity federation

- **Social Interactions**:
  - Like activity handling
  - Announce/Share functionality
  - Reply threading
  - Collection updates (followers, following, etc.)

---

### Files Reference

**Actual Source Files** (experimental, not integrated):
- ✅ `src/features/activitypub/feditypes.ts` - TypeScript interfaces (~400 lines)
- ✅ `src/features/activitypub/fedistore.ts` - SQLite storage class (~300 lines, missing getAllItems())
- ✅ `src/features/activitypub/fediverse.ts` - Express.js server skeleton (~100 lines)

**Integration Status**: ⚠️ **ZERO IMPORTS** - These files are not used by any production blockchain code.

---

### Future Development Path

To complete this implementation, the following work is required:

1. **Priority 1 - API Completion**:
   - Implement getAllItems() method in FediStore
   - Add REST API endpoint handlers in fediverse.ts
   - Connect Express routes to FediStore operations

2. **Priority 2 - Federation Protocol**:
   - Implement WebFinger discovery
   - Add HTTP signature signing/verification
   - Build remote inbox delivery mechanism

3. **Priority 3 - Integration**:
   - Connect ActivityPub to blockchain events
   - Add actor management to validator nodes
   - Implement blockchain-to-ActivityPub bridges

4. **Priority 4 - Social Features**:
   - Complete Follow/Accept/Reject workflow
   - Implement Like, Announce, Reply activities
   - Build notification system

---

This documentation describes the **planned architecture** for full ActivityPub federation support. Current implementation is experimental foundation code representing approximately 30% of the documented features.
