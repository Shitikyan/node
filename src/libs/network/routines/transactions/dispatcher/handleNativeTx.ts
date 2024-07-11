import { NativePayload } from "@kynesyslabs/demosdk-beta/types"

export async function handleNativeTx(nativeTx: NativePayload) {
    console.log(nativeTx)
}