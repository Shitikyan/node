import { GCRMain } from "@/model/entities/GCRv2/GCR_Main"
import Datasource from "@/model/datasource"
import { Repository } from "typeorm"
import { isValidDeployerAddress } from "./contractValidation"
import { ExtendedContractMetadata } from "./contractMetadata"

/**
 * Smart Contract Query Utilities
 * 
 * Provides efficient querying and filtering capabilities for smart contracts
 * using PostgreSQL JSONB operations and GIN indexes.
 */

/**
 * Contract search criteria
 */
export interface ContractSearchCriteria {
    owner?: string;
    createdAfter?: number;
    createdBefore?: number;
    minVersion?: number;
    maxVersion?: number;
    hasDescription?: boolean;
    descriptionContains?: string;
    minSize?: number;
    maxSize?: number;
    limit?: number;
    offset?: number;
}

/**
 * Contract summary for search results
 */
export interface ContractSummary {
    address: string;
    owner: string;
    created: number;
    version: number;
    description?: string;
    codeSize: number;
    stateSize: number;
    totalSize: number;
    balance: bigint;
    lastModified?: number;
}

/**
 * Pagination info for query results
 */
export interface PaginationInfo {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
}

/**
 * Query result with pagination
 */
export interface QueryResult<T> {
    data: T[];
    pagination: PaginationInfo;
}

/**
 * Contract statistics
 */
export interface ContractStatistics {
    totalContracts: number;
    totalOwners: number;
    averageContractSize: number;
    largestContract: number;
    smallestContract: number;
    oldestContract: number;
    newestContract: number;
    contractsByVersion: { [version: number]: number };
}

/**
 * Smart contract query operations class
 */
export class ContractQueries {
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
     * Find contracts by owner
     * 
     * @param owner - Owner address
     * @param limit - Maximum number of results
     * @param offset - Pagination offset
     * @returns Array of contract addresses owned by the address
     */
    async findContractsByOwner(
        owner: string,
        limit = 50,
        offset = 0,
    ): Promise<QueryResult<string>> {
        try {
            if (!isValidDeployerAddress(owner)) {
                return {
                    data: [],
                    pagination: {
                        total: 0,
                        page: Math.floor(offset / limit) + 1,
                        pageSize: limit,
                        totalPages: 0,
                        hasNext: false,
                        hasPrevious: false,
                    },
                }
            }
            
            // Query using JSONB operators
            const repository = await this.getRepository()
            const [accounts, total] = await repository
                .createQueryBuilder("gcr")
                .where("gcr.contracts != '{}'")
                .andWhere("EXISTS (SELECT 1 FROM jsonb_each(gcr.contracts) AS c WHERE c.value->>'owner' = :owner)", { owner })
                .skip(offset)
                .take(limit)
                .getManyAndCount()
            
            // Extract contract addresses where this owner is the owner
            const contractAddresses: string[] = []
            for (const account of accounts) {
                for (const [address, contractData] of Object.entries(account.contracts)) {
                    if ((contractData as any).owner === owner) {
                        contractAddresses.push(address)
                    }
                }
            }
            
            const pagination = this.createPaginationInfo(total, limit, offset)
            
            return {
                data: contractAddresses,
                pagination,
            }
            
        } catch (error) {
            console.error(`Error finding contracts by owner ${owner}:`, error)
            return {
                data: [],
                pagination: {
                    total: 0,
                    page: Math.floor(offset / limit) + 1,
                    pageSize: limit,
                    totalPages: 0,
                    hasNext: false,
                    hasPrevious: false,
                },
            }
        }
    }
    
