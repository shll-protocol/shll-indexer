import { createConfig } from "ponder";

import { ListingManagerAbi } from "./abis/ListingManagerAbi";
import { AgentNFAAbi } from "./abis/AgentNFAAbi";

const rpcUrl = process.env.PONDER_RPC_URL_97 ?? "https://bsctestapi.terminet.io/rpc";

console.log("DEBUG: PONDER_RPC_URL_97 =", rpcUrl);
console.log("DEBUG: MAX_RPS =", process.env.MAX_REQUESTS_PER_SECOND);

export default createConfig({
  chains: {
    bscTestnet: {
      id: 97,
      // Pass RPC as string — let Ponder manage the transport internally
      rpc: rpcUrl,
      // Throttle requests to avoid rate limits on free-tier RPC nodes
      maxRequestsPerSecond: Number(process.env.MAX_REQUESTS_PER_SECOND ?? 1),
      // Increase polling interval to reduce load (default 1s is too aggressive)
      pollingInterval: 5_000,
      // Limit block range for eth_getLogs to avoid "limit exceeded" errors
      ethGetLogsBlockRange: 5,
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
