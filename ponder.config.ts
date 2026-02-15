import { createConfig } from "ponder";
import { http, type Transport } from "viem";

import { ListingManagerAbi } from "./abis/ListingManagerAbi";
import { AgentNFAAbi } from "./abis/AgentNFAAbi";

const rpcEnv = process.env.PONDER_RPC_URLS_97 ?? process.env.PONDER_RPC_URL_97 ?? "https://bsctestapi.terminet.io/rpc";
const rpcCandidates = rpcEnv
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const listingManagerAddress =
  process.env.LISTING_MANAGER_ADDRESS_97 ?? "0x7e47e94d4ec2992898300006483d55848efbc315";
const agentNfaAddress = process.env.AGENT_NFA_ADDRESS_97 ?? "0xcf5d434d855155beba97e3554ef9afea5ed4eb4d";

function readNumberEnv(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

const maxRequestsPerSecond = Math.floor(readNumberEnv(process.env.MAX_REQUESTS_PER_SECOND, 1, 1, 1_000));
const minIntervalMs = Math.floor(readNumberEnv(process.env.RPC_MIN_INTERVAL_MS, 0, 0, 60_000));
const rpcTimeoutMs = Math.floor(readNumberEnv(process.env.RPC_TIMEOUT_MS, 5_000, 1_000, 120_000));
const rpcFailoverMaxAttempts = Math.floor(readNumberEnv(process.env.RPC_FAILOVER_MAX_ATTEMPTS, 2, 1, 5));
const rpcFailoverCooldownMs = Math.floor(readNumberEnv(process.env.RPC_FAILOVER_COOLDOWN_MS, 30_000, 1_000, 300_000));
const rpcFailoverFailureThreshold = Math.floor(
  readNumberEnv(process.env.RPC_FAILOVER_FAILURE_THRESHOLD, 2, 1, 20),
);
const pollingInterval = Math.floor(readNumberEnv(process.env.POLLING_INTERVAL_MS, 10_000, 1_000, 60_000));
const ethGetLogsBlockRange = Math.floor(readNumberEnv(process.env.ETH_GET_LOGS_BLOCK_RANGE, 1, 1, 5_000));
const contractStartBlock = Math.floor(
  readNumberEnv(process.env.CONTRACT_START_BLOCK_97, 90_496_831, 0, Number.MAX_SAFE_INTEGER),
);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return /429|Too Many Requests|limit exceeded|LimitExceededRpcError|rate limit/i.test(msg);
}

function isTimeoutError(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return /timeout|timed out|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT|Headers Timeout Error/i.test(msg);
}

