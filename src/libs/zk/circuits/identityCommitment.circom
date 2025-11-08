pragma circom 2.0.0;

include "../../../node_modules/circomlibjs/circuits/poseidon.circom";

/**
 * Identity Commitment Circuit
 *
 * This circuit generates a cryptographic commitment to an identity.
 *
 * Inputs:
 *   - providerId: The provider-specific identifier (Twitter ID, EVM address, etc.)
 *   - secret: User's secret (never revealed)
 *
 * Output:
 *   - commitment: H(providerId, secret)
 */
template IdentityCommitment() {
    signal input providerId;
    signal input secret;
    signal output commitment;

    component hasher = Poseidon(2);
    hasher.inputs[0] <== providerId;
    hasher.inputs[1] <== secret;

    commitment <== hasher.out;
}

component main = IdentityCommitment();