    /**
     * Find contracts created after a specific timestamp
     * 
     * @param timestamp - Unix timestamp
     * @param limit - Maximum number of results
     * @param offset - Pagination offset
     * @returns Array of contract addresses
     */
    async findContractsCreatedAfter(
        timestamp: number,
        limit = 50,
        offset = 0,
    ): Promise<QueryResult<string>> {
        try {
            const repository = await this.getRepository()
            const [accounts, total] = await repository
                .createQueryBuilder("gcr")
                .where("gcr.contracts != '{}'")
                .andWhere("EXISTS (SELECT 1 FROM jsonb_each(gcr.contracts) AS c WHERE (c.value->>'created')::bigint > :timestamp)", { timestamp })
                .skip(offset)
                .take(limit)
                .getManyAndCount()
            
            const contractAddresses: string[] = []
            for (const account of accounts) {
                for (const [address, contractData] of Object.entries(account.contracts)) {
                    if ((contractData as any).created > timestamp) {
                        contractAddresses.push(address)
                    }
                }
            }
            
            const pagination = this.createPaginationInfo(total, limit, offset)
            
            return {
                data: contractAddresses,
                pagination,
            }
            
        } catch (error) {
            console.error(`Error finding contracts created after ${timestamp}:`, error)
            return {
                data: [],
                pagination: this.createPaginationInfo(0, limit, offset),
            }
        }
    }
    
    /**
     * Search contracts with complex criteria
     * 
     * @param criteria - Search criteria
     * @returns Array of contract summaries
     */
    async searchContracts(criteria: ContractSearchCriteria): Promise<QueryResult<ContractSummary>> {
        try {
            const limit = criteria.limit || 50
            const offset = criteria.offset || 0
            
            let query = this.repository
                .createQueryBuilder("gcr")
                .where("gcr.contracts != '{}'")
            
            // Apply filters
            if (criteria.owner) {
                query = query.andWhere("EXISTS (SELECT 1 FROM jsonb_each(gcr.contracts) AS c WHERE c.value->>'owner' = :owner)", { owner: criteria.owner })
            }
            
            if (criteria.createdAfter) {
                query = query.andWhere("EXISTS (SELECT 1 FROM jsonb_each(gcr.contracts) AS c WHERE (c.value->>'created')::bigint > :createdAfter)", { createdAfter: criteria.createdAfter })
            }
            
            if (criteria.createdBefore) {
                query = query.andWhere("EXISTS (SELECT 1 FROM jsonb_each(gcr.contracts) AS c WHERE (c.value->>'created')::bigint < :createdBefore)", { createdBefore: criteria.createdBefore })
            }
            
            if (criteria.minVersion) {
                query = query.andWhere("EXISTS (SELECT 1 FROM jsonb_each(gcr.contracts) AS c WHERE (c.value->>'version')::integer >= :minVersion)", { minVersion: criteria.minVersion })
            }
            
            if (criteria.maxVersion) {
                query = query.andWhere("EXISTS (SELECT 1 FROM jsonb_each(gcr.contracts) AS c WHERE (c.value->>'version')::integer <= :maxVersion)", { maxVersion: criteria.maxVersion })
            }
            
            if (criteria.hasDescription !== undefined) {
                if (criteria.hasDescription) {
                    query = query.andWhere("EXISTS (SELECT 1 FROM jsonb_each(gcr.contracts) AS c WHERE c.value->>'description' IS NOT NULL AND c.value->>'description' != '')")
                } else {
                    query = query.andWhere("EXISTS (SELECT 1 FROM jsonb_each(gcr.contracts) AS c WHERE c.value->>'description' IS NULL OR c.value->>'description' = '')")
                }
            }
            
            if (criteria.descriptionContains) {
                query = query.andWhere("EXISTS (SELECT 1 FROM jsonb_each(gcr.contracts) AS c WHERE c.value->>'description' ILIKE :descriptionContains)", 
                    { descriptionContains: `%${criteria.descriptionContains}%` })
            }
            
            const [accounts, total] = await query
                .skip(offset)
                .take(limit)
                .getManyAndCount()
            
            // Convert to contract summaries
            const summaries: ContractSummary[] = []
            for (const account of accounts) {
                for (const [address, contractData] of Object.entries(account.contracts)) {
                    const data = contractData as any
                    
                    // Apply size filters
                    const codeSize = Buffer.byteLength(data.code, "utf8")
                    const stateSize = Buffer.byteLength(JSON.stringify(data.state), "utf8")
                    const totalSize = codeSize + stateSize
                    
                    if (criteria.minSize && totalSize < criteria.minSize) continue
                    if (criteria.maxSize && totalSize > criteria.maxSize) continue
                    
                    summaries.push({
                        address,
                        owner: data.owner,
                        created: data.created,
                        version: data.version,
                        description: data.description,
                        codeSize,
                        stateSize,
                        totalSize,
                        balance: account.balance,
                        lastModified: data.lastModified,
                    })
                }
            }
            
            const pagination = this.createPaginationInfo(total, limit, offset)
            
            return {
                data: summaries,
                pagination,
            }
            
        } catch (error) {
            console.error("Error searching contracts:", error)
            return {
                data: [],
                pagination: this.createPaginationInfo(0, criteria.limit || 50, criteria.offset || 0),
            }
        }
    }
    
