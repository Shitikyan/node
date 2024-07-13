import Chain from "src/libs/blockchain/chain"
import Mempool from "src/libs/blockchain/mempool"
import { confirmTransaction } from "src/libs/blockchain/routines/validateTransaction"
import Transaction from "src/libs/blockchain/transaction"

import deriveBlock from "src/libs/consensus/routines/deriveBlock"
import Cryptography from "src/libs/crypto/cryptography"
import Hashing from "src/libs/crypto/hashing"
import eggs from "src/libs/network/routines/eggs"
import { handleNodeAPI } from "./routines/nodecalls/handleNodeAPI"
import handleL2PS from "./routines/transactions/dispatcher/handleL2PS"
import { normalizeWebBuffers } from "src/libs/network/routines/normalizeWebBuffers"
import Sessions from "src/libs/network/routines/sessionManager"
import { BrowserRequest } from "src/libs/network/serverListeners"
import { Peer } from "src/libs/peer"
import { Blocks } from "src/model/entities/Blocks"
import sharedState from "src/utilities/sharedState"
import _ from "lodash"

import handleDemosWork from "./routines/transactions/handleDemosWork"

// NOTE Terminal kit for useful logging
import terminalkit from "terminal-kit"

import { AddressInfo, DemoScript, ExecutionResult, ValidityData } from "@kynesyslabs/demosdk-beta/types"
import { DemosWork } from "@kynesyslabs/demosdk-beta/demoswork"

import { XmWorkStep, Web2WorkStep, NativeWorkStep } from "@kynesyslabs/demosdk-beta/demoswork"

import GLS from "../blockchain/gls/gls"
import { StatusNative } from "src/model/entities/StatusNative"
let term = terminalkit.terminal

export default class ServerHandlers {
    // ANCHOR BrowserRequest

    // SECTION Login On Chain
    static async handleLoginRequest(content: BrowserRequest) {
        // A browser login request is the first step for a user to confirm their identity
        // The user will be prompted for a message to sign and their session is either created or updated
        let address_requested = content.data.publicKey // Must be a JSON string of a publicKey
        return Sessions.getInstance().newSession(address_requested)
    }

    static async handleLoginResponse(content: BrowserRequest) {
        let result = [true, ""]
        let s_signature = content.data.signature // Must be a JSON or a string of a signature (as Uint8Array or {type: "Buffer", data: []})
        let signature_conversion = normalizeWebBuffers(s_signature)
        let signature = signature_conversion[0]
        if (!signature) {
            return [false, "Invalid signature: " + signature_conversion[1]]
        }
        // TODO Check session validity
        // INFO When a user logs in, the server will store and send a token valid for X time
        // the user possessing that token will be able to demonstrate that the user is still logged in
        // even in 3rd party applications.
        // In any case, by calling loginRequest any application is able to enforce the user to log in
        // and verify themselves again.
        return result
    }

    // !SECTION Consensus Voting
    // ANCHOR Vote request

    static async handleVoteRequest(timestamp: number): Promise<string> {
        // Todo : compare the received response response with what we have locally, and return the vote result
        console.log("[SERVERHANDLER] handleVoteRequest")
        const mempool = await Mempool.getMempool()

        // REVIEW Is this the right way to get the shard?
        const { shard } = sharedState.getInstance()

        const { derivedBlock } = await deriveBlock(mempool, timestamp, shard)
        const proposedBlock = derivedBlock
        let proposedBlockHash = proposedBlock.hash
        return proposedBlockHash
    }

