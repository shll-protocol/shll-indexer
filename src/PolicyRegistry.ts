import { ponder } from "ponder:registry";
import { policy, actionRule } from "../ponder.schema";

ponder.on("PolicyRegistry:PolicyCreated", async ({ event, context }) => {
    const { policyId, version, policyModules } = event.args;

    // Fetch detailed schema from contract since it's not in the event
    const schema = await context.client.readContract({
        abi: context.contracts.PolicyRegistry.abi,
        address: context.contracts.PolicyRegistry.address,
        functionName: 'getSchema',
        args: [policyId, version],
    });

    await context.db.insert(policy).values({
        id: `${policyId}-${version}`,
        policyId: Number(policyId),
        version: Number(version),
        maxSlippageBps: schema.maxSlippageBps,
        maxTradeLimit: schema.maxTradeLimit,
        maxDailyLimit: schema.maxDailyLimit,
        allowedTokenGroups: JSON.stringify(schema.allowedTokenGroups),
        allowedDexGroups: JSON.stringify(schema.allowedDexGroups),
        receiverMustBeVault: schema.receiverMustBeVault,
        forbidInfiniteApprove: schema.forbidInfiniteApprove,
        isFrozen: false,
        createdAt: event.block.timestamp,
    }).onConflictDoUpdate({
        maxSlippageBps: schema.maxSlippageBps,
        maxTradeLimit: schema.maxTradeLimit,
        maxDailyLimit: schema.maxDailyLimit,
        allowedTokenGroups: JSON.stringify(schema.allowedTokenGroups),
        allowedDexGroups: JSON.stringify(schema.allowedDexGroups),
        receiverMustBeVault: schema.receiverMustBeVault,
        forbidInfiniteApprove: schema.forbidInfiniteApprove,
    });
});

ponder.on("PolicyRegistry:ActionRuleSet", async ({ event, context }) => {
    const { policyId, version, target, selector, moduleMask } = event.args;
    await context.db.insert(actionRule).values({
        id: `${policyId}-${version}-${target}-${selector}`,
        policyId: Number(policyId),
        version: Number(version),
        target,
        selector,
        moduleMask,
    }).onConflictDoUpdate({
        moduleMask,
    });
});

ponder.on("PolicyRegistry:PolicyFrozen", async ({ event, context }) => {
    const { policyId, version } = event.args;
    await context.db.update(policy, { id: `${policyId}-${version}` }).set({
        isFrozen: true,
    });
});
