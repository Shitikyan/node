export interface LogicExecutionRequest {
    requestId: string
    data: any
    operations: LogicExecutionOperation[]
    timestamp: number
}

export interface LogicExecutionResponse {
    success: boolean
    result: any  // TODO: Proper type definition
    extra: any
}

export interface LogicExecutionOperation {
    type: string // TODO Typize it
    payload: any // TODO Build a proper type for payload
}

export interface LogicExecutionResult {
    requestId: string
    success: boolean
    result: any
    operations: LogicExecutionOperation[]
    timestamp: number
    executionTime: number
}

export interface LogicExecutionValidation {
    isValid: boolean
    errorMessage?: string
    sizeValid: boolean
    operationCountValid: boolean
}