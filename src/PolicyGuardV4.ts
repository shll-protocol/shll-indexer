import { ponder } from "ponder:registry";
import { templatePolicy, policyPlugin, commitFailure } from "../ponder.schema";

// ═══════════════════════════════════════════════════════
// IPolicy interface — for reading policyType() from plugin contracts
// ═══════════════════════════════════════════════════════

const IPolicyAbi = [
    {
        type: "function",
        name: "policyType",
        inputs: [],
        outputs: [{ name: "", type: "bytes32" }],
        stateMutability: "pure",
    },
] as const;

/**
 * Read policyType() from a policy contract and decode bytes32 → string.
 * Falls back to "unknown" if the call fails.
 */
async function readPolicyType(
    client: { readContract: (args: unknown) => Promise<unknown> },
    policyAddress: `0x${string}`,
): Promise<string> {
    try {
        const raw = await client.readContract({
            abi: IPolicyAbi,
            address: policyAddress,
            functionName: "policyType",
        }) as `0x${string}`;
        // Decode bytes32 → trimmed ASCII string
        const hex = raw.replace(/0+$/, "");
        if (hex.length <= 2) return "unknown";
        const buf = Buffer.from(hex.slice(2), "hex");
        return buf.toString("utf8").replace(/\0/g, "");
    } catch {
        return "unknown";
    }
}

// ═══════════════════════════════════════════════════════
//              TEMPLATE POLICY EVENTS
// ═══════════════════════════════════════════════════════

ponder.on("PolicyGuardV4:TemplatePolicyAdded", async ({ event, context }) => {
    const { templateId, policy } = event.args;
    const policyType = await readPolicyType(context.client as never, policy);

    await context.db.insert(templatePolicy).values({
        id: `${templateId}-${policy}`,
        templateId,
        policyAddress: policy,
        policyType,
        addedAt: event.block.timestamp,
    }).onConflictDoNothing();
});

ponder.on("PolicyGuardV4:TemplatePolicyRemoved", async ({ event, context }) => {
    const { templateId, policy } = event.args;
    const id = `${templateId}-${policy}`;

    try {
        await context.db.delete(templatePolicy, { id });
    } catch {
        // Row may not exist if we started indexing mid-stream
        console.warn(`templatePolicy ${id} not found for deletion`);
    }
});

// ═══════════════════════════════════════════════════════
//              INSTANCE POLICY EVENTS
// ═══════════════════════════════════════════════════════

ponder.on("PolicyGuardV4:InstancePolicyAdded", async ({ event, context }) => {
    const { instanceId, policy } = event.args;
    const policyType = await readPolicyType(context.client as never, policy);

    await context.db.insert(policyPlugin).values({
        id: `${instanceId}-${policy}`,
        instanceId,
        policyAddress: policy,
        policyType,
        isCustom: true, // Explicitly added by renter
        addedAt: event.block.timestamp,
    }).onConflictDoNothing();
});

ponder.on("PolicyGuardV4:InstancePolicyRemoved", async ({ event, context }) => {
    const { instanceId, policy } = event.args;
    const id = `${instanceId}-${policy}`;

    try {
        await context.db.delete(policyPlugin, { id });
    } catch {
        console.warn(`policyPlugin ${id} not found for deletion`);
    }
});

// ═══════════════════════════════════════════════════════
//              INSTANCE BINDING
// ═══════════════════════════════════════════════════════

ponder.on("PolicyGuardV4:InstanceBound", async ({ event, context }) => {
    const { instanceId, templateId } = event.args;

    // Read template policies from contract and replicate to instance
    try {
        const policies = await context.client.readContract({
            abi: context.contracts.PolicyGuardV4.abi,
            address: context.contracts.PolicyGuardV4.address,
            functionName: "getTemplatePolicies",
            args: [templateId],
        }) as `0x${string}`[];

        for (const policy of policies) {
            const policyType = await readPolicyType(context.client as never, policy);
            await context.db.insert(policyPlugin).values({
                id: `${instanceId}-${policy}`,
                instanceId,
                policyAddress: policy,
                policyType,
                isCustom: false, // Inherited from template
                addedAt: event.block.timestamp,
            }).onConflictDoNothing();
        }
    } catch (err) {
        console.error(
            `Failed to read template policies for instance ${instanceId}, template ${templateId}:`,
            err,
        );
    }
});

// ═══════════════════════════════════════════════════════
//         P-2026-032: COMMIT FAILURES
// ═══════════════════════════════════════════════════════

ponder.on("PolicyGuardV4:CommitFailed", async ({ event, context }) => {
    const { instanceId, policy, reason } = event.args;

    await context.db.insert(commitFailure).values({
        id: `${event.transaction.hash}-${event.log.logIndex}`,
        instanceId,
        policyAddress: policy,
        reason: reason as `0x${string}`,
        txHash: event.transaction.hash,
        blockNumber: event.block.number,
        timestamp: event.block.timestamp,
    }).onConflictDoNothing();
});
