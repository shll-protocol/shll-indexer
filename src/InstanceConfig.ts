import { ponder } from "ponder:registry";
import { instanceConfig } from "../ponder.schema";
import { decodeAbiParameters } from "viem";

// I-3 fix: ABI must match Solidity struct order and types exactly
// struct InstanceParams { uint16 slippageBps; uint96 tradeLimit; uint96 dailyLimit; uint32 tokenGroupId; uint32 dexGroupId; uint8 riskTier; }
const InstanceParamsAbi = [
  {
    type: "tuple",
    name: "params",
    components: [
      { name: "slippageBps", type: "uint16" },
      { name: "tradeLimit", type: "uint96" },
      { name: "dailyLimit", type: "uint96" },
      { name: "tokenGroupId", type: "uint32" },
      { name: "dexGroupId", type: "uint32" },
      { name: "riskTier", type: "uint8" },
    ],
  },
] as const;

ponder.on("InstanceConfig:InstanceConfigBound", async ({ event, context }) => {
  const { instanceId, policyId, version, paramsHash } = event.args;

  // Fetch paramsPacked from contract since event only contains paramsHash
  let paramsPacked: `0x${string}` = "0x";
  let slippageBps = 0;
  let tradeLimit = 0n;
  let dailyLimit = 0n;
  let tokenGroupId = 0;
  let dexGroupId = 0;
  let riskTier = 0;

  try {
    const result = await context.client.readContract({
      abi: context.contracts.InstanceConfig.abi,
      address: context.contracts.InstanceConfig.address,
      functionName: 'getInstanceParams',
      args: [instanceId],
    });
    // result = [PolicyRef, bytes paramsPacked]
    paramsPacked = result[1] as `0x${string}`;

    if (paramsPacked && paramsPacked !== "0x") {
      const [params] = decodeAbiParameters(InstanceParamsAbi, paramsPacked);
      slippageBps = params.slippageBps;
      tradeLimit = params.tradeLimit;
      dailyLimit = params.dailyLimit;
      tokenGroupId = params.tokenGroupId;
      dexGroupId = params.dexGroupId;
      riskTier = params.riskTier;
    }
  } catch (e) {
    console.error("Failed to fetch/decode instance params for", instanceId, e);
  }

  await context.db.insert(instanceConfig).values({
    id: instanceId,
    policyId: Number(policyId),
    version: Number(version),
    paramsPacked,
    paramsHash,
    slippageBps,
    tradeLimit,
    dailyLimit,
    tokenGroupId,
    dexGroupId,
    riskTier,
    updatedAt: event.block.timestamp,
  }).onConflictDoUpdate({
    policyId: Number(policyId),
    version: Number(version),
    paramsPacked,
    paramsHash,
    slippageBps,
    tradeLimit,
    dailyLimit,
    tokenGroupId,
    dexGroupId,
    riskTier,
    updatedAt: event.block.timestamp,
  });
});
