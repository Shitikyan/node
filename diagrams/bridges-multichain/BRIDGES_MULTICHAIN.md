# Bridges & Multichain Integration - Mermaid Diagrams

## Overview

Demos blockchain provides comprehensive cross-chain and multichain capabilities through XM (Cross-chain/Multichain) Scripts, Native Bridges, and integration with Rubic SDK for token swaps. The system supports operations across multiple blockchains including EVM chains (Ethereum, Polygon, BSC, etc.), Solana, and Aptos.

**Key Features:**
- **XM Scripts**: JSON-based multichain operation scripts with multiple operation types
- **Cross-Chain Operations**: Pay, contract read/write, balance queries across chains
- **Native Bridge**: Controlled bridge system with CVSA-based controller coordination
- **Rubic Integration**: Cross-chain token swaps via Rubic API v2
- **Multi-Chain Support**: EVM chains, Solana, Aptos with unified interface
- **Operation Executors**: Specialized handlers for each chain and operation type
- **Transaction Compilation**: Client-side signing flow for bridge operations

## 1. Bridges & Multichain Architecture Overview

```mermaid
graph TB
    subgraph "Client Side"
        USER[User/DApp]
        SDK[Demos SDK]
    end

    subgraph "Demos Node: Multichain Layer"
        DISPATCHER[XMDispatcher]
        PARSER[XMParser]
        EXECUTORS[Operation Executors]
        NATIVEBRIDGE[Native Bridge Manager]
        RUBIC[Rubic Service]
    end

    subgraph "Bridge System"
        BRIDGECLASS[Bridge Multiton Class]
        BRIDGECONTEXT[Bridge Context]
        BRIDGEOPS[Bridge Operations Map]
        CONTROLLERS[Controller Shard CVSA]
    end

    subgraph "Operation Executors"
        PAY[Pay Executor]
        CONTRACTREAD[Contract Read Executor]
        CONTRACTWRITE[Contract Write Executor]
        BALANCE[Balance Query Executor]
    end

    subgraph "External Blockchains"
        EVM[EVM Chains<br/>Ethereum, Polygon, BSC<br/>Avalanche, Optimism, Arbitrum]
        SOLANA[Solana]
        APTOS[Aptos]
    end

    subgraph "Bridge Providers"
        RUBICSDK[Rubic API v2]
        RPC[Chain RPC Providers]
    end

    USER --> SDK
    SDK --> DISPATCHER
    DISPATCHER --> PARSER
    PARSER --> EXECUTORS

    EXECUTORS --> PAY
    EXECUTORS --> CONTRACTREAD
    EXECUTORS --> CONTRACTWRITE
    EXECUTORS --> BALANCE

    SDK --> NATIVEBRIDGE
    NATIVEBRIDGE --> BRIDGECLASS
    BRIDGECLASS --> BRIDGECONTEXT
    BRIDGECLASS --> BRIDGEOPS
    BRIDGECONTEXT --> CONTROLLERS

    SDK --> RUBIC
    RUBIC --> RUBICSDK

    PAY --> RPC
    CONTRACTREAD --> RPC
    CONTRACTWRITE --> RPC
    BALANCE --> RPC

    RPC --> EVM
    RPC --> SOLANA
    RPC --> APTOS

    RUBICSDK --> EVM
    RUBICSDK --> SOLANA

    style DISPATCHER fill:#e1f5ff
    style PARSER fill:#fff4e1
    style EXECUTORS fill:#e8f5e9
    style BRIDGECLASS fill:#f3e5f5
    style RUBIC fill:#ffe0b2
```

## 2. XM Script Structure & Parsing

