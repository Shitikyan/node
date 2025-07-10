import Hashing from "@/libs/crypto/hashing"
import { getSharedState } from "@/utilities/sharedState"
import { LogicExecutionValidation } from "./types"

export function generateRequestId(data: any): string {
    const dataString = JSON.stringify(data, (_, v) =>
        typeof v === "bigint" ? v.toString() : v,
    )
    return Hashing.sha256(dataString)
}

export function validateRequestSize(data: any): boolean {
    const dataString = JSON.stringify(data, (_, v) =>
        typeof v === "bigint" ? v.toString() : v,
    )
    const size = Buffer.byteLength(dataString, "utf8")
    return size <= getSharedState.logicExecutionMaxSize
}

export function validateOperationCount(operations: any[]): boolean {
    return operations.length <= getSharedState.logicExecutionMaxOperations
}

export function validateLogicExecutionRequest(
    data: any,
): LogicExecutionValidation {
    const operations = data.operations || []
    const sizeValid = validateRequestSize(data)
    const operationCountValid = validateOperationCount(operations)

    const isValid = sizeValid && operationCountValid

    let errorMessage: string | undefined
    if (!sizeValid) {
        errorMessage = `Request size exceeds maximum limit of ${getSharedState.logicExecutionMaxSize} bytes`
    } else if (!operationCountValid) {
        errorMessage = `Operation count exceeds maximum limit of ${getSharedState.logicExecutionMaxOperations}`
    }

    return {
        isValid,
        errorMessage,
        sizeValid,
        operationCountValid,
    }
}

export function processData(data: any): any {
    // REVIEW: This is a placeholder implementation
    // TODO: Implement actual data processing logic
    return {
        processed: true,
        originalData: data,
        timestamp: Date.now(),
    }
}
