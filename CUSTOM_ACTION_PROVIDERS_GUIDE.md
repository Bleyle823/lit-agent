# Custom Action Providers Guide

This guide explains how to create and use custom action providers in your AgentKit-powered application.

## What are Action Providers?

Action Providers define the specific capabilities your AI agent can perform. They translate natural language requests into executable blockchain operations. Each action provider exposes a set of **actions** (tools) that the agent can use.

## Current Setup

Your agent is currently configured in `app/api/agent/prepare-agentkit.ts` with built-in action providers:

- `wethActionProvider()` - WETH operations
- `pythActionProvider()` - Price oracle data
- `walletActionProvider()` - Wallet management
- `erc20ActionProvider()` - ERC-20 token operations
- `cdpApiActionProvider()` - Coinbase Developer Platform API
- `cdpSmartWalletActionProvider()` - Smart wallet operations
- `x402ActionProvider()` - X402 protocol operations

## Creating a Custom Action Provider

### Step 1: Create Your Action Provider File

Create a new file for your custom action provider. For example, `app/api/agent/action-providers/custom-action-provider.ts`:

```typescript
import { ActionProvider, Action, WalletProvider } from "@coinbase/agentkit";
import { z } from "zod";

/**
 * Example: Custom Action Provider for NFT Operations
 * 
 * This demonstrates how to create a custom action provider that:
 * 1. Defines custom actions (tools) for the agent
 * 2. Implements the action execution logic
 * 3. Provides descriptions for the LLM to understand when to use each action
 */
export function customNftActionProvider(): ActionProvider {
  return {
    // Unique identifier for this provider
    id: "custom-nft-provider",
    
    // List of actions this provider exposes
    actions: [
      {
        // Unique action identifier
        id: "get-nft-balance",
        
        // Description helps the LLM understand when to use this action
        description: "Get the NFT balance for a specific collection and address. Use this when the user asks about their NFT holdings or wants to check NFT balances.",
        
        // Input schema using Zod - defines what parameters the action accepts
        inputSchema: z.object({
          collectionAddress: z.string().describe("The contract address of the NFT collection"),
          ownerAddress: z.string().describe("The wallet address to check the balance for"),
        }),
        
        // The actual function that executes when this action is called
        handler: async (input, walletProvider: WalletProvider) => {
          const { collectionAddress, ownerAddress } = input;
          
          // Your custom logic here
          // Example: Query blockchain for NFT balance
          try {
            // This is a placeholder - implement your actual logic
            const balance = await queryNftBalance(collectionAddress, ownerAddress);
            
            return {
              success: true,
              result: `NFT Balance: ${balance} tokens in collection ${collectionAddress}`,
            };
          } catch (error) {
            return {
              success: false,
              error: `Failed to get NFT balance: ${error instanceof Error ? error.message : "Unknown error"}`,
            };
          }
        },
      },
      
      // You can define multiple actions in one provider
      {
        id: "transfer-nft",
        description: "Transfer an NFT from the agent's wallet to another address. Use this when the user wants to send an NFT.",
        inputSchema: z.object({
          collectionAddress: z.string().describe("The contract address of the NFT collection"),
          tokenId: z.string().describe("The token ID of the NFT to transfer"),
          toAddress: z.string().describe("The recipient wallet address"),
        }),
        handler: async (input, walletProvider: WalletProvider) => {
          const { collectionAddress, tokenId, toAddress } = input;
          
          try {
            // Implement your NFT transfer logic using walletProvider
            // Example: Use walletProvider to send a transaction
            const txHash = await transferNft(walletProvider, collectionAddress, tokenId, toAddress);
            
            return {
              success: true,
              result: `NFT transferred successfully. Transaction: ${txHash}`,
            };
          } catch (error) {
            return {
              success: false,
              error: `Transfer failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            };
          }
        },
      },
    ],
  };
}

// Helper functions (implement these based on your needs)
async function queryNftBalance(collectionAddress: string, ownerAddress: string): Promise<number> {
  // Implement your NFT balance query logic
  // This might involve calling a contract or using an API
  return 0;
}

async function transferNft(
  walletProvider: WalletProvider,
  collectionAddress: string,
  tokenId: string,
  toAddress: string
): Promise<string> {
  // Implement your NFT transfer logic
  // Use walletProvider to send transactions
  return "0x...";
}
```

### Step 2: Import and Add to AgentKit Configuration

In `app/api/agent/prepare-agentkit.ts`, import and add your custom action provider:

```typescript
import { customNftActionProvider } from "./action-providers/custom-action-provider";

