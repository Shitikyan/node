# Web2 Integration & DAHR (Data Agnostic HTTPS Relay)

## Overview

The Web2 Integration system enables Demos blockchain to interact with traditional Web2 HTTP/HTTPS services through the DAHR (Data Agnostic HTTPS Relay) pattern. This allows blockchain applications to make authenticated, verified requests to external web services while maintaining cryptographic integrity.

---

## Diagram 1: DAHR Architecture Overview

```mermaid
graph TB
    subgraph "Client Layer"
        Client[Blockchain Client]
        SDK[Demos SDK]
    end

    subgraph "DAHR Management Layer"
        Factory[DAHRFactory<br/>Singleton]
        SessionStore[(Session Store<br/>Map with Expiry)]
        Cleanup[Cleanup Process<br/>24h TTL]
    end

    subgraph "DAHR Instance Layer"
        DAHR1[DAHR Instance 1<br/>SessionID: abc123]
        DAHR2[DAHR Instance 2<br/>SessionID: def456]
        DAHR3[DAHR Instance N<br/>SessionID: xyz789]
    end

    subgraph "Proxy Layer"
        Proxy1[Local Proxy Server<br/>Port: Random]
        Proxy2[Local Proxy Server<br/>Port: Random]
        Proxy3[Local Proxy Server<br/>Port: Random]
    end

    subgraph "External Web2 Services"
        API1[REST API]
        API2[Web Service]
        API3[External API]
    end

    subgraph "Validation & Security"
        URLValidator[URL Validator<br/>Normalize & Validate]
        HashVerifier[Request/Response<br/>Hash Verifier]
        SSLConfig[SSL/TLS<br/>Configuration]
    end

    Client -->|1. Create DAHR Request| SDK
    SDK -->|2. Web2Request| Factory
    Factory -->|3. Check Existing| SessionStore
    Factory -->|4. Create New| DAHR1
    DAHR1 -->|5. Initialize| Proxy1

    Factory -.->|Periodic| Cleanup
    Cleanup -.->|Remove Expired| SessionStore

    DAHR1 -->|6. Validate URL| URLValidator
    URLValidator -->|7. Forward Request| Proxy1
    Proxy1 -->|8. HTTP/HTTPS| API1
    API1 -->|9. Response| Proxy1
    Proxy1 -->|10. Verify| HashVerifier
    HashVerifier -->|11. Result| DAHR1

    Factory --> DAHR2
    Factory --> DAHR3
    DAHR2 --> Proxy2
    DAHR3 --> Proxy3

    Proxy1 -.->|SSL Verify| SSLConfig
    Proxy2 -.->|SSL Verify| SSLConfig
    Proxy3 -.->|SSL Verify| SSLConfig

```

**Description**: Complete DAHR architecture showing the factory pattern for managing multiple DAHR instances, each with its own proxy server for forwarding requests to external Web2 services with cryptographic verification.

---

## Diagram 2: DAHR Creation & Factory Pattern

```mermaid
sequenceDiagram
    participant Client
    participant RPC as RPC Handler
    participant Factory as DAHRFactory
    participant Store as Session Store
    participant DAHR as DAHR Instance
    participant ProxyFact as ProxyFactory
    participant Proxy as Proxy Server

    Client->>RPC: Web2Request<br/>{action: CREATE, url, method}
    RPC->>Factory: createDAHR(web2Request)

    Note over Factory: Singleton Instance Check
    Factory->>Factory: getInstance()

    Factory->>Store: cleanupExpired()
    Note over Store: Check all sessions<br/>Remove > 24h old

    loop Each Session
        Store->>Store: Check lastAccess
        alt Expired (> 24h)
            Store->>DAHR: stopProxy()
            Store->>Store: delete(sessionId)
        end
    end

    Factory->>DAHR: new DAHR(web2Request)
    activate DAHR

    DAHR->>DAHR: generateUniqueId()<br/>sessionId = uuid()
    DAHR->>ProxyFact: createProxy(sessionId)
    ProxyFact->>Proxy: new Proxy(sessionId)
    Proxy-->>DAHR: proxy instance

    DAHR-->>Factory: dahr instance

    Factory->>Store: set(sessionId, {dahr, lastAccess: now})

    Factory-->>RPC: DAHR instance
    RPC-->>Client: {sessionId, status: 200}

    Note over Client: Store sessionId<br/>for future requests

    deactivate DAHR
```

