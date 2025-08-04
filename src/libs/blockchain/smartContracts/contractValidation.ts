/* eslint-disable @typescript-eslint/naming-convention */
/**
 * Smart Contract Validation Utilities
 * 
 * Provides validation functions for contract addresses, code, and operations
 * in the Demos Network smart contract system.
 */

/**
 * Contract address format constants
 */
export const CONTRACT_ADDRESS_PREFIX = "contract_"
export const CONTRACT_ADDRESS_HASH_LENGTH = 64 // SHA256 hex length
export const CONTRACT_ADDRESS_TOTAL_LENGTH = CONTRACT_ADDRESS_PREFIX.length + CONTRACT_ADDRESS_HASH_LENGTH

/**
 * Contract size and execution limits
 */
export const CONTRACT_LIMITS = {
    MAX_CONTRACT_SIZE: 64 * 1024, // 64KB
    MAX_CODE_LENGTH: 50000, // Maximum characters in contract code
    MIN_CODE_LENGTH: 10, // Minimum meaningful contract code
    MAX_METHOD_NAME_LENGTH: 100,
    MAX_ARGS_COUNT: 50,
    MAX_ARG_SIZE: 1024 * 1024, // 1MB per argument
} as const

/**
 * Valid contract operation types
 */
export const VALID_OPERATIONS = ["deploy", "call", "store", "retrieve"] as const
export type ContractOperation = typeof VALID_OPERATIONS[number];

/**
 * Validates if a string is a valid contract address
 * 
 * @param address - Address to validate
 * @returns True if valid contract address format
 */
export function isValidContractAddress(address: string): boolean {
    if (typeof address !== "string") {
        return false
    }
    
    // Check prefix
    if (!address.startsWith(CONTRACT_ADDRESS_PREFIX)) {
        return false
    }
    
    // Check total length
    if (address.length !== CONTRACT_ADDRESS_TOTAL_LENGTH) {
        return false
    }
    
    // Check if hash part is valid hex
    const hashPart = address.slice(CONTRACT_ADDRESS_PREFIX.length)
    return /^[a-f0-9]{64}$/i.test(hashPart)
}

/**
 * Validates contract code for deployment
 * 
 * @param code - Contract source code
 * @returns Validation result with success status and error message
 */
