
import { INativePayload } from "node_modules/@kynesyslabs/demosdk-beta/build/types/native"

export async function handleNativeTx(nativeTx: INativePayload) {
    console.log(nativeTx)
}