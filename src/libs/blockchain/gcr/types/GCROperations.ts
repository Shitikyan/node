import { DemoScript } from "@kynesyslabs/demosdk/types"

export default interface GCROperation {
    address: string // Public key of the address
    data: DemoScript | any // The data that has been executed (expanded for different transaction types)
    gas: number // The gas used
}

export interface AccountGCRIdentities {
    xm: Map<string, string[]>
    web2: Map<string, string[]>
}
