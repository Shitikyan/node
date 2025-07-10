import { Transaction } from "@kynesyslabs/demosdk/types"
import { LogicExecutionResponse, LogicExecutionResult } from "./types"
import {
    generateRequestId,
    validateLogicExecutionRequest,
    processData,
} from "./utils"
import log from "@/utilities/logger"

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

        // Generate request ID based on data hash
        const requestId = generateRequestId(logicExecutionData)

        log.info(
            `[LogicExecution] Processing request ${requestId} from ${sender}`,
        )

        // Process the data
        // REVIEW: This is where the actual smart contract-like logic would be executed
        const processedResult = processData(logicExecutionData)

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

        return {
            success: false,
            result: null,
            extra: `Error: ${JSON.stringify(error)}`,
        }
    }
}
