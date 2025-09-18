import { getSharedState } from "src/utilities/sharedState"
// Removed unused imports for simple fixed fee model

// INFO Calculating transaction fees based on the size of the transaction and the status of the chain
async function calculateComposedGas(): Promise<number> {
    const networkFee = getSharedState.networkFee ?? 1 // Configurable network fee with fallback
    const rpcFee = getSharedState.rpcFee

    if (typeof rpcFee !== "number" || rpcFee < 0) {
        throw new Error("Invalid rpcFee: must be a non-negative number")
    }

    const totalFee = networkFee + rpcFee
    return totalFee
}

export async function calculateComposedGasWithBreakdown(): Promise<{
    totalFee: number
    breakdown: {
        networkFee: number
        rpcFee: number
    }
}> {
    const totalFee = await calculateComposedGas()
    const networkFee = getSharedState.networkFee ?? 1
    const rpcFee = getSharedState.rpcFee

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
    payload?: any, // Deprecated: payload size no longer affects gas calculation
): Promise<number> {
    if (payload !== undefined) {
        console.warn(
            "calculateCurrentGas: payload parameter is deprecated and ignored in fixed-fee model",
        )
    }
    // Simple fixed fee calculation - no payload size multiplication
    const totalFee = await calculateComposedGas()
    return totalFee
}
