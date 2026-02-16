import { ponder } from "ponder:registry";
import { spendHistory } from "../ponder.schema";

ponder.on("PolicyGuardV2:Spent", async ({ event, context }) => {
    const { instanceId, amount, dayIndex } = event.args;
    await context.db.insert(spendHistory).values({
        id: `${event.transaction.hash}-${event.log.logIndex}`,
        instanceId,
        amount,
        dayIndex: Number(dayIndex),
        txHash: event.transaction.hash,
        timestamp: event.block.timestamp,
    });
});
