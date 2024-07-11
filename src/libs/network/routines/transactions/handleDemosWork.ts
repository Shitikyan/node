import {
    demosWork,
    demosStep,
    ExecutionResult,
} from "@kynesyslabs/demosdk-beta/types"
import {
    XMPayload,
    XMScript,
    IWeb2Request,
    Web2Payload,
    NativePayload,
} from "@kynesyslabs/demosdk-beta/types"
import handleWeb2Request from "./dispatcher/handleWeb2Request"
import { handleXMScript } from "./dispatcher/handleXMScript"
import { handleNativeTx } from "./dispatcher/handleNativeTx"
import handleL2PS from "./dispatcher/handleL2PS"
import { cloneDeep } from "lodash"

const emptyResult: ExecutionResult = {
    success: true,
    response: null,
    extra: null,
    require_reply: false,
    operations: [],
}

/**
 * Handles the execution of a demosWork object, processing each step sequentially.
 *
 * @param {demosWork} demosWork - The demosWork object containing the steps to be executed.
 * @param {any} senderSocket - The socket through which the sender is connected.
 * @returns {Promise<ExecutionResult>} - A promise that resolves to the execution result of the demosWork.
 */
export default async function handleDemosWork(
    demosWork: demosWork,
    senderSocket: any,
): Promise<ExecutionResult> {
    let result = cloneDeep(emptyResult)
    let stepsNumber = demosWork.steps.length
    for (let i = 0; i < stepsNumber; i++) {
        console.log("[handleDemosWork] Step " + i)
        let step = demosWork.steps[i]
        // ! Executing the step
        let step_result = await handleDemosStep(step, senderSocket)
        // TODO Also check each step success or error
        result.operations.push(step_result)
    }
    return result
}

/**
 * Handles the execution of a single demosStep, processing it based on its type.
 *
 * @param {demosStep} step - The demosStep object containing the step to be executed.
 * @param {any} [senderSocket] - The socket through which the sender is connected (optional).
 * @returns {Promise<any>} - A promise that resolves to the result of the step execution.
 */
// TODO Typize the return
export async function handleDemosStep(
    step: demosStep,
    senderSocket?: any,
): Promise<any> {
    let content = step.content
    let payload = null
    let step_result = null
    switch (content.type.context) {
        // REVIEW We need to check the type of the transaction
        case "xm":
            payload = content.type.payload as XMPayload
            console.log("[Included XM Chainscript]")
            console.log(payload[1])
            // TODO Better types on answers
            var xm_result = await handleXMScript(payload[1] as XMScript)
            // TODO Add result.success handling
            step_result.response = xm_result
            break
        case "web2":
            // TODO Better types on answers
            payload = content.type.payload as Web2Payload
            var web2_result = await handleWeb2Request(
                payload[1] as IWeb2Request,
                senderSocket,
            )

            // TODO Add result.success handling
            step_result.response = web2_result
            break
        case "native":
            payload = content.type.payload as NativePayload
            // REVIEW This still works with the new tx system?
            var native_result = await handleNativeTx(
                content.type.payload as NativePayload,
            )
            // NOTE We add the Transaction to the mempool as it looks valid
            if (native_result[0]) {
                step_result.success = true
            }
            // REVIEW Check if this is ok with types
            step_result.response = native_result
    }
    return step_result
}
