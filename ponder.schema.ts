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
  // V1.3 Rent-to-Mint
  isTemplate: t.boolean().notNull().default(false),
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
  policyId: t.hex(),                        // V3 compat, V4 no longer uses this
  agentType: t.text().default("unknown"),   // "dca" | "llm_trader" | "llm_defi" | "hot_token"
  // V1.3 Rent-to-Mint
  isTemplate: t.boolean().notNull().default(false),
  templateId: t.bigint(), // non-null only for instances
  // BAP-578 pause support
  paused: t.boolean().default(false),
  createdAt: t.bigint().notNull(),
}), (table) => ({
  typeIdx: index().on(table.agentType),
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

// ═══════════════════════════════════════════════════════
// V3.0: PolicyGuardV4 — Composable Policy Plugin tables
// ═══════════════════════════════════════════════════════

// Agent-bound policy plugin assignments (per-instance)
export const policyPlugin = onchainTable("policy_plugin", (t) => ({
  id: t.text().primaryKey(),          // "{instanceId}-{policyAddress}"
  instanceId: t.bigint().notNull(),
  policyAddress: t.hex().notNull(),
  policyType: t.text().notNull(),     // "token_whitelist" | "spending_limit" | etc.
  isCustom: t.boolean().notNull(),    // true = renter-configured, false = template-inherited
  addedAt: t.bigint().notNull(),
}), (table) => ({
  instanceIdx: index().on(table.instanceId),
  typeIdx: index().on(table.policyType),
}));

// Template policy compositions (owner-defined ceilings)
export const templatePolicy = onchainTable("template_policy", (t) => ({
  id: t.text().primaryKey(),          // "{templateId}-{policyAddress}"
  templateId: t.hex().notNull(),      // bytes32
  policyAddress: t.hex().notNull(),
  policyType: t.text().notNull(),
  addedAt: t.bigint().notNull(),
}), (table) => ({
  templateIdx: index().on(table.templateId),
}));

// V1.4: Group Registry tables (retained: DEX/Token whitelists still in use)
export const groupMember = onchainTable("group_member", (t) => ({
  id: t.text().primaryKey(), // type-groupId-address
  type: t.text().notNull(), // "token" | "dex"
  groupId: t.integer().notNull(),
  address: t.hex().notNull(),
  allowed: t.boolean().notNull(),
  updatedAt: t.bigint().notNull(),
}));

// V1.4: Spend tracking (retained: SpendingLimitPolicy still uses this)
export const spendHistory = onchainTable("spend_history", (t) => ({
  id: t.text().primaryKey(), // txHash-logIndex
  instanceId: t.bigint().notNull(),
  amount: t.bigint().notNull(),
  dayIndex: t.integer().notNull(),
  txHash: t.hex().notNull(),
  timestamp: t.bigint().notNull(),
}), (table) => ({
  instanceIdx: index().on(table.instanceId, table.timestamp),
}));

// P-2026-032: PolicyGuardV4 commit failures (post-execution policy errors)
export const commitFailure = onchainTable("commit_failure", (t) => ({
  id: t.text().primaryKey(),          // txHash-logIndex
  instanceId: t.bigint().notNull(),
  policyAddress: t.hex().notNull(),
  reason: t.hex().notNull(),          // raw bytes reason from revert
  txHash: t.hex().notNull(),
  blockNumber: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
}), (table) => ({
  instanceIdx: index().on(table.instanceId, table.timestamp),
}));

