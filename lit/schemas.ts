import { z } from "zod";

/**
 * Schema for Hello Lit action
 */
export const HelloLitSchema = z.object({
  magicNumber: z.number().optional().describe("A number to send to the Lit Action"),
}).strict();

/**
 * Schema for Encrypt Env action
 */
export const EncryptEnvSchema = z.object({
  envFilePath: z
    .string()
    .optional()
    .default(".env")
    .describe("Path to the .env file to encrypt"),
  outputPath: z
    .string()
    .optional()
    .default(".env.encrypted")
    .describe("Path where the encrypted file will be saved"),
  walletAddress: z
    .string()
    .optional()
    .describe(
      "Wallet address authorized to decrypt the file. Defaults to the agent's wallet address."
    ),
}).strict();

/**
 * Schema for Decrypt Env action
 */
export const DecryptEnvSchema = z.object({
  encryptedFilePath: z
    .string()
    .optional()
    .default(".env.encrypted")
    .describe("Path to the encrypted .env file"),
  outputPath: z
    .string()
    .optional()
    .default(".env")
    .describe("Path where the decrypted file will be saved"),
}).strict();

/**
 * Schema for ERC20 Transfer action
 */
export const LitErc20TransferSchema = z.object({
  pkpEthAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid Ethereum address")
    .describe("The Ethereum address of the PKP to use for signing"),
  tokenAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid Ethereum address")
    .describe("The contract address of the ERC20 token to transfer"),
  recipientAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid Ethereum address")
    .describe("The recipient's wallet address"),
  amount: z
    .string()
    .regex(/^\d*\.?\d+$/, "Must be a valid decimal number")
    .describe("The amount of tokens to transfer"),
  chainId: z
    .string()
    .regex(/^\d+$/, "Must be a valid chain ID")
    .describe("The chain ID of the network (e.g., '1', '8453')"),
  rpcUrl: z
    .string()
    .url()
    .describe("The RPC URL for the network"),
}).strict();

/**
 * Schema for ECDSA Sign action
 */
export const LitEcdsaSignSchema = z.object({
  pkpEthAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid Ethereum address")
    .describe("The Ethereum address of the PKP to use for signing"),
  message: z
    .string()
    .describe("The message to sign"),
}).strict();

/**
 * Schema for Uniswap Swap action
 */
export const LitUniswapSwapSchema = z.object({
  pkpEthAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid Ethereum address")
    .describe("The Ethereum address of the PKP to use for signing"),
  tokenIn: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid Ethereum address")
    .describe("The contract address of the token to sell"),
  tokenOut: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid Ethereum address")
    .describe("The contract address of the token to buy"),
  amountIn: z
    .string()
    .regex(/^\d*\.?\d+$/, "Must be a valid decimal number")
    .describe("The amount of tokenIn to swap"),
  chainId: z
    .string()
    .regex(/^\d+$/, "Must be a valid chain ID")
    .describe("The chain ID of the network"),
  rpcUrl: z
    .string()
    .url()
    .describe("The RPC URL for the network"),
}).strict();

