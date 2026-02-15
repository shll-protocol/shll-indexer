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

// V1.3: When a template is registered
ponder.on("AgentNFA:TemplateListed", async ({ event, context }) => {
    const { tokenId } = event.args;

    await context.db
        .update(agent, { id: tokenId.toString() })
        .set({ isTemplate: true });
});

// V1.3: When an instance is minted from a template
ponder.on("AgentNFA:InstanceMinted", async ({ event, context }) => {
    const { templateId, instanceId, owner, account } = event.args;

    await context.db
        .insert(agent)
        .values({
            id: instanceId.toString(),
            tokenId: instanceId,
            owner,
            account,
            policyId: "0x" as `0x${string}`, // Will be populated by AgentMinted if also emitted
            isTemplate: false,
            templateId,
            createdAt: event.block.timestamp,
        })
        .onConflictDoUpdate({
            isTemplate: false,
            templateId,
        });
});
