import { XMScript } from "@kynesyslabs/demosdk-beta/types"
import multichainDispatcher from "src/features/multichain/XMDispatcher"
import { multichainCapabilities } from "sdk/localsdk/multichain"

export async function handleXMScript(
    xmscript: XMScript,
): Promise<{ response: any; require_reply: boolean; extra: any }> {
    /* NOTE This workflow goeas as:
     * The XM Operation is validated, executed and verified
     * when applicable.
     * A transaction is derived from the executed operation.
     * An operation is then created and pushed in the GLS.
     * An operation for the gas is also pushed it pn the GLS.
     * The tx is pushed in the mempool if applicable.
     */
    let extra: any
    let require_reply = false
    console.log("[XMChain] Handling XM Chain Operation...")
    // REVIEW Remember that crosschain operations can be in chainscript syntax
    // INFO Use the src/features/multichain/chainscript/chainscript.chs for the specs
    //console.log(content.data)
    let response = await multichainDispatcher.digest(xmscript)
    // TODO
    return { extra, require_reply, response }
}



export async function handleXMChainStatus(): Promise<any> {
        let extra: any
        let require_reply = false
        // NOTE Remember that crosschain operations are in chainscript syntax (see chainscript_example.ts)
        const response = await multichainCapabilities()
        // TODO
        return { extra, require_reply, response }
    }