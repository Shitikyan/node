/**
 * Test the OSC parser with example contract
 */

import { parseOSCContract } from "./oscParser"
import { readFileSync } from "fs"
import { join } from "path"

async function testOSCParser() {
    console.log("🔍 Testing OSC Parser (SDK-Wrapped Approach)\n")
    
    try {
        // Read example contract
        const source = readFileSync(join(__dirname, "example.osc"), "utf8")
        console.log("📄 Contract Source (first 10 lines):")
        console.log(source.split("\n").slice(0, 10).join("\n") + "...\n")
        
        // Parse contract
        const contract = parseOSCContract(source)
        
        console.log("✅ Parser Results:")
        console.log("📋 Contract Name:", contract.name)
        console.log("📊 State Variables:", Object.keys(contract.state).length)
        Object.keys(contract.state).forEach(key => {
            const stateVar = contract.state[key]
            console.log(`   - ${key}: ${stateVar.type} = ${stateVar.defaultValue}`)
        })
        
        console.log("🔧 Functions:", Object.keys(contract.functions).length)
        Object.keys(contract.functions).forEach(funcName => {
            const func = contract.functions[funcName]
            console.log(`   - ${funcName}(${func.params.map(p => `${p.name}: ${p.type}`).join(", ")})${func.returns ? ` -> ${func.returns}` : ""}`)
            console.log(`     Operations: ${func.operations.length}`)
            func.operations.forEach((op, i) => {
                console.log(`       ${i + 1}. ${op.type}`)
            })
        })
        
        // Test specific function parsing
        console.log("\n🎯 Detailed Function Analysis:")
        const payFunction = contract.functions.pay
        if (payFunction) {
            console.log("Pay Function:")
            console.log("  Parameters:", payFunction.params)
            console.log("  Return Type:", payFunction.returns)
            console.log("  Operations:")
            payFunction.operations.forEach((op, i) => {
                console.log(`    ${i + 1}. ${JSON.stringify(op, null, 2)}`)
            })
        }
        
        console.log("\n✨ SDK Operations Found:")
        const allOperations = Object.values(contract.functions).flatMap(f => f.operations)
        const sdkOps = allOperations.filter(op => op.type.startsWith("sdk."))
        sdkOps.forEach(op => {
            console.log(`  - ${op.type}`)
        })
        
        console.log(`\n🎉 Parse Complete! Found ${Object.keys(contract.functions).length} functions with ${allOperations.length} total operations.`)
        
    } catch (error) {
        console.error("❌ Parser Error:", error.message)
        console.error("Stack:", error.stack)
    }
}

// Run test if called directly
if (require.main === module) {
    testOSCParser().catch(console.error)
}

export { testOSCParser }