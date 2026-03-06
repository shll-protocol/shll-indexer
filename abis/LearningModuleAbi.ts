export const LearningModuleAbi = [
    {
        type: "event",
        name: "LearningRootUpdated",
        inputs: [
            { name: "tokenId", type: "uint256", indexed: true },
            { name: "newRoot", type: "bytes32", indexed: false },
            { name: "leafCount", type: "uint256", indexed: false },
        ],
    },
    {
        type: "event",
        name: "LearningStateChanged",
        inputs: [
            { name: "tokenId", type: "uint256", indexed: true },
            { name: "enabled", type: "bool", indexed: false },
        ],
    },
] as const;
