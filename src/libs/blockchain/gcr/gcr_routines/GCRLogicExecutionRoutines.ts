import { Repository } from "typeorm"
import { GCRMain } from "src/model/entities/GCRv2/GCR_Main"
import { GCRLogicExecutions } from "src/model/entities/GCRv2/GCRLogicExecutions"
import { GCREditLogicExecution } from "@kynesyslabs/demosdk/types"
import { GCRResult } from "../handleGCR"
import Datasource from "src/model/datasource"
import log from "src/utilities/logger"

/**
 * Logic execution GCR routines for storing and managing smart contract-like executions
 * This handles the custom GCR edits for logic_execution transactions
 */
export default class GCRLogicExecutionRoutines {
    /**
     * Apply a logic execution GCR edit
     * @param edit The GCR edit to apply
     * @param mainRepository Repository for GCR_Main table
     * @param simulate Whether this is a simulation
     * @returns GCRResult indicating success/failure
     */
    static async apply(
        edit: GCREditLogicExecution,
        mainRepository: Repository<GCRMain>,
        simulate = false,
    ): Promise<GCRResult> {
        try {
            // Validate edit structure
            if (!edit.data || !edit.data.requestId || !edit.data.payload) {
                return {
                    success: false,
                    message:
                        "Invalid logic execution edit: missing required data",
                }
            }

            const { requestId, payload, status, timestamp } = edit.data

            // Get logic executions repository
            const db = await Datasource.getInstance()
            const logicExecutionsRepository = db
                .getDataSource()
                .getRepository(GCRLogicExecutions)

            if (simulate) {
                log.debug(
                    `[GCRLogicExecutionRoutines] Simulating logic execution storage for request: ${requestId}`,
                )
                return { success: true, message: "Simulation successful" }
            }

            // Check if execution already exists
            const existingExecution = await logicExecutionsRepository.findOne({
                where: { request_id: requestId },
            })

            if (existingExecution && !edit.isRollback) {
                return {
                    success: false,
                    message: `Logic execution with request ID ${requestId} already exists`,
                }
            }

            if (edit.isRollback) {
                // Handle rollback: remove the execution record
                if (existingExecution) {
                    await logicExecutionsRepository.remove(existingExecution)
                    log.info(
                        `[GCRLogicExecutionRoutines] Rolled back logic execution: ${requestId}`,
                    )
                }
                return { success: true, message: "Rollback successful" }
            }

            // Create new logic execution record
            const logicExecution = new GCRLogicExecutions()
            logicExecution.request_id = requestId
            logicExecution.tx_hash = edit.txhash
            logicExecution.public_key = edit.account
            logicExecution.status = status || "pending"
            logicExecution.request_data = {
                operations: payload.operations || [],
                metadata: payload.metadata,
            }
            logicExecution.result_data = null // Will be updated during execution
            logicExecution.created_at = BigInt(timestamp || Date.now())
            logicExecution.executed_at = null
            logicExecution.block_hash = null
            logicExecution.block_number = null

            // Save the execution record
            await logicExecutionsRepository.save(logicExecution)

            // Update assignedTxs in GCR_Main
            await this.updateAssignedTxs(
                edit.account,
                edit.txhash,
                mainRepository,
            )

            log.info(
                `[GCRLogicExecutionRoutines] Stored logic execution: ${requestId}`,
            )
            return {
                success: true,
                message: "Logic execution stored successfully",
            }
        } catch (error) {
            log.error(
                `[GCRLogicExecutionRoutines] Error applying logic execution edit: ${error}`,
            )
            return {
                success: false,
                message: `Failed to apply logic execution edit: ${error.message}`,
            }
        }
    }

