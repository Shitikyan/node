import { GCRMain } from "@/model/entities/GCRv2/GCR_Main"
import Datasource from "@/model/datasource"
import { Repository } from "typeorm"
import { isValidContractAddress, isValidDeployerAddress } from "./contractValidation"
import { ContractData, StorageResult } from "./contractStorage"
import { ContractState, OwnershipTransfer, VersionHistoryEntry } from "./language/types/ContractTypes"

/**
 * Smart Contract Metadata Management
 * 
 * Provides utilities for managing contract metadata including ownership,
 * versioning, timestamps, and contract information.
 */

/**
 * Contract metadata interface
 */
export interface ContractMetadata {
    owner: string;
    created: number;
    version: number;
    isContract: true;
    lastModified?: number;
    description?: string;
}

/**
 * Extended contract metadata with additional information
 */
export interface ExtendedContractMetadata extends ContractMetadata {
    address: string;
    codeSize: number;
    stateSize: number;
    totalSize: number;
    balance: bigint;
    nonce: number;
    deploymentTxHash?: string;
}



/**
 * Contract metadata management class
 */
export class ContractMetadataManager {
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
    
    /**
     * Get contract metadata
     * 
     * @param address - Contract address
     * @returns Contract metadata or null if not found
     */
    async getMetadata(address: string): Promise<ContractMetadata | null> {
        try {
            if (!isValidContractAddress(address)) {
                return null
            }
            
            const repository = await this.getRepository()
            const account = await repository.findOne({ where: { pubkey: address } })
            if (!account || !account.contracts[address]) {
                return null
            }
            
            const contractData = account.contracts[address]
            
            return {
                owner: contractData.owner,
                created: contractData.created,
                version: contractData.version,
                isContract: contractData.isContract,
                lastModified: contractData.lastModified,
                description: contractData.description,
            }
            
        } catch (error) {
            console.error(`Error getting metadata for contract ${address}:`, error)
            return null
        }
    }
    
    /**
     * Get extended contract metadata with size and account information
     * 
     * @param address - Contract address
     * @returns Extended metadata or null if not found
     */
    async getExtendedMetadata(address: string): Promise<ExtendedContractMetadata | null> {
        try {
            if (!isValidContractAddress(address)) {
                return null
            }
            
            const repository = await this.getRepository()
            const account = await repository.findOne({ where: { pubkey: address } })
            if (!account || !account.contracts[address]) {
                return null
            }
            
            const contractData = account.contracts[address]
            
            // Calculate sizes
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
            
            return {
                address,
                owner: contractData.owner,
                created: contractData.created,
                version: contractData.version,
                isContract: contractData.isContract,
                lastModified: contractData.lastModified,
                description: contractData.description,
                codeSize,
                stateSize,
                totalSize,
                balance: account.balance,
                nonce: account.nonce,
            }
            
        } catch (error) {
            console.error(`Error getting extended metadata for contract ${address}:`, error)
            return null
        }
    }
    
    /**
     * Update contract description
     * 
     * @param address - Contract address
     * @param description - New description
     * @param updater - Address of the account updating (must be owner)
     * @returns Storage result
     */
    async updateDescription(
        address: string,
        description: string,
        updater: string,
    ): Promise<StorageResult> {
        try {
            if (!isValidContractAddress(address)) {
                return { success: false, error: "Invalid contract address format" }
            }
            
            if (!isValidDeployerAddress(updater)) {
                return { success: false, error: "Invalid updater address format" }
            }
            
            const repository = await this.getRepository()
            const account = await repository.findOne({ where: { pubkey: address } })
            if (!account || !account.contracts[address]) {
                return { success: false, error: "Contract not found" }
            }
            
            const contractData = account.contracts[address]
            
            // Check ownership
            if (contractData.owner !== updater) {
                return { success: false, error: "Only contract owner can update description" }
            }
            
            // Update description and last modified
            contractData.description = description
            contractData.lastModified = Date.now()
            
            // Update contracts field
            account.contracts = {
                ...account.contracts,
                [address]: contractData,
            }
            
            // Save to database
            await repository.save(account)
            
            return { success: true }
            
        } catch (error) {
            return { 
                success: false, 
                error: `Description update error: ${error instanceof Error ? error.message : "Unknown error"}`, 
            }
        }
    }
    
