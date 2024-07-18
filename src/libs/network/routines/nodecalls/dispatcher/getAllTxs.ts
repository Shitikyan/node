import Datasource from "src/model/datasource"
import { Transactions } from "src/model/entities/Transactions"

export async function getAllTxs(): Promise<Transactions[]> {
    const db = await Datasource.getInstance()
    const transactionRepository = db
        .getDataSource()
        .getRepository(Transactions)
    return await transactionRepository.find()
}