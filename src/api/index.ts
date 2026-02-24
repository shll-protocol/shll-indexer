import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { client, graphql } from "ponder";
import { cors } from "hono/cors";
import { desc, eq } from "ponder";

const app = new Hono();
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Enable CORS for frontend access
app.use(
    "*",
    cors({
        origin: "*",
        allowMethods: ["GET", "POST", "OPTIONS"],
        allowHeaders: ["Content-Type"],
    })
);

// Ponder SQL client
app.use("/sql/*", client({ db, schema }));

// GraphQL endpoints
app.use("/", graphql({ db, schema }));
app.use("/graphql", graphql({ db, schema }));

// --- Custom REST API endpoints ---

// GET /api/listings - All active listings (enriched with agent data)
app.get("/api/listings", async (c) => {
    const listings = await db
        .select()
        .from(schema.listing)
        .where(eq(schema.listing.active, true))
        .orderBy(desc(schema.listing.createdAt));

    // Guard against placeholder rows created by missed historical events.
    const filtered = listings.filter(
        (l) => l.nfa.toLowerCase() !== ZERO_ADDRESS && l.isTemplate === true
    );

    // Batch-lookup agentType from agent table
    const agents = await db.select().from(schema.agent);
    const agentMap = new Map(agents.map((a) => [a.tokenId.toString(), a]));

    return c.json({
        items: filtered.map((l) => {
            const agent = agentMap.get(l.tokenId.toString());
            return {
                ...l,
                // Serialize bigints as strings for JSON compatibility
                tokenId: l.tokenId.toString(),
                pricePerDay: l.pricePerDay.toString(),
                expires: l.expires?.toString() ?? null,
                createdAt: l.createdAt.toString(),
                updatedAt: l.updatedAt.toString(),
                // Enriched fields from agent table
                agentType: agent?.agentType ?? null,
            };
        }),
        count: filtered.length,
    });
});

// GET /api/agents - All minted agents (supports ?type= filter)
app.get("/api/agents", async (c) => {
    const typeFilter = c.req.query("type");
    const agents = await db
        .select()
        .from(schema.agent)
        .orderBy(desc(schema.agent.createdAt));

    // Fallback for historical index gaps:
    // if a token has ever appeared in a template listing, treat it as template in API response.
    const templateListings = await db
        .select()
        .from(schema.listing)
        .where(eq(schema.listing.isTemplate, true));
    const templateTokenIds = new Set(templateListings.map((l) => l.tokenId.toString()));

    // Apply agentType filter if provided
    const filtered = typeFilter
        ? agents.filter((a) => a.agentType === typeFilter)
        : agents;

    return c.json({
        items: filtered.map((a) => ({
            ...a,
            tokenId: a.tokenId.toString(),
            isTemplate: a.isTemplate || templateTokenIds.has(a.tokenId.toString()),
            createdAt: a.createdAt.toString(),
        })),
        count: filtered.length,
    });
});

// GET /api/rentals/:address - Rental history by renter address
app.get("/api/rentals/:address", async (c) => {
    const address = c.req.param("address").toLowerCase() as `0x${string}`;
    const rentals = await db
        .select()
        .from(schema.rentalHistory)
        .where(eq(schema.rentalHistory.renter, address))
        .orderBy(desc(schema.rentalHistory.timestamp));

    return c.json({
        items: rentals.map((r) => ({
            ...r,
            expires: r.expires.toString(),
            totalPaid: r.totalPaid.toString(),
            timestamp: r.timestamp.toString(),
            blockNumber: r.blockNumber.toString(),
        })),
        count: rentals.length,
    });
});

// GET /api/activity/:tokenId - Execution activity by tokenId
app.get("/api/activity/:tokenId", async (c) => {
    const tokenIdRaw = c.req.param("tokenId");
    if (!/^\d+$/.test(tokenIdRaw)) {
        return c.json({ error: "invalid tokenId" }, 400);
    }

    const limitRaw = c.req.query("limit");
    let limit = 20;
    if (limitRaw != null) {
        const parsed = Number.parseInt(limitRaw, 10);
        if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 200) {
            return c.json({ error: "limit must be an integer between 1 and 200" }, 400);
        }
        limit = parsed;
    }

    const rows = await db
        .select()
        .from(schema.executionHistory)
        .where(eq(schema.executionHistory.tokenId, BigInt(tokenIdRaw)))
        .orderBy(desc(schema.executionHistory.blockNumber), desc(schema.executionHistory.logIndex))
        .limit(limit);

    return c.json({
        items: rows.map((r) => ({
            ...r,
            tokenId: r.tokenId.toString(),
            blockNumber: r.blockNumber.toString(),
            timestamp: r.timestamp.toString(),
        })),
        count: rows.length,
    });
});

// GET /api/health — Liveness probe
app.get("/api/health", async (c) => {
    const chainId = Number(process.env.CHAIN_ID ?? "97");
    const chainName = chainId === 56 ? "bsc-mainnet" : "bsc-testnet";
    try {
        const agents = await db.select().from(schema.agent).limit(1);
        return c.json({
            status: "ok",
            chain: chainName,
            chainId,
            hasData: agents.length > 0,
            timestamp: Date.now(),
        });
    } catch (err) {
        return c.json(
            { status: "error", message: err instanceof Error ? err.message : "unknown" },
            503
        );
    }
});

