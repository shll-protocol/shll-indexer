import { onchainTable, index } from "ponder";

// Listings on the marketplace
export const listing = onchainTable("listing", (t) => ({
  // listingId (bytes32) as primary key
  id: t.hex().primaryKey(),
  nfa: t.hex().notNull(),
  tokenId: t.bigint().notNull(),
  owner: t.hex().notNull(),
  pricePerDay: t.bigint().notNull(),
  minDays: t.integer().notNull(),
  active: t.boolean().notNull().default(true),
  // Current rental info (updated on rent/extend)
  renter: t.hex(),
  expires: t.bigint(),
  // Metadata (enriched from on-chain read)
  agentName: t.text().default("Unknown Agent"),
  // Timestamps
  createdAt: t.bigint().notNull(),
  updatedAt: t.bigint().notNull(),
}), (table) => ({
  activeIdx: index().on(table.active),
  nfaIdx: index().on(table.nfa),
  ownerIdx: index().on(table.owner),
}));

// Agents (NFTs minted)
export const agent = onchainTable("agent", (t) => ({
  // tokenId as string primary key
  id: t.text().primaryKey(),
  tokenId: t.bigint().notNull(),
  owner: t.hex().notNull(),
  account: t.hex().notNull(),
  policyId: t.hex().notNull(),
  createdAt: t.bigint().notNull(),
}));

// Rental history records
export const rentalHistory = onchainTable("rental_history", (t) => ({
  id: t.text().primaryKey(), // txHash-logIndex
  listingId: t.hex().notNull(),
  renter: t.hex().notNull(),
  expires: t.bigint().notNull(),
  totalPaid: t.bigint().notNull(),
  eventType: t.text().notNull(), // "rent" | "extend"
  timestamp: t.bigint().notNull(),
  blockNumber: t.bigint().notNull(),
}), (table) => ({
  listingIdx: index().on(table.listingId),
  renterIdx: index().on(table.renter),
}));

// Agent execution activity (source of truth for Console Activity panel)
export const executionHistory = onchainTable("execution_history", (t) => ({
  id: t.text().primaryKey(), // txHash-logIndex
  tokenId: t.bigint().notNull(),
  caller: t.hex().notNull(),
  account: t.hex().notNull(),
  target: t.hex().notNull(),
  selector: t.hex().notNull(), // bytes4
  success: t.boolean().notNull(),
  result: t.hex().notNull(),
  txHash: t.hex().notNull(),
  logIndex: t.integer().notNull(),
  blockNumber: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}), (table) => ({
  tokenIdx: index().on(table.tokenId, table.timestamp),
  txIdx: index().on(table.txHash),
}));