function getErrorCode(error: unknown): number | string | undefined {
  if (typeof error === "object" && error !== null && "code" in (error as Record<string, unknown>)) {
    const code = (error as Record<string, unknown>).code;
    if (typeof code === "number" || typeof code === "string") return code;
  }

  const msg = error instanceof Error ? error.message : String(error);
  const match = msg.match(/"code"\s*:\s*(-?\d+)/);
  if (match?.[1]) {
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function isRetriableError(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  const code = getErrorCode(error);
  const retriableCodes = new Set<number | string>([19, -32005, "19", "-32005"]);
  return (
    retriableCodes.has(code ?? "") ||
    isRateLimitError(error) ||
    isTimeoutError(error) ||
    /ECONNRESET|ENOTFOUND|EAI_AGAIN|socket hang up|503|504|temporarily unavailable|temporary internal error|please retry/i.test(
      msg,
    )
  );
}

type EndpointState = {
  cooldownUntil: number;
  failures: number;
};

type RpcTransportOptions = {
  requestIntervalMs: number;
  timeoutMs: number;
  maxAttempts: number;
  cooldownMs: number;
  failureThreshold: number;
};

function createRateLimitedRpcTransport(urls: string[], options: RpcTransportOptions): Transport {
  if (urls.length === 0) {
    throw new Error("No RPC endpoints configured for bscTestnet");
  }

  const { requestIntervalMs, timeoutMs, maxAttempts, cooldownMs, failureThreshold } = options;
  let lastLogsRequestAt = 0;
  let nextIndex = 0;

  return (({ chain, timeout }) => {
    const effectiveTimeoutMs = timeout ?? timeoutMs;
    const clients = urls.map((url) =>
      http(url, { retryCount: 0, timeout: effectiveTimeoutMs })({
        chain,
        retryCount: 0,
        timeout: effectiveTimeoutMs,
      }),
    );
    const template = clients[0] as Record<string, unknown>;
    const endpointState: EndpointState[] = clients.map(() => ({ cooldownUntil: 0, failures: 0 }));

    const sendWithFailover = async (args: unknown) => {
      const method =
        typeof args === "object" &&
          args !== null &&
          "method" in (args as Record<string, unknown>) &&
          typeof (args as Record<string, unknown>).method === "string"
          ? ((args as Record<string, unknown>).method as string)
          : "";

      if (method === "eth_getLogs" && requestIntervalMs > 0) {
        const elapsed = Date.now() - lastLogsRequestAt;
        if (elapsed < requestIntervalMs) {
          await sleep(Math.min(requestIntervalMs - elapsed, 250));
        }
        lastLogsRequestAt = Date.now();
      }

      const attemptLimit = Math.max(1, maxAttempts);
      let lastError: unknown;
      let attempts = 0;
      const orderedIndexes = Array.from({ length: clients.length }, (_, offset) => (nextIndex + offset) % clients.length);
      const now = Date.now();
      const available = orderedIndexes.filter((idx) => endpointState[idx]!.cooldownUntil <= now);
      const deferred = orderedIndexes.filter((idx) => endpointState[idx]!.cooldownUntil > now);
      const candidates = [...available, ...deferred];
      const usableCandidates = candidates.length > 0 ? candidates : orderedIndexes;

      while (attempts < attemptLimit) {
        const idx = usableCandidates[attempts % usableCandidates.length] ?? orderedIndexes[0] ?? 0;
        const state = endpointState[idx]!;
        const waitMs = state.cooldownUntil - Date.now();
        if (waitMs > 0) await sleep(Math.min(waitMs, 250));
        attempts += 1;

        const client = clients[idx] as { request: (params: unknown) => Promise<unknown> };
        try {
          const result = await client.request(args);
          state.cooldownUntil = 0;
          state.failures = 0;
          nextIndex = (idx + 1) % clients.length;
          return result;
        } catch (error) {
          lastError = error;
          if (!isRetriableError(error)) throw error;

          state.failures += 1;
          if (state.failures >= failureThreshold) {
            state.failures = 0;
            state.cooldownUntil = Date.now() + cooldownMs;
          }

          if (attempts < attemptLimit) {
            await sleep(Math.min(200 * attempts, 500));
          }
        }
      }

      if (attempts === 0 && orderedIndexes.length > 0) {
        const idx = orderedIndexes[0] ?? 0;
        const client = clients[idx] as { request: (params: unknown) => Promise<unknown> };
        try {
          const result = await client.request(args);
          endpointState[idx]!.cooldownUntil = 0;
          endpointState[idx]!.failures = 0;
          nextIndex = (idx + 1) % clients.length;
          return result;
        } catch (error) {
          if (!isRetriableError(error)) throw error;
          endpointState[idx]!.failures += 1;
          if (endpointState[idx]!.failures >= failureThreshold) {
            endpointState[idx]!.failures = 0;
            endpointState[idx]!.cooldownUntil = Date.now() + cooldownMs;
          }
          lastError = error;
        }
      }

      throw lastError ?? new Error("RPC request failed");
    };

    return {
      ...template,
      request: async (args: unknown) => sendWithFailover(args),
    } as unknown as ReturnType<Transport>;
  }) as Transport;
}

const rpc = createRateLimitedRpcTransport(rpcCandidates, {
  requestIntervalMs: minIntervalMs,
  timeoutMs: rpcTimeoutMs,
  maxAttempts: rpcFailoverMaxAttempts,
  cooldownMs: rpcFailoverCooldownMs,
  failureThreshold: rpcFailoverFailureThreshold,
});

console.log("DEBUG: PONDER_RPC_URL_97 =", rpcCandidates);
console.log("DEBUG: MAX_RPS =", maxRequestsPerSecond);
console.log("DEBUG: RPC_MIN_INTERVAL_MS =", minIntervalMs);
console.log("DEBUG: RPC_TIMEOUT_MS =", rpcTimeoutMs);
console.log("DEBUG: RPC_FAILOVER_MAX_ATTEMPTS =", rpcFailoverMaxAttempts);
console.log("DEBUG: RPC_FAILOVER_COOLDOWN_MS =", rpcFailoverCooldownMs);
console.log("DEBUG: RPC_FAILOVER_FAILURE_THRESHOLD =", rpcFailoverFailureThreshold);
console.log("DEBUG: POLLING_INTERVAL_MS =", pollingInterval);
console.log("DEBUG: ETH_GET_LOGS_BLOCK_RANGE =", ethGetLogsBlockRange);
console.log("DEBUG: LISTING_MANAGER_ADDRESS_97 =", listingManagerAddress);
console.log("DEBUG: AGENT_NFA_ADDRESS_97 =", agentNfaAddress);
console.log("DEBUG: CONTRACT_START_BLOCK_97 =", contractStartBlock);

export default createConfig({
  chains: {
    bscTestnet: {
      id: 97,
      // Custom transport: fast failover + endpoint cooldown (no global eth_getLogs queue).
      rpc,
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
      address: listingManagerAddress as `0x${string}`,
      startBlock: contractStartBlock,
    },
    AgentNFA: {
      chain: "bscTestnet",
      abi: AgentNFAAbi,
      address: agentNfaAddress as `0x${string}`,
      startBlock: contractStartBlock,
    },
  },
});
