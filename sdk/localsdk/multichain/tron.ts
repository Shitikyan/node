// INFO Support for the Tron network

import { TronWeb } from "tronweb"
import {
    SignedTransaction,
    Transaction,
} from "tronweb/lib/esm/types/Transaction"

import required from "src/utilities/required"
import defaultChainAsync from "./types/defaultChainAsync"

// LINK to the testnet https://api.shasta.trongrid.io
export default class TRON extends defaultChainAsync {
    // LINK https://github.com/tronprotocol/tronweb
    // LINK Tron Web SDK: https://tronweb.network/docu/docs/intro
    // NOTE As Tron supports solidity contracts, we need to study for it quite a lot
    // TODO See TVM and EVM

    declare provider: TronWeb
    declare wallet: TronWeb

    constructor(rpc_url: string) {
        super(rpc_url)
        this.name = "TRON"
    }

    // INFO Connecting to a provider
    async connect(rpc_url?: string): Promise<boolean> {
        if (rpc_url) {
            this.rpc_url = rpc_url
        }

        this.provider = new TronWeb({
            fullHost: this.rpc_url,
        })

        // INFO: Check if the connection is successful
        await this.provider.trx.getChainParameters()
        return true
    }

    async disconnect(): Promise<any> {
        throw new Error("Method not implemented.")
    }
    getBalance(address: string): Promise<string> {
        throw new Error("Method not implemented.")
    }
    pay(receiver: string, amount: string): Promise<Transaction> {
        required(this.wallet.defaultAddress.hex, "Provider is not initialized")

        console.log("TRON WALLET ADDRESS")
        console.log(this.wallet.defaultAddress.hex)

        const parsedAmount = parseFloat(amount)

        if (isNaN(parsedAmount)) {
            throw new Error("Invalid TRX amount")
        }

        return this.provider.transactionBuilder.sendTrx(
            receiver,
            parsedAmount,
            this.wallet.defaultAddress.hex as string,
        )
    }
    info(): Promise<string> {
        throw new Error("Method not implemented.")
    }

    // INFO Adding a wallet to the Tron network provider
    async connectWallet(privateKey: string, api_key?: string) {
        required(this.provider, "Provider is not initialized")
        this.wallet = new TronWeb({
            fullHost: "https://api.shasta.trongrid.io",
            privateKey: privateKey,
            headers: { "TRON-PRO-API-KEY": api_key },
        })
    }

    createWallet() {}

    signTransaction(tx: Transaction) {
        required(this.wallet, "Wallet not initialized")

        return this.wallet.trx.sign(tx)
    }
    async sendTransaction(signedTx: SignedTransaction) {
        required(this.wallet, "Wallet not initialized")

        const sentTx = await this.wallet.trx.sendRawTransaction(signedTx)

        if (!sentTx.result) {
            throw new Error("Failed to send transaction")
        }

        return sentTx.transaction.txID
    }
}

export async function testTron() {
    console.log("TESTING TRON")
    const TRON_RPC_URL = "https://api.shasta.trongrid.io"

    const tron = new TRON(TRON_RPC_URL)
    await tron.connect()

    // TODO: Read PK from a file
    tron.connectWallet("<PRIVATE_KEY>")

    console.log("TRON WALLET")
    // console.log(tron.provider)

    const tx = await tron.pay("TVDGpn4hCSzJ5nkHPLetk8KQBtwaTppnkr", "1.5")

    console.log("TRON TX")
    console.log(tx)

    const signedTx = await tron.signTransaction(tx)

    console.log("TRON SIGNED TX")
    console.log(signedTx.signature)

    const txHash = await tron.sendTransaction(signedTx)

    console.log("TRON TX HASH")
    console.log(txHash)
}