```mermaid
flowchart TD
    START([Client creates XM Script])

    START --> XMSTRUCT[XM Script Structure]

    subgraph "XM Script JSON Format"
        XMSTRUCT --> OPERATIONS[operations object]
        OPERATIONS --> OP1["operation_name_1: IOperation"]
        OPERATIONS --> OP2["operation_name_2: IOperation"]
        OPERATIONS --> OPN["operation_name_n: IOperation"]

        OP1 --> OPFIELDS[IOperation fields]
        OPFIELDS --> CHAIN[chain: string]
        OPFIELDS --> SUBCHAIN[subchain: string]
        OPFIELDS --> ISEVM[is_evm: boolean]
        OPFIELDS --> TASK[task object]

        TASK --> TASKTYPE[type: pay, contract_read, contract_write, balance_query]
        TASK --> PARAMS[params: operation-specific parameters]
    end

    XMSTRUCT --> SENDTONODE[Send to Demos node via RPC]
    SENDTONODE --> DISPATCHER[XMDispatcher.digest]

    subgraph "XM Script Parsing & Validation"
        DISPATCHER --> LOGSCRIPT[Log full script for debugging]
        DISPATCHER --> COUNTOPS[Count operations]
        DISPATCHER --> ANALYZEOPS[Analyze operation names]
        DISPATCHER --> EXECUTE[Call XMDispatcher.execute]
    end

    EXECUTE --> PARSER[XMParser.execute]

    subgraph "Operation Iteration"
        PARSER --> LOOPOPS{For each<br/>operation}
        LOOPOPS -->|more| EXTRACTOP[Extract operation name and object]
        LOOPOPS -->|done| COLLECTRESULTS

        EXTRACTOP --> EXECONE[XMParser.executeOperation]
        EXECONE --> CHAINID[Determine chain ID]

        CHAINID --> ISEVM2{is_evm<br/>true?}
        ISEVM2 -->|yes| GETCHAINID[Get chain ID from config or parse subchain]
        ISEVM2 -->|no| SETCHAINID0[Set chain ID to 0]

        GETCHAINID --> DISPATCHTASK
        SETCHAINID0 --> DISPATCHTASK

        DISPATCHTASK[Dispatch based on task.type]

        DISPATCHTASK --> SWITCHTYPE{task.type}
        SWITCHTYPE -->|pay| PAYTASK[handlePayOperation]
        SWITCHTYPE -->|contract_read| READTASK[handleContractRead]
        SWITCHTYPE -->|contract_write| WRITETASK[handleContractWrite]
        SWITCHTYPE -->|balance_query| BALANCETASK[handleBalanceQuery]
        SWITCHTYPE -->|unknown| ERRORTASK[Return error: unknown type]

        PAYTASK --> STORERESULT[Store result with operation name]
        READTASK --> STORERESULT
        WRITETASK --> STORERESULT
        BALANCETASK --> STORERESULT
        ERRORTASK --> STORERESULT

        STORERESULT --> LOOPOPS
    end

    COLLECTRESULTS[Collect all operation results]
    COLLECTRESULTS --> COUNTFAILED[Count failed operations]

    COUNTFAILED --> ALLFAILED{All operations<br/>failed?}
    ALLFAILED -->|yes| FAILRESPONSE[Return: success false, all_ops_failed]
    ALLFAILED -->|no| SOMEFAILED{Some operations<br/>failed?}

    SOMEFAILED -->|yes| PARTIALRESPONSE[Return: success true, partial_success]
    SOMEFAILED -->|no| SUCCESSRESPONSE[Return: success true, all_ops_ok]

    FAILRESPONSE --> END([Return results to client])
    PARTIALRESPONSE --> END
    SUCCESSRESPONSE --> END

    style START fill:#e1f5ff
    style DISPATCHER fill:#fff4e1
    style PARSER fill:#e8f5e9
    style SUCCESSRESPONSE fill:#c8e6c9
    style FAILRESPONSE fill:#ffcdd2
```

## 3. XM Operation Execution Flow

```mermaid
sequenceDiagram
    participant Client
    participant XMDispatcher
    participant XMParser
    participant Executor
    participant ChainRPC as Chain RPC Provider
    participant Blockchain as External Blockchain

    Note over Client,Blockchain: XM Script Execution Flow

    Client->>XMDispatcher: Submit XM Script via execute RPC
    XMDispatcher->>XMDispatcher: Log and analyze script
    XMDispatcher->>XMParser: execute(script)

    loop For each operation in script
        XMParser->>XMParser: Extract operation name and object
        XMParser->>XMParser: Determine chain ID (EVM or 0)

        XMParser->>Executor: executeOperation(operation, chainID)

        alt Operation type: pay
            Executor->>Executor: handlePayOperation
            Executor->>Executor: Parse payment parameters
            Executor->>Executor: Build transaction
            Executor->>ChainRPC: Send signed transaction
            ChainRPC->>Blockchain: Execute payment on chain
            Blockchain->>ChainRPC: Return transaction hash
            ChainRPC->>Executor: Return result
            Executor->>XMParser: Return success with tx hash

        else Operation type: contract_read
            Executor->>Executor: handleContractRead
            Executor->>Executor: Parse contract address and method
            Executor->>ChainRPC: Call contract method (read-only)
            ChainRPC->>Blockchain: Query contract state
            Blockchain->>ChainRPC: Return contract data
            ChainRPC->>Executor: Return result
            Executor->>XMParser: Return success with data

        else Operation type: contract_write
            Executor->>Executor: handleContractWrite
            Executor->>Executor: Parse contract address, method, params
            Executor->>Executor: Build contract call transaction
            Executor->>ChainRPC: Send signed transaction
            ChainRPC->>Blockchain: Execute contract write
            Blockchain->>ChainRPC: Return transaction hash
            ChainRPC->>Executor: Return result
            Executor->>XMParser: Return success with tx hash

        else Operation type: balance_query
            Executor->>Executor: handleBalanceQuery
            Executor->>Executor: Parse address
            Executor->>ChainRPC: Query balance
            ChainRPC->>Blockchain: Get account balance
            Blockchain->>ChainRPC: Return balance
            ChainRPC->>Executor: Return result
            Executor->>XMParser: Return success with balance

        else Unknown type
            Executor->>XMParser: Return error: unknown task type
        end

        XMParser->>XMParser: Store result for operation name
    end

    XMParser->>XMParser: Collect all results
    XMParser->>XMParser: Count failed operations

    alt All operations failed
        XMParser->>XMDispatcher: Return: success false, all_ops_failed
    else Some operations failed
        XMParser->>XMDispatcher: Return: success true, partial_success
    else All operations succeeded
        XMParser->>XMDispatcher: Return: success true, all_ops_ok
    end

    XMDispatcher->>Client: Return results with operation statuses
```

