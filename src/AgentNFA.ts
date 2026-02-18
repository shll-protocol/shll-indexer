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

// V3.0: When an agent's type is set or updated
// V3.0 uses keccak256("dca") hashes, NOT right-padded ASCII bytes32
const AGENT_TYPE_MAP: Record<string, string> = {
    "0x072fb5d9648043d2fc65e3b92ab24cc0a0e09bc6e9dd0a8b17d995f1c67e5523": "dca",
    "0xf03a8666449c9c4b8d4441d97da812c3ac61312ec971e34d97c6cc4ecd34eaa8": "llm_trader",
    // Add more as needed
};

ponder.on("AgentNFA:AgentTypeSet", async ({ event, context }) => {
    const { tokenId, agentType } = event.args;
    const hex = (agentType as string).toLowerCase();
    // Try keccak256 hash lookup first (V3.0)
    let decoded = AGENT_TYPE_MAP[hex];
    if (!decoded) {
        // Fallback: try to decode as right-padded ASCII (V1.5 compat)
        const trimmed = hex.replace(/0+$/, "");
        if (trimmed.length > 2) {
            try {
                const buf = Buffer.from(trimmed.slice(2), "hex");
                const ascii = buf.toString("utf8").replace(/\0/g, "");
                // Only use if it looks like a valid ASCII label
                if (/^[a-z0-9_]+$/i.test(ascii)) {
                    decoded = ascii;
                }
            } catch {
                // ignore decode errors
            }
        }
        if (!decoded) decoded = `0x${hex.slice(2, 10)}`;
    }

    await context.db
        .update(agent, { id: tokenId.toString() })
        .set({ agentType: decoded });
});