**Description**: Detailed sequence showing DAHR instance creation through the factory pattern, including session management, cleanup of expired sessions, and proxy server initialization.

---

## Diagram 3: Proxy Server Initialization & Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Uninitialized

    Uninitialized --> Initializing: createProxy(sessionId)

    state Initializing {
        [*] --> GeneratingPort
        GeneratingPort --> ConfiguringServer: Random port assigned
        ConfiguringServer --> SettingUpProxy: HTTP/HTTPS config
        SettingUpProxy --> BindingPort: Proxy middleware ready
        BindingPort --> [*]
    }

    Initializing --> Ready: Server listening

    state Ready {
        [*] --> Idle
        Idle --> ProcessingRequest: sendHTTPRequest()

        state ProcessingRequest {
            [*] --> ValidatingTarget
            ValidatingTarget --> CheckingInitialization: URL validated

            state CheckingInitialization {
                [*] --> CompareTarget
                CompareTarget --> ReuseServer: Same target URL
                CompareTarget --> RestartServer: Different target URL
            }

            CheckingInitialization --> CreatingRequest: Server ready
            CreatingRequest --> ForwardingRequest: Headers + Body set
            ForwardingRequest --> AwaitingResponse: Sent to target
            AwaitingResponse --> HashingResponse: Response received
            HashingResponse --> [*]: Hash verified
        }

        ProcessingRequest --> Idle: Request complete
        Idle --> ShuttingDown: stopProxy()
    }

    state ShuttingDown {
        [*] --> ClosingConnections
        ClosingConnections --> UnbindingPort: Active requests drained
        UnbindingPort --> CleaningResources: Port released
        CleaningResources --> [*]
    }

    Ready --> ShuttingDown: Session expired<br/>or manual stop
    ShuttingDown --> Stopped: Cleanup complete
    Stopped --> [*]

    note right of Initializing
        Proxy Host: 127.0.0.1
        Proxy Port: Random (1024-65535)
        Timeout: 30 seconds
        SSL Verify: Configurable
    end note

    note right of ProcessingRequest
        Request Hashing:
        - Headers canonicalized
        - Body SHA256 hashed
        Response Hashing:
        - Status + Headers hashed
        - Body SHA256 hashed
    end note
