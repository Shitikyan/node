import { Column, Entity, Index, PrimaryColumn } from "typeorm"

/* INFO
    Logic execution transactions are stored in a dedicated table following the GCRv2 pattern.
    The executions are indexed by request ID, tx hash, public key, status and block details.
    This allows for quick lookup of execution history, results, and blockchain inclusion.
*/

export interface LogicExecutionRequestData {
    operations: Array<{
        type: string
        payload: any
    }>
    metadata?: any
}

export interface LogicExecutionResultData {
    requestId: string
    success: boolean
    result: any
    operations: Array<{
        type: string
        payload: any
    }>
    timestamp: number
    executionTime: number
}

@Entity("gcr_logic_executions")
@Index("idx_logic_exec_pubkey", ["public_key"])
@Index("idx_logic_exec_status", ["status"])
@Index("idx_logic_exec_block", ["block_number"])
export class GCRLogicExecutions {
    @PrimaryColumn("text", { name: "request_id" })
    request_id: string

    @Column("text", { name: "tx_hash" })
    tx_hash: string

    @Column("text", { name: "public_key" })
    public_key: string

    @Column("text", { name: "status" })
    status: string // "pending", "executed", "failed"

    @Column("text", { name: "block_hash", nullable: true })
    block_hash: string | null

    @Column("integer", { name: "block_number", nullable: true })
    block_number: number | null

    @Column("jsonb", { name: "request_data" })
    request_data: LogicExecutionRequestData

    @Column("jsonb", { name: "result_data", nullable: true })
    result_data: LogicExecutionResultData | null

    @Column("bigint", { name: "created_at" })
    created_at: bigint

    @Column("bigint", { name: "executed_at", nullable: true })
    executed_at: bigint | null
}