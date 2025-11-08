# ZK-SNARK Privacy Identity System

This directory contains the zero-knowledge proof infrastructure for Demos Network's privacy-preserving identity system.

## Phase 0: Environment Setup ✅ COMPLETE

### Installed Dependencies

- **snarkjs** (v0.7.5) - ZK proof generation and verification
- **circomlibjs** (v0.1.7) - Circuit libraries for Circom
- **ffjavascript** (v0.3.0) - Finite field arithmetic

### Powers of Tau Ceremony

Generated Powers of Tau ceremony files for trusted setup (2^12 = 4096 constraints):

- `pot12_0000.ptau` - Initial ceremony file
- `pot12_0001.ptau` - After contribution
- `pot12_final.ptau` - **Final file ready for use** (4.6MB)

For production, we'll need a larger ceremony file (2^20 = 1M constraints) which can be downloaded from:
```bash
curl -o pot20_final.ptau https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_20.ptau
```

### Directory Structure

```
/src/libs/zk/
├── circuits/                           # Circom circuits
│   └── identityCommitment.circom       # Basic commitment circuit
├── build/                              # Compiled circuits (gitignored)
├── keys/                               # Proving/verification keys
│   ├── verification_keys/
│   └── proving_keys/
├── tests/                              # Test suites
│   ├── circuits/
│   └── integration/
├── types.ts                            # TypeScript type definitions
├── utils.ts                            # Helper functions
├── .gitignore                          # Ignore build artifacts
├── pot12_final.ptau                    # Powers of Tau (testing)
└── README.md                           # This file
```

### Infrastructure Files Created

**types.ts** - Complete type definitions for:
- Identity types (web2, xm)
- Platform types (twitter, github, discord, evm, solana)
- Proof structures (Groth16Proof, AttestationPublicSignals)
- Circuit inputs/outputs
- Transaction payloads

**utils.ts** - Utility functions for:
- Secret generation
- BigInt conversions
- Hex/buffer operations
- Proof formatting
- Benchmarking
- Validation

**circuits/identityCommitment.circom** - Simple test circuit that hashes two inputs using Poseidon

## Next Steps

### Phase 1: Core ZK Infrastructure (3 weeks)

1. **Week 1: Circuits**
   - Implement remaining circuits (merkleProof, identityAttestation)
   - Compile and test all circuits
   - Generate verification keys

2. **Week 2: TypeScript Infrastructure**
   - Implement `prover.ts`
   - Implement `verifier.ts`
   - Implement `merkleTree.ts`
   - Write unit tests

3. **Week 3: Integration & Testing**
   - Create database migrations
   - Integrate MerkleTreeManager
   - Performance testing
   - Documentation

## Usage Examples

### Generate Random Secret

```typescript
import { generateRandomSecret } from "@/libs/zk/utils"

const secret = generateRandomSecret()
// Store securely, never send to server!
```

### Type-Safe Commitment

```typescript
import { IdentityCommitment, Platform } from "@/libs/zk/types"

const commitment: IdentityCommitment = {
    hash: "0x...",
    leaf_index: 0,
    identity_type: "web2",
    platform: "twitter",
    timestamp: Date.now()
}
```

## Circuit Compilation (When Circom is Installed)

```bash
# Compile circuit
circom circuits/identityCommitment.circom --r1cs --wasm --sym -o build/

# Generate proving key
snarkjs groth16 setup build/identityCommitment.r1cs pot12_final.ptau circuit_0000.zkey

# Export verification key
snarkjs zkey export verificationkey circuit_0000.zkey verification_key.json
```

## Testing

```bash
# Run circuit tests
npm test -- src/libs/zk/tests/circuits

# Run integration tests
npm test -- src/libs/zk/tests/integration
```

## Security Notes

- ⚠️ The current `pot12_final.ptau` is for TESTING ONLY
- ⚠️ Production requires larger ceremony (2^20 or higher)
- ⚠️ User secrets must NEVER leave the client device
- ⚠️ Verification keys must be distributed securely

## Performance Targets

- **Proof Generation**: < 10 seconds (EVM < 15 seconds)
- **Proof Verification**: < 1 second
- **Merkle Tree Operations**: < 100ms
- **Transaction Throughput**: > 100 TPS

## Resources

- [Circom Documentation](https://docs.circom.io/)
- [snarkjs GitHub](https://github.com/iden3/snarkjs)
- [ZK-SNARK Explainer](https://z.cash/technology/zksnarks/)
- [Implementation Plan](../../../ZK_PRIVACY_IDENTITY_IMPLEMENTATION_PLAN.md)
