export const AgentNFAAbi = [
    {
        type: "event",
        name: "AgentMinted",
        inputs: [
            { name: "tokenId", type: "uint256", indexed: true },
            { name: "owner", type: "address", indexed: true },
            { name: "account", type: "address", indexed: false },
            { name: "policyId", type: "bytes32", indexed: false },
        ],
    },
    {
        type: "event",
        name: "LeaseSet",
        inputs: [
            { name: "tokenId", type: "uint256", indexed: true },
            { name: "user", type: "address", indexed: true },
            { name: "expires", type: "uint64", indexed: false },
        ],
    },
    {
        type: "event",
        name: "MetadataUpdated",
        inputs: [
            { name: "tokenId", type: "uint256", indexed: true },
            { name: "metadataURI", type: "string", indexed: false },
        ],
    },
    {
        type: "event",
        name: "Executed",
        inputs: [
            { name: "tokenId", type: "uint256", indexed: true },
            { name: "caller", type: "address", indexed: true },
            { name: "account", type: "address", indexed: true },
            { name: "target", type: "address", indexed: false },
            { name: "selector", type: "bytes4", indexed: false },
            { name: "success", type: "bool", indexed: false },
            { name: "result", type: "bytes", indexed: false },
        ],
    },
    // View functions for read contract calls from handlers
    {
        type: "function",
        name: "getAgentMetadata",
        inputs: [{ name: "tokenId", type: "uint256" }],
        outputs: [
            {
                name: "",
                type: "tuple",
                components: [
                    { name: "persona", type: "string" },
                    { name: "experience", type: "string" },
                    { name: "voiceHash", type: "string" },
                    { name: "animationURI", type: "string" },
                    { name: "vaultURI", type: "string" },
                    { name: "vaultHash", type: "bytes32" },
                ],
            },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "ownerOf",
        inputs: [{ name: "tokenId", type: "uint256" }],
        outputs: [{ name: "", type: "address" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "userOf",
        inputs: [{ name: "tokenId", type: "uint256" }],
        outputs: [{ name: "", type: "address" }],
        stateMutability: "view",
    },
    // V1.3 Rent-to-Mint events
    {
        type: "event",
        name: "TemplateListed",
        inputs: [
            { name: "tokenId", type: "uint256", indexed: true },
            { name: "policyId", type: "bytes32", indexed: false },
            { name: "packHash", type: "string", indexed: false },
        ],
    },
    {
        type: "event",
        name: "InstanceMinted",
        inputs: [
            { name: "templateId", type: "uint256", indexed: true },
            { name: "instanceId", type: "uint256", indexed: true },
            { name: "owner", type: "address", indexed: true },
            { name: "account", type: "address", indexed: false },
        ],
    },
    // V1.3 view functions
    {
        type: "function",
        name: "isTemplate",
        inputs: [{ name: "tokenId", type: "uint256" }],
        outputs: [{ name: "", type: "bool" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "templateOf",
        inputs: [{ name: "tokenId", type: "uint256" }],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
    },
] as const;