## 4. Cross-Chain Payment (Pay Operation)

```mermaid
flowchart TD
    START([handlePayOperation called])

    START --> GETOP[Get operation object with chainID]
    GETOP --> PARSECHAIN{Parse<br/>chain type}

    PARSECHAIN -->|EVM| EVMPAY[EVM Payment Flow]
    PARSECHAIN -->|Solana| SOLANAPAY[Solana Payment Flow]
    PARSECHAIN -->|Aptos| APTOSPAY[Aptos Payment Flow]

    subgraph "EVM Payment Flow"
        EVMPAY --> EVMPARSE[Parse EVM parameters]
        EVMPARSE --> EVMFROM[from: wallet address]
        EVMPARSE --> EVMTO[to: recipient address]
        EVMPARSE --> EVMAMOUNT[amount: value in wei]
        EVMPARSE --> EVMPRIVKEY[privateKey: for signing]

        EVMPRIVKEY --> EVMPROVIDER[Get RPC provider for chain ID]
        EVMPROVIDER --> WEB3[Create Web3 instance]

        WEB3 --> BUILDTX[Build transaction object]
        BUILDTX --> SETTO[Set to address]
        BUILDTX --> SETVALUE[Set value in wei]
        BUILDTX --> SETGAS[Set gas limit]
        BUILDTX --> SETGASPRICE[Set gas price or maxFeePerGas]

        SETGASPRICE --> SIGNTX[Sign transaction with private key]
        SIGNTX --> SENDRAWTX[web3.eth.sendSignedTransaction]
        SENDRAWTX --> WAITTX[Wait for transaction receipt]
        WAITTX --> EVMRESULT[Return: result success, transactionHash]
    end

    subgraph "Solana Payment Flow"
        SOLANAPAY --> SOLPARSE[Parse Solana parameters]
        SOLPARSE --> SOLFROM[from: public key]
        SOLPARSE --> SOLTO[to: recipient public key]
        SOLPARSE --> SOLAMOUNT[amount: lamports]
        SOLPARSE --> SOLPRIVKEY[privateKey: for signing]

        SOLPRIVKEY --> SOLCONN[Create Connection to Solana RPC]
        SOLCONN --> CREATETRANSFER[Create SystemProgram.transfer instruction]
        CREATETRANSFER --> SIGNSOL[Sign transaction with keypair]
        SIGNSOL --> SENDSOL[connection.sendTransaction]
        SENDSOL --> CONFIRMSOL[Confirm transaction]
        CONFIRMSOL --> SOLRESULT[Return: result success, signature]
    end

    subgraph "Aptos Payment Flow"
        APTOSPAY --> APTPARSE[Parse Aptos parameters]
        APTPARSE --> APTFROM[from: account address]
        APTPARSE --> APTTO[to: recipient address]
        APTPARSE --> APTAMOUNT[amount: octas]
        APTPARSE --> APTPRIVKEY[privateKey: for signing]

        APTPRIVKEY --> APTCLIENT[Create Aptos client]
        APTCLIENT --> APTBUILD[Build coin transfer payload]
        APTBUILD --> APTSIGN[Sign transaction]
        APTSIGN --> APTSUBMIT[Submit transaction]
        APTSUBMIT --> APTWAIT[Wait for transaction]
        APTWAIT --> APTRESULT[Return: result success, hash]
    end

    EVMRESULT --> ADDCHAIN[Add chain info to result]
    SOLRESULT --> ADDCHAIN
    APTRESULT --> ADDCHAIN

    ADDCHAIN --> END([Return result to caller])

    style START fill:#e1f5ff
    style EVMPAY fill:#fff4e1
    style SOLANAPAY fill:#e8f5e9
    style APTOSPAY fill:#f3e5f5
    style END fill:#c8e6c9
```

## 5. Contract Read/Write Operations

