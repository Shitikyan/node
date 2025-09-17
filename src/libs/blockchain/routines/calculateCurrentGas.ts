import { getSharedState } from "src/utilities/sharedState"
// Removed unused imports for simple fixed fee model

// INFO Calculating transaction fees based on the size of the transaction and the status of the chain
async function calculateComposedGas(): Promise<number> {
    const networkFee = 1 // Fixed 1 DEM network fee
    const rpcFee = getSharedState.rpcFee // 1-4 DEM from environment
    const totalFee = networkFee + rpcFee
    return totalFee
}

export async function calculateComposedGasWithBreakdown(): Promise<{
    totalFee: number
    breakdown: {
        networkFee: number
        rpcFee: number
    }}> {
    const networkFee = 1 // Fixed 1 DEM network fee
    const rpcFee = getSharedState.rpcFee // 1-4 DEM from environment
    const totalFee = networkFee + rpcFee
    return {
        totalFee,
        breakdown: {
            networkFee,
            rpcFee,
        },
    }
}

// REVIEW Why is this just a nested call
export default async function calculateCurrentGas(
    payload: any,
): Promise<number> {
    // Simple fixed fee calculation - no payload size multiplication
    const totalFee = await calculateComposedGas()
    return totalFee
}
