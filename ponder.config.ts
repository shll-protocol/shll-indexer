import { createConfig } from "ponder";

import { ListingManagerAbi } from "./abis/ListingManagerAbi";
import { AgentNFAAbi } from "./abis/AgentNFAAbi";

const rpcUrl = process.env.PONDER_RPC_URL_97 ?? "https://bsctestapi.terminet.io/rpc";
const maxRequestsPerSecond = Number(process.env.MAX_REQUESTS_PER_SECOND ?? 1);
const pollingInterval = Number(process.env.POLLING_INTERVAL_MS ?? 10_000);
const ethGetLogsBlockRange = Number(process.env.ETH_GET_LOGS_BLOCK_RANGE ?? 1);

console.log("DEBUG: PONDER_RPC_URL_97 =", rpcUrl);
console.log("DEBUG: MAX_RPS =", maxRequestsPerSecond);
console.log("DEBUG: POLLING_INTERVAL_MS =", pollingInterval);
console.log("DEBUG: ETH_GET_LOGS_BLOCK_RANGE =", ethGetLogsBlockRange);

export default createConfig({
  chains: {
    bscTestnet: {
      id: 97,
      // Pass RPC as string — let Ponder manage the transport internally
      rpc: rpcUrl,
      // Throttle and shrink log windows for strict public RPC providers
      maxRequestsPerSecond,
      pollingInterval,
      ethGetLogsBlockRange,
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
