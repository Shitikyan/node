import { IWeb2Request } from "@kynesyslabs/demosdk-beta/types"
import handleWeb2 from "src/features/web2/Web2Dispatcher"

// ? Can we avoid calling another function pls?
/**
 * Handles a Web2 request by processing it through the Web2 dispatcher and managing the results.
 * 
 * This function performs the following workflow:
 * 1. The Web2 Operation is validated, executed, and verified when applicable.
 * 2. It is then sent back once attested.
 * 3. A transaction is derived from the executed web2 operation.
 * 4. An operation is then created and pushed in the GLS.
 * 5. An operation for the gas is also pushed in the GLS.
 * 6. The transaction is pushed in the mempool if applicable.
 *
 * @param {IWeb2Request} content - The Web2 request content to be processed.
 * @param {any} senderSocket - The socket of the sender.
 * @returns {Promise<{ response: any; require_reply: boolean; extra: any }>} A promise that resolves to an object containing:
 *   - response: The processed Web2 request or null if there was an error.
 *   - require_reply: A boolean indicating whether a reply is required (always false in this implementation).
 *   - extra: Any extra information or error message.
 */
export default async function handleWeb2Request(
    content: IWeb2Request,
    senderSocket: any,
): Promise<{ response: any; require_reply: boolean; extra: any }> {
    /* NOTE This workflow goeas as:
     * The Web2 Operation is validated, executed and verified
     * when applicable. Is then sent back once attested.
     * A transaction is derived from the executed web2 operation.
     * An operation is then created and pushed in the GLS.
     * An operation for the gas is also pushed in the GLS.
     * The tx is pushed in the mempool if applicable.
     */
    console.log("[SERVER] Received web2Request")
    //console.log(JSON.stringify(request))

    let extra: string,
        require_reply = false
    let response: IWeb2Request
    // We get our connection string
    // const currentPeerString = Identity.getInstance().getConnectionString()
    // NOTE Switched to the new class

    //console.log("[WEB2 CONTENT DUMP]")
    //console.log(content)
    let fullResponse = await handleWeb2(content, senderSocket)
    //console.log("[WEB2 CONTENT RESPONSE DUMP]")
    //console.log(fullResponse)

    // Managing the results
    if (fullResponse[0]) {
        response = fullResponse[1] as IWeb2Request
    } else {
        response = null
        extra = fullResponse[1] as string
    }
    return { extra, require_reply, response }
}