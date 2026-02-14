import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { client, graphql } from "ponder";
import { cors } from "hono/cors";
import { desc, eq } from "ponder";

const app = new Hono();

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

// GET /api/listings - All active listings
app.get("/api/listings", async (c) => {
    const listings = await db
        .select()
        .from(schema.listing)
        .where(eq(schema.listing.active, true))
        .orderBy(desc(schema.listing.createdAt));

    return c.json({
        items: listings.map((l) => ({
            ...l,
            // Serialize bigints as strings for JSON compatibility
            tokenId: l.tokenId.toString(),
            pricePerDay: l.pricePerDay.toString(),
            expires: l.expires?.toString() ?? null,
            createdAt: l.createdAt.toString(),
            updatedAt: l.updatedAt.toString(),
        })),
        count: listings.length,
    });
});

// GET /api/agents - All minted agents
app.get("/api/agents", async (c) => {
    const agents = await db
        .select()
        .from(schema.agent)
        .orderBy(desc(schema.agent.createdAt));

    return c.json({
        items: agents.map((a) => ({
            ...a,
            tokenId: a.tokenId.toString(),
            createdAt: a.createdAt.toString(),
        })),
        count: agents.length,
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
    try {
        const agents = await db.select().from(schema.agent).limit(1);
        return c.json({
            status: "ok",
            chain: "bsc-testnet",
            chainId: 97,
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
            chain: "bsc-testnet",
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

export default app;
