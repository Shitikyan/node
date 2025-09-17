/**
 * ConsensusParameters.ts
 *
 * Centralized consensus parameters and validation rules for the Demos Network.
 * This includes fee validation to prevent malicious nodes from charging arbitrary fees.
 *
 * SECURITY: These parameters ensure network-wide agreement on valid fee ranges,
 * preventing economic attacks where malicious nodes charge excessive fees.
 */

import Transaction from "src/libs/blockchain/transaction"
import { getSharedState } from "./sharedState"

export interface FeeValidationResult {
    valid: boolean
    reason?: string
}

/**
 * Consensus-level parameters that all nodes must agree upon
 * These parameters define the rules for valid transactions across the network
 */
export class ConsensusParameters {
    private static instance: ConsensusParameters

    // Fee consensus parameters
    readonly fees = {
        // Network fee is fixed at 1 DEM across all nodes
        network_fee: 1,

        // RPC fee must be within this range (1-4 DEM)
        rpc_fee_range: {
            min: 1,
            max: 4,
        },

        // Additional fees not implemented yet
        additional_fee: 0,

        // Enforcement level: "none" | "monitoring" | "soft" | "hard"
        // - none: No validation (backwards compatibility)
        // - monitoring: Log violations but accept transactions
        // - soft: Reject at local mempool but not consensus
        // - hard: Full consensus rejection, blocks with invalid fees rejected
        enforcement_level: "monitoring" as
            | "none"
            | "monitoring"
            | "soft"
            | "hard",
    }

    // Future consensus parameters can be added here
    readonly blocks = {
        max_size: 1000000, // 1MB max block size
        max_transactions: 1000,
    }

    readonly transactions = {
        max_size: 100000, // 100KB max transaction size
        min_confirmations: 1,
    }

    constructor() {
        // Load any environment overrides for testing
        if (process.env.CONSENSUS_FEE_ENFORCEMENT) {
            this.fees.enforcement_level = process.env
                .CONSENSUS_FEE_ENFORCEMENT as any
        }
    }

    public static getInstance(): ConsensusParameters {
        if (!ConsensusParameters.instance) {
            ConsensusParameters.instance = new ConsensusParameters()
        }
        return ConsensusParameters.instance
    }

    /**
     * Validates transaction fees against consensus rules
     * This prevents malicious nodes from setting arbitrary fees
     *
     * @param tx Transaction to validate
     * @returns Validation result with reason if invalid
     */
    public validateTransactionFees(tx: Transaction): FeeValidationResult {
        const fees = tx.content.transaction_fee

        // Skip validation if enforcement is disabled
        if (this.fees.enforcement_level === "none") {
            return { valid: true }
        }

        // Validate network fee (must be exactly 1 DEM)
        if (fees.network_fee !== this.fees.network_fee) {
            const reason = `Invalid network fee: ${fees.network_fee} DEM (must be ${this.fees.network_fee} DEM)`
            this.logViolation(tx, reason)
            return { valid: false, reason }
        }

        // Validate RPC fee range (must be 1-4 DEM)
        if (
            fees.rpc_fee < this.fees.rpc_fee_range.min ||
            fees.rpc_fee > this.fees.rpc_fee_range.max
        ) {
            const reason = `Invalid RPC fee: ${fees.rpc_fee} DEM (must be ${this.fees.rpc_fee_range.min}-${this.fees.rpc_fee_range.max} DEM)`
            this.logViolation(tx, reason)
            return { valid: false, reason }
        }

        // Validate additional fee (currently must be 0)
        if (fees.additional_fee !== this.fees.additional_fee) {
            const reason = `Invalid additional fee: ${fees.additional_fee} DEM (must be ${this.fees.additional_fee} DEM)`
            this.logViolation(tx, reason)
            return { valid: false, reason }
        }

        // Validate total fee sanity check
        const totalFee = fees.network_fee + fees.rpc_fee + fees.additional_fee
        const maxTotalFee =
            this.fees.network_fee +
            this.fees.rpc_fee_range.max +
            this.fees.additional_fee

        if (totalFee > maxTotalFee) {
            const reason = `Total fee exceeds maximum: ${totalFee} DEM (max ${maxTotalFee} DEM)`
            this.logViolation(tx, reason)
            return { valid: false, reason }
        }

        return { valid: true }
    }

    /**
     * Validates a block's transactions against consensus fee rules
     *
     * @param transactions Array of transactions in the block
     * @returns Validation result
     */
    public validateBlockFees(transactions: Transaction[]): FeeValidationResult {
        for (const tx of transactions) {
            const result = this.validateTransactionFees(tx)
            if (!result.valid) {
                return {
                    valid: false,
                    reason: `Block contains invalid transaction ${tx.hash}: ${result.reason}`,
                }
            }
        }
        return { valid: true }
    }

    /**
     * Checks if fee validation should reject the transaction
     * based on current enforcement level
     *
     * @param validationResult Result from validateTransactionFees
     * @returns Whether to reject the transaction
     */
    public shouldRejectTransaction(
        validationResult: FeeValidationResult,
    ): boolean {
        if (validationResult.valid) {
            return false
        }

        switch (this.fees.enforcement_level) {
            case "none":
            case "monitoring":
                return false // Accept even if invalid
            case "soft":
            case "hard":
                return true // Reject invalid transactions
            default:
                return false
        }
    }

    /**
     * Checks if fee validation should reject the block
     * based on current enforcement level
     *
     * @param validationResult Result from validateBlockFees
     * @returns Whether to reject the block
     */
    public shouldRejectBlock(validationResult: FeeValidationResult): boolean {
        if (validationResult.valid) {
            return false
        }

        // Only reject blocks in hard enforcement mode
        return this.fees.enforcement_level === "hard"
    }

    /**
     * Logs fee violations for monitoring and debugging
     *
     * @param tx Transaction with fee violation
     * @param reason Reason for violation
     */
    private logViolation(tx: Transaction, reason: string): void {
        const level = this.fees.enforcement_level
        const prefix =
            level === "monitoring" ? "⚠️ [FEE MONITOR]" : "🚨 [FEE VIOLATION]"

        console.warn(`${prefix} ${reason}`)
        console.warn(`  Transaction: ${tx.hash}`)
        console.warn(`  From: ${tx.content.from}`)
        console.warn(
            `  Fees: network=${tx.content.transaction_fee.network_fee}, rpc=${tx.content.transaction_fee.rpc_fee}`,
        )
        console.warn(`  Enforcement: ${level}`)

        // In production, this could send to monitoring service
        if (getSharedState.PROD) {
            // TODO: Send to monitoring service
        }
    }

    /**
     * Gets current fee parameters for display/info purposes
     *
     * @returns Current consensus fee parameters
     */
    public getFeeParameters() {
        return {
            networkFee: this.fees.network_fee,
            rpcFeeMin: this.fees.rpc_fee_range.min,
            rpcFeeMax: this.fees.rpc_fee_range.max,
            enforcementLevel: this.fees.enforcement_level,
        }
    }
}

// Export singleton instance getter for convenience
export function getConsensusParameters(): ConsensusParameters {
    return ConsensusParameters.getInstance()
}
