import { GCRMain } from "@/model/entities/GCRv2/GCR_Main"
import Datasource from "@/model/datasource"
import { Repository } from "typeorm"
import { 
    isValidContractAddress, 
    isValidDeployerAddress, 
    CONTRACT_LIMITS,
    validateContractCode, 
} from "./contractValidation"

/**
 * Smart Contract Storage Operations
 * 
 * Provides core CRUD operations for smart contracts in the Demos Network.
 * Contracts are stored as account entities in GCRMain with contract data in JSONB.
 */

/**
 * Contract storage data structure
 */
export interface ContractData {
    code: string;
    state: any;
    owner: string;
    created: number;
    isContract: true;
    version: number;
    lastModified?: number;
    description?: string;
}

/**
 * Contract storage result
 */
export interface StoredContract {
    address: string;
    data: ContractData;
    balance: bigint;
    nonce: number;
}

/**
 * Contract storage operation result
 */
export interface StorageResult {
    success: boolean;
    error?: string;
    data?: any;
}

/**
 * Contract storage size information
 */
export interface ContractSizeInfo {
    codeSize: number;
    stateSize: number;
    totalSize: number;
    isWithinLimits: boolean;
}

/**
 * Core contract storage operations class
 */
export class ContractStorage {
    private repository: Repository<GCRMain> | null = null
    
    constructor(repository?: Repository<GCRMain>) {
        if (repository) {
            this.repository = repository
        }
        // Repository will be initialized lazily when needed
    }
    
    /**
     * Get GCRMain repository (lazy initialization)
     */
    private async getRepository(): Promise<Repository<GCRMain>> {
        if (this.repository) {
            return this.repository
        }
        
        const datasource = await Datasource.getInstance()
        const dataSource = datasource.getDataSource()
        this.repository = dataSource.getRepository(GCRMain)
        return this.repository
    }
    
    /**\
     * Store a new contract
     * 
     * @param address - Contract address
     * @param code - Contract source code
     * @param owner - Contract owner/deployer
     * @param initialState - Initial contract state (optional)
     * @param description - Contract description (optional)
     * @returns Storage result
     */
    async storeContract(
        address: string,
        code: string,
        owner: string,
        initialState: any = {},
        description?: string,
    ): Promise<StorageResult> {
        try {
            // Validate inputs
            if (!isValidContractAddress(address)) {
                return { success: false, error: "Invalid contract address format" }
            }
            
            if (!isValidDeployerAddress(owner)) {
                return { success: false, error: "Invalid owner address format" }
            }
            
            const codeValidation = validateContractCode(code)
            if (!codeValidation.valid) {
                return { success: false, error: codeValidation.error }
            }
            
            // Check if contract already exists
            const repository = await this.getRepository()
            const existing = await repository.findOne({ where: { pubkey: address } })
            if (existing) {
                return { success: false, error: "Contract already exists at this address" }
            }
            
            // Create contract data
            const contractData: ContractData = {
                code,
                state: initialState,
                owner,
                created: Date.now(),
                isContract: true,
                version: 1,
                lastModified: Date.now(),
                description,
            }
            
            // Check size limits
            const sizeInfo = this.calculateContractSize(contractData)
            if (!sizeInfo.isWithinLimits) {
                return { 
                    success: false, 
                    error: `Contract too large: ${sizeInfo.totalSize} bytes (limit: ${CONTRACT_LIMITS.MAX_CONTRACT_SIZE})`, 
                }
            }
            
            // Create new GCRMain entry for the contract
            const contractAccount = new GCRMain()
            contractAccount.pubkey = address
            contractAccount.balance = BigInt(0)
            contractAccount.nonce = 0
            contractAccount.assignedTxs = []
            contractAccount.identities = { xm: {}, web2: {}, pqc: {} }
            contractAccount.points = {
                totalPoints: 0,
                breakdown: {
                    web3Wallets: {},
                    socialAccounts: { twitter: 0, github: 0, discord: 0 },
                    referrals: 0,
                },
                lastUpdated: new Date(),
            }
            contractAccount.referralInfo = {
                totalReferrals: 0,
                referralCode: `contract_${address.slice(-8)}`,
                referrals: [],
                referredBy: null,
            }
            contractAccount.contracts = {
                [address]: contractData,
            }
            
            // Save to database
            await repository.save(contractAccount)
            
            return { 
                success: true, 
                data: { address, size: sizeInfo.totalSize }, 
            }
            
        } catch (error) {
            return { 
                success: false, 
                error: `Storage error: ${error instanceof Error ? error.message : "Unknown error"}`, 
            }
        }
    }
    
