import { createConfig } from "ponder";
import { http, fallback } from "viem";

import { ListingManagerAbi } from "./abis/ListingManagerAbi";
import { AgentNFAAbi } from "./abis/AgentNFAAbi";

// PublicNode.com has generous rate limits for BSC Testnet
// Binance nodes as fallback
const bscTestnetTransport = fallback([
  http(process.env.PONDER_RPC_URL_97 ?? "https://bsc-testnet-rpc.publicnode.com", {
    retryCount: 5,
    retryDelay: 2000,
  }),
  http("https://bsc-testnet.public.blastapi.io", {
    retryCount: 3,
    retryDelay: 3000,
  }),
  http("https://endpoints.omniatech.io/v1/bsc/testnet/public", {
    retryCount: 3,
    retryDelay: 3000,
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