```mermaid
sequenceDiagram
    participant XMParser
    participant Executor
    participant Web3 as Web3/Provider
    participant Contract as Smart Contract
    participant Blockchain

    Note over XMParser,Blockchain: Contract Read Operation

    XMParser->>Executor: handleContractRead(operation, chainID)
    Executor->>Executor: Parse contract address
    Executor->>Executor: Parse method name
    Executor->>Executor: Parse method parameters
    Executor->>Executor: Parse ABI

    Executor->>Web3: Create provider for chain ID
    Web3->>Executor: Provider ready

    Executor->>Contract: Create contract instance with ABI
    Contract->>Executor: Contract instance ready

    Executor->>Contract: Call method (read-only, no gas)
    Contract->>Blockchain: Query contract state
    Blockchain->>Contract: Return state data
    Contract->>Executor: Return method result

    Executor->>XMParser: Return: result success, data

    Note over XMParser,Blockchain: Contract Write Operation

    XMParser->>Executor: handleContractWrite(operation, chainID)
    Executor->>Executor: Parse contract address
    Executor->>Executor: Parse method name
    Executor->>Executor: Parse method parameters
    Executor->>Executor: Parse ABI
    Executor->>Executor: Parse private key for signing

    Executor->>Web3: Create provider for chain ID
    Web3->>Executor: Provider ready

    Executor->>Contract: Create contract instance with ABI
    Contract->>Executor: Contract instance ready

    Executor->>Contract: Encode method call
    Contract->>Executor: Return encoded data

    Executor->>Web3: Build transaction object
    Executor->>Web3: Set to: contract address
    Executor->>Web3: Set data: encoded method call
    Executor->>Web3: Set gas limit and gas price

    Executor->>Web3: Sign transaction with private key
    Web3->>Executor: Return signed transaction

    Executor->>Web3: sendSignedTransaction
    Web3->>Blockchain: Broadcast transaction
    Blockchain->>Blockchain: Execute contract method
    Blockchain->>Web3: Return transaction receipt
    Web3->>Executor: Return receipt with tx hash

    Executor->>XMParser: Return: result success, transactionHash

    Note over XMParser,Blockchain: Both operations add chain info (chain.subchain) to result
```

## 6. Native Bridge Operation Compilation

### ⚠️ Implementation Status: 🚧 IN DEVELOPMENT (Incomplete)

**NOTE**: The Native Bridge feature is **partially implemented**:

**✅ Implemented**:
- Basic operation structure (NativeBridgeOperation interface)
- RPC endpoint for compilation (`nativeBridge`)
- manageNativeBridge.ts scaffold (60 lines)
- Transaction flow structure

**❌ NOT Implemented**:
- `parseEVMOperation` - EVM transaction verification and parsing (TODO in code)
- `parseSOLANAOperation` - Solana transaction verification and parsing (TODO in code)
- Bridge contract interaction (lock/unlock verification)
- Merkle proof generation
- CVSA-based controller coordination
- handleNativeBridgeTx execution in consensus

**Status**: The Native Bridge architecture is designed but core verification logic is not yet implemented. XM Scripts provide full cross-chain functionality as an alternative.

See `src/libs/network/manageNativeBridge.ts` for current implementation.

---