// GET /api/ready — Readiness probe (sync status)
app.get("/api/ready", async (c) => {
    const chainId = Number(process.env.CHAIN_ID ?? "97");
    const chainName = chainId === 56 ? "bsc-mainnet" : "bsc-testnet";
    try {
        // Latest indexed block from rental_history
        const latestRental = await db
            .select()
            .from(schema.rentalHistory)
            .orderBy(desc(schema.rentalHistory.blockNumber))
            .limit(1);

        // Latest indexed block from agents
        const latestAgent = await db
            .select()
            .from(schema.agent)
            .orderBy(desc(schema.agent.createdAt))
            .limit(1);

        const rentalBlock = latestRental[0]?.blockNumber ?? 0n;
        const agentTs = latestAgent[0]?.createdAt ?? 0n;

        // Confirmations threshold (20 blocks for BSC)
        const CONFIRMATIONS = 20;

        return c.json({
            status: "ok",
            chain: chainName,
            chainId,
            checkpoint: rentalBlock.toString(),
            latestAgentTimestamp: agentTs.toString(),
            confirmations: CONFIRMATIONS,
            ready: true,
            timestamp: Date.now(),
        });
    } catch (err) {
        return c.json(
            { status: "error", ready: false, message: err instanceof Error ? err.message : "unknown" },
            503
        );
    }
});
// --- V3.0 API endpoints ---

// GET /api/agents/:tokenId/policies - Policy plugins for an agent instance
app.get("/api/agents/:tokenId/policies", async (c) => {
    const tokenIdRaw = c.req.param("tokenId");
    if (!/^\d+$/.test(tokenIdRaw)) {
        return c.json({ error: "invalid tokenId" }, 400);
    }

    const rows = await db
        .select()
        .from(schema.policyPlugin)
        .where(eq(schema.policyPlugin.instanceId, BigInt(tokenIdRaw)));

    return c.json({
        tokenId: tokenIdRaw,
        items: rows.map((r) => ({
            ...r,
            instanceId: r.instanceId.toString(),
            addedAt: r.addedAt.toString(),
        })),
        count: rows.length,
    });
});

// GET /api/agents/:tokenId/summary - Aggregated execution stats
app.get("/api/agents/:tokenId/summary", async (c) => {
    const tokenIdRaw = c.req.param("tokenId");
    if (!/^\d+$/.test(tokenIdRaw)) {
        return c.json({ error: "invalid tokenId" }, 400);
    }

    const tokenId = BigInt(tokenIdRaw);
    const executions = await db
        .select()
        .from(schema.executionHistory)
        .where(eq(schema.executionHistory.tokenId, tokenId))
        .orderBy(desc(schema.executionHistory.timestamp));

    const total = executions.length;
    const success = executions.filter((e) => e.success).length;

    return c.json({
        tokenId: tokenIdRaw,
        totalExecutions: total,
        successRate: total > 0 ? Math.round((success / total) * 10000) / 100 : 0,
        successCount: success,
        failCount: total - success,
        lastExecution: executions[0]?.timestamp?.toString() ?? null,
    });
});

// GET /api/stats - Global agent/listing statistics
app.get("/api/stats", async (c) => {
    const agents = await db.select().from(schema.agent);
    const listings = await db
        .select()
        .from(schema.listing)
        .where(eq(schema.listing.active, true));

    // Group agents by agentType
    const byType: Record<string, number> = {};
    for (const a of agents) {
        const t = a.agentType ?? "unknown";
        byType[t] = (byType[t] ?? 0) + 1;
    }

    return c.json({
        totalAgents: agents.length,
        totalTemplates: agents.filter((a) => a.isTemplate).length,
        activeListings: listings.length,
        agentsByType: byType,
    });
});

// P-2026-032: GET /api/agents/:tokenId/commit-failures — PolicyGuardV4 commit failures
app.get("/api/agents/:tokenId/commit-failures", async (c) => {
    const tokenIdRaw = c.req.param("tokenId");
    if (!/^\d+$/.test(tokenIdRaw)) {
        return c.json({ error: "invalid tokenId" }, 400);
    }

    const limitRaw = c.req.query("limit");
    const limit = Math.min(Math.max(1, Number(limitRaw ?? 50)), 200);

    const rows = await db
        .select()
        .from(schema.commitFailure)
        .where(eq(schema.commitFailure.instanceId, BigInt(tokenIdRaw)))
        .orderBy(desc(schema.commitFailure.timestamp))
        .limit(limit);

    return c.json({
        tokenId: tokenIdRaw,
        items: rows.map((r) => ({
            ...r,
            instanceId: r.instanceId.toString(),
            blockNumber: r.blockNumber.toString(),
            timestamp: r.timestamp.toString(),
        })),
        count: rows.length,
    });
});

// GET /api/groups/:type/:groupId - Group members (token/dex) — retained from V1.4
app.get("/api/groups/:type/:groupId", async (c) => {
    const type = c.req.param("type");
    const groupIdRaw = c.req.param("groupId");
    if (!["token", "dex"].includes(type)) {
        return c.json({ error: "type must be 'token' or 'dex'" }, 400);
    }
    if (!/^\d+$/.test(groupIdRaw)) {
        return c.json({ error: "invalid groupId" }, 400);
    }

    const allMembers = await db
        .select()
        .from(schema.groupMember)
        .where(eq(schema.groupMember.type, type));

    const filtered = allMembers.filter(
        (m) => m.groupId === Number(groupIdRaw),
    );

    return c.json({
        type,
        groupId: Number(groupIdRaw),
        members: filtered.map((m) => ({
            address: m.address,
            allowed: m.allowed,
            updatedAt: m.updatedAt.toString(),
        })),
        count: filtered.length,
    });
});

export default app;
