import { Transaction } from "@kynesyslabs/demosdk/types"
import { LogicExecutionResponse, LogicExecutionResult } from "./types"
import {
    generateRequestId,
    validateLogicExecutionRequest,
    processData,
} from "./utils"
import GCRLogicExecutionRoutines from "@/libs/blockchain/gcr/gcr_routines/GCRLogicExecutionRoutines"
import log from "@/utilities/logger"

/**
 * Handle logic execution transactions
 * This is called after the GCR edits have been applied during consensus,
 * so the execution record already exists in GCRLogicExecutions table.
 * Our job is to execute the logic and update the results.
 */
export default async function handleLogicExecution(
    tx: Transaction,
    sender: string,
): Promise<LogicExecutionResponse> {
    try {
        const executionStartTime = Date.now()

        // Extract logic execution data from transaction
        const logicExecutionData = tx.content.data[1] as any

        // Validate the request
        const validation = validateLogicExecutionRequest(logicExecutionData)
        if (!validation.isValid) {
            return {
                success: false,
                result: null,
                extra: validation.errorMessage,
            }
        }

        // Generate request ID based on data hash (should match the one in GCR edit)
        const requestId = generateRequestId(logicExecutionData)

        log.info(
            `[LogicExecution] Processing request ${requestId} from ${sender}`,
        )

        // Get the execution record from GCRLogicExecutions table
        const executionRecord = await GCRLogicExecutionRoutines.getExecution(requestId)
        if (!executionRecord) {
            log.error(`[LogicExecution] Execution record not found for request ${requestId}`)
            return {
                success: false,
                result: null,
                extra: `Execution record not found for request ${requestId}`
            }
        }

        // Process the data using our generic processData function
        const processedResult = await processData(logicExecutionData)

        const executionTime = Date.now() - executionStartTime

        // Create execution result
        const result: LogicExecutionResult = {
            requestId,
            success: true,
            result: processedResult,
            operations: logicExecutionData.operations || [],
            timestamp: Date.now(),
            executionTime,
        }

        // Update the execution record with the results
        await GCRLogicExecutionRoutines.updateExecutionResult(
            requestId,
            result
        )

        log.info(
            `[LogicExecution] Request ${requestId} completed in ${executionTime}ms`,
        )

        return {
            success: true,
            result,
            extra: {
                requestId,
                executionTime,
                operationCount: logicExecutionData.operations?.length || 0,
            },
        }
    } catch (error) {
        log.error(
            `[LogicExecution] Error processing request from ${sender}:` + error,
        )

        // Try to update the execution record with the error
        try {
            const logicExecutionData = tx.content.data[1] as any
            const requestId = generateRequestId(logicExecutionData)
            await GCRLogicExecutionRoutines.updateExecutionResult(
                requestId,
                {
                    requestId,
                    success: false,
                    result: null,
                    operations: logicExecutionData.operations || [],
                    timestamp: Date.now(),
                    executionTime: 0,
                    error: error.message
                }
            )
        } catch (updateError) {
            log.error(`[LogicExecution] Failed to update execution record with error: ${updateError}`)
        }

        return {
            success: false,
            result: null,
            extra: `Error: ${JSON.stringify(error)}`,
        }
    }
}
