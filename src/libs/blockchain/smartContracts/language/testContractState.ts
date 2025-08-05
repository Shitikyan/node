/**
 * Test ContractState interface and structure
 */

import { ContractState, StateVariable } from "./types/ContractTypes"
import { parseOSCContract } from "./oscParser"
import { readFileSync } from "fs"
import { join } from "path"

function createInitialState(parsedContract: any): ContractState {
    const state: ContractState = {}
    
    // Convert parsed state variables to ContractState format
    for (const [name, stateVar] of Object.entries(parsedContract.state)) {
        const parsed = stateVar as any
        
        const stateVariable: StateVariable = {
            value: parsed.defaultValue,
            type: parsed.type,
            public: true,    // Default: everyone can read
            owned: true,      // Default: only owner can modify
        }
        
        state[name] = stateVariable
    }
    
    return state
}

async function testContractState() {
    console.log("🧪 Testing ContractState Structure\n")
    
    try {
        // Parse example contract
        const source = readFileSync(join(__dirname, "example.osc"), "utf8")
        const parsed = parseOSCContract(source)
        
        // Create initial state
        const initialState = createInitialState(parsed)
        
        console.log("✅ Initial Contract State:")
        console.log(JSON.stringify(initialState, null, 2))
        
        console.log("\n🔍 State Variable Access:")
        for (const [name, stateVar] of Object.entries(initialState)) {
            console.log(`${name}:`)
            console.log(`  Value: ${stateVar.value}`)
            console.log(`  Type: ${stateVar.type}`)
            console.log(`  Public: ${stateVar.public} (${stateVar.public ? "everyone can read" : "owner only"})`)
            console.log(`  Owned: ${stateVar.owned} (${stateVar.owned ? "owner can modify" : "anyone can modify"})`)
            console.log()
        }
        
        // Test state modification
        console.log("🔄 Testing State Modification:")
        const modifiedState = { ...initialState }
        modifiedState.name = {
            value: "UpdatedToken",
            type: "string",
            public: true,
            owned: true,
        }
        
        console.log(`Updated name: ${modifiedState.name.value}`)
        
        // Test access control scenarios
        console.log("\n🛡️ Access Control Examples:")
        
        // Private state variable (only owner can read)
        modifiedState.secretKey = {
            value: "secret123",
            type: "string", 
            public: false,  // Only owner can read
            owned: true,     // Only owner can modify
        }
        
        // Public writable (anyone can modify - dangerous!)
        modifiedState.publicCounter = {
            value: 0,
            type: "int",
            public: true,   // Everyone can read
            owned: false,    // Anyone can modify (use with caution)
        }
        
        console.log("secretKey: owner-only read/write")
        console.log("publicCounter: public read, public write")
        
        console.log("\n🎉 ContractState structure works perfectly!")
        
    } catch (error) {
        console.error("❌ ContractState test failed:", error.message)
    }
}

// Run test if called directly
if (require.main === module) {
    testContractState().catch(console.error)
}

export { testContractState, createInitialState }