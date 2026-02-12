import { createConfig } from "ponder";
import { http } from "viem";

import { ListingManagerAbi } from "./abis/ListingManagerAbi";
import { AgentNFAAbi } from "./abis/AgentNFAAbi";

console.log("DEBUG: PONDER_RPC_URL_97 =", process.env.PONDER_RPC_URL_97);
console.log("DEBUG: RPC_BATCH_SIZE =", process.env.RPC_BATCH_SIZE);
console.log("DEBUG: RPC_WAIT_MS =", process.env.RPC_WAIT_MS);

// Try Alchemy again with strict batching to avoid query errors
// Note: Alchemy free tier on BSC Testnet might still fail on old history
export default createConfig({
  chains: {
    bscTestnet: {
      id: 97,
      rpc: http(process.env.PONDER_RPC_URL_97 ?? "https://bnb-testnet.g.alchemy.com/v2/CVaHvQCguUQe5C-mRLHWe5qzcCmPkA1T", {
        batch: {
          batchSize: Number(process.env.RPC_BATCH_SIZE ?? 50),
          wait: Number(process.env.RPC_WAIT_MS ?? 1000),
        },
        retryCount: Number(process.env.RPC_RETRY_COUNT ?? 10),
        retryDelay: Number(process.env.RPC_RETRY_DELAY ?? 3000),
      }),
      ethGetLogsBlockRange: Number(process.env.ETH_GET_LOGS_BLOCK_RANGE ?? 2000),
    },
  },
  contracts: {
    ListingManager: {
      chain: "bscTestnet",
      abi: ListingManagerAbi,
      address: "0x599917b3df76b9A599b4C6f58E6aE5adE9b185B5",
      startBlock: 89967916,
    },
    AgentNFA: {
      chain: "bscTestnet",
      abi: AgentNFAAbi,
      address: "0x30Ba562CE38fbD0ff300Dfc4b0271fe9c40C4cf0",
      startBlock: 89967916,
    },
  },
});