    /**
     * Update the execution result for a completed logic execution
     * @param requestId The request ID to update
     * @param resultData The execution result data
     * @param blockHash The block hash where this was finalized
     * @param blockNumber The block number where this was finalized
     * @returns GCRResult indicating success/failure
     */
    static async updateExecutionResult(
        requestId: string,
        resultData: any,
        blockHash?: string,
        blockNumber?: number,
    ): Promise<GCRResult> {
        try {
            const db = await Datasource.getInstance()
            const logicExecutionsRepository = db
                .getDataSource()
                .getRepository(GCRLogicExecutions)

            const execution = await logicExecutionsRepository.findOne({
                where: { request_id: requestId },
            })

            if (!execution) {
                return {
                    success: false,
                    message: `Logic execution with request ID ${requestId} not found`,
                }
            }

            execution.result_data = resultData
            execution.status = resultData.success ? "executed" : "failed"
            execution.executed_at = BigInt(Date.now())

            if (blockHash) execution.block_hash = blockHash
            if (blockNumber) execution.block_number = blockNumber

            await logicExecutionsRepository.save(execution)

            log.info(
                `[GCRLogicExecutionRoutines] Updated execution result for: ${requestId}`,
            )
            return {
                success: true,
                message: "Execution result updated successfully",
            }
        } catch (error) {
            log.error(
                `[GCRLogicExecutionRoutines] Error updating execution result: ${error}`,
            )
            return {
                success: false,
                message: `Failed to update execution result: ${error.message}`,
            }
        }
    }

    /**
     * Get logic execution by request ID
     * @param requestId The request ID to lookup
     * @returns The logic execution record or null if not found
     */
    static async getExecution(
        requestId: string,
    ): Promise<GCRLogicExecutions | null> {
        try {
            const db = await Datasource.getInstance()
            const logicExecutionsRepository = db
                .getDataSource()
                .getRepository(GCRLogicExecutions)

            return await logicExecutionsRepository.findOne({
                where: { request_id: requestId },
            })
        } catch (error) {
            log.error(
                `[GCRLogicExecutionRoutines] Error getting execution: ${error}`,
            )
            return null
        }
    }

    /**
     * Get all logic executions for a public key
     * @param publicKey The public key to search for
     * @param limit Optional limit on results
     * @returns Array of logic execution records
     */
    static async getExecutionsForAccount(
        publicKey: string,
        limit?: number,
    ): Promise<GCRLogicExecutions[]> {
        try {
            const db = await Datasource.getInstance()
            const logicExecutionsRepository = db
                .getDataSource()
                .getRepository(GCRLogicExecutions)

            const query = logicExecutionsRepository
                .createQueryBuilder("le")
                .where("le.public_key = :publicKey", { publicKey })
                .orderBy("le.created_at", "DESC")

            if (limit) {
                query.limit(limit)
            }

            return await query.getMany()
        } catch (error) {
            log.error(
                `[GCRLogicExecutionRoutines] Error getting executions for account: ${error}`,
            )
            return []
        }
    }

    /**
     * Update assignedTxs in GCR_Main to track this transaction
     * @param account The account public key
     * @param txHash The transaction hash to add
     * @param mainRepository Repository for GCR_Main table
     */
    private static async updateAssignedTxs(
        account: string,
        txHash: string,
        mainRepository: Repository<GCRMain>,
    ): Promise<void> {
        try {
            // Ensure account has 0x prefix
            if (!account.startsWith("0x")) {
                account = "0x" + account
            }

            const existingAccount = await mainRepository.findOne({
                where: { pubkey: account },
            })

            if (existingAccount) {
                // Add transaction to assignedTxs if not already present
                if (!existingAccount.assignedTxs.includes(txHash)) {
                    existingAccount.assignedTxs.push(txHash)
                    await mainRepository.save(existingAccount)
                }
            } else {
                log.warning(
                    `[GCRLogicExecutionRoutines] Account ${account} not found in GCR_Main for tx assignment`,
                )
            }
        } catch (error) {
            log.error(
                `[GCRLogicExecutionRoutines] Error updating assignedTxs: ${error}`,
            )
            // Don't throw - this is not critical for execution storage
        }
    }
}
