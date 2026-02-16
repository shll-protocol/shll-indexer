export const PolicyGuardV2Abi = [
    {
        "type": "event",
        "name": "Spent",
        "inputs": [
            { "name": "instanceId", "type": "uint256", "indexed": true, "internalType": "uint256" },
            { "name": "amount", "type": "uint256", "indexed": false, "internalType": "uint256" },
            { "name": "dayIndex", "type": "uint32", "indexed": false, "internalType": "uint32" }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "TargetBlocked",
        "inputs": [
            { "name": "target", "type": "address", "indexed": true, "internalType": "address" },
            { "name": "blocked", "type": "bool", "indexed": false, "internalType": "bool" }
        ],
        "anonymous": false
    }
] as const;