```mermaid
flowchart TD
    START([Client requests native bridge operation])

    START --> SENDNATIVE[RPC: nativeBridge with NativeBridgeOperation]
    SENDNATIVE --> MANAGE[manageNativeBridge function]

    subgraph "NativeBridgeOperation Structure"
        MANAGE --> OPSTRUCT[Operation structure]
        OPSTRUCT --> ORIGINCHAIN[originChain: EVM or SOLANA]
        OPSTRUCT --> ORIGINTX[originTx: transaction hash]
        OPSTRUCT --> FROM[from: source address]
        OPSTRUCT --> TO[to: destination address]
        OPSTRUCT --> AMOUNT[amount: value]
        OPSTRUCT --> CURRENCY[currency: token symbol]
        OPSTRUCT --> DESTCHAIN[destinationChain: target chain]
    end

    ORIGINCHAIN --> PARSE[parseOperation function]

    PARSE --> CHECKCHAIN{originChain<br/>type?}
    CHECKCHAIN -->|EVM| PARSEVM[parseEVMOperation]
    CHECKCHAIN -->|SOLANA| PARSESOL[parseSOLANAOperation]

    subgraph "EVM Operation Parsing"
        PARSEVM --> EVMVERIFY[Verify origin transaction on EVM]
        EVMVERIFY --> EVMLOCK[Verify tokens locked in bridge contract]
        EVMLOCK --> EVMDERIVE[Derive compiled content]
        EVMDERIVE --> EVMCONTENT[NativeBridgeOperationCompiled content]
        EVMCONTENT --> EVMVALID[validUntil: current block + 3]
        EVMCONTENT --> EVMOP[operation: mint or burn or transfer]
        EVMCONTENT --> EVMPROOF[proof: merkle proof or signatures]
    end

    subgraph "Solana Operation Parsing"
        PARSESOL --> SOLVERIFY[Verify origin transaction on Solana]
        SOLVERIFY --> SOLLOCK[Verify tokens locked in bridge program]
        SOLLOCK --> SOLDERIVE[Derive compiled content]
        SOLDERIVE --> SOLCONTENT[NativeBridgeOperationCompiled content]
        SOLCONTENT --> SOLVALID[validUntil: current block + 3]
        SOLCONTENT --> SOLOP[operation: mint or burn or transfer]
        SOLCONTENT --> SOLPROOF[proof: signatures]
    end

    EVMCONTENT --> CREATECOMPILED
    SOLCONTENT --> CREATECOMPILED

    CREATECOMPILED[Create NativeBridgeOperationCompiled object]
    CREATECOMPILED --> SETCONTENT[Set content with derived data]
    CREATECOMPILED --> SETSIG[Set signature empty to be signed by client]
    CREATECOMPILED --> SETRPC[Set rpc node ed25519 public key]

    SETRPC --> RESPONSE[Create RPCResponse]
    RESPONSE --> SETRESULT[result: 200]
    RESPONSE --> SETRESPONSE[response: compiled operation]

    SETRESPONSE --> RETURNCLIENT[Return to client]
    RETURNCLIENT --> CLIENTSIGN[Client signs compiled operation]
    CLIENTSIGN --> SUBMITNATIVE[Client submits as native bridge transaction]

    SUBMITNATIVE --> CONSENSUS[Transaction enters consensus]
    CONSENSUS --> EXECUTEBRIDGE[handleNativeBridgeTx in consensus]

    EXECUTEBRIDGE --> VERIFYCOMPILED[Verify compiled operation validity]
    VERIFYCOMPILED --> VERIFYVALID{validUntil<br/>not expired?}
    VERIFYVALID -->|no| EXPIRED[Reject: operation expired]
    VERIFYVALID -->|yes| VERIFYRPC{rpc pubkey<br/>matches?}

    VERIFYRPC -->|no| INVALIDRPC[Reject: invalid RPC]
    VERIFYRPC -->|yes| VERIFYSIG{Client signature<br/>valid?}

    VERIFYSIG -->|no| INVALIDSIG[Reject: invalid signature]
    VERIFYSIG -->|yes| EXECUTEOP[Execute bridge operation]

    EXECUTEOP --> MINT[Mint tokens on Demos]
    MINT --> ADDGCR[Add GCREdit to mint tokens]
    ADDGCR --> SUCCESS[Operation successful]

    SUCCESS --> END([Bridge operation complete])
    EXPIRED --> END
    INVALIDRPC --> END
    INVALIDSIG --> END

    style START fill:#e1f5ff
    style MANAGE fill:#fff4e1
    style CREATECOMPILED fill:#e8f5e9
    style SUCCESS fill:#c8e6c9
    style EXPIRED fill:#ffcdd2
```

## 7. Bridge Context & Multiton Pattern

```mermaid
classDiagram
    class BridgeContext {
        +string chain
        +string address
        +ControllerProperties controllers_properties
        +number valid_from
        +number valid_to
    }

    class ControllerProperties {
        +string seed (CVSA)
        +number reference_block
    }

    class BridgeOperation {
        +string id
        +BridgeOperationContent content
    }

    class BridgeOperationContent {
        +BridgeContext context
        +string from
        +string to
        +string currency
        +number amount
        +number max_block_delay
    }

    class Bridge {
        -static Map instances
        +string id
        +BridgeContext context
        +Map operations
        +static getInstance(id) Bridge
        +executeOperation(operationId) Promise~BridgeOperationResult~
        +registerOperation(operation) Promise~boolean~
    }

    class BridgeOperationResult {
        +boolean success
        +string message
        +BridgeOperation operation
        +any extra
    }

    class BridgesControls {
        +static getShardFromCVSA(cvsa) string[]
    }

    BridgeContext *-- ControllerProperties
    BridgeOperationContent *-- BridgeContext
    BridgeOperation *-- BridgeOperationContent
    Bridge o-- BridgeContext
    Bridge o-- BridgeOperation
    Bridge ..> BridgeOperationResult
    BridgesControls ..> Bridge

    note for Bridge "Multiton Pattern:<br/>One instance per chain+address<br/>Manages operations map<br/>CVSA-based controller coordination"

    note for BridgeContext "Chain-specific bridge config<br/>Controllers determined by CVSA<br/>Valid from/to block numbers<br/>Reference block for verification"
```