// ... existing code ...

const agentkit = await AgentKit.from({
  walletProvider,
  actionProviders: [
    // ... existing providers ...
    wethActionProvider(),
    pythActionProvider(),
    walletActionProvider(),
    erc20ActionProvider(),
    cdpApiActionProvider(),
    cdpSmartWalletActionProvider(),
    x402ActionProvider(),
    
    // Add your custom provider here
    customNftActionProvider(),
  ],
});
```

## Action Provider Structure

Each action provider must implement the `ActionProvider` interface:

```typescript
interface ActionProvider {
  id: string;                    // Unique identifier
  actions: Action[];              // Array of actions this provider exposes
}
```

Each action must implement the `Action` interface:

```typescript
interface Action {
  id: string;                    // Unique action identifier
  description: string;            // Description for the LLM
  inputSchema: z.ZodSchema;      // Input validation schema
  handler: (                    // Execution function
    input: z.infer<inputSchema>,
    walletProvider: WalletProvider
  ) => Promise<{
    success: boolean;
    result?: string;
    error?: string;
  }>;
}
```

## Best Practices

### 1. **Clear Descriptions**
Write detailed, natural language descriptions for each action. The LLM uses these to decide when to call your actions.

```typescript
description: "Get the current price of ETH in USD. Use this when the user asks about ETH price, Ethereum value, or wants to know the current market rate."
```

### 2. **Comprehensive Input Schemas**
Use Zod schemas with `.describe()` to help the LLM understand each parameter:

```typescript
inputSchema: z.object({
  amount: z.string().describe("The amount of tokens to transfer, as a string (e.g., '1.5' or '1000')"),
  recipient: z.string().describe("The Ethereum address (0x...) of the recipient"),
  tokenAddress: z.string().optional().describe("Optional: The token contract address. If not provided, uses native ETH"),
}),
```

### 3. **Error Handling**
Always return structured error responses:

```typescript
try {
  // Your logic
  return { success: true, result: "..." };
} catch (error) {
  return {
    success: false,
    error: `Clear error message: ${error instanceof Error ? error.message : "Unknown error"}`,
  };
}
```

### 4. **Use WalletProvider for Transactions**
When you need to send transactions, use the `walletProvider` parameter:

```typescript
handler: async (input, walletProvider: WalletProvider) => {
  // Get the public client for read operations
  const publicClient = walletProvider.getPublicClient();
  
  // Get the wallet client for write operations
  const walletClient = walletProvider.getWalletClient();
  
  // Send a transaction
  const hash = await walletClient.sendTransaction({
    to: "0x...",
    value: parseEther("0.1"),
  });
  
  return { success: true, result: `Transaction sent: ${hash}` };
}
```

## Example: Simple Custom Action Provider

See `app/api/agent/action-providers/example-custom-provider.ts` for a complete, working example that you can use as a template.

## Testing Your Custom Action Provider

1. **Start your development server:**
   ```bash
   npm run dev
   ```

2. **Test in the UI:**
   - Open http://localhost:3000
   - Ask the agent to use your custom action
   - Example: "Check my NFT balance for collection 0x123..."

3. **Check the console:**
   - Monitor server logs for any errors
   - Verify your action is being called correctly

## Common Use Cases for Custom Action Providers

- **NFT Operations**: Minting, transferring, querying NFT data
- **DeFi Protocols**: Interacting with specific DeFi protocols
- **Custom Smart Contracts**: Wrapping your own contract interactions
- **External APIs**: Integrating with off-chain services
- **Data Aggregation**: Combining multiple data sources
- **Business Logic**: Implementing domain-specific operations

## Resources

- [AgentKit Documentation](https://docs.cdp.coinbase.com/agentkit/docs/welcome)
- [Creating an Action Provider](https://github.com/coinbase/agentkit/tree/main/typescript/agentkit#creating-an-action-provider)
- [Built-in Action Providers](https://github.com/coinbase/agentkit/tree/main/typescript/agentkit#action-providers)
- [Zod Documentation](https://zod.dev/) - For input validation schemas
- [Viem Documentation](https://viem.sh/) - For blockchain interactions

## Next Steps

1. Review the example custom action provider in `app/api/agent/action-providers/example-custom-provider.ts`
2. Create your own custom action provider based on your needs
3. Add it to the `actionProviders` array in `prepare-agentkit.ts`
4. Test it by asking your agent to use the new capabilities

