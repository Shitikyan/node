# Fees Branch Scope - Demos Network Fee System Inspection

## Purpose
This branch (`fees`) is designed to inspect and analyze the fee system within the Demos Network node software.

## Core Fee Components

### 1. Transaction Fee Structure
The Demos Network implements a three-tier fee system for transactions:

- **Network Fee** (`network_fee`): Base blockchain network fee
- **RPC Fee** (`rpc_fee`): Fee charged for RPC services 
- **Additional Fee** (`additional_fee`): Extra fees (e.g., dApp fees, special operations)

### 2. Key Files and Locations

#### Fee Calculation & Processing
- `src/libs/blockchain/routines/calculateCurrentGas.ts`: Core fee calculation logic
- `src/libs/consensus/routines/orderTxs.ts`: Transaction ordering by total fees
- `src/libs/blockchain/routines/validateTransaction.ts`: Fee validation during transaction processing

#### Fee Data Models
- `src/model/entities/Transactions.ts`: Database entity with fee columns (networkFee, rpcFee, additionalFee)
- `src/libs/blockchain/transaction.ts`: Transaction object with fee structure
- `src/utilities/sharedState.ts`: Global RPC fee configuration

#### Fee Implementation
- `src/libs/utils/demostdlib/deriveMempoolOperation.ts`: Fee derivation for mempool operations
- `src/libs/blockchain/routines/executeNativeTransaction.ts`: Fee processing during execution

### 3. Fee System Architecture

#### Configuration
- `RPC_FEE`: Environment variable for base RPC fee (default: 10)
- `RPC_FEE_PERCENT`: Environment variable for RPC fee percentage
- Configurable via `src/index.ts` initialization

#### Fee Calculation Flow
1. **Base Gas Calculation**: Get last block base gas from GCR
2. **Congestion Adaptation**: Adjust gas based on block timing
3. **RPC Fee Addition**: Add configured RPC fee
4. **Size Multiplication**: Multiply by transaction payload size
5. **Total Fee**: Sum of network_fee + rpc_fee + additional_fee

#### Transaction Ordering
- Transactions sorted by total fee amount (ascending)
- Higher fee transactions get priority processing
- Implemented in `orderTxs` function

### 4. Current Implementation Status

#### Implemented Features
- ✅ Three-tier fee structure (network, RPC, additional)
- ✅ Dynamic gas calculation based on congestion
- ✅ Transaction ordering by fee priority
- ✅ Database persistence of fee components
- ✅ Fee validation during transaction processing

#### TODO/Incomplete Features
- ❌ Fee limits and caps implementation
- ❌ dApp fee integration
- ❌ Sophisticated fee estimation algorithms
- ❌ Fee refund mechanisms
- ❌ Advanced congestion pricing

### 5. Key Areas for Inspection

#### Critical Fee Components
1. **Fee Calculation Logic** (`calculateCurrentGas.ts`)
2. **Congestion Adaptation** (`adaptGasToCongestion` function)
3. **Fee Validation** (`validateTransaction.ts`)
4. **Transaction Priority** (`orderTxs.ts`)
5. **Database Schema** (`Transactions.ts` entity)

#### Configuration Points
- Environment variables for fee settings
- Shared state management for runtime fee configuration
- Genesis block fee initialization (set to 0)

### 6. Fee System Dependencies

#### External Dependencies
- GCR (Global Chain Registry) for base gas values
- Chain state for congestion analysis
- Shared state for configuration management
- Transaction validation pipeline

#### Internal Components
- Transaction creation and serialization
- Mempool operation derivation
- Block validation and consensus
- Database persistence layer

## Inspection Focus Areas

When analyzing the fee system, pay particular attention to:

1. **Fee Calculation Accuracy**: Verify gas calculation and congestion adaptation
2. **Fee Structure Completeness**: Ensure all three fee types are properly handled
3. **Performance Impact**: Review fee calculation efficiency
4. **Configuration Management**: Check environment variable handling
5. **Database Consistency**: Verify fee data persistence
6. **Transaction Ordering**: Validate fee-based priority system
7. **Error Handling**: Review fee validation and error scenarios

## Environment Variables
- `RPC_FEE`: Base RPC fee amount
- `RPC_FEE_PERCENT`: RPC fee as percentage
- `PROD`: Production mode flag affecting fee validation