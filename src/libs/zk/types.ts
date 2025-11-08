/**
 * ZK-SNARK Privacy Identity System - Type Definitions
 *
 * This file contains all TypeScript types for the ZK privacy identity system.
 */

/**
 * Identity types supported by the privacy system
 */
export type IdentityType = "web2" | "xm"

/**
 * Web2 platforms supported
 */
export type Web2Platform = "twitter" | "github" | "discord"

/**
 * Cross-chain platforms supported
 */
export type XmPlatform = "evm" | "solana"

/**
 * All supported platforms
 */
export type Platform = Web2Platform | XmPlatform

/**
 * ZK proof protocol
 */
export type ProofProtocol = "groth16" | "plonk"

/**
 * Groth16 proof structure
 */
export interface Groth16Proof {
    pi_a: [string, string]
    pi_b: [[string, string], [string, string]]
    pi_c: [string, string]
    protocol: "groth16"
}

/**
 * Public signals for identity attestation
 */
export interface AttestationPublicSignals {
    merkle_root: string      // Current Merkle tree root
    nullifier: string        // Context-specific nullifier
    context_hash: string     // Hash of context string
}

/**
 * Complete ZK proof with public signals
 */
export interface ZKProof {
    proof: Groth16Proof
    public_signals: AttestationPublicSignals
}

/**
 * Identity commitment data
 */
export interface IdentityCommitment {
    hash: string              // Poseidon(provider_id, secret)
    leaf_index: number        // Position in Merkle tree
    identity_type: IdentityType
    platform: Platform
    timestamp: number         // When committed
}

/**
 * Private identity data stored in GCR
 */
export interface PrivateIdentityData {
    commitments: IdentityCommitment[]
    merkle_root: string       // Current root of commitment tree
    used_nullifiers: string[] // Nullifiers already consumed
}

/**
 * Merkle proof structure
 */
export interface MerkleProof {
    pathElements: string[]    // Sibling hashes along the path
    pathIndices: number[]     // 0 = left, 1 = right
}

/**
 * Commitment transaction payload
 */
export interface CommitmentTransactionPayload {
    commitment_hash: string
    identity_type: IdentityType
    platform: Platform
}

/**
 * Attestation transaction payload
 */
export interface AttestationTransactionPayload {
    proof: Groth16Proof
    public_signals: AttestationPublicSignals
    context: string           // Human-readable context
    identity_type: IdentityType
    platform: Platform
}

/**
 * Circuit input for identity commitment
 */
export interface CommitmentCircuitInput {
    providerId: string
    secret: string
}

/**
 * Circuit input for identity attestation
 */
export interface AttestationCircuitInput {
    // Private inputs
    providerId: string
    secret: string
    merklePathElements: string[]
    merklePathIndices: number[]

    // Public inputs
    merkleRoot: string
    nullifier: string
    contextHash: string
}

/**
 * Proof generation result
 */
export interface ProofGenerationResult {
    proof: Groth16Proof
    publicSignals: string[]
}

/**
 * Verification result
 */
export interface VerificationResult {
    valid: boolean
    message?: string
}

/**
 * Circuit compilation metadata
 */
export interface CircuitMetadata {
    name: string
    wasmPath: string
    zkeyPath: string
    vkeyPath: string
    r1csPath: string
}

/**
 * Performance benchmarks
 */
export interface PerformanceBenchmark {
    operation: string
    duration_ms: number
    timestamp: Date
    metadata?: Record<string, any>
}
