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
      rpc: http("https://bnb-testnet.g.alchemy.com/v2/CVaHvQCguUQe5C-mRLHWe5qzcCmPkA1T", {
        batch: {
          batchSize: 100, // Very small batch size to avoid "Response too large" or timeouts
          wait: 500,     // Wait 500ms between batches to rate limit ourselves
        },
        retryCount: 5,
        retryDelay: 2000,
      }),
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
