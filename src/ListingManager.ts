import { ponder } from "ponder:registry";
import { listing, rentalHistory } from "../ponder.schema";

// Minimal ABI for reading agent metadata
const getAgentMetadataAbi = [{
    type: "function" as const,
    name: "getAgentMetadata",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{
        type: "tuple",
        components: [
            { name: "persona", type: "string" },
            { name: "experience", type: "string" },
            { name: "voiceHash", type: "string" },
            { name: "animationURI", type: "string" },
            { name: "vaultURI", type: "string" },
            { name: "vaultHash", type: "bytes32" },
        ],
    }],
    stateMutability: "view" as const,
}] as const;

// When a new listing is created on the marketplace
ponder.on("ListingManager:ListingCreated", async ({ event, context }) => {
    const { listingId, nfa, tokenId, pricePerDay, minDays } = event.args;

    // Try to read agent name from on-chain metadata
    let agentName = `Agent #${tokenId}`;
    try {
        const metadata = await context.client.readContract({
            address: nfa,
            abi: getAgentMetadataAbi,
            functionName: "getAgentMetadata",
            args: [tokenId],
        });
        if (metadata && metadata.persona) {
            const parsed = JSON.parse(metadata.persona);
            if (parsed.name) agentName = parsed.name;
        }
    } catch (e) {
        // Fallback to default name if readContract fails (e.g., pruned node)
    }

    await context.db
        .insert(listing)
        .values({
            id: listingId,
            nfa,
            tokenId,
            owner: event.transaction.from,
            pricePerDay: BigInt(pricePerDay),
            minDays: Number(minDays),
            active: true,
            agentName,
            createdAt: event.block.timestamp,
            updatedAt: event.block.timestamp,
        })
        .onConflictDoUpdate({
            active: true,
            pricePerDay: BigInt(pricePerDay),
            minDays: Number(minDays),
            agentName,
            updatedAt: event.block.timestamp,
        });
});

// When an agent is rented
ponder.on("ListingManager:AgentRented", async ({ event, context }) => {
    const { listingId, renter, expires, totalPaid } = event.args;

    // Update listing with rental info
    await context.db
        .update(listing, { id: listingId })
        .set({
            renter,
            expires: BigInt(expires),
            updatedAt: event.block.timestamp,
        });

    // Record rental history
    await context.db
        .insert(rentalHistory)
        .values({
            id: `${event.transaction.hash}-${event.log.logIndex}`,
            listingId,
            renter,
            expires: BigInt(expires),
            totalPaid,
            eventType: "rent",
            timestamp: event.block.timestamp,
            blockNumber: event.block.number,
        });
});

// When a lease is extended
ponder.on("ListingManager:LeaseExtended", async ({ event, context }) => {
    const { listingId, renter, newExpires, totalPaid } = event.args;

    // Update listing with new expiry
    await context.db
        .update(listing, { id: listingId })
        .set({
            expires: BigInt(newExpires),
            updatedAt: event.block.timestamp,
        });

    // Record extension history
    await context.db
        .insert(rentalHistory)
        .values({
            id: `${event.transaction.hash}-${event.log.logIndex}`,
            listingId,
            renter,
            expires: BigInt(newExpires),
            totalPaid,
            eventType: "extend",
            timestamp: event.block.timestamp,
            blockNumber: event.block.number,
        });
});

// When a listing is canceled
ponder.on("ListingManager:ListingCanceled", async ({ event, context }) => {
    const { listingId } = event.args;

    // Use upsert to handle cases where the original ListingCreated event was missed
    // (e.g. indexer started from a later block)
    await context.db
        .insert(listing)
        .values({
            id: listingId,
            nfa: "0x0000000000000000000000000000000000000000", // Placeholder
            tokenId: 0n, // Placeholder
            owner: event.transaction.from, // Best guess
            pricePerDay: 0n,
            minDays: 0,
            active: false,
            createdAt: event.block.timestamp,
            updatedAt: event.block.timestamp,
        })
        .onConflictDoUpdate({
            active: false,
            updatedAt: event.block.timestamp,
        });
});

// V1.3: When a template listing is created
ponder.on("ListingManager:TemplateListingCreated", async ({ event, context }) => {
    const { listingId, nfa, tokenId, pricePerDay, minDays } = event.args;

    // Try to read agent name from on-chain metadata
    let agentName = `Agent #${tokenId}`;
    try {
        const metadata = await context.client.readContract({
            address: nfa,
            abi: getAgentMetadataAbi,
            functionName: "getAgentMetadata",
            args: [tokenId],
        });
        if (metadata && metadata.persona) {
            const parsed = JSON.parse(metadata.persona);
            if (parsed.name) agentName = parsed.name;
        }
    } catch (e) {
        // Fallback to default name
    }

    await context.db
        .insert(listing)
        .values({
            id: listingId,
            nfa,
            tokenId,
            owner: event.transaction.from,
            pricePerDay: BigInt(pricePerDay),
            minDays: Number(minDays),
            active: true,
            isTemplate: true,
            agentName,
            createdAt: event.block.timestamp,
            updatedAt: event.block.timestamp,
        })
        .onConflictDoUpdate({
            active: true,
            isTemplate: true,
            pricePerDay: BigInt(pricePerDay),
            minDays: Number(minDays),
            agentName,
            updatedAt: event.block.timestamp,
        });
});

// V1.3: When a Rent-to-Mint instance is rented
ponder.on("ListingManager:InstanceRented", async ({ event, context }) => {
    const { listingId, renter, instanceTokenId, instanceAccount, expires, totalPaid } = event.args;

    // Record rental history
    await context.db
        .insert(rentalHistory)
        .values({
            id: `${event.transaction.hash}-${event.log.logIndex}`,
            listingId,
            renter,
            expires: BigInt(expires),
            totalPaid,
            eventType: "rent-to-mint",
            timestamp: event.block.timestamp,
            blockNumber: event.block.number,
        });
});
