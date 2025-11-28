import { ActionProvider, Action, WalletProvider } from "@coinbase/agentkit";
import { z } from "zod";
import { formatEther, parseEther } from "viem";

/**
 * Example Custom Action Provider
 * 
 * This is a complete, working example of a custom action provider.
 * It demonstrates:
 * - How to structure an action provider
 * - How to define actions with proper schemas
 * - How to use the WalletProvider for blockchain operations
 * - Error handling best practices
 * 
 * You can use this as a template for creating your own custom action providers.
 */

/**
 * Example Action Provider: Token Price Checker
 * 
 * This provider adds the ability to:
 * 1. Get the current balance of any ERC-20 token
 * 2. Get the current ETH/USD price (using a simple calculation)
 * 
 * Note: This is a simplified example. In production, you'd want to use
 * proper price oracles or APIs for accurate price data.
 */
export function exampleCustomActionProvider(): ActionProvider {
  return {
    id: "example-custom-provider",
    
    actions: [
      {
        id: "get-token-balance",
        description: 
          "Get the balance of an ERC-20 token for a specific address. " +
          "Use this when the user asks about token balances, wants to check how many tokens they have, " +
          "or needs to verify a token balance for any Ethereum address. " +
          "Provide the token contract address and the wallet address to check.",
        
        inputSchema: z.object({
          tokenAddress: z
            .string()
            .describe("The contract address of the ERC-20 token (must be a valid Ethereum address starting with 0x)"),
          address: z
            .string()
            .describe("The wallet address to check the balance for (must be a valid Ethereum address starting with 0x)"),
        }),
        
        handler: async (input, walletProvider: WalletProvider) => {
          const { tokenAddress, address } = input;
          
          try {
            // Validate addresses
            if (!tokenAddress.startsWith("0x") || tokenAddress.length !== 42) {
              return {
                success: false,
                error: `Invalid token address: ${tokenAddress}. Must be a valid Ethereum address.`,
              };
            }
            
            if (!address.startsWith("0x") || address.length !== 42) {
              return {
                success: false,
                error: `Invalid address: ${address}. Must be a valid Ethereum address.`,
              };
            }
            
            // Get the public client for read operations
            const publicClient = walletProvider.getPublicClient();
            
            // Standard ERC-20 balanceOf function ABI
            const balanceOfAbi = [
              {
                constant: true,
                inputs: [{ name: "_owner", type: "address" }],
                name: "balanceOf",
                outputs: [{ name: "balance", type: "uint256" }],
                type: "function",
              },
              {
                constant: true,
                inputs: [],
                name: "decimals",
                outputs: [{ name: "", type: "uint8" }],
                type: "function",
              },
              {
                constant: true,
                inputs: [],
                name: "symbol",
                outputs: [{ name: "", type: "string" }],
                type: "function",
              },
            ] as const;
            
            // Get token balance
            const balance = await publicClient.readContract({
              address: tokenAddress as `0x${string}`,
              abi: balanceOfAbi,
              functionName: "balanceOf",
              args: [address as `0x${string}`],
            });
            
            // Get token decimals and symbol for better display
            let decimals = 18; // Default
            let symbol = "TOKEN"; // Default
            
            try {
              decimals = await publicClient.readContract({
                address: tokenAddress as `0x${string}`,
                abi: balanceOfAbi,
                functionName: "decimals",
              });
            } catch {
              // If decimals() fails, use default
            }
            
            try {
              symbol = await publicClient.readContract({
                address: tokenAddress as `0x${string}`,
                abi: balanceOfAbi,
                functionName: "symbol",
              });
            } catch {
              // If symbol() fails, use default
            }
            
            // Format the balance
            const formattedBalance = formatEther(balance);
            const adjustedBalance = (Number(formattedBalance) / Math.pow(10, 18 - decimals)).toFixed(6);
            
            return {
              success: true,
              result: `Token Balance: ${adjustedBalance} ${symbol} (${balance.toString()} raw units) for address ${address}`,
            };
          } catch (error) {
            return {
              success: false,
              error: `Failed to get token balance: ${error instanceof Error ? error.message : "Unknown error"}. ` +
                     `Make sure the token address is valid and the contract supports the ERC-20 standard.`,
            };
          }
        },
      },
      
      {
        id: "get-eth-price-estimate",
        description:
          "Get an estimated ETH price in USD. " +
          "Use this when the user asks about Ethereum price, ETH value, or wants to know the current ETH/USD rate. " +
          "Note: This is a simplified estimate. For production, use proper price oracles.",
        
        inputSchema: z.object({
          // No input required for this example
        }).optional(),
        
        handler: async (input, walletProvider: WalletProvider) => {
          try {
            // This is a placeholder - in production, you'd call a real price API
            // For example: CoinGecko, Coinbase API, Chainlink, etc.
            
            // Example: You could fetch from an API
            // const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
            // const data = await response.json();
            // const price = data.ethereum.usd;
            
            // For this example, we'll return a placeholder message
            const estimatedPrice = "~$3,000"; // Placeholder
            
            return {
              success: true,
              result: `Estimated ETH Price: ${estimatedPrice} USD. ` +
                      `Note: This is a placeholder. In production, integrate with a real price oracle like Chainlink, ` +
                      `CoinGecko API, or Coinbase API for accurate pricing.`,
            };
          } catch (error) {
            return {
              success: false,
              error: `Failed to get ETH price: ${error instanceof Error ? error.message : "Unknown error"}`,
            };
          }
        },
      },
    ],
  };
}

