import { createConfig } from "ponder";
import { http } from "viem";

import { ListingManagerAbi } from "./abis/ListingManagerAbi";
import { AgentNFAAbi } from "./abis/AgentNFAAbi";

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
      address: "0x43e4c56548bf43917516ec55bc6ec5ba4faadd1b",
      startBlock: 89798900,
    },
    AgentNFA: {
      chain: "bscTestnet",
      abi: AgentNFAAbi,
      address: "0x3a4f53ce6b3493a20a445baffe7bc43accebfaf6",
      startBlock: 89798900,
    },
  },
});