    /**
     * Retrieve a contract by address
     * 
     * @param address - Contract address
     * @returns Stored contract or null if not found
     */
    async getContract(address: string): Promise<StoredContract | null> {
        try {
            if (!isValidContractAddress(address)) {
                return null
            }
            
            const repository = await this.getRepository()
            const account = await repository.findOne({ where: { pubkey: address } })
            if (!account || !account.contracts[address]) {
                return null
            }
            
            return {
                address,
                data: account.contracts[address],
                balance: account.balance,
                nonce: account.nonce,
            }
            
        } catch (error) {
            console.error(`Error retrieving contract ${address}:`, error)
            return null
        }
    }
    
    /**
     * Update contract state
     * 
     * @param address - Contract address
     * @param key - State key (optional, if not provided updates entire state)
     * @param value - State value
     * @returns Storage result
     */
    async updateContractState(
        address: string,
        key: string | null,
        value: any,
    ): Promise<StorageResult> {
        try {
            if (!isValidContractAddress(address)) {
                return { success: false, error: "Invalid contract address format" }
            }
            
            const repository = await this.getRepository()
            const account = await repository.findOne({ where: { pubkey: address } })
            if (!account || !account.contracts[address]) {
                return { success: false, error: "Contract not found" }
            }
            
            const contractData = account.contracts[address]
            
            // Update state
            if (key === null) {
                // Replace entire state
                contractData.state = value
            } else {
                // Update specific key
                if (typeof contractData.state !== "object" || contractData.state === null) {
                    contractData.state = {}
                }
                contractData.state[key] = value
            }
            
            // Update last modified timestamp
            contractData.lastModified = Date.now()
            
            // Check size limits
            const sizeInfo = this.calculateContractSize(contractData)
            if (!sizeInfo.isWithinLimits) {
                return { 
                    success: false, 
                    error: `Contract state too large: ${sizeInfo.totalSize} bytes (limit: ${CONTRACT_LIMITS.MAX_CONTRACT_SIZE})`, 
                }
            }
            
            // Update contracts field
            account.contracts = {
                ...account.contracts,
                [address]: contractData,
            }
            
            // Save to database
            await repository.save(account)
            
            return { success: true, data: { key, size: sizeInfo.totalSize } }
            
        } catch (error) {
            return { 
                success: false, 
                error: `State update error: ${error instanceof Error ? error.message : "Unknown error"}`, 
            }
        }
    }
    
    /**
     * Get contract state
     * 
     * @param address - Contract address
     * @param key - State key (optional, if not provided returns entire state)
     * @returns Contract state or specific key value
     */
    async getContractState(address: string, key?: string): Promise<any> {
        try {
            const contract = await this.getContract(address)
            if (!contract) {
                return null
            }
            
            if (key === undefined) {
                return contract.data.state
            }
            
            if (typeof contract.data.state === "object" && contract.data.state !== null) {
                return contract.data.state[key]
            }
            
            return undefined
            
        } catch (error) {
            console.error(`Error getting contract state for ${address}:`, error)
            return null
        }
    }
    
    /**
     * Delete a contract
     * 
     * @param address - Contract address
     * @returns Storage result
     */
    async deleteContract(address: string): Promise<StorageResult> {
        try {
            if (!isValidContractAddress(address)) {
                return { success: false, error: "Invalid contract address format" }
            }
            
            const repository = await this.getRepository()
            const account = await repository.findOne({ where: { pubkey: address } })
            if (!account) {
                return { success: false, error: "Contract not found" }
            }
            
            // Remove the contract account entirely
            await repository.remove(account)
            
            return { success: true }
            
        } catch (error) {
            return { 
                success: false, 
                error: `Deletion error: ${error instanceof Error ? error.message : "Unknown error"}`, 
            }
        }
    }
    
