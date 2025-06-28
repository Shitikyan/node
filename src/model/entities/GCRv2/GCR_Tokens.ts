// WIP: This should be a table for chain-wide tokens reference

import { Column, Entity, PrimaryColumn } from "typeorm"
import { Token } from "@/libs/blockchain/gcr/types/Token"

@Entity("gcr_tokens")
export class GCRTokens {
    @PrimaryColumn({ type: "text", name: "token_address" })
    tokenAddress: string
    @Column({ type: "jsonb", name: "properties" })
    properties: Token
}