    // TODO Insert demosWork logic here too
    static async handleValidateTransaction(
        tx: Transaction,
    ): Promise<ValidityData> {
        term.yellow("[handleTransactions] Handling a DEMOS tx...\n")
        let fname = "[handleTransactions] "
        term.yellow(fname + "Handling transaction...")
        // Verify and execute the transaction
        let validationData: ValidityData
        try {
            /* NOTE This workflow goeas as:
             * The transaction is validated
             * A gas operation is created and is sent back alongside the validation data
             * TODO Add signatures to validation data
             * The validation data can be used by the client to effectively execute the tx
             */
            //console.log(fname + "Validating transaction...")
            validationData = await confirmTransaction(tx)
            //console.log(fname + "Fetching result...")
        } catch (e) {
            term.red.bold("[TX VALIDATION ERROR] 💀 : ")
            term.red(e)
            validationData = {
                data: {
                    valid: false,
                    reference_block: null,
                    message:
                        "An error occurred while validating the transaction",
                    gas_operation: null,
                    transaction: null,
                },
                signature: null,
                rpc_public_key: null,
            }
            // Signing and hashing the validation data
            let hashedValidationData = Hashing.sha256(
                JSON.stringify(validationData.data),
            )
            validationData.signature = Cryptography.sign(
                hashedValidationData,
                sharedState.getInstance().identity.ed25519.privateKey,
            )
        }

        term.bold.white(fname + "Transaction handled.")
        return validationData
    }

    // NOTE This method is used to handle the execution of a transaction
    // TODO Better typing for content (must contain validity data, hashing and signature as shown below)
    // TODO Either put this into a module or do something to make it more modular
    static async handleExecuteTransaction(
        validatedData: ValidityData,
        senderSocket: any,
    ): Promise<ExecutionResult> {
        let fname = "[handleExecuteTransaction] "
        let result: ExecutionResult = {
            success: true,
            response: null,
            extra: null,
            require_reply: false,
        }
        // NOTE Content should contain validity data and our signature to proceed
        // Integrity checks
        let ourKey = sharedState.getInstance().identity.ed25519.publicKey
        let hexOurKey = ourKey.toString("hex")
        let dataKey = validatedData.rpc_public_key
        let hexDataKey = Buffer.from(dataKey as Buffer).toString("hex")
        let dataSignature = validatedData.signature
        let queriedTx = _.cloneDeep(validatedData.data.transaction) // dataManipulation.copyCreate(validatedData.data.transaction)

        // queriedTx.content.from = queriedTx?.content?.from?.toString()
        // queriedTx.content.from = queriedTx?.content?.to?.toString()

        console.log(
            "[SERVER] Received transaction for execution: " + queriedTx.hash,
        )

        // We need to have issued the validity data
        if (hexDataKey !== hexOurKey) {
            term.red.bold(
                fname + "Invalid validityData signature key (not us) 💀 : ",
            )

            result.success = false
            result.response = false
            result.extra = "Invalid signature key"
            return result
        }
        // Also the signature must be valid
        let hashedData = Hashing.sha256(JSON.stringify(validatedData.data))
        console.log(JSON.stringify(validatedData))
        console.log("Backend - Hash:", hashedData)
        console.log(
            "Backend - Data Signature:",
            Buffer.from(dataSignature as Buffer).toString("hex"),
        )
        console.log(
            "Backend - Data Key:",
            Buffer.from(dataKey as Buffer).toString("hex"),
        )
        let signatureValid = Cryptography.verify(
            hashedData,
            dataSignature,
            dataKey,
        )
        if (!signatureValid) {
            term.red.bold(fname + "Invalid validityData signature 💀 : ")
            result.success = false
            result.response = false
            result.extra = "Invalid signature"
            return result
        }
        // Finally, the block number reference must be valid
        let blockNumber = validatedData.data.reference_block
        let lastBlockNumber = await Chain.getLastBlockNumber()
        if (blockNumber != lastBlockNumber) {
            term.red.bold(fname + "Invalid validityData block reference 💀 : ")
            result.success = false
            result.response = false
            result.extra = "Invalid block reference"
            return result
        }
        // REVIEW Is this useful at this point?
        if (!validatedData.data.valid) {
            // An invalid transaction won't even be added to the mempool
            term.yellow.bold(fname + "Invalid validityData 💀 : ")
            console.log(validatedData.data.message)
            result.success = false
            result.response = false
            result.extra = validatedData.data.message
            return result
        }

        /* NOTE
                    We just processed the cryptographic validity of the transaction.
                    We will now try to execute it obtaining valid Operations.
                */
        term.green.bold(fname + "Valid validityData! \n")
        // REVIEW Switch case for different types of transactions
        let tx = _.cloneDeep(validatedData.data.transaction) as unknown as Transaction // ! Change the logic using demosWork
        // Preparing processing the steps of demoScript
        result = await handleDemosWork(tx.content.data, senderSocket)
        // Only if the transaction is valid we add it to the mempool
        
        if (result.success) {
            // REVIEW We add the transaction to the mempool
            Mempool.addTransaction(queriedTx as unknown as Transaction) // ! Change the logic using demosWork
            // TODO Check if Operation(s) are added to the GLS too
            // FIXME Add an operation for the nonce or anyway a way to manage the nonce
        }
        // TODO Broadcast the tx to the other peers (or maybe not, consensus should take care of it)
        // Response is then sent back automatically as a reply (with our validation)
        // Returning the state of the transaction including operations
        return result
    }