    /**
     * Transfer contract ownership
     * 
     * @param address - Contract address
     * @param newOwner - New owner address
     * @param currentOwner - Current owner address (for verification)
     * @param txHash - Transaction hash (optional)
     * @returns Storage result
     */
    async transferOwnership(
        address: string,
        newOwner: string,
        currentOwner: string,
        txHash?: string,
    ): Promise<StorageResult> {
        try {
            if (!isValidContractAddress(address)) {
                return { success: false, error: "Invalid contract address format" }
            }
            
            if (!isValidDeployerAddress(newOwner)) {
                return { success: false, error: "Invalid new owner address format" }
            }
            
            if (!isValidDeployerAddress(currentOwner)) {
                return { success: false, error: "Invalid current owner address format" }
            }
            
            const repository = await this.getRepository()
            const account = await repository.findOne({ where: { pubkey: address } })
            if (!account || !account.contracts[address]) {
                return { success: false, error: "Contract not found" }
            }
            
            const contractData = account.contracts[address]
            
            // Verify current ownership
            if (contractData.owner !== currentOwner) {
                return { success: false, error: "Current owner verification failed" }
            }
            
            // Prevent self-transfer
            if (currentOwner === newOwner) {
                return { success: false, error: "Cannot transfer ownership to the same address" }
            }
            
            // Initialize ownership history if needed
            if (!contractData.ownershipHistory) {
                contractData.ownershipHistory = []
            }
            
            const transfer: OwnershipTransfer = {
                previousOwner: currentOwner,
                newOwner,
                timestamp: Date.now(),
                txHash,
            }
            
            contractData.ownershipHistory.push(transfer)
            
            // Update owner and metadata
            contractData.owner = newOwner
            contractData.lastModified = Date.now()
            
            // Update contracts field
            account.contracts = {
                ...account.contracts,
                [address]: contractData,
            }
            
            // Save to database
            await repository.save(account)
            
            return { 
                success: true, 
                data: { previousOwner: currentOwner, newOwner, timestamp: transfer.timestamp }, 
            }
            
        } catch (error) {
            return { 
                success: false, 
                error: `Ownership transfer error: ${error instanceof Error ? error.message : "Unknown error"}`, 
            }
        }
    }
    
    /**
     * Get contract ownership history
     * 
     * @param address - Contract address
     * @returns Array of ownership transfers
     */
    async getOwnershipHistory(address: string): Promise<OwnershipTransfer[]> {
        try {
            if (!isValidContractAddress(address)) {
                return []
            }
            
            const repository = await this.getRepository()
            const account = await repository.findOne({ where: { pubkey: address } })
            if (!account || !account.contracts[address]) {
                return []
            }
            
            const contractData = account.contracts[address]
            return contractData.ownershipHistory || []
            
        } catch (error) {
            console.error(`Error getting ownership history for contract ${address}:`, error)
            return []
        }
    }
    
    /**
     * Get contract version history
     * 
     * @param address - Contract address
     * @returns Array of version history entries
     */
    async getVersionHistory(address: string): Promise<VersionHistoryEntry[]> {
        try {
            if (!isValidContractAddress(address)) {
                return []
            }
            
            const repository = await this.getRepository()
            const account = await repository.findOne({ where: { pubkey: address } })
            if (!account || !account.contracts[address]) {
                return []
            }
            
            const contractData = account.contracts[address]
            return contractData.versionHistory || []
            
        } catch (error) {
            console.error(`Error getting version history for contract ${address}:`, error)
            return []
        }
    }
    
    /**
     * Record a version update in history
     * 
     * @param address - Contract address
     * @param version - Version number
     * @param codeHash - Hash of the code
     * @param description - Version description
     * @param txHash - Transaction hash
     * @returns Storage result
     */
    async recordVersionUpdate(
        address: string,
        version: number,
        codeHash: string,
        description?: string,
        txHash?: string,
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
            
            // Initialize version history if needed
            if (!contractData.versionHistory) {
                contractData.versionHistory = []
            }
            
            const versionEntry: VersionHistoryEntry = {
                version,
                timestamp: Date.now(),
                codeHash,
                description,
                txHash,
            }
            
            contractData.versionHistory.push(versionEntry)
            contractData.lastModified = Date.now()
            
            // Update contracts field
            account.contracts = {
                ...account.contracts,
                [address]: contractData,
            }
            
            // Save to database
            await repository.save(account)
            
            return { success: true, data: versionEntry }
            
        } catch (error) {
            return { 
                success: false, 
                error: `Version history update error: ${error instanceof Error ? error.message : "Unknown error"}`, 
            }
        }
    }
    
    /**
     * Check if an address is the owner of a contract
     * 
     * @param contractAddress - Contract address
     * @param ownerAddress - Potential owner address
     * @returns True if the address is the owner
     */
    async isOwner(contractAddress: string, ownerAddress: string): Promise<boolean> {
        try {
            const metadata = await this.getMetadata(contractAddress)
            return metadata ? metadata.owner === ownerAddress : false
        } catch (error) {
            console.error(`Error checking ownership for ${contractAddress}:`, error)
            return false
        }
    }
    
    /**
     * Get contract creation timestamp
     * 
     * @param address - Contract address
     * @returns Creation timestamp or null if not found
     */
    async getCreationTime(address: string): Promise<number | null> {
        try {
            const metadata = await this.getMetadata(address)
            return metadata ? metadata.created : null
        } catch (error) {
            console.error(`Error getting creation time for contract ${address}:`, error)
            return null
        }
    }
    
    /**
     * Get contract age in milliseconds
     * 
     * @param address - Contract address
     * @returns Age in milliseconds or null if not found
     */
    async getContractAge(address: string): Promise<number | null> {
        try {
            const creationTime = await this.getCreationTime(address)
            return creationTime ? Date.now() - creationTime : null
        } catch (error) {
            console.error(`Error calculating age for contract ${address}:`, error)
            return null
        }
    }
}

/**
 * Default contract metadata manager instance
 */
export const contractMetadata = new ContractMetadataManager()