import { createConfig } from "ponder";
import { http, type Transport } from "viem";

import { ListingManagerAbi } from "./abis/ListingManagerAbi";
import { AgentNFAAbi } from "./abis/AgentNFAAbi";
import { PolicyGuardV4Abi } from "./abis/PolicyGuardV4Abi";

// ─── Dynamic Chain ID ───────────────────────────────────────────
// Set CHAIN_ID=56 for BSC Mainnet, defaults to 97 (BSC Testnet)
const chainId = Number(process.env.CHAIN_ID ?? "97");
const chainSuffix = `_${chainId}`;
const chainName = chainId === 56 ? "bsc" : "bscTestnet";

// Default RPCs per network
const defaultRpcsByChain: Record<number, string> = {
  97: [
    "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
    "https://data-seed-prebsc-2-s1.bnbchain.org:8545",
    "https://bsc-testnet-rpc.publicnode.com",
  ].join(","),
  56: [
    "https://bsc-dataseed1.binance.org",
    "https://bsc-dataseed2.binance.org",
    "https://bsc-rpc.publicnode.com",
  ].join(","),
};
const defaultRpcs = defaultRpcsByChain[chainId] ?? defaultRpcsByChain[97]!;

// Read env vars with chain suffix: e.g. PONDER_RPC_URL_97 or PONDER_RPC_URL_56
const rpcEnv =
  process.env[`PONDER_RPC_URLS${chainSuffix}`] ??
  process.env[`PONDER_RPC_URL${chainSuffix}`] ??
  defaultRpcs;
const rpcCandidates = rpcEnv
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const listingManagerAddress =
  process.env[`LISTING_MANAGER_ADDRESS${chainSuffix}`] ?? "0x0000000000000000000000000000000000000000";
const agentNfaAddress =
  process.env[`AGENT_NFA_ADDRESS${chainSuffix}`] ?? "0x0000000000000000000000000000000000000000";
const policyGuardV4Address =
  process.env[`POLICY_GUARD_V4_ADDRESS${chainSuffix}`] ?? "0x0000000000000000000000000000000000000000";

// Default start blocks per network
const defaultStartBlock: Record<number, number> = {
  97: 90_562_960,
  56: 0, // Will be set after mainnet deployment
};

function readNumberEnv(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

const maxRequestsPerSecond = Math.floor(readNumberEnv(process.env.MAX_REQUESTS_PER_SECOND, 1, 1, 1_000));
const minIntervalMs = Math.floor(readNumberEnv(process.env.RPC_MIN_INTERVAL_MS, 0, 0, 60_000));
const rpcTimeoutMs = Math.floor(readNumberEnv(process.env.RPC_TIMEOUT_MS, 15_000, 1_000, 120_000));
const rpcFailoverMaxAttempts = Math.floor(readNumberEnv(process.env.RPC_FAILOVER_MAX_ATTEMPTS, 5, 1, 10));
const rpcFailoverCooldownMs = Math.floor(readNumberEnv(process.env.RPC_FAILOVER_COOLDOWN_MS, 30_000, 1_000, 300_000));
const rpcFailoverFailureThreshold = Math.floor(
  readNumberEnv(process.env.RPC_FAILOVER_FAILURE_THRESHOLD, 2, 1, 20),
);
const pollingInterval = Math.floor(readNumberEnv(process.env.POLLING_INTERVAL_MS, 10_000, 1_000, 60_000));
const ethGetLogsBlockRange = Math.floor(readNumberEnv(process.env.ETH_GET_LOGS_BLOCK_RANGE, 1, 1, 5_000));
const contractStartBlock = Math.floor(
  readNumberEnv(
    process.env[`CONTRACT_START_BLOCK${chainSuffix}`],
    defaultStartBlock[chainId] ?? 0,
    0,
    Number.MAX_SAFE_INTEGER,
  ),
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

function isBlockNotFoundError(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return /BlockNotFoundError|Block.*could not be found|block not found/i.test(msg);
}

function isRetriableError(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  const code = getErrorCode(error);
  const retriableCodes = new Set<number | string>([19, -32005, "19", "-32005"]);
  return (
    retriableCodes.has(code ?? "") ||
    isRateLimitError(error) ||
    isTimeoutError(error) ||
    isBlockNotFoundError(error) ||
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
  let logsLock = false;
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

      // Serial gate: only one eth_getLogs at a time, with full delay
      if (method === "eth_getLogs" && requestIntervalMs > 0) {
        while (logsLock) {
          await sleep(50);
        }
        logsLock = true;
        const elapsed = Date.now() - lastLogsRequestAt;
        if (elapsed < requestIntervalMs) {
          await sleep(requestIntervalMs - elapsed);
        }
        lastLogsRequestAt = Date.now();
        logsLock = false;
      }

      // Round-robin: advance starting index BEFORE selecting candidates
      const startIdx = nextIndex;
      nextIndex = (nextIndex + 1) % clients.length;

      const attemptLimit = Math.max(1, maxAttempts);
      let lastError: unknown;
      let attempts = 0;
      const orderedIndexes = Array.from({ length: clients.length }, (_, offset) => (startIdx + offset) % clients.length);
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

console.log("DEBUG: CHAIN_ID =", chainId, `(${chainName})`);
console.log(`DEBUG: PONDER_RPC_URL${chainSuffix} =`, rpcCandidates);
console.log("DEBUG: MAX_RPS =", maxRequestsPerSecond);
console.log("DEBUG: RPC_MIN_INTERVAL_MS =", minIntervalMs);
console.log("DEBUG: RPC_TIMEOUT_MS =", rpcTimeoutMs);
console.log("DEBUG: RPC_FAILOVER_MAX_ATTEMPTS =", rpcFailoverMaxAttempts);
console.log("DEBUG: RPC_FAILOVER_COOLDOWN_MS =", rpcFailoverCooldownMs);
console.log("DEBUG: RPC_FAILOVER_FAILURE_THRESHOLD =", rpcFailoverFailureThreshold);
console.log("DEBUG: POLLING_INTERVAL_MS =", pollingInterval);
console.log("DEBUG: ETH_GET_LOGS_BLOCK_RANGE =", ethGetLogsBlockRange);
console.log(`DEBUG: LISTING_MANAGER_ADDRESS${chainSuffix} =`, listingManagerAddress);
console.log(`DEBUG: AGENT_NFA_ADDRESS${chainSuffix} =`, agentNfaAddress);
console.log(`DEBUG: POLICY_GUARD_V4_ADDRESS${chainSuffix} =`, policyGuardV4Address);

export default createConfig({
  chains: {
    [chainName]: {
      id: chainId,
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
      chain: chainName as "bscTestnet",
      abi: ListingManagerAbi,
      address: listingManagerAddress as `0x${string}`,
      startBlock: contractStartBlock,
    },
    AgentNFA: {
      chain: chainName as "bscTestnet",
      abi: AgentNFAAbi,
      address: agentNfaAddress as `0x${string}`,
      startBlock: contractStartBlock,
    },
    PolicyGuardV4: {
      chain: chainName as "bscTestnet",
      abi: PolicyGuardV4Abi,
      address: policyGuardV4Address as `0x${string}`,
      startBlock: contractStartBlock,
    },
  },
});
