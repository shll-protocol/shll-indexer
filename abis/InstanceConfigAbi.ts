export const InstanceConfigAbi = [
    {
        "type": "event",
        "name": "InstanceConfigBound",
        "inputs": [
            { "name": "instanceId", "type": "uint256", "indexed": true, "internalType": "uint256" },
            { "name": "policyId", "type": "uint32", "indexed": true, "internalType": "uint32" },
            { "name": "version", "type": "uint16", "indexed": true, "internalType": "uint16" },
            { "name": "paramsHash", "type": "bytes32", "indexed": false, "internalType": "bytes32" }
        ],
        "anonymous": false
    },
    {
        "type": "function",
        "name": "getInstanceParams",
        "inputs": [
            { "name": "instanceId", "type": "uint256", "internalType": "uint256" }
        ],
        "outputs": [
            {
                "name": "ref",
                "type": "tuple",
                "internalType": "struct InstanceConfig.PolicyRef",
                "components": [
                    { "name": "policyId", "type": "uint32", "internalType": "uint32" },
                    { "name": "version", "type": "uint16", "internalType": "uint16" }
                ]
            },
            { "name": "params", "type": "bytes", "internalType": "bytes" }
        ],
        "stateMutability": "view"
    }
] as const;
