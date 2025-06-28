/* LICENSE

© 2023 by KyneSys Labs, licensed under CC BY-NC-ND 4.0

Full license text: https://creativecommons.org/licenses/by-nc-nd/4.0/legalcode
Human readable license: https://creativecommons.org/licenses/by-nc-nd/4.0/

KyneSys Labs: https://www.kynesys.xyz/

*/

// TODO Should tokens be cached to a file in the data folder for quick access on node startup and maybe sync with the chain?
// TODO Should the GCR have a table for chain-wide properties (such as tokens)?

/**
 * A class to represent a token
 */
export class Token {
    address: string
    name: string
    ticker: string
    decimals: number
}

/**
 * A class to map tokens by their address
 */
export class TokenMapper {
    private static instance: TokenMapper
    private tokens: Map<string, Token> = new Map()

    private constructor() {}

    static getInstance(): TokenMapper {
        if (!TokenMapper.instance) {
            TokenMapper.instance = new TokenMapper()
        }
        return TokenMapper.instance
    }

    /**
     * Get all tokens
     * @returns All tokens
     */
    async getTokens(): Promise<Token[]> {
        return Array.from(this.tokens.values())
    }

    /**
     * Get a token by its address
     * @param address - The address of the token
     * @returns The token
     */
    async getToken(address: string): Promise<Token> {
        if (!this.tokens.has(address)) {
            const token = await this.tokens.get(address)
            if (!token) {
                throw new Error(`Token ${address} not found`)
            }
            return token
        }
    }

    /**
     * Get the state of a token for an address
     * @param address - The address of the token
     * @returns The state of the token for the address
     */
    async getTokenStateForAddress(address: string): Promise<TokenStateForAddress> {
        const tokenState = new TokenStateForAddress()
        // TODO Retrieve from the GCRMain table
        return tokenState
    }
}

/**
 * A class to represent the state of a token for an address
 */
export class TokenStateForAddress {
    tokenAddress: string
    balance: bigint
    allowance: Map<string, bigint> = new Map() // address is allowed to spend from the balance
    lastUpdated: Date
}