## 8. Rubic Cross-Chain Swap Flow

```mermaid
sequenceDiagram
    participant Client
    participant DemosNode as Demos Node (RubicService)
    participant RubicAPI as Rubic API v2
    participant FromChain as Source Blockchain
    participant ToChain as Destination Blockchain

    Note over Client,ToChain: Rubic Cross-Chain Token Swap Flow

    Client->>DemosNode: RPC: bridge with get_trade
    Note right of Client: Payload:<br/>fromChainId, toChainId<br/>fromToken, toToken, amount

    DemosNode->>DemosNode: Parse payload
    DemosNode->>DemosNode: Get blockchain names from chain IDs
    DemosNode->>DemosNode: Get token addresses for chains

    DemosNode->>RubicAPI: POST /quote-best
    Note right of DemosNode: srcTokenBlockchain<br/>srcTokenAddress<br/>srcTokenAmount<br/>dstTokenBlockchain<br/>dstTokenAddress<br/>referrer, integratorAddress

    RubicAPI->>RubicAPI: Find best route across bridges
    RubicAPI->>RubicAPI: Calculate estimated output
    RubicAPI->>RubicAPI: Generate quote ID

    RubicAPI->>DemosNode: Return quote with ID
    Note left of RubicAPI: Quote includes:<br/>- quote ID<br/>- estimated output<br/>- route details<br/>- fees

    DemosNode->>Client: Return quote data

    Client->>Client: Review quote
    Client->>Client: Approve swap

    Client->>DemosNode: RPC: bridge with execute_trade
    Note right of Client: Payload:<br/>fromChainId, toChainId<br/>fromToken, toToken, amount<br/>fromAddress, toAddress<br/>quoteId

    DemosNode->>DemosNode: Parse payload with addresses
    DemosNode->>DemosNode: Get blockchain names and token addresses

    DemosNode->>RubicAPI: POST /swap
    Note right of DemosNode: All quote params<br/>+ id (quoteId)<br/>+ fromAddress<br/>+ receiver<br/>+ integratorAddress<br/>+ referrer

    RubicAPI->>RubicAPI: Build transaction data
    RubicAPI->>RubicAPI: Include approval transaction if needed

    RubicAPI->>DemosNode: Return transaction data
    Note left of RubicAPI: Transaction includes:<br/>- to: contract address<br/>- data: encoded call<br/>- value: ETH amount<br/>- gas estimates

    DemosNode->>Client: Return transaction data

    Client->>Client: Sign transaction with wallet
    Client->>Client: Get raw signed transaction

    Client->>DemosNode: RPC: send raw transaction
    Note right of Client: rawTx (hex for EVM, base64 for Solana)<br/>chainId

    DemosNode->>DemosNode: Determine blockchain from chainId
    DemosNode->>DemosNode: Get RPC provider for chain

    alt Source chain is EVM
        DemosNode->>FromChain: web3.eth.sendSignedTransaction
        FromChain->>FromChain: Execute transaction
        FromChain->>FromChain: Lock tokens in bridge contract
        FromChain->>DemosNode: Return transaction hash
    else Source chain is Solana
        DemosNode->>FromChain: connection.sendRawTransaction
        FromChain->>FromChain: Execute transaction
        FromChain->>FromChain: Lock tokens in bridge program
        FromChain->>DemosNode: Return transaction signature
    end

    DemosNode->>Client: Return transaction hash

    Note over FromChain,ToChain: Rubic Bridge Cross-Chain Transfer

    FromChain->>RubicAPI: Emit bridge event
    RubicAPI->>RubicAPI: Detect event
    RubicAPI->>ToChain: Mint/unlock tokens on destination

    ToChain->>ToChain: Execute destination transaction
    ToChain->>RubicAPI: Confirm transfer

    RubicAPI->>Client: Notify swap complete (via polling or webhook)

    Client->>ToChain: Verify token balance on destination
    ToChain->>Client: Confirm tokens received
```

## 9. Multi-Chain Transaction Execution