    /**
     * Get contract size information
     * 
     * @param address - Contract address
     * @returns Size information or null if contract not found
     */
    async getContractSize(address: string): Promise<ContractSizeInfo | null> {
        try {
            const contract = await this.getContract(address)
            if (!contract) {
                return null
            }
            
            return this.calculateContractSize(contract.data)
            
        } catch (error) {
            console.error(`Error calculating contract size for ${address}:`, error)
            return null
        }
    }
    
    /**
     * Update contract version (for upgrades)
     * 
     * @param address - Contract address
     * @param newCode - New contract code
     * @param newVersion - New version number
     * @returns Storage result
     */
    async updateContractVersion(
        address: string,
        newCode: string,
        newVersion: number,
    ): Promise<StorageResult> {
        try {
            if (!isValidContractAddress(address)) {
                return { success: false, error: "Invalid contract address format" }
            }
            
            const codeValidation = validateContractCode(newCode)
            if (!codeValidation.valid) {
                return { success: false, error: codeValidation.error }
            }
            
            const repository = await this.getRepository()
            const account = await repository.findOne({ where: { pubkey: address } })
            if (!account || !account.contracts[address]) {
                return { success: false, error: "Contract not found" }
            }
            
            const contractData = account.contracts[address]
            
            // Update code and version
            contractData.code = newCode
            contractData.version = newVersion
            contractData.lastModified = Date.now()
            
            // Check size limits
            const sizeInfo = this.calculateContractSize(contractData)
            if (!sizeInfo.isWithinLimits) {
                return { 
                    success: false, 
                    error: `Updated contract too large: ${sizeInfo.totalSize} bytes (limit: ${CONTRACT_LIMITS.MAX_CONTRACT_SIZE})`, 
                }
            }
            
            // Update contracts field
            account.contracts = {
                ...account.contracts,
                [address]: contractData,
            }
            
            // Increment account nonce for version tracking
            account.nonce += 1
            
            // Save to database
            await repository.save(account)
            
            return { 
                success: true, 
                data: { version: newVersion, size: sizeInfo.totalSize, nonce: account.nonce }, 
            }
            
        } catch (error) {
            return { 
                success: false, 
                error: `Version update error: ${error instanceof Error ? error.message : "Unknown error"}`, 
            }
        }
    }
    
    /**
     * Check if a contract exists
     * 
     * @param address - Contract address
     * @returns True if contract exists
     */
    async contractExists(address: string): Promise<boolean> {
        try {
            if (!isValidContractAddress(address)) {
                return false
            }
            
            const repository = await this.getRepository()
            const account = await repository.findOne({ 
                where: { pubkey: address },
                select: ["pubkey"],
            })
            
            return account !== null
            
        } catch (error) {
            console.error(`Error checking contract existence for ${address}:`, error)
            return false
        }
    }
    
    /**
     * Calculate contract size information
     * 
     * @param contractData - Contract data
     * @returns Size information
     */
    private calculateContractSize(contractData: ContractData): ContractSizeInfo {
        const codeSize = Buffer.byteLength(contractData.code, "utf8")
        const stateSize = Buffer.byteLength(JSON.stringify(contractData.state), "utf8")
        const metadataSize = Buffer.byteLength(JSON.stringify({
            owner: contractData.owner,
            created: contractData.created,
            version: contractData.version,
            lastModified: contractData.lastModified,
            description: contractData.description,
        }), "utf8")
        
        const totalSize = codeSize + stateSize + metadataSize
        const isWithinLimits = totalSize <= CONTRACT_LIMITS.MAX_CONTRACT_SIZE
        
        return {
            codeSize,
            stateSize,
            totalSize,
            isWithinLimits,
        }
    }
}

/**
 * Default contract storage instance
 * For use when you don't need dependency injection
 */
export const contractStorage = new ContractStorage()