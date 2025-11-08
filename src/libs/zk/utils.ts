/**
 * ZK-SNARK Privacy Identity System - Utility Functions
 *
 * Helper functions for the ZK privacy identity system.
 */

import crypto from "crypto"

/**
 * Generate a random secret for commitment
 * This secret should be stored securely by the user and never sent to the server
 */
export function generateRandomSecret(): string {
    const bytes = crypto.randomBytes(32)
    return "0x" + bytes.toString("hex")
}

/**
 * Convert hex string to BigInt
 */
export function hexToBigInt(hex: string): bigint {
    if (hex.startsWith("0x")) {
        return BigInt(hex)
    }
    return BigInt("0x" + hex)
}

/**
 * Convert BigInt to hex string
 */
export function bigIntToHex(value: bigint): string {
    let hex = value.toString(16)
    if (hex.length % 2 !== 0) {
        hex = "0" + hex
    }
    return "0x" + hex
}

/**
 * Convert string to BigInt (for circuit inputs)
 */
export function stringToBigInt(str: string): bigint {
    const hash = crypto.createHash("sha256").update(str).digest("hex")
    return BigInt("0x" + hash)
}

/**
 * Hash a string using SHA256
 */
export function sha256(data: string): string {
    return crypto.createHash("sha256").update(data).digest("hex")
}

/**
 * Convert buffer to hex string
 */
export function bufferToHex(buffer: Buffer): string {
    return "0x" + buffer.toString("hex")
}

/**
 * Convert hex string to buffer
 */
export function hexToBuffer(hex: string): Buffer {
    const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex
    return Buffer.from(cleanHex, "hex")
}

/**
 * Validate commitment hash format
 */
export function isValidCommitmentHash(hash: string): boolean {
    if (!hash.startsWith("0x")) {
        return false
    }
    const hex = hash.slice(2)
    return /^[0-9a-fA-F]{64}$/.test(hex)
}

/**
 * Validate nullifier format
 */
export function isValidNullifier(nullifier: string): boolean {
    return isValidCommitmentHash(nullifier)
}

/**
 * Validate Merkle root format
 */
export function isValidMerkleRoot(root: string): boolean {
    return isValidCommitmentHash(root)
}

/**
 * Format proof for transaction
 */
export function formatProofForTransaction(proof: any, publicSignals: any) {
    return {
        proof: {
            pi_a: [proof.pi_a[0], proof.pi_a[1]],
            pi_b: [
                [proof.pi_b[0][1], proof.pi_b[0][0]],
                [proof.pi_b[1][1], proof.pi_b[1][0]]
            ],
            pi_c: [proof.pi_c[0], proof.pi_c[1]],
            protocol: "groth16" as const
        },
        public_signals: {
            merkle_root: publicSignals[0],
            nullifier: publicSignals[1],
            context_hash: publicSignals[2]
        }
    }
}

/**
 * Format proof for snarkjs verification
 */
export function formatProofForSnarkjs(proof: {
    pi_a: string[]
    pi_b: string[][]
    pi_c: string[]
    protocol: string
}) {
    return {
        pi_a: proof.pi_a,
        pi_b: [
            [proof.pi_b[0][1], proof.pi_b[0][0]],
            [proof.pi_b[1][1], proof.pi_b[1][0]]
        ],
        pi_c: proof.pi_c,
        protocol: proof.protocol
    }
}

/**
 * Benchmark a function execution
 */
export async function benchmark<T>(
    operation: string,
    fn: () => Promise<T>
): Promise<{ result: T; duration_ms: number }> {
    const start = Date.now()
    const result = await fn()
    const duration_ms = Date.now() - start

    return { result, duration_ms }
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000
): Promise<T> {
    let lastError: Error | undefined

    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn()
        } catch (error) {
            lastError = error as Error
            if (i < maxRetries - 1) {
                const delay = initialDelay * Math.pow(2, i)
                await sleep(delay)
            }
        }
    }

    throw lastError || new Error("Max retries exceeded")
}

/**
 * Chunk an array into smaller arrays
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
}

/**
 * Convert EVM address to BigInt (for circuit input)
 */
export function evmAddressToBigInt(address: string): bigint {
    // Remove 0x prefix if present
    const cleanAddress = address.startsWith("0x") ? address.slice(2) : address

    // Validate address
    if (!/^[0-9a-fA-F]{40}$/.test(cleanAddress)) {
        throw new Error(`Invalid EVM address: ${address}`)
    }

    return BigInt("0x" + cleanAddress)
}

/**
 * Convert Solana public key to BigInt (for circuit input)
 */
export function solanaPublicKeyToBigInt(publicKey: string): bigint {
    // Solana public keys are base58 encoded, but for circuit we use hex representation
    // This is a placeholder - actual implementation would decode base58
    const hash = crypto.createHash("sha256").update(publicKey).digest("hex")
    return BigInt("0x" + hash)
}

/**
 * Validate provider ID format based on platform
 */
export function validateProviderId(
    providerId: string,
    platform: string
): boolean {
    switch (platform) {
        case "twitter":
        case "github":
        case "discord":
            // Numeric ID for social platforms
            return /^\d+$/.test(providerId)

        case "evm":
            // EVM address: 0x + 40 hex chars
            return /^0x[0-9a-fA-F]{40}$/.test(providerId)

        case "solana":
            // Solana public key: base58 string (simplified validation)
            return providerId.length >= 32 && providerId.length <= 44

        default:
            return false
    }
}