    /**
     * Get total number of contracts
     * 
     * @returns Number of contracts
     */
    async getContractCount(): Promise<number> {
        try {
            const repository = await this.getRepository()
            const result = await repository
                .createQueryBuilder("gcr")
                .select("COUNT(*)", "count")
                .where("gcr.contracts != '{}'")
                .getRawOne()
            
            return parseInt(result.count) || 0
            
        } catch (error) {
            console.error("Error getting contract count:", error)
            return 0
        }
    }
    
    /**
     * Get contracts owned by multiple addresses
     * 
     * @param owners - Array of owner addresses
     * @param limit - Maximum number of results
     * @param offset - Pagination offset
     * @returns Contracts owned by any of the specified addresses
     */
    async findContractsByMultipleOwners(
        owners: string[],
        limit = 50,
        offset = 0,
    ): Promise<QueryResult<ContractSummary>> {
        try {
            if (owners.length === 0) {
                return {
                    data: [],
                    pagination: this.createPaginationInfo(0, limit, offset),
                }
            }
            
            const validOwners = owners.filter(owner => isValidDeployerAddress(owner))
            if (validOwners.length === 0) {
                return {
                    data: [],
                    pagination: this.createPaginationInfo(0, limit, offset),
                }
            }
            
            const repository = await this.getRepository()
            const [accounts, total] = await repository
                .createQueryBuilder("gcr")
                .where("gcr.contracts != '{}'")
                .andWhere("EXISTS (SELECT 1 FROM jsonb_each(gcr.contracts) AS c WHERE c.value->>'owner' = ANY(:owners))", { owners: validOwners })
                .skip(offset)
                .take(limit)
                .getManyAndCount()
            
            const summaries: ContractSummary[] = []
            for (const account of accounts) {
                for (const [address, contractData] of Object.entries(account.contracts)) {
                    const data = contractData as any
                    
                    if (validOwners.includes(data.owner)) {
                        const codeSize = Buffer.byteLength(data.code, "utf8")
                        const stateSize = Buffer.byteLength(JSON.stringify(data.state), "utf8")
                        
                        summaries.push({
                            address,
                            owner: data.owner,
                            created: data.created,
                            version: data.version,
                            description: data.description,
                            codeSize,
                            stateSize,
                            totalSize: codeSize + stateSize,
                            balance: account.balance,
                            lastModified: data.lastModified,
                        })
                    }
                }
            }
            
            const pagination = this.createPaginationInfo(total, limit, offset)
            
            return {
                data: summaries,
                pagination,
            }
            
        } catch (error) {
            console.error("Error finding contracts by multiple owners:", error)
            return {
                data: [],
                pagination: this.createPaginationInfo(0, limit, offset),
            }
        }
    }
    