```

**Description**: State machine showing the complete lifecycle of a proxy server instance, from initialization through request processing to graceful shutdown, including port management and request/response hashing.

---

## Diagram 4: HTTP Request Flow & Forwarding

```mermaid
flowchart TD
    Start([DAHR.startProxy Called]) --> ParseParams[Parse Parameters<br/>method, headers, payload, url]

    ParseParams --> ValidateURL{URL Validation}

    ValidateURL -->|Invalid| ErrorInvalidURL[Return Error:<br/>Invalid URL format]
    ErrorInvalidURL --> End([End])

    ValidateURL -->|Valid| NormalizeURL[Normalize URL<br/>- Add protocol if missing<br/>- Validate hostname<br/>- Check port]

    NormalizeURL --> CheckProxy{Proxy<br/>Initialized?}

    CheckProxy -->|No| InitProxy[Initialize Proxy Server<br/>- Assign random port<br/>- Configure SSL<br/>- Start listening]

    CheckProxy -->|Yes, Same URL| ReuseProxy[Reuse Existing Proxy]
    CheckProxy -->|Yes, Different URL| RestartProxy[Restart Proxy<br/>with new target]

    InitProxy --> ProxyReady[Proxy Ready]
    ReuseProxy --> ProxyReady
    RestartProxy --> ProxyReady

    ProxyReady --> BuildRequest[Build HTTP Request<br/>- Method: GET/POST/PUT/DELETE<br/>- Headers: canonicalized<br/>- Body: payload if present]

    BuildRequest --> HashRequest[Hash Request<br/>- Headers hash: SHA256<br/>- Body hash: SHA256]

    HashRequest --> SendRequest[Send Request to Proxy<br/>localhost:proxyPort]

    SendRequest --> ProxyForward[Proxy Forwards<br/>to Target URL]

    ProxyForward --> AwaitResponse{Response<br/>Received?}

    AwaitResponse -->|Timeout 30s| ErrorTimeout[Return Error:<br/>Request timeout]
    ErrorTimeout --> End

    AwaitResponse -->|Error| ErrorNetwork[Return Error:<br/>Network/Connection issue]
    ErrorNetwork --> End

    AwaitResponse -->|Success| ReceiveResponse[Receive Response<br/>- Status code<br/>- Headers<br/>- Body]

    ReceiveResponse --> HashResponse[Hash Response<br/>- Headers hash: SHA256<br/>- Body hash: SHA256]

    HashResponse --> BuildResult[Build IWeb2Result<br/>- requestHash<br/>- responseHash<br/>- responseHeadersHash<br/>- statusCode<br/>- data]

    BuildResult --> UpdateSession[Update Session<br/>lastAccess = now

    UpdateSession --> Success([Return Success Web2Result])

```

**Description**: Complete flowchart showing the end-to-end HTTP request flow from parameter parsing through URL validation, proxy initialization, request forwarding, response handling, and cryptographic hashing for integrity verification.

---

## Diagram 5: Session Management & Cleanup

```mermaid
flowchart TB
    subgraph "Session Creation"
        CreateReq[Create DAHR Request] --> GenSession[Generate Unique SessionID<br/>UUID v4]
        GenSession --> StoreSession[Store in SessionStore<br/>Map sessionId, dahr, lastAccess]
    end

    subgraph "Session Store Schema"
        direction TB
        SessionMap[(Session Store<br/>Map String, Object)]
        SessionMap --> Entry1[SessionID: abc-123<br/>DAHR: instance1<br/>lastAccess: 1699000000000]
        SessionMap --> Entry2[SessionID: def-456<br/>DAHR: instance2<br/>lastAccess: 1699003600000]
        SessionMap --> Entry3[SessionID: xyz-789<br/>DAHR: instance3<br/>lastAccess: 1699007200000]
    end

    subgraph "Session Access"
        UseReq[START_PROXY Request<br/>with sessionId] --> Lookup{Session<br/>Exists?}
        Lookup -->|No| Error404[404 Not Found<br/>Session expired or invalid]
        Lookup -->|Yes| GetDAHR[Retrieve DAHR Instance]
        GetDAHR --> UpdateAccess[Update lastAccess<br/>timestamp = now]
        UpdateAccess --> Execute[Execute Request]
    end

    subgraph "Cleanup Process"
        direction TB
        Trigger{Cleanup Trigger} -->|Periodic| ScheduledCleanup[Scheduled Cleanup<br/>Every new DAHR creation]
        Trigger -->|On Demand| ManualCleanup[Manual Cleanup<br/>Factory method call]

        ScheduledCleanup --> IterateSessions[Iterate All Sessions]
        ManualCleanup --> IterateSessions

        IterateSessions --> CheckAge{Age Check<br/>now - lastAccess}

        CheckAge -->|< 24 hours| Keep[Keep Session Active]
        CheckAge -->|>= 24 hours| Remove[Remove Session]

        Remove --> StopProxy[Stop Proxy Server<br/>- Close connections<br/>- Release port]
        StopProxy --> DeleteEntry[Delete from SessionStore]

        Keep --> NextSession{More<br/>Sessions?}
        DeleteEntry --> NextSession
        NextSession -->|Yes| IterateSessions
        NextSession -->|No| CleanupDone[Cleanup Complete]
    end

    subgraph "Configuration"
        Config[Cleanup Settings]
        Config --> TTL[TTL: 24 hours<br/>86,400,000 ms]
        Config --> Strategy[Strategy: Lazy cleanup<br/>on creation]
    end

    StoreSession -.-> SessionMap
    Execute -.-> SessionMap

```

**Description**: Comprehensive view of session lifecycle management including creation with unique IDs, access pattern with timestamp updates, and automatic cleanup of expired sessions after 24 hours of inactivity.

---

## Diagram 6: URL Validation & Normalization

```mermaid
flowchart TD
    Start([validateAndNormalizeHttpUrl]) --> Input[Input: URL string]

    Input --> CheckEmpty{URL Empty<br/>or Null?}
    CheckEmpty -->|Yes| ErrorEmpty[Return Error:<br/>URL is required]
    ErrorEmpty --> End([End with Error])

    CheckEmpty -->|No| CheckProtocol{Has Protocol?<br/>http:// or https://}

    CheckProtocol -->|No| AddProtocol[Add Default Protocol<br/>https://]
    CheckProtocol -->|Yes| ProtocolPresent[Protocol Present]

    AddProtocol --> ParseURL[Parse URL with Node URL API]
    ProtocolPresent --> ParseURL

    ParseURL --> ValidParse{Valid<br/>URL Format?}

    ValidParse -->|No| ErrorFormat[Return Error:<br/>Invalid URL format]
    ErrorFormat --> End

    ValidParse -->|Yes| ExtractComponents[Extract Components<br/>- Protocol<br/>- Hostname<br/>- Port<br/>- Path<br/>- Query params]

    ExtractComponents --> ValidateProtocol{Protocol Valid?<br/>http or https only}

    ValidateProtocol -->|No| ErrorProtocol[Return Error:<br/>Only HTTP/HTTPS allowed]
    ErrorProtocol --> End

    ValidateProtocol -->|Yes| ValidateHostname{Hostname Valid?}

    ValidateHostname -->|No| ErrorHostname[Return Error:<br/>Invalid hostname]
    ErrorHostname --> End

    ValidateHostname -->|Yes| CheckPort{Port<br/>Specified?}

    CheckPort -->|No| UseDefaultPort[Use Default Port<br/>80 for HTTP<br/>443 for HTTPS]
    CheckPort -->|Yes| ValidatePort{Port Valid?<br/>1-65535}

    ValidatePort -->|No| ErrorPort[Return Error:<br/>Invalid port number]
    ErrorPort --> End

    ValidatePort -->|Yes| PortValid[Port Valid]
    UseDefaultPort --> NormalizeURL
    PortValid --> NormalizeURL

    NormalizeURL[Normalize URL<br/>- Lowercase hostname<br/>- Remove trailing slash<br/>- Encode special chars<br/>- Standardize path]

    NormalizeURL --> SecurityCheck{Security<br/>Checks}

    SecurityCheck --> CheckLocalhost{Block<br/>Localhost?}
    CheckLocalhost -->|Blocked in Prod| ErrorLocalhost[Return Error:<br/>Localhost not allowed]
    ErrorLocalhost --> End

    CheckLocalhost -->|Allowed| CheckPrivateIP{Block<br/>Private IPs?}
    CheckPrivateIP -->|Blocked in Prod| ErrorPrivate[Return Error:<br/>Private IP not allowed]
    ErrorPrivate --> End

    CheckPrivateIP -->|Allowed| AllChecksPass[All Validation Passed]

    AllChecksPass --> BuildResult[Build Normalized Result<br/>- Original URL<br/>- Normalized URL<br/>- Components]

    BuildResult --> Success([Return Success Normalized URL])

```

**Description**: Detailed URL validation and normalization process ensuring only valid, secure HTTP/HTTPS URLs are processed, with protocol inference, component extraction, and security checks against localhost and private IPs in production.

---

## Diagram 7: Request/Response Hashing for Integrity

```mermaid
flowchart LR
    subgraph "Request Hashing"
        direction TB
        ReqStart[HTTP Request] --> ReqHeaders[Headers Map]
        ReqStart --> ReqBody[Request Body<br/>JSON/String/Binary]

        ReqHeaders --> CanonHeaders[Canonicalize Headers<br/>- Sort by key alphabetically<br/>- Lowercase keys<br/>- Trim values<br/>- Remove auth headers]

        CanonHeaders --> HeadersJSON[Convert to JSON String<br/>Deterministic order]
        HeadersJSON --> HashHeaders[SHA256 Hash Headers<br/>→ headersHash]

        ReqBody --> ConvertBuffer[Convert to Buffer<br/>UTF-8 encoding]
        ConvertBuffer --> HashBody[SHA256 Hash Body<br/>→ bodyHash]

        HashHeaders --> CombineReqHash[Combine Hashes<br/>requestHash = hash<br/>headers + body]
        HashBody --> CombineReqHash

        CombineReqHash --> ReqHashResult[Request Hash<br/>32-byte SHA256]
    end

    subgraph "Response Hashing"
        direction TB
        RespStart[HTTP Response] --> RespStatus[Status Code]
        RespStart --> RespHeaders[Response Headers]
        RespStart --> RespBody[Response Body]

        RespHeaders --> CanonRespHeaders[Canonicalize Headers<br/>Same process as request]
        CanonRespHeaders --> RespHeadersJSON[Convert to JSON String]
        RespHeadersJSON --> HashRespHeaders[SHA256 Hash Headers<br/>→ responseHeadersHash]

        RespBody --> RespBuffer[Convert to Buffer<br/>UTF-8 encoding]
        RespBuffer --> HashRespBody[SHA256 Hash Body<br/>→ responseBodyHash]

        RespStatus --> CombineRespHash[Combine Hashes<br/>responseHash = hash<br/>status + headers + body]
        HashRespHeaders --> CombineRespHash
        HashRespBody --> CombineRespHash

        CombineRespHash --> RespHashResult[Response Hash<br/>32-byte SHA256]
    end

    subgraph "Hash Verification"
        direction TB
        ReqHashResult --> StoreReq[(Store Request Hash<br/>in Web2Result)]
        RespHashResult --> StoreResp[(Store Response Hashes<br/>in Web2Result)]

        StoreReq --> BuildResult[Build IWeb2Result]
        StoreResp --> BuildResult

        BuildResult --> ResultObject{Web2Result Object}
        ResultObject --> Field1[requestHash: string]
        ResultObject --> Field2[responseHash: string]
        ResultObject --> Field3[responseHeadersHash: string]
        ResultObject --> Field4[statusCode: number]
        ResultObject --> Field5[data: string]

        Field1 --> Client[Return to Client]
        Field2 --> Client
        Field3 --> Client
        Field4 --> Client
        Field5 --> Client

        Client --> ClientVerify[Client Can Verify<br/>- Recalculate hashes<br/>- Compare with received<br/>- Detect tampering]
    end

```

**Description**: Complete request/response integrity hashing system showing header canonicalization, deterministic hashing with SHA256, and how clients can verify data integrity by recalculating and comparing hashes.

---

## Diagram 8: Action Routing (CREATE vs START_PROXY)

```mermaid
sequenceDiagram
    participant Client
    participant RPC as handleWeb2ProxyRequest
    participant Factory as DAHRFactory
    participant Store as Session Store
    participant DAHR as DAHR Instance
    participant Proxy as Proxy Server
    participant Web2 as External API

    rect rgb(230, 245, 255)
        Note over Client,Web2: Action 1: CREATE - Initialize DAHR Session
        Client->>RPC: Web2Request<br/>{action: CREATE, url, method}
        RPC->>RPC: Parse web2Request

        alt Action is CREATE
            RPC->>Factory: handleWeb2(web2Request)
            Factory->>Factory: cleanupExpired()
            Factory->>DAHR: new DAHR(web2Request)
            DAHR->>DAHR: sessionId = generateUniqueId()
            DAHR->>Proxy: createProxy(sessionId)
            Proxy-->>DAHR: proxy instance
            DAHR-->>Factory: dahr instance
            Factory->>Store: store(sessionId, dahr, now)
            Factory-->>RPC: DAHR instance
            RPC->>RPC: Serialize DAHR<br/>{sessionId, url, method}
            RPC-->>Client: RPCResponse<br/>{result: 200, response: serializedDAHR}

            Note over Client: Store sessionId for<br/>subsequent requests
        end
    end

    rect rgb(255, 245, 230)
        Note over Client,Web2: Action 2: START_PROXY - Execute Request
        Client->>RPC: Web2Request<br/>{action: START_PROXY, sessionId, method, headers, payload, url}
        RPC->>RPC: Parse sessionId & params

        alt Action is START_PROXY
            RPC->>Factory: getDAHRInstance(sessionId)
            Factory->>Store: get(sessionId)

            alt Session Not Found
                Store-->>Factory: null
                Factory-->>RPC: null
                RPC-->>Client: RPCResponse<br/>{result: 404, error: "Session not found"}
            else Session Found
                Store-->>Factory: {dahr, lastAccess}
                Factory->>Store: update lastAccess = now
                Factory-->>RPC: dahr instance

                RPC->>DAHR: startProxy({method, headers, payload, url})
                DAHR->>DAHR: validateAndNormalizeUrl(url)
                DAHR->>Proxy: sendHTTPRequest(params)

                alt Proxy Not Initialized or Different URL
                    Proxy->>Proxy: startProxyServer(targetUrl)
                    Note over Proxy: Initialize or restart<br/>proxy for new target
                end

                Proxy->>Proxy: Build HTTP request<br/>with headers & body
                Proxy->>Proxy: Hash request<br/>(headers + body)
                Proxy->>Web2: Forward HTTP request
                Web2-->>Proxy: HTTP response
                Proxy->>Proxy: Hash response<br/>(status + headers + body)
                Proxy-->>DAHR: IWeb2Result with hashes
                DAHR-->>RPC: web2Response
                RPC-->>Client: RPCResponse<br/>{result: 200, response: web2Result}
            end
        end
    end

    rect rgb(230, 255, 230)
        Note over Client,Web2: Optional: Session Cleanup (24h expiry)
        Factory->>Store: cleanupExpired()
        loop Each Session
            Store->>Store: Check if now - lastAccess > 24h
            alt Expired
                Store->>DAHR: stopProxy()
                DAHR->>Proxy: close server
                Store->>Store: delete(sessionId)
            end
        end
    end
```

**Description**: Side-by-side comparison of the two-action workflow: CREATE action initializes a DAHR session with proxy server, START_PROXY executes the actual HTTP request, with session management and cleanup.

---

## Diagram 9: Error Handling & Validation

```mermaid
flowchart TD
    Start([Web2 Request Received]) --> ParseAction{Parse<br/>Action Type}

    ParseAction -->|CREATE| ValidateCreate[Validate CREATE Request]
    ParseAction -->|START_PROXY| ValidateProxy[Validate START_PROXY Request]
    ParseAction -->|Unknown| ErrorUnknownAction[Error: Unknown action type<br/>400 Bad Request]

    ErrorUnknownAction --> End([Return Error Response])

    ValidateCreate --> CheckURL1{URL<br/>Present?}
    CheckURL1 -->|No| ErrorNoURL[Error: URL required<br/>400 Bad Request]
    ErrorNoURL --> End

    CheckURL1 -->|Yes| CheckMethod1{HTTP Method<br/>Valid?}
    CheckMethod1 -->|No| ErrorBadMethod[Error: Invalid method<br/>400 Bad Request]
    ErrorBadMethod --> End

    CheckMethod1 -->|Yes| CreateDAHR[Create DAHR Instance]

    CreateDAHR --> FactoryError{Factory<br/>Error?}
    FactoryError -->|Yes| ErrorFactory[Error: Factory failed<br/>500 Internal Error]
    ErrorFactory --> End

    FactoryError -->|No| ProxyInitError{Proxy Init<br/>Error?}
    ProxyInitError -->|Yes| ErrorProxyInit[Error: Proxy initialization<br/>500 Internal Error]
    ErrorProxyInit --> End

    ProxyInitError -->|No| SuccessCreate[Success: Return sessionId<br/>200 OK]
    SuccessCreate --> End

    ValidateProxy --> CheckSession{SessionId<br/>Present?}
    CheckSession -->|No| ErrorNoSession[Error: SessionId required<br/>400 Bad Request]
    ErrorNoSession --> End

    CheckSession -->|Yes| LookupSession{Session<br/>Exists?}
    LookupSession -->|No| ErrorSessionNotFound[Error: Session not found<br/>404 Not Found]
    ErrorSessionNotFound --> End

    LookupSession -->|Yes| CheckURL2{URL<br/>Valid?}
    CheckURL2 -->|No| ErrorInvalidURL[Error: Invalid URL format<br/>422 Unprocessable Entity]
    ErrorInvalidURL --> End

    CheckURL2 -->|Yes| CheckHeaders{Headers<br/>Valid?}
    CheckHeaders -->|No| ErrorBadHeaders[Error: Invalid headers<br/>400 Bad Request]
    ErrorBadHeaders --> End

    CheckHeaders -->|Yes| ExecuteRequest[Execute HTTP Request]

    ExecuteRequest --> NetworkError{Network<br/>Error?}
    NetworkError -->|Yes| ErrorNetwork[Error: Network failure<br/>502 Bad Gateway]
    ErrorNetwork --> End

    NetworkError -->|No| TimeoutError{Request<br/>Timeout?}
    TimeoutError -->|Yes| ErrorTimeout[Error: Request timeout 30s<br/>504 Gateway Timeout]
    ErrorTimeout --> End

    TimeoutError -->|No| SSLError{SSL/TLS<br/>Error?}
    SSLError -->|Yes| ErrorSSL[Error: SSL verification failed<br/>495 SSL Certificate Error]
    ErrorSSL --> End

    SSLError -->|No| ProxyError{Proxy<br/>Error?}
    ProxyError -->|Yes| ErrorProxy[Error: Proxy forwarding failed<br/>502 Bad Gateway]
    ErrorProxy --> End

    ProxyError -->|No| ResponseError{Response<br/>Invalid?}
    ResponseError -->|Yes| ErrorResponse[Error: Invalid response format<br/>502 Bad Gateway]
    ErrorResponse --> End

    ResponseError -->|No| HashError{Hashing<br/>Failed?}
    HashError -->|Yes| ErrorHash[Error: Hash generation failed<br/>500 Internal Error]
    ErrorHash --> End

    HashError -->|No| SuccessProxy[Success: Return Web2Result<br/>200 OK]
    SuccessProxy --> End

```

**Description**: Comprehensive error handling flowchart covering all validation points and potential failure modes including action validation, session management errors, network failures, timeouts, SSL errors, and response integrity issues.

---

## Diagram 10: Complete DAHR Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> Idle: System Start

    state "DAHR Lifecycle" as Lifecycle {
        Idle --> RequestReceived: CREATE action

        state RequestReceived {
            [*] --> ValidatingRequest
            ValidatingRequest --> RequestValid: Validation passed
            ValidatingRequest --> RequestInvalid: Validation failed
            RequestInvalid --> [*]
        }

        RequestReceived --> CreatingInstance: Request valid

        state CreatingInstance {
            [*] --> GeneratingSessionId
            GeneratingSessionId --> InitializingProxy: SessionId created
            InitializingProxy --> AssigningPort: Proxy configured
            AssigningPort --> StartingServer: Port bound
            StartingServer --> InstanceReady: Server listening
            StartingServer --> CreationFailed: Error occurred
            CreationFailed --> [*]
        }

        CreatingInstance --> Active: Instance ready

        state Active {
            [*] --> AwaitingRequest

            AwaitingRequest --> ValidatingSession: START_PROXY received

            state ValidatingSession {
                [*] --> CheckingSessionId
                CheckingSessionId --> SessionFound: Session exists
                CheckingSessionId --> SessionNotFound: Session missing/expired
                SessionNotFound --> [*]
            }

            ValidatingSession --> ProcessingRequest: Session valid

            state ProcessingRequest {
                [*] --> ValidatingURL
                ValidatingURL --> NormalizingURL: URL valid
                NormalizingURL --> CheckingProxyState: URL normalized

                state CheckingProxyState {
                    [*] --> ComparingTarget
                    ComparingTarget --> ProxyReady: Same target
                    ComparingTarget --> RestartingProxy: Different target
                    RestartingProxy --> ProxyReady: Restarted
                }

                CheckingProxyState --> BuildingRequest: Proxy ready
                BuildingRequest --> HashingRequest: Request built
                HashingRequest --> ForwardingRequest: Request hashed
                ForwardingRequest --> AwaitingResponse: Sent to target

                state AwaitingResponse {
                    [*] --> WaitingForResponse
                    WaitingForResponse --> ResponseReceived: Success
                    WaitingForResponse --> TimeoutOccurred: 30s timeout
                    WaitingForResponse --> NetworkError: Connection failed
                    TimeoutOccurred --> [*]
                    NetworkError --> [*]
                }

                AwaitingResponse --> HashingResponse: Response received
                HashingResponse --> BuildingResult: Response hashed
                BuildingResult --> [*]: Result ready
            }

            ProcessingRequest --> UpdatingSession: Request complete
            UpdatingSession --> AwaitingRequest: Session updated
        }

        Active --> Expiring: 24h since lastAccess
        Active --> Stopping: Manual stop

        state Expiring {
            [*] --> CleanupTriggered
            CleanupTriggered --> CheckingAge: Cleanup running
            CheckingAge --> AgeExceeded: > 24 hours
            CheckingAge --> AgeValid: < 24 hours
            AgeValid --> [*]
            AgeExceeded --> InitiatingShutdown: Session expired
        }

        state Stopping {
            [*] --> StoppingProxy
            StoppingProxy --> ClosingConnections: Proxy stopping
            ClosingConnections --> ReleasingPort: Connections closed
            ReleasingPort --> CleaningResources: Port released
            CleaningResources --> [*]: Cleanup complete
        }

        Expiring --> Stopped: Shutdown complete
        Stopping --> Stopped: Shutdown complete
    }

    Stopped --> [*]: Session removed

    note right of RequestReceived
        Validates:
        - Action type
        - URL format
        - HTTP method
        - Required fields
    end note

    note right of Active
        Session Properties:
        - sessionId (UUID)
        - DAHR instance
        - lastAccess timestamp
        - Proxy server reference
    end note

    note right of ProcessingRequest
        Request Execution:
        - URL validation
        - Proxy initialization
        - Request building
        - SHA256 hashing
        - HTTP forwarding
        - Response hashing
        - Result assembly
    end note

    note right of Expiring
        Cleanup Strategy:
        - Lazy cleanup on CREATE
        - 24-hour TTL
        - Graceful shutdown
        - Resource release
    end note
```

**Description**: Complete state machine covering the entire DAHR lifecycle from creation through active request processing, session management, expiry handling, and graceful shutdown, showing all state transitions and validation points.

---

## Summary

The Web2 Integration system provides a robust, secure gateway for Demos blockchain applications to interact with traditional web services. Key features include:

1. **Factory Pattern**: Singleton DAHRFactory manages multiple DAHR instances with automatic cleanup
2. **Session Management**: UUID-based sessions with 24-hour TTL and lazy cleanup
3. **Proxy Architecture**: Local proxy servers forward requests to external APIs with configurable SSL
4. **Cryptographic Integrity**: SHA256 hashing of requests and responses for tamper detection
5. **URL Validation**: Comprehensive validation and normalization with security checks
6. **Two-Action Workflow**: CREATE initializes sessions, START_PROXY executes requests
7. **Error Handling**: Comprehensive validation at every layer with detailed error responses
8. **Resource Management**: Automatic port assignment, connection pooling, graceful shutdown

### Related Documentation

- **Blockchain Core**: Block structure and chain management
- **Transaction Processing**: Transaction validation and mempool
- **RPC Server**: Network communication layer
- **Cryptography Systems**: FHE, ZK, and PQC integration
