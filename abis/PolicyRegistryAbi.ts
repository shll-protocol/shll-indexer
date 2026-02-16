export const PolicyRegistryAbi = [
    {
        "type": "event",
        "name": "PolicyCreated",
        "inputs": [
            { "name": "policyId", "type": "uint32", "indexed": true, "internalType": "uint32" },
            { "name": "version", "type": "uint16", "indexed": true, "internalType": "uint16" },
            { "name": "policyModules", "type": "uint256", "indexed": false, "internalType": "uint256" }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "ActionRuleSet",
        "inputs": [
            { "name": "policyId", "type": "uint32", "indexed": true, "internalType": "uint32" },
            { "name": "version", "type": "uint16", "indexed": true, "internalType": "uint16" },
            { "name": "target", "type": "address", "indexed": true, "internalType": "address" },
            { "name": "selector", "type": "bytes4", "indexed": false, "internalType": "bytes4" },
            { "name": "moduleMask", "type": "uint256", "indexed": false, "internalType": "uint256" }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "PolicyFrozen",
        "inputs": [
            { "name": "policyId", "type": "uint32", "indexed": true, "internalType": "uint32" },
            { "name": "version", "type": "uint16", "indexed": true, "internalType": "uint16" }
        ],
        "anonymous": false
    },
    {
        "type": "function",
        "name": "getSchema",
        "inputs": [
            { "name": "policyId", "type": "uint32", "internalType": "uint32" },
            { "name": "version", "type": "uint16", "internalType": "uint16" }
        ],
        "outputs": [
            {
                "name": "",
                "type": "tuple",
                "internalType": "struct PolicyRegistry.ParamSchema",
                "components": [
                    { "name": "maxSlippageBps", "type": "uint16", "internalType": "uint16" },
                    { "name": "maxTradeLimit", "type": "uint96", "internalType": "uint96" },
                    { "name": "maxDailyLimit", "type": "uint96", "internalType": "uint96" },
                    { "name": "allowedTokenGroups", "type": "uint32[]", "internalType": "uint32[]" },
                    { "name": "allowedDexGroups", "type": "uint32[]", "internalType": "uint32[]" },
                    { "name": "receiverMustBeVault", "type": "bool", "internalType": "bool" },
                    { "name": "forbidInfiniteApprove", "type": "bool", "internalType": "bool" }
                ]
            }
        ],
        "stateMutability": "view"
    }
] as const;
