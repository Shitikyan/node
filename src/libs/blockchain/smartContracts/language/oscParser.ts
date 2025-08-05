/**
 * OSC (Open Smart Contract) Parser - SDK-Wrapped Approach
 * 
 * Parses .osc contracts and maps operations to @kynesyslabs/demosdk methods.
 * This approach leverages existing SDK infrastructure for safety and functionality.
 */

export interface OSCContract {
    name: string
    state: { [key: string]: StateVariable }
    functions: { [name: string]: OSCFunction }
}

export interface StateVariable {
    type: "string" | "int" | "address" | "boolean"
    defaultValue: any
}

export interface OSCFunction {
    params: Parameter[]
    returns?: "string" | "int" | "address" | "boolean"
    operations: SDKOperation[]
}

export interface Parameter {
    name: string
    type: "string" | "int" | "address" | "boolean"
}

export type SDKOperation = 
    | { type: "sdk.transfer", from: string, to: string, amount: string }
    | { type: "sdk.crosschain.transfer", chain: string, subchain: string, address: string, amount: string }
    | { type: "sdk.web2.createProof", platform: string }
    | { type: "sdk.messaging.send", targetId: string, message: string }
    | { type: "require", condition: string }
    | { type: "set", target: string, value: string }
    | { type: "return", value: string }

export class OSCParser {
    parse(source: string): OSCContract {
        const lines = source.split("\n")
            .map(line => line.trim())
            .filter(line => line && !line.startsWith("#"))

        const contract: OSCContract = {
            name: "",
            state: {},
            functions: {},
        }

        let currentFunction = ""
        let currentFunctionData: Partial<OSCFunction> = {}
        let insideFunction = false

        for (const line of lines) {
            // Parse contract name
            if (line.startsWith("contract ")) {
                contract.name = line.replace("contract ", "").replace(" {", "")
                continue
            }

            // Parse state variables (only at contract level)
            if (line.startsWith("state ") && !insideFunction) {
                this.parseStateLine(line, contract)
                continue
            }

            // Parse function declarations
            if (line.startsWith("function ")) {
                // Save previous function if exists
                if (currentFunction && currentFunctionData.operations) {
                    contract.functions[currentFunction] = currentFunctionData as OSCFunction
                }

                currentFunction = this.parseFunctionDeclaration(line, currentFunctionData)
                currentFunctionData.operations = []
                
                // Check if opening brace is on same line
                if (line.includes("{")) {
                    insideFunction = true
                }
                continue
            }

            // Handle opening brace on separate line
            if (line === "{" && currentFunction) {
                insideFunction = true
                continue
            }

            // Handle closing brace
            if (line === "}") {
                if (insideFunction) {
                    // End of current function
                    if (currentFunction && currentFunctionData.operations) {
                        contract.functions[currentFunction] = currentFunctionData as OSCFunction
                        currentFunction = ""
                        currentFunctionData = {}
                    }
                    insideFunction = false
                }
                continue
            }

            // Parse operations inside functions
            if (insideFunction && currentFunctionData.operations) {
                const operation = this.parseOperation(line)
                if (operation) {
                    currentFunctionData.operations.push(operation)
                }
            }
        }

        // Save last function
        if (currentFunction && currentFunctionData.operations) {
            contract.functions[currentFunction] = currentFunctionData as OSCFunction
        }

        return contract
    }

    private parseStateLine(line: string, contract: OSCContract): void {
        // Format: "state name: string = "MyToken""
        const match = line.match(/state\s+(\w+):\s*(\w+)(?:\s*=\s*(.+))?/)
        if (match) {
            const [, name, type, defaultValue] = match
            contract.state[name] = {
                type: type as any,
                defaultValue: this.parseValue(defaultValue, type),
            }
        }
    }

    private parseFunctionDeclaration(line: string, functionData: Partial<OSCFunction>): string {
        // Format: "function pay(address: address, amount: int) -> boolean"
        const match = line.match(/function\s+(\w+)\(([^)]*)\)(?:\s*->\s*(\w+))?/)
        if (match) {
            const [, name, paramsStr, returnType] = match
            
            functionData.params = this.parseParameters(paramsStr)
            if (returnType) {
                functionData.returns = returnType as any
            }
            
            return name
        }
        return ""
    }

    private parseParameters(paramsStr: string): Parameter[] {
        if (!paramsStr.trim()) return []
        
        return paramsStr.split(",").map(param => {
            const match = param.trim().match(/(\w+):\s*(\w+)/)
            if (match) {
                const [, name, type] = match
                return { name, type: type as any }
            }
            return { name: "unknown", type: "string" }
        })
    }

    private parseOperation(line: string): SDKOperation | null {
        // SDK transfer operation
        if (line.startsWith("sdk.transfer(")) {
            const match = line.match(/sdk\.transfer\(([^,]+),\s*([^,]+),\s*([^)]+)\)/)
            if (match) {
                return {
                    type: "sdk.transfer",
                    from: match[1].trim(),
                    to: match[2].trim(),
                    amount: match[3].trim(),
                }
            }
        }

        // SDK cross-chain transfer
        if (line.startsWith("sdk.crosschain.transfer(")) {
            const match = line.match(/sdk\.crosschain\.transfer\(([^,]+),\s*([^,]+),\s*([^,]+),\s*([^)]+)\)/)
            if (match) {
                return {
                    type: "sdk.crosschain.transfer",
                    chain: match[1].trim(),
                    subchain: match[2].trim(),
                    address: match[3].trim(),
                    amount: match[4].trim(),
                }
            }
        }

        // SDK web2 proof creation
        if (line.startsWith("sdk.web2.createProof(")) {
            const match = line.match(/sdk\.web2\.createProof\(([^)]+)\)/)
            if (match) {
                return {
                    type: "sdk.web2.createProof",
                    platform: match[1].trim().replace(/['"]/g, ""),
                }
            }
        }

        // SDK messaging
        if (line.startsWith("sdk.messaging.send(")) {
            const match = line.match(/sdk\.messaging\.send\(([^,]+),\s*([^)]+)\)/)
            if (match) {
                return {
                    type: "sdk.messaging.send",
                    targetId: match[1].trim(),
                    message: match[2].trim(),
                }
            }
        }

        // Require statement
        if (line.startsWith("require ")) {
            return {
                type: "require",
                condition: line.replace("require ", ""),
            }
        }

        // State assignment
        if (line.includes(" = ") && line.startsWith("state.")) {
            const [target, value] = line.split(" = ").map(s => s.trim())
            return {
                type: "set",
                target,
                value,
            }
        }

        // Return statement
        if (line.startsWith("return ")) {
            return {
                type: "return",
                value: line.replace("return ", ""),
            }
        }

        return null
    }

    private parseValue(value: string | undefined, type: string): any {
        if (!value) return null
        
        // Remove quotes
        const cleanValue = value.replace(/['"]/g, "")
        
        switch (type) {
            case "int":
                return parseInt(cleanValue)
            case "boolean":
                return cleanValue === "true"
            case "string":
            case "address":
            default:
                return cleanValue
        }
    }
}

// Usage function
export function parseOSCContract(source: string): OSCContract {
    const parser = new OSCParser()
    return parser.parse(source)
}