    /**
     * Get contract statistics
     * 
     * @returns Statistics about all contracts
     */
    async getContractStatistics(): Promise<ContractStatistics> {
        try {
            const repository = await this.getRepository()
            const accounts = await repository
                .createQueryBuilder("gcr")
                .where("gcr.contracts != '{}'")
                .getMany()
            
            let totalContracts = 0
            const owners = new Set<string>()
            const sizes: number[] = []
            const creationTimes: number[] = []
            const versions: { [version: number]: number } = {}
            
            for (const account of accounts) {
                for (const [address, contractData] of Object.entries(account.contracts)) {
                    const data = contractData as any
                    
                    totalContracts++
                    owners.add(data.owner)
                    creationTimes.push(data.created)
                    
                    // Calculate size
                    const codeSize = Buffer.byteLength(data.code, "utf8")
                    const stateSize = Buffer.byteLength(JSON.stringify(data.state), "utf8")
                    const totalSize = codeSize + stateSize
                    sizes.push(totalSize)
                    
                    // Count versions
                    const version = data.version || 1
                    versions[version] = (versions[version] || 0) + 1
                }
            }
            
            return {
                totalContracts,
                totalOwners: owners.size,
                averageContractSize: sizes.length > 0 ? Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length) : 0,
                largestContract: sizes.length > 0 ? Math.max(...sizes) : 0,
                smallestContract: sizes.length > 0 ? Math.min(...sizes) : 0,
                oldestContract: creationTimes.length > 0 ? Math.min(...creationTimes) : 0,
                newestContract: creationTimes.length > 0 ? Math.max(...creationTimes) : 0,
                contractsByVersion: versions,
            }
            
        } catch (error) {
            console.error("Error getting contract statistics:", error)
            return {
                totalContracts: 0,
                totalOwners: 0,
                averageContractSize: 0,
                largestContract: 0,
                smallestContract: 0,
                oldestContract: 0,
                newestContract: 0,
                contractsByVersion: {},
            }
        }
    }
    
    /**
     * Find largest contracts
     * 
     * @param limit - Number of contracts to return
     * @returns Largest contracts by size
     */
    async findLargestContracts(limit = 10): Promise<ContractSummary[]> {
        try {
            const repository = await this.getRepository()
            const accounts = await repository
                .createQueryBuilder("gcr")
                .where("gcr.contracts != '{}'")
                .getMany()
            
            const summaries: ContractSummary[] = []
            
            for (const account of accounts) {
                for (const [address, contractData] of Object.entries(account.contracts)) {
                    const data = contractData as any
                    
                    const codeSize = Buffer.byteLength(data.code, "utf8")
                    const stateSize = Buffer.byteLength(JSON.stringify(data.state), "utf8")
                    const totalSize = codeSize + stateSize
                    
                    summaries.push({
                        address,
                        owner: data.owner,
                        created: data.created,
                        version: data.version,
                        description: data.description,
                        codeSize,
                        stateSize,
                        totalSize,
                        balance: account.balance,
                        lastModified: data.lastModified,
                    })
                }
            }
            
            // Sort by total size descending and take top N
            return summaries
                .sort((a, b) => b.totalSize - a.totalSize)
                .slice(0, limit)
            
        } catch (error) {
            console.error("Error finding largest contracts:", error)
            return []
        }
    }
    
    /**
     * Find most recent contracts
     * 
     * @param limit - Number of contracts to return
     * @returns Most recently created contracts
     */
    async findMostRecentContracts(limit = 10): Promise<ContractSummary[]> {
        try {
            const repository = await this.getRepository()
            const accounts = await repository
                .createQueryBuilder("gcr")
                .where("gcr.contracts != '{}'")
                .getMany()
            
            const summaries: ContractSummary[] = []
            
            for (const account of accounts) {
                for (const [address, contractData] of Object.entries(account.contracts)) {
                    const data = contractData as any
                    
                    const codeSize = Buffer.byteLength(data.code, "utf8")
                    const stateSize = Buffer.byteLength(JSON.stringify(data.state), "utf8")
                    
                    summaries.push({
                        address,
                        owner: data.owner,
                        created: data.created,
                        version: data.version,
                        description: data.description,
                        codeSize,
                        stateSize,
                        totalSize: codeSize + stateSize,
                        balance: account.balance,
                        lastModified: data.lastModified,
                    })
                }
            }
            
            // Sort by creation time descending and take top N
            return summaries
                .sort((a, b) => b.created - a.created)
                .slice(0, limit)
            
        } catch (error) {
            console.error("Error finding most recent contracts:", error)
            return []
        }
    }
    
    /**
     * Create pagination information
     * 
     * @param total - Total number of items
     * @param limit - Items per page
     * @param offset - Current offset
     * @returns Pagination info
     */
    private createPaginationInfo(total: number, limit: number, offset: number): PaginationInfo {
        const page = Math.floor(offset / limit) + 1
        const totalPages = Math.ceil(total / limit)
        
        return {
            total,
            page,
            pageSize: limit,
            totalPages,
            hasNext: page < totalPages,
            hasPrevious: page > 1,
        }
    }
}

/**
 * Default contract queries instance
 */
export const contractQueries = new ContractQueries()