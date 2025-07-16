import GCROperation from "src/libs/blockchain/gcr/types/GCROperations"
import { EntityTarget, Repository, FindOptionsOrder } from "typeorm"
import Datasource from "../../../../model/datasource"
import Hashing from "src/libs/crypto/hashing"
import { GCRSubnetsTxs } from "../../../../model/entities/GCRv2/GCRSubnetsTxs"
import { GlobalChangeRegistry } from "../../../../model/entities/GCR/GlobalChangeRegistry"
import { GCRHashes } from "../../../../model/entities/GCRv2/GCRHashes"
import { GCRTracker } from "src/model/entities/GCR/GCRTracker"
import { GCRLogicExecutions } from "../../../../model/entities/GCRv2/GCRLogicExecutions"

// TODO Call the GCR methods to apply the operation to the GCR tables
// TODO See if we can have a diff of the DB tables and apply only the changes

export default async function applyGCROperation(
    operation: GCROperation,
): Promise<boolean> {
    try {
        const db = await Datasource.getInstance()

        // Handle different operation types
        if (
            operation.data &&
            typeof operation.data === "object" &&
            operation.data.type === "logic_execution"
        ) {
            // Handle logic execution operations
            const gcrLogicExecutionsRepository: Repository<GCRLogicExecutions> =
                db.getDataSource().getRepository(GCRLogicExecutions)

            // TODO: Store logic execution data in GCRLogicExecutions table
            // This is where we would store the request ID, transaction data, etc.
            // For now, just log that we received a logic execution operation
            console.log(
                `[applyGCROperation] Logic execution operation for address: ${operation.address}`,
            )
            console.log(
                `[applyGCROperation] Request ID: ${operation.data.requestId}`,
            )

            return true
        }

        // Handle other operation types (existing logic)
        const gcrTrackerRepository: Repository<GCRTracker> = db
            .getDataSource()
            .getRepository(GCRTracker)
        const gcrHashesRepository: Repository<GCRHashes> = db
            .getDataSource()
            .getRepository(GCRHashes)
        const gcrSubnetsTxsRepository: Repository<GCRSubnetsTxs> = db
            .getDataSource()
            .getRepository(GCRSubnetsTxs)
        const globalChangeRegistryRepository: Repository<GlobalChangeRegistry> =
            db.getDataSource().getRepository(GlobalChangeRegistry)

        // TODO Examine the operation and apply it to the GCR tables
        // TODO Update the GCR hashes
        // ? Is there a way to return a diff of the GCR tables?
        return true
    } catch (error) {
        console.error(
            "[applyGCROperation] Error applying GCR operation:",
            error,
        )
        return false
    }
}
