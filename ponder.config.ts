import { createConfig } from "ponder";
import { http, fallback } from "viem";

import { ListingManagerAbi } from "./abis/ListingManagerAbi";
import { AgentNFAAbi } from "./abis/AgentNFAAbi";

// Use fallback transport with multiple BSC Testnet RPCs to avoid rate limiting
const bscTestnetTransport = fallback([
  http(process.env.PONDER_RPC_URL_97 ?? "https://data-seed-prebsc-1-s1.binance.org:8545", {
    batch: true,
    retryCount: 5,
    retryDelay: 1000,
  }),
  http("https://data-seed-prebsc-2-s1.binance.org:8545", {
    batch: true,
    retryCount: 3,
    retryDelay: 2000,
  }),
  http("https://data-seed-prebsc-1-s2.binance.org:8545", {
    batch: true,
    retryCount: 3,
    retryDelay: 2000,
  }),
]);

export default createConfig({
  chains: {
    bscTestnet: {
      id: 97,
      rpc: bscTestnetTransport,
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
