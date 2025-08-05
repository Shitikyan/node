/**
 * Contract State and Type Definitions
 * Phase 2.1 - Smart Contract State Management
 */

// OSC primitive types
export type OSCValue = string | number | boolean

// State variable with access control
export interface StateVariable {
    value: OSCValue
    type: "string" | "int" | "address" | "boolean"
    public: boolean   // true = everyone can read, false = only owner can read
    owned: boolean    // true = only owner can modify, false = everyone can modify
}

// Contract state - mapping of variable names to state variables
export interface ContractState {
    [variableName: string]: StateVariable
}

// Ownership transfer record
export interface OwnershipTransfer {
    previousOwner: string
    newOwner: string
    timestamp: number
    txHash?: string
}

// Version history entry
export interface VersionHistoryEntry {
    version: number
    timestamp: number
    codeHash: string
    description?: string
    txHash?: string
}

// Complete contract storage structure (matches GCRMain.contracts)
export interface StoredContract {
    code: string              // OSC source code
    state: ContractState      // Contract state with access control
    owner: string            // Contract owner pubkey
    created: number          // Creation timestamp
    isContract: true         // Type marker
    version: number          // Contract version
    lastModified?: number    // Last update timestamp  
    description?: string     // Optional description
    // Metadata fields for contract management
    ownershipHistory?: OwnershipTransfer[]
    versionHistory?: VersionHistoryEntry[]
}

// Contract deployment configuration
export interface ContractDeployment {
    source: string           // OSC source code
    deployer: string         // Deployer pubkey
    contractAddress: string  // Generated contract address
    description?: string     // Optional description
}

// Future extension placeholder for mappings
// export interface ContractMapping {
//     [key: string]: OSCValue
// }

// Contract execution context
export interface ExecutionContext {
    caller: string           // Transaction sender
    contractAddress: string  // Current contract address
    timestamp: number       // Execution timestamp
}

// Contract execution result
export interface ExecutionResult {
    success: boolean
    returnValue?: OSCValue
    newState?: ContractState
    stateChanged: boolean
    error?: string
    gasUsed?: number        // Future gas metering
}