```mermaid
flowchart TD
    START([XM Script with multiple chain operations])

    START --> PARSEOPS[Parse all operations]
    PARSEOPS --> GROUPCHAIN[Group operations by chain]

    subgraph "Chain-Specific Execution"
        GROUPCHAIN --> EVMOPS[EVM Chain Operations]
        GROUPCHAIN --> SOLOPS[Solana Operations]
        GROUPCHAIN --> APTOPS[Aptos Operations]

        EVMOPS --> EVMLOOP{For each<br/>EVM operation}
        EVMLOOP -->|more| EVMEXEC[Execute EVM operation]
        EVMLOOP -->|done| EVMRESULTS

        EVMEXEC --> EVMCHAINID[Get chain ID for subchain]
        EVMCHAINID --> EVMPROVIDER[Get Web3 provider for chain]
        EVMPROVIDER --> EVMTASK{Task type?}

        EVMTASK -->|pay| EVMPAY[Build and send payment]
        EVMTASK -->|contract_read| EVMREAD[Call contract method]
        EVMTASK -->|contract_write| EVMWRITE[Send contract transaction]
        EVMTASK -->|balance_query| EVMBALANCE[Query balance]

        EVMPAY --> EVMRESULT[Store result]
        EVMREAD --> EVMRESULT
        EVMWRITE --> EVMRESULT
        EVMBALANCE --> EVMRESULT

        EVMRESULT --> EVMLOOP

        EVMRESULTS[Collect EVM results]

        SOLOPS --> SOLLOOP{For each<br/>Solana operation}
        SOLLOOP -->|more| SOLEXEC[Execute Solana operation]
        SOLLOOP -->|done| SOLRESULTS

        SOLEXEC --> SOLCONN[Create Solana connection]
        SOLCONN --> SOLTASK{Task type?}

        SOLTASK -->|pay| SOLPAY[Create and send transfer]
        SOLTASK -->|contract_read| SOLREAD[Query program account]
        SOLTASK -->|contract_write| SOLWRITE[Send program instruction]
        SOLTASK -->|balance_query| SOLBALANCE[Query account balance]

        SOLPAY --> SOLRESULT[Store result]
        SOLREAD --> SOLRESULT
        SOLWRITE --> SOLRESULT
        SOLBALANCE --> SOLRESULT

        SOLRESULT --> SOLLOOP

        SOLRESULTS[Collect Solana results]

        APTOPS --> APTLOOP{For each<br/>Aptos operation}
        APTLOOP -->|more| APTEXEC[Execute Aptos operation]
        APTLOOP -->|done| APTRESULTS

        APTEXEC --> APTCLIENT[Create Aptos client]
        APTCLIENT --> APTTASK{Task type?}

        APTTASK -->|pay| APTPAY[Build and submit coin transfer]
        APTTASK -->|contract_read| APTREAD[View function call]
        APTTASK -->|contract_write| APTWRITE[Submit entry function]
        APTTASK -->|balance_query| APTBALANCE[Query account resource]

        APTPAY --> APTRESULT[Store result]
        APTREAD --> APTRESULT
        APTWRITE --> APTRESULT
        APTBALANCE --> APTRESULT

        APTRESULT --> APTLOOP

        APTRESULTS[Collect Aptos results]
    end

    EVMRESULTS --> MERGERESULTS[Merge all chain results]
    SOLRESULTS --> MERGERESULTS
    APTRESULTS --> MERGERESULTS

    MERGERESULTS --> ANALYZE[Analyze success/failure per operation]

    ANALYZE --> CHECKALL{All operations<br/>failed?}
    CHECKALL -->|yes| FAILALL[Return: success false, all_ops_failed]
    CHECKALL -->|no| CHECKSOME{Some operations<br/>failed?}

    CHECKSOME -->|yes| PARTIAL[Return: success true, partial_success]
    CHECKSOME -->|no| SUCCESSALL[Return: success true, all_ops_ok]

    FAILALL --> END([Return complete results])
    PARTIAL --> END
    SUCCESSALL --> END

    style START fill:#e1f5ff
    style EVMOPS fill:#fff4e1
    style SOLOPS fill:#e8f5e9
    style APTOPS fill:#f3e5f5
    style SUCCESSALL fill:#c8e6c9
    style FAILALL fill:#ffcdd2
```

