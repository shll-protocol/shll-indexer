import { ponder } from "ponder:registry";
import { agent, learningHistory } from "../ponder.schema";

// BAP-578: When a PoP batch is appended (LearningRootUpdated event)
ponder.on("LearningModule:LearningRootUpdated", async ({ event, context }) => {
    const { tokenId, newRoot, leafCount } = event.args;

    // Insert learning history record
    await context.db
        .insert(learningHistory)
        .values({
            id: `${event.transaction.hash}-${event.log.logIndex}`,
            tokenId,
            newRoot,
            leafCount,
            txHash: event.transaction.hash,
            blockNumber: event.block.number,
            timestamp: event.block.timestamp,
        })
        .onConflictDoNothing();

    // Update agent's learning state
    await context.db
        .update(agent, { id: tokenId.toString() })
        .set({
            learningRoot: newRoot,
            learningLeaves: leafCount,
        });
});

// BAP-578: When learning is enabled/disabled for an agent
ponder.on("LearningModule:LearningStateChanged", async ({ event, context }) => {
    const { tokenId, enabled } = event.args;

    await context.db
        .update(agent, { id: tokenId.toString() })
        .set({ learningEnabled: enabled });
});
