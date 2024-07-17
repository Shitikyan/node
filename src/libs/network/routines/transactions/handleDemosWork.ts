import {
    DemoScript,
    WorkStepInput,
    ExecutionResult,
} from "@kynesyslabs/demosdk-beta/types"
import {
    DemosWorkOperation,
    WorkStep,
    DemosWork,
} from "@kynesyslabs/demosdk-beta/demoswork"
import { XMScript, IWeb2Request } from "@kynesyslabs/demosdk-beta/types"
import { INativePayload } from "node_modules/@kynesyslabs/demosdk-beta/build/types/native"
import handleWeb2Request from "./dispatcher/handleWeb2Request"
import { handleXMScript } from "./dispatcher/handleXMScript"
import { handleNativeTx } from "./dispatcher/handleNativeTx"
import handleL2PS from "./dispatcher/handleL2PS"
import _ from "lodash"

import { XmWorkStep, Web2WorkStep, NativeWorkStep } from "@kynesyslabs/demosdk-beta/demoswork"


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
 * @param {demoScript} demoScript - The demosWork object containing the steps to be executed.
 * @param {any} senderSocket - The socket through which the sender is connected.
 * @returns {Promise<ExecutionResult>} - A promise that resolves to the execution result of the demosWork.
 */
export default async function handleDemosWork(
    demoScript: DemoScript,
    senderSocket: any,
): Promise<ExecutionResult> {
    let result = _.cloneDeep(emptyResult)
    let steps = demoScript.steps
    for (let stepID in steps) {
        console.log("[handleDemosWork] Step " + stepID)
        let step = steps[stepID]
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
    step: WorkStep, 
    senderSocket?: any,
): Promise<any> {
    let payload = null
    let content = step.content
    let step_result = null  
    switch (step.context) {
        // REVIEW We need to check the type of the transaction
        case "xm":
            payload = content as XMScript
            console.log("[Included XM Chainscript]")
            console.log(payload)
            // TODO Better types on answers
            var xm_result = await handleXMScript(payload)  // ? review this method
            // TODO Add result.success handling
            step_result.response = xm_result
            break
        case "web2":
            // TODO Better types on answers
            payload = content as IWeb2Request
            var web2_result = await handleWeb2Request(
                payload[1] as IWeb2Request,
                senderSocket,       
            )  // ? review this method

            // TODO Add result.success handling
            step_result.response = web2_result
            break
        case "native":
            payload = content as INativePayload
            // REVIEW This still works with the new tx system?
            var native_result = await handleNativeTx(
                payload,
            )  // ? review this method
            // NOTE We add the Transaction to the mempool as it looks valid
            if (native_result[0]) {
                step_result.success = true
            }
            // REVIEW Check if this is ok with types
            step_result.response = native_result
    }
    return step_result
}
