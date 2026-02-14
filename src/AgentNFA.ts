import { ponder } from "ponder:registry";
import { agent, executionHistory } from "../ponder.schema";

// When a new agent NFT is minted
ponder.on("AgentNFA:AgentMinted", async ({ event, context }) => {
    const { tokenId, owner, account, policyId } = event.args;

    await context.db
        .insert(agent)
        .values({
            id: tokenId.toString(),
            tokenId,
            owner,
            account,
            policyId,
            createdAt: event.block.timestamp,
        })
        .onConflictDoNothing();
});

// Track execute() activity for console timeline and auditing.
ponder.on("AgentNFA:Executed", async ({ event, context }) => {
    const { tokenId, caller, account, target, selector, success, result } = event.args;

    await context.db
        .insert(executionHistory)
        .values({
            id: `${event.transaction.hash}-${event.log.logIndex}`,
            tokenId,
            caller,
            account,
            target,
            selector,
            success,
            result,
            txHash: event.transaction.hash,
            logIndex: Number(event.log.logIndex),
            blockNumber: event.block.number,
            timestamp: event.block.timestamp,
        })
        .onConflictDoNothing();
});
