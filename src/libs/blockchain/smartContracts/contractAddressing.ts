import * as crypto from "crypto"

/**
 * Smart Contract Addressing Utilities
 * 
 * Provides deterministic contract address generation for the Demos Network.
 * Contract addresses are generated using: keccak256(deployer + code + nonce)
 */

/**
 * Generates a deterministic contract address
 * 
 * @param deployer - Address of the contract deployer
 * @param contractCode - The contract source code
 * @param nonce - Deployer's current nonce
 * @returns Contract address string
 */
export function generateContractAddress(
    deployer: string,
    contractCode: string,
    nonce: number,
): string {
    if (!deployer || typeof deployer !== "string") {
        throw new Error("Deployer address is required and must be a string")
    }
    
    if (!contractCode || typeof contractCode !== "string") {
        throw new Error("Contract code is required and must be a string")
    }
    
    if (typeof nonce !== "number" || nonce < 0) {
        throw new Error("Nonce must be a non-negative number")
    }
    
    // Create deterministic input string
    const input = `${deployer}${contractCode}${nonce}`
    
    // Generate keccak256 hash (using sha256 as substitute until keccak256 is available)
    const hash = crypto.createHash("sha256").update(input).digest("hex")
    
    // Return contract address with 'contract_' prefix for identification
    return `contract_${hash}`
}

/**
 * Generates a contract address using code hash (for identical contracts)
 * 
 * @param deployer - Address of the contract deployer  
 * @param codeHash - Hash of the contract code
 * @param nonce - Deployer's current nonce
 * @returns Contract address string
 */
export function generateContractAddressFromCodeHash(
    deployer: string,
    codeHash: string,
    nonce: number,
): string {
    if (!deployer || typeof deployer !== "string") {
        throw new Error("Deployer address is required and must be a string")
    }
    
    if (!codeHash || typeof codeHash !== "string") {
        throw new Error("Code hash is required and must be a string")
    }
    
    if (typeof nonce !== "number" || nonce < 0) {
        throw new Error("Nonce must be a non-negative number")
    }
    
    // Create deterministic input string using code hash
    const input = `${deployer}${codeHash}${nonce}`
    
    // Generate address hash
    const hash = crypto.createHash("sha256").update(input).digest("hex")
    
    return `contract_${hash}`
}

/**
 * Generates hash of contract code for deduplication
 * 
 * @param contractCode - The contract source code
 * @returns Code hash string
 */
export function generateCodeHash(contractCode: string): string {
    if (!contractCode || typeof contractCode !== "string") {
        throw new Error("Contract code is required and must be a string")
    }
    
    // Normalize code by removing extra whitespace and comments
    const normalizedCode = contractCode
        .replace(/\/\*[\s\S]*?\*\//g, "") // Remove block comments
        .replace(/\/\/.*$/gm, "") // Remove line comments
        .replace(/\s+/g, " ") // Normalize whitespace
        .trim()
    
    return crypto.createHash("sha256").update(normalizedCode).digest("hex")
}

/**
 * Checks if two contract addresses would collide
 * 
 * @param address1 - First contract address
 * @param address2 - Second contract address
 * @returns True if addresses are identical
 */
export function checkAddressCollision(address1: string, address2: string): boolean {
    return address1 === address2
}

/**
 * Predicts the next contract address for a deployer
 * 
 * @param deployer - Address of the deployer
 * @param contractCode - The contract code to be deployed
 * @param currentNonce - Current nonce of the deployer
 * @returns Predicted contract address
 */
export function predictContractAddress(
    deployer: string,
    contractCode: string,
    currentNonce: number,
): string {
    // Contract will be deployed with nonce + 1 (after the deploy transaction)
    return generateContractAddress(deployer, contractCode, currentNonce + 1)
}

/**
 * Batch generate multiple contract addresses (for testing/simulation)
 * 
 * @param deployer - Address of the deployer
 * @param contractCodes - Array of contract codes
 * @param startingNonce - Starting nonce value
 * @returns Array of contract addresses
 */
export function batchGenerateAddresses(
    deployer: string,
    contractCodes: string[],
    startingNonce: number,
): string[] {
    const addresses: string[] = []
    
    for (let i = 0; i < contractCodes.length; i++) {
        const address = generateContractAddress(
            deployer,
            contractCodes[i],
            startingNonce + i,
        )
        addresses.push(address)
    }
    
    return addresses
}

/**
 * Extract contract address from transaction hash (for indexing)
 * 
 * @param txHash - Transaction hash
 * @param deployer - Deployer address
 * @param nonce - Deployer nonce
 * @returns Contract address that would be generated
 */
export function extractContractAddressFromTx(
    txHash: string,
    deployer: string,
    nonce: number,
): string {
    // For now, this is a placeholder - in a real implementation,
    // we would extract the contract code from the transaction
    // and then generate the address
    const input = `${deployer}${txHash}${nonce}`
    const hash = crypto.createHash("sha256").update(input).digest("hex")
    return `contract_${hash}`
}