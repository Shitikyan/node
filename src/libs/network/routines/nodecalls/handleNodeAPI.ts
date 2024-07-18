import { Peer } from "src/libs/peer"
import { Blocks } from "src/model/entities/Blocks"
import Transaction from "src/libs/blockchain/transaction"
import { AddressInfo } from "@kynesyslabs/demosdk-beta/types"
import Chain from "src/libs/blockchain/chain"
import GLS from "src/libs/blockchain/gls/gls"
import { StatusNative } from "src/model/entities/StatusNative"
import eggs from "../eggs"
// Methods imported
import getPeerlist from "./dispatcher/getPeerlist"
import getPreviousHashFromBlockNumber from "./dispatcher/getPreviousHashFromBlockNumber"
import getPreviousHashFromBlockHash from "./dispatcher/getPreviousHashFromBlockHash"
import getBlockHeaderByNumber from "./dispatcher/getBlockHeaderByNumber"
import getBlockHeaderByHash from "./dispatcher/getBlockHeaderByHash"
import getBlockByNumber from "./dispatcher/getBlockByNumber"
import getBlockByHash from "./dispatcher/getBlockByHash"
import { getAllTxs } from "./dispatcher/getAllTxs"

export async function handleNodeAPI(
        content: any,
        receiver: any,
        id_ed25519: any,
    ): Promise<any> {
        // Basic Node API handling logic
        // ...
        let extra: any
        let require_reply = false
        let response:
            | string
            | Peer[]
            | number
            | Blocks
            | Transaction
            | Transaction[]
            | AddressInfo
        let result: any // Storage for the result
        let nStat: any // Storage for the native status
        let { data } = content
        //console.log(typeof data)
        console.log(JSON.stringify(content))
        switch (content.message) {
            // NOTE The following commented block of code is vestigial
            /*case "crosschain_operation":
            case "multichain_operation":
                term.yellow.bold("[SERVER] Received crosschain_operation\n")
                response = await ServerHandlers.handleXMChainOperation(content)
                break // REVIEW Here or in comlinks? */
            case "getPeerlist":
                response = await getPeerlist()
                break
            // REVIEW Both below for getting the last hash (untested yet)
            case "getPreviousHashFromBlockNumber":
                result = await getPreviousHashFromBlockNumber(data)
                response = result.response
                extra = result.extra
                break
            case "getPreviousHashFromBlockHash":
                result = await getPreviousHashFromBlockHash(data)
                response = result.response
                extra = result.extra
                break
            // REVIEW (untested) Headers instead of full blocks
            case "getBlockHeaderByNumber":
                result = await getBlockHeaderByNumber(data)
                response = result.response
                extra = result.extra
                break
            case "getBlockHeaderByHash":
                result = await getBlockHeaderByHash(data)
                response = result.response
                extra = result.extra
                break
            case "getLastBlockNumber":
                console.log("[SERVER] Received getLastBlockNumber")
                response = await Chain.getLastBlockNumber()
                console.log("[CHAIN.ts] Received reply from the database") // REVIEW Debug
                //console.log(response)
                break
            case "getLastBlockHash":
                response = await Chain.getLastBlockHash()
                break
            case "getBlockByNumber":
                console.log(`get block by number ${data.blockNumber}`)
                result = await getBlockByNumber(data)
                response = result.response
                extra = result.extra
                break
            case "getBlockByHash":
                console.log(`get block by hash ${data.hash}`)
                result = getBlockByHash(data)
                response = result.response
                extra = result.extra
                break
            case "getTxByHash":
                if (!data.hash) {
                    receiver.emit("public", {
                        error: "No tx specified",
                    })
                }
                console.log(`getting tx with hash ${data.hash}`)
                response = await Chain.getTxByHash(data.hash)
                break
            case "getAllTxs":
                var object_response = await getAllTxs()
                response = JSON.stringify(object_response)
                break
            case "getMempool":
                response = await Chain.getPendingPool()
                break
            // INFO Authentication listener
            case "getPeerIdentity":
                // NOTE We don't need to sign anything as the comlink is signed already
                response = id_ed25519.publicKey.toString("hex") // "I am " + 
                console.log(response)
                break

            // INFO Address info endpoint
            case "getAddressInfo":
                if (!data.address) {
                    receiver.emit("public", {
                        error: "No address specified",
                    })
                }
                nStat = (await GLS.getGLSNativeStatus(
                    data.address,
                )) as StatusNative
                response = nStat.toString() // REVIEW It works ?
                break
            case "getAddressNonce":
                if (!data.address) {
                    receiver.emit("public", {
                        error: "No address specified",
                    })
                }
                nStat = (await GLS.getGLSNativeStatus(
                    data.address,
                )) as StatusNative
                response = nStat.nonce
                break
            case "getPeerTime":
                response = new Date().getTime()
                break

            // NOTE Don't look past here, go away
            // INFO For real, nothing here to be seen
            case "hots":
                console.log("[SERVER] Received hots")
                response = eggs.hots()
                break
            default:
                console.log("[SERVER] Received unknown message")
                // eslint-disable-next-line quotes
                response = '{ error: "Unknown message"}'
                break
        }
        console.log("[handleNodeAPI] response: ", response)
        return response 
}