// PolicyGuardV4 ABI — Composable Policy Engine (V3.0)
// Extracted from compiled PolicyGuardV4.sol

export const PolicyGuardV4Abi = [
    // ═══════════════════════════════════════════════════════
    //                       EVENTS
    // ═══════════════════════════════════════════════════════
    {
        type: "event",
        name: "PolicyApproved",
        inputs: [
            { name: "policy", type: "address", indexed: true },
        ],
        anonymous: false,
    },
    {
        type: "event",
        name: "PolicyRevoked",
        inputs: [
            { name: "policy", type: "address", indexed: true },
        ],
        anonymous: false,
    },
    {
        type: "event",
        name: "TemplatePolicyAdded",
        inputs: [
            { name: "templateId", type: "bytes32", indexed: true },
            { name: "policy", type: "address", indexed: true },
        ],
        anonymous: false,
    },
    {
        type: "event",
        name: "TemplatePolicyRemoved",
        inputs: [
            { name: "templateId", type: "bytes32", indexed: true },
            { name: "policy", type: "address", indexed: true },
        ],
        anonymous: false,
    },
    {
        type: "event",
        name: "InstancePolicyAdded",
        inputs: [
            { name: "instanceId", type: "uint256", indexed: true },
            { name: "policy", type: "address", indexed: true },
        ],
        anonymous: false,
    },
    {
        type: "event",
        name: "InstancePolicyRemoved",
        inputs: [
            { name: "instanceId", type: "uint256", indexed: true },
            { name: "policy", type: "address", indexed: true },
        ],
        anonymous: false,
    },
    {
        type: "event",
        name: "InstanceBound",
        inputs: [
            { name: "instanceId", type: "uint256", indexed: true },
            { name: "templateId", type: "bytes32", indexed: true },
        ],
        anonymous: false,
    },
    {
        type: "event",
        name: "CommitFailed",
        inputs: [
            { name: "instanceId", type: "uint256", indexed: true },
            { name: "policy", type: "address", indexed: true },
            { name: "reason", type: "bytes", indexed: false },
        ],
        anonymous: false,
    },

    // ═══════════════════════════════════════════════════════
    //                    VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════
    {
        type: "function",
        name: "getActivePolicies",
        inputs: [{ name: "instanceId", type: "uint256" }],
        outputs: [{ name: "", type: "address[]" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "getTemplatePolicies",
        inputs: [{ name: "templateId", type: "bytes32" }],
        outputs: [{ name: "", type: "address[]" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "hasCustomPolicies",
        inputs: [{ name: "instanceId", type: "uint256" }],
        outputs: [{ name: "", type: "bool" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "instanceTemplateId",
        inputs: [{ name: "instanceId", type: "uint256" }],
        outputs: [{ name: "", type: "bytes32" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "approvedPolicies",
        inputs: [{ name: "policy", type: "address" }],
        outputs: [{ name: "", type: "bool" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "validate",
        inputs: [
            { name: "nfa", type: "address" },
            { name: "tokenId", type: "uint256" },
            { name: "agentAccount", type: "address" },
            { name: "caller", type: "address" },
            {
                name: "action",
                type: "tuple",
                components: [
                    { name: "target", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "data", type: "bytes" },
                ],
            },
        ],
        outputs: [
            { name: "ok", type: "bool" },
            { name: "reason", type: "string" },
        ],
        stateMutability: "view",
    },
] as const;
