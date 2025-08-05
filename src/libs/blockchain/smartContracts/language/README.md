# OSC Language Developer Guide
**SDK-Wrapped Smart Contract Language for Demos Network**

## Quick Start

```bash
# Test the parser
bun run src/libs/blockchain/smartContracts/language/testParser.ts

# Test contract state structure
bun run src/libs/blockchain/smartContracts/language/testContractState.ts

# Parse a custom contract
import { parseOSCContract } from './oscParser'
const contract = parseOSCContract(sourceCode)
```

## What is OSC?

OSC (Open Smart Contract) is a domain-specific language that maps directly to @kynesyslabs/demosdk methods. Instead of reinventing blockchain operations, OSC provides a clean syntax that compiles to proven SDK calls.

## Language Syntax

### Contract Structure

```osc
contract ContractName {
    # State variables
    state variableName: type = defaultValue
    
    # Functions
    function functionName(param: type) -> returnType {
        # Function body
    }
}
```

### Data Types

- `string` - Text values
- `int` - Integer numbers  
- `address` - Blockchain addresses
- `boolean` - True/false values

### State Variables

State variables persist across function calls with access control:

```osc
state name: string = "MyToken"        # Default: public=true, owned=true (owner only)
state balance: int = 1000             # Default: public=true, owned=true
state owner: address = caller()       # Default: public=true, owned=true
```

**Access Control:**
- `public: true` - Everyone can read the value
- `public: false` - Only contract owner can read the value  
- `owned: true` - Only contract owner can modify the value
- `owned: false` - Anyone can modify the value (use with caution)

**Storage Structure:**
```typescript
state: {
  name: { value: "MyToken", type: "string", public: true, owned: true },
  balance: { value: 1000, type: "int", public: true, owned: true },
  owner: { value: "pubkey123", type: "address", public: true, owned: true }
}
```

### Functions

Functions define contract behavior:

```osc
function transfer(to: address, amount: int) -> boolean {
    sdk.transfer(caller(), to, amount)
    return true
}
```

## SDK Operations

OSC maps to these @kynesyslabs/demosdk operations:

### Basic Operations

| OSC Syntax | SDK Method | Description |
|------------|------------|-------------|
| `sdk.transfer(from, to, amount)` | `demos.transfer()` | Transfer tokens |
| `require condition` | - | Validation check |
| `state.variable = value` | - | State assignment |
| `return value` | - | Return from function |

### Cross-Chain Operations

```osc
sdk.crosschain.transfer(chain, subchain, address, amount)
```
Maps to: `EVM.preparePay()` + `prepareXMScript()` + `demos.broadcast()`

### Web2 Integration

```osc
sdk.web2.createProof("platform")
```
Maps to: `identities.createWeb2ProofPayload(demos)`

### Messaging

```osc
sdk.messaging.send(targetId, message)
```
Maps to: `messagingPeer.sendMessage(targetId, message)`

## Built-in Functions

- `caller()` - Returns address of transaction sender
- `require condition` - Validates condition, reverts if false

## Example Contract

See `example.osc` for a complete token contract example.

## Development Workflow

### Writing Contracts

1. **Create .osc file** with your contract:
```osc
contract MyContract {
    state name: string = "Hello"
    
    function greet() -> string {
        return state.name
    }
}
```

2. **Test parsing**:
```typescript
import { parseOSCContract } from './oscParser'
const contract = parseOSCContract(sourceCode)
console.log(contract.functions.greet.operations)
```

### Testing Your Changes

```bash
# Run all tests
bun run testParser.ts && bun run testContractState.ts

# Test specific functionality
npm test -- --grep "OSC"

# Type checking
npx tsc --noEmit
```

### Adding New SDK Operations

1. **Add to ContractTypes.ts**:
```typescript
| { type: "sdk.newOperation", param1: string, param2: string }
```

2. **Update oscParser.ts** operation parsing
3. **Add test cases** in testParser.ts
4. **Update documentation** with examples

## Project Structure

```
language/
├── README.md           # This documentation
├── oscParser.ts        # OSC language parser implementation
├── example.osc         # Example token contract
├── testParser.ts       # Parser test suite
└── types/
    └── ContractTypes.ts # Contract state and type definitions
```

### File Descriptions

- **`oscParser.ts`**: Core parser implementation with TypeScript interfaces
- **`example.osc`**: Complete example showing all language features  
- **`testParser.ts`**: Test suite that validates parser functionality
- **`README.md`**: Complete language documentation and architecture
- **`types/ContractTypes.ts`**: Contract state interfaces with access control

## How It Works

```
.osc Contract → OSC Parser → Operation Tree → ContractExecutor → SDK Calls
```

1. **Write Contract**: Create `.osc` file with state and functions
2. **Parse**: `parseOSCContract()` converts source to operation tree
3. **Execute**: ContractExecutor processes operations (Phase 2.2)
4. **Storage**: State stored in `GCRMain.contracts` JSONB column

### State Management

```typescript
// Contract state with access control
{
  "name": {
    "value": "MyToken",
    "type": "string", 
    "public": true,    // Everyone can read
    "owned": true      // Only owner can modify
  }
}
```

## Parser Implementation

### Bracket-Based Parsing
The parser uses **bracket-based scoping** instead of indentation:

- Functions are scoped by `{` and `}` brackets
- No indentation requirements - developers can format freely
- More robust than indentation-based parsing
- Simpler logic with fewer edge cases

### Flexible Formatting
Both styles work identically:

```osc
# Style 1: Indented
function pay(address: address, amount: int) -> boolean {
    sdk.transfer(caller(), address, amount)
    return true
}

# Style 2: Non-indented  
function pay(address: address, amount: int) -> boolean {
sdk.transfer(caller(), address, amount)
return true
}
```

### Technical Implementation

- **Parser Size**: ~265 lines (vs 700+ for full AST parser)
- **Parsing Strategy**: Line-by-line with bracket depth tracking
- **State Management**: Simple function scoping with operation collection
- **Error Handling**: Graceful degradation for malformed syntax

## Troubleshooting

### Parser Issues

```bash
# Check if contract syntax is valid
bun run testParser.ts

# Debug parsing step by step
const contract = parseOSCContract(source)
console.log('Functions:', Object.keys(contract.functions))
console.log('State:', Object.keys(contract.state))
```

### Common Issues

- **Missing brackets**: Ensure all `{` have matching `}`
- **Invalid types**: Use `string`, `int`, `address`, `boolean` only
- **SDK operations**: Check operation syntax matches examples

### Next Steps (Phase 2.2)

The foundation is ready! Next phase will implement:
- ContractExecutor class
- SDK method mapping 
- State access control enforcement
- Transaction integration

---

*See SMART_CONTRACTS_IMPLEMENTATION_PHASES.md for detailed implementation status*