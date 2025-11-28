/**
 * Default IPFS CIDs for Lit Actions
 */
export const IPFS_CIDS = {
    "datil-dev": {
        erc20Transfer: "QmUPnnuz8E3wKYG7bCxqnjjhV9anE9uMxHXY4fTv7Z5Y6A",
        ecdsaSign: "QmZJovPgBBBmuLKRtdVwdV47opNSmLiV2AZCNTtWzeog1Q",
        uniswapSwap: "QmQPUjXmFiAe363TYAiv3DPciyTDSFLym2S9FR1d78ZRWs",
    },
    "datil-test": {
        erc20Transfer: "QmRcwjz5EpUaABPMwhgYwsDsy1noYNYkhr6nC8JqWUPEoy",
        ecdsaSign: "QmZbVUwomfUfCa38ia69LrSfH1k8JNK3BHeSUKm5tGMWgv",
        uniswapSwap: "QmaLAZCJEk5B4BW962pjENxCDHvwGtPptCamhckk9GJxJe",
    },
    "datil": {
        erc20Transfer: "QmQ1k3ZzmoPDukAphQ353WJ73XaNFnhmztr1v2hfTprW3V",
        ecdsaSign: "QmPjxnXWSPYGYR2gZyiZHpRE7dMAeb7K181R4Cfvkw5KM8",
        uniswapSwap: "QmStLtPzAvyUAQXbkUorZUJ7mgst6tU4xhJoFYHMZp9etH",
    },
} as const;

export type LitNetwork = keyof typeof IPFS_CIDS;

/**
 * Lit Action code for Hello World test
 */
export const HELLO_LIT_CODE = `(async () => {
  // @ts-ignore
  console.log(magicNumber);
  try {
    // @ts-ignore
    LitActions.setResponse({
      response: JSON.stringify({ message: "Hello from Lit Protocol!" }),
    });
  } catch (error) {
    // @ts-ignore
    LitActions.setResponse({ response: error.message });
  }
})();`;

