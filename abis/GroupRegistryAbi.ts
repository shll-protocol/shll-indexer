export const GroupRegistryAbi = [
    {
        "type": "event",
        "name": "GroupMemberSet",
        "inputs": [
            { "name": "groupId", "type": "uint32", "indexed": true, "internalType": "uint32" },
            { "name": "member", "type": "address", "indexed": true, "internalType": "address" },
            { "name": "allowed", "type": "bool", "indexed": false, "internalType": "bool" }
        ],
        "anonymous": false
    }
] as const;