export function validateContractCode(code: string): { valid: boolean; error?: string } {
    if (typeof code !== "string") {
        return { valid: false, error: "Contract code must be a string" }
    }
    
    // Check minimum length
    if (code.length < CONTRACT_LIMITS.MIN_CODE_LENGTH) {
        return { valid: false, error: `Contract code too short (minimum ${CONTRACT_LIMITS.MIN_CODE_LENGTH} characters)` }
    }
    
    // Check maximum length
    if (code.length > CONTRACT_LIMITS.MAX_CODE_LENGTH) {
        return { valid: false, error: `Contract code too long (maximum ${CONTRACT_LIMITS.MAX_CODE_LENGTH} characters)` }
    }
    
    // Check for dangerous patterns (basic security)
    const dangerousPatterns = [
        /require\s*\(/i, // Node.js require
        /import\s+.*from/i, // ES6 imports
        /eval\s*\(/i, // Eval function
        /Function\s*\(/i, // Function constructor
        /setTimeout|setInterval/i, // Async functions
        /process\./i, // Process object
        /global\./i, // Global object
        /__dirname|__filename/i, // File system access
    ]
    
    for (const pattern of dangerousPatterns) {
        if (pattern.test(code)) {
            return { valid: false, error: `Contract code contains disallowed pattern: ${pattern.source}` }
        }
    }
    
    // Check for required function structure (must have at least deploy function)
    if (!code.includes("function deploy")) {
        return { valid: false, error: "Contract must contain a deploy function" }
    }
    
    return { valid: true }
}

/**
 * Validates contract method name
 * 
 * @param methodName - Method name to validate
 * @returns True if valid method name
 */
export function isValidMethodName(methodName: string): boolean {
    if (typeof methodName !== "string") {
        return false
    }
    
    // Check length
    if (methodName.length === 0 || methodName.length > CONTRACT_LIMITS.MAX_METHOD_NAME_LENGTH) {
        return false
    }
    
    // Check format (alphanumeric + underscore, starting with letter)
    return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(methodName)
}

/**
 * Validates contract operation type
 * 
 * @param operation - Operation to validate
 * @returns True if valid operation
 */
export function isValidOperation(operation: string): operation is ContractOperation {
    return VALID_OPERATIONS.includes(operation as ContractOperation)
}

/**
 * Validates contract method arguments
 * 
 * @param args - Arguments to validate
 * @returns Validation result with success status and error message
 */
export function validateContractArgs(args: any[]): { valid: boolean; error?: string } {
    if (!Array.isArray(args)) {
        return { valid: false, error: "Arguments must be an array" }
    }
    
    // Check argument count
    if (args.length > CONTRACT_LIMITS.MAX_ARGS_COUNT) {
        return { valid: false, error: `Too many arguments (maximum ${CONTRACT_LIMITS.MAX_ARGS_COUNT})` }
    }
    
    // Check each argument size
    for (let i = 0; i < args.length; i++) {
        const argSize = JSON.stringify(args[i]).length
        if (argSize > CONTRACT_LIMITS.MAX_ARG_SIZE) {
            return { valid: false, error: `Argument ${i} too large (maximum ${CONTRACT_LIMITS.MAX_ARG_SIZE} bytes)` }
        }
    }
    
    return { valid: true }
}

/**
 * Validates deployer address format
 * 
 * @param address - Address to validate
 * @returns True if valid deployer address
 */
export function isValidDeployerAddress(address: string): boolean {
    if (typeof address !== "string") {
        return false
    }
    
    // Basic address validation (adjust based on your address format)
    // For now, assume addresses are at least 10 characters and contain valid characters
    return address.length >= 10 && /^[a-zA-Z0-9_-]+$/.test(address)
}

/**
 * Validates contract state key
 * 
 * @param key - State key to validate
 * @returns True if valid state key
 */
export function isValidStateKey(key: string): boolean {
    if (typeof key !== "string") {
        return false
    }
    
    // Check length (reasonable limits)
    if (key.length === 0 || key.length > 100) {
        return false
    }
    
    // Check format (alphanumeric + common symbols)
    return /^[a-zA-Z0-9_.-]+$/.test(key)
}

/**
 * Validates contract deployment parameters
 * 
 * @param params - Deployment parameters
 * @returns Validation result
 */
export function validateDeploymentParams(params: {
    deployer: string;
    code: string;
    args?: any[];
    nonce: number;
}): { valid: boolean; error?: string } {
    // Validate deployer
    if (!isValidDeployerAddress(params.deployer)) {
        return { valid: false, error: "Invalid deployer address" }
    }
    
    // Validate code
    const codeValidation = validateContractCode(params.code)
    if (!codeValidation.valid) {
        return codeValidation
    }
    
    // Validate nonce
    if (typeof params.nonce !== "number" || params.nonce < 0) {
        return { valid: false, error: "Nonce must be a non-negative number" }
    }
    
    // Validate args if provided
    if (params.args !== undefined) {
        const argsValidation = validateContractArgs(params.args)
        if (!argsValidation.valid) {
            return argsValidation
        }
    }
    
    return { valid: true }
}

/**
 * Validates contract call parameters
 * 
 * @param params - Call parameters
 * @returns Validation result
 */
export function validateCallParams(params: {
    contractAddress: string;
    method: string;
    args?: any[];
    caller: string;
}): { valid: boolean; error?: string } {
    // Validate contract address
    if (!isValidContractAddress(params.contractAddress)) {
        return { valid: false, error: "Invalid contract address format" }
    }
    
    // Validate method name
    if (!isValidMethodName(params.method)) {
        return { valid: false, error: "Invalid method name format" }
    }
    
    // Validate caller
    if (!isValidDeployerAddress(params.caller)) {
        return { valid: false, error: "Invalid caller address" }
    }
    
    // Validate args if provided
    if (params.args !== undefined) {
        const argsValidation = validateContractArgs(params.args)
        if (!argsValidation.valid) {
            return argsValidation
        }
    }
    
    return { valid: true }
}

/**
 * Sanitizes contract code by removing dangerous patterns
 * 
 * @param code - Raw contract code
 * @returns Sanitized code
 */
export function sanitizeContractCode(code: string): string {
    // Remove comments
    let sanitized = code
        .replace(/\/\*[\s\S]*?\*\//g, "") // Block comments
        .replace(/\/\/.*$/gm, "") // Line comments
    
    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, " ").trim()
    
    return sanitized
}

/**
 * Check if contract address is in the correct format and extract hash
 * 
 * @param address - Contract address
 * @returns Hash part of the address or null if invalid
 */
export function extractAddressHash(address: string): string | null {
    if (!isValidContractAddress(address)) {
        return null
    }
    
    return address.slice(CONTRACT_ADDRESS_PREFIX.length)
}