    // Handling a whole demosWork as a transaction data using the dedicated method
    static async handleDemosWork(demoScript: DemoScript, senderSocket: any): Promise<ExecutionResult> {
        return handleDemosWork(demoScript, senderSocket)
    }

    // Proxy method for handleL2PS
    // ! Add this to demosWork
    static async handleL2PS(content: any): Promise<{ response: any; require_reply: boolean; extra: any }> {
        return handleL2PS(content)
    }

    // TODO Use a dedicated module for this
    static async handleConsensusRequest(
        request: any,
        content: any,
        senderIdentity: any,
    ): Promise<any> {
        let extra: string,
            require_reply = false
        let response: any

        console.log("[SERVER] Received consensus request")
        console.log("[SERVER] Peer identity information received")
        console.log(senderIdentity)
        if (!sharedState.getInstance().consensusMode) {
            return {
                extra,
                require_reply,
                response: { error: "We are not in consensus mode" },
            }
        }

        console.log("we are in consensus mode")

        let authorized = false
        let senderPublicKey = senderIdentity.toString("hex")

        const { shard } = sharedState.getInstance()

        if (!shard) {
            return {
                extra,
                require_reply,
                response: { error: "No shard found in shared state" },
            }
        }
        console.log("[SERVERHANDLER] Shard found in shared state")
        //console.log(shard)

        const peerList = await shard.getPeers()

        // Authorizing the sender
        for (let peer of peerList) {
            if (peer.identity.toString("hex") === senderPublicKey) {
                authorized = true
                break
            }
        }

        // Return error if not authorized
        if (!authorized) {
            return {
                extra,
                require_reply,
                response: { error: "Not authorized" },
            }
        }

        switch (content.message) {
            case "getMempool":
                response = await Mempool.getMempool()
                console.log("[SERVERHANDLER] Received mempool")
                //console.log(response)
                return { extra, require_reply, response }

            default:
                return {
                    extra,
                    require_reply,
                    response: { error: "Unknown message" },
                }
        }
    }

    // TODO Use a dedicated module for this
    static async handleMessage(content: any): Promise<any> {
        // Basic message handling logic
        // ...
        let extra: any
        let require_reply = false
        const response = "Not Yet Implemented"
        return { extra, require_reply, response }
    }

    // TODO Use a dedicated module for this
    static async handleStorage(): Promise<any> {
        // Basic storage handling logic
        // ...
        let extra = { storageState: "mocked" }
        let require_reply = true
        let response = {}
        return { extra, require_reply, response }
    }

    // TODO Use a dedicated module for this
    static async handleMempool(content: any): Promise<any> {
        // Basic message handling logic
        // ...
        let extra: any
        let require_reply = false
        const response = await Mempool.receive(content.message)
        return { extra, require_reply, response }
    }

    static async handleNodeAPI(
        content: any,
        receiver: any,
        id_ed25519: any,
    ): Promise<any> {
        let extra: any
        let require_reply = false
        let response = await handleNodeAPI(content, receiver, id_ed25519)
        // REVIEW Unified error handling
        if (response === "error") {
            receiver.emit("error", {
                error: extra,
                muid: content.muid,
            })
        }
        // REVIEW Is this ok? Follow back and see
        return { extra, require_reply, response }
    }
        
}