## 10. Complete Multichain Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> ScriptCreation: Client creates XM Script

    state "Script Creation" as ScriptCreation {
        [*] --> DefineOperations
        DefineOperations: Define operations with chains
        DefineOperations --> SetParams: Set task types and params
        SetParams --> ValidateJSON: Validate JSON structure
        ValidateJSON --> [*]: Script ready
    }

    ScriptCreation --> Submission: Submit via RPC

    state "Script Submission" as Submission {
        [*] --> RPCCall
        RPCCall: execute method with XM Script
        RPCCall --> Authentication: Verify signature headers
        Authentication --> Dispatch: Route to XMDispatcher
        Dispatch --> [*]
    }

    Submission --> Parsing: XMDispatcher.digest

    state "Script Parsing" as Parsing {
        [*] --> LogScript
        LogScript: Log full script for debugging
        LogScript --> AnalyzeOps: Count and analyze operations
        AnalyzeOps --> PrepareExec: Prepare for execution
        PrepareExec --> [*]
    }

    Parsing --> Execution: XMParser.execute

    state "Operation Execution" as Execution {
        [*] --> IterateOps
        IterateOps: Loop through operations

        IterateOps --> DetermineChain: Determine chain and ID
        DetermineChain --> DispatchTask: Dispatch by task type

        DispatchTask --> PayExecution: Pay task
        DispatchTask --> ReadExecution: Contract read
        DispatchTask --> WriteExecution: Contract write
        DispatchTask --> BalanceExecution: Balance query

        PayExecution --> StoreResult: Store operation result
        ReadExecution --> StoreResult
        WriteExecution --> StoreResult
        BalanceExecution --> StoreResult

        StoreResult --> MoreOps: Check for more operations
        MoreOps --> IterateOps: Yes
        MoreOps --> [*]: No, all executed
    }

    Execution --> ResultAnalysis: Collect results

    state "Result Analysis" as ResultAnalysis {
        [*] --> CountFailures
        CountFailures: Count failed operations
        CountFailures --> CheckFailures: Analyze failure rate

        CheckFailures --> AllFailed: 100% failed
        CheckFailures --> SomeFailed: Partial failure
        CheckFailures --> AllSucceeded: 0% failed

        AllFailed --> [*]: success false
        SomeFailed --> [*]: success true, partial
        AllSucceeded --> [*]: success true, all ok
    }

    ResultAnalysis --> Response: Format response

    state "Response Formation" as Response {
        [*] --> BuildResponse
        BuildResponse: Create RPCResponse object
        BuildResponse --> SetSuccess: Set success flag
        SetSuccess --> SetMessage: Set message (all_ops_failed, partial_success, all_ops_ok)
        SetMessage --> SetResults: Set results object with all operation outcomes
        SetResults --> [*]
    }

    Response --> [*]: Return to client

    note right of ScriptCreation
        Script Structure:
        - operations: object with named operations
        - Each operation: chain, subchain, is_evm, task
        - Task: type and params
    end note

    note right of Execution
        Execution Features:
        - Chain-specific executors
        - EVM chain ID resolution
        - RPC provider selection
        - Transaction signing
        - Error handling per operation
    end note

    note right of ResultAnalysis
        Result Handling:
        - Individual operation success/failure
        - Overall script success determination
        - Partial success supported
        - Detailed error messages
    end note
```

---

## Key File References

### Multichain Core Files
- **XM Dispatcher**: `src/features/multichain/XMDispatcher.ts` (71 lines - entry point, digest, execute)
- **XM Parser**: `src/features/multichain/routines/XMParser.ts` (153 lines - load, execute, executeOperation)
- **Pay Executor**: `src/features/multichain/routines/executors/pay.ts` (handles payment operations)
- **Contract Read Executor**: `src/features/multichain/routines/executors/contract_read.ts`
- **Contract Write Executor**: `src/features/multichain/routines/executors/contract_write.ts`
- **Balance Query Executor**: `src/features/multichain/routines/executors/balance_query.ts`

### Bridge System Files
- **Bridges**: `src/features/bridges/bridges.ts` (114 lines - Bridge class, BridgeContext, multiton pattern) ✅ **PRODUCTION**
- **Bridge Utils**: `src/features/bridges/bridgeUtils.ts` (utility functions) ✅ **PRODUCTION**
- **Manage Native Bridge**: `src/libs/network/manageNativeBridge.ts` (60 lines - operation compilation scaffold) 🚧 **IN DEVELOPMENT** - parseEVMOperation and parseSOLANAOperation not implemented
- **Manage Bridges**: `src/libs/network/manageBridge.ts` (44 lines - Rubic integration routing) ✅ **PRODUCTION**

### Rubic Integration Files
- **Rubic Service**: `src/features/bridges/rubic.ts` (200+ lines - Rubic API v2 integration)
- **Get Quote From API**: rubic.ts:35 (quote-best endpoint)
- **Get Swap Data From API**: rubic.ts:86 (swap endpoint with quote ID)
- **Send Raw Transaction**: rubic.ts:157 (execute signed tx on chain)

---

## Bridges & Multichain Integration Principles

1. **Multi-Chain Support**: Unified interface for EVM chains, Solana, and Aptos operations

2. **XM Script Flexibility**: JSON-based scripts with named operations and task types

3. **Partial Success Model**: Scripts can partially succeed if some operations fail

4. **Chain ID Resolution**: Automatic chain ID lookup for EVM networks from subchain names

5. **RPC Provider Selection**: Dynamic provider selection based on chain and operation type

6. **Bridge Multiton Pattern**: One Bridge instance per chain+address combination

7. **CVSA-Based Controllers**: Bridge controllers determined by CVSA seed

8. **Native Bridge Compilation**: Two-step flow (compile operation → client signs → submit)

9. **Rubic Quote-Based Flow**: Get quote with ID → Get swap data → Client signs → Execute

10. **Operation Executors**: Specialized handlers per chain and operation type (pay, read, write, query)
