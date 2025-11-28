import { ActionProvider, WalletProvider } from "@coinbase/agentkit";
import { z } from "zod";
import * as fs from "fs/promises";
import * as LitJsSdk from "@lit-protocol/lit-node-client";
import { LIT_ABILITY } from "@lit-protocol/constants";
import { createSiweMessage, LitActionResource } from "@lit-protocol/auth-helpers";
import { encryptString, decryptToString } from "@lit-protocol/encryption";
import {
  EncryptEnvSchema,
  DecryptEnvSchema,
  LitErc20TransferSchema,
  LitEcdsaSignSchema,
  LitUniswapSwapSchema,
  HelloLitSchema,
} from "./lit/schemas";
import { IPFS_CIDS, HELLO_LIT_CODE, LitNetwork } from "./lit/constants";
import { ERC20TransferPolicy, SignEcdsaPolicy, UniswapSwapPolicy } from "./lit/policies";

/**
 * Configuration for LitActionProvider
 */
export interface LitActionProviderConfig {
  /**
   * The Lit network to connect to. Defaults to "datil-dev".
   */
  litNetwork?: LitNetwork;
  /**
   * Enable debug mode for Lit client.
   */
  debug?: boolean;
}

// Shared Lit client instance
let litNodeClient: LitJsSdk.LitNodeClient | null = null;

/**
 * Initialize Lit Node Client
 */
async function getLitClient(config: LitActionProviderConfig): Promise<LitJsSdk.LitNodeClient> {
  if (!litNodeClient) {
    litNodeClient = new LitJsSdk.LitNodeClient({
      litNetwork: config.litNetwork || "datil-dev",
      debug: config.debug || false,
    });
    await litNodeClient.connect();
  }
  return litNodeClient;
}

/**
 * Get session signatures for Lit Protocol operations
 */
async function getSessionSigs(
  walletProvider: WalletProvider,
  config: LitActionProviderConfig
) {
  const client = await getLitClient(config);
  const walletAddress = await walletProvider.getAddress();
  const network = await walletProvider.getNetwork();

  return await client.getSessionSigs({
    chain: "ethereum", // Lit usually expects "ethereum" for auth even if on L2
    expiration: new Date(Date.now() + 1000 * 60 * 10).toISOString(), // 10 mins
    resourceAbilityRequests: [
      {
        resource: new LitActionResource("*") as any,
        ability: LIT_ABILITY.LitActionExecution,
      },
    ],
    authNeededCallback: async ({ uri, expiration, resourceAbilityRequests }) => {
      const toSign = await createSiweMessage({
        uri,
        expiration,
        resources: resourceAbilityRequests as any,
        walletAddress,
        nonce: await client.getLatestBlockhash(),
        litNodeClient: client,
      });

      // Use AgentKit's WalletProvider to sign the message
      // AgentKit WalletProvider uses viem, so we need to get the wallet client
      const walletClient = walletProvider.getWalletClient();
      // Get the account from the wallet client
      const accounts = await walletClient.getAddresses();
      const account = accounts[0] as `0x${string}`;
      const signature = await walletClient.signMessage({
        message: toSign,
        account,
      });

      return {
        sig: signature,
        derivedVia: "web3.eth.personal.sign",
        signedMessage: toSign,
        address: walletAddress,
      };
    },
  });
}

/**
 * Lit Protocol Action Provider for AgentKit
 * 
 * This provider enables the agent to:
 * - Test Lit Protocol connection (hello)
 * - Encrypt/decrypt .env files using Lit Protocol
 * - Transfer ERC20 tokens via Lit Protocol PKP
 * - Sign messages using Lit Protocol PKP
 * - Swap tokens on Uniswap using Lit Protocol PKP
 */
export function litActionProvider(config: LitActionProviderConfig = {}): ActionProvider {
  const finalConfig: LitActionProviderConfig = {
    litNetwork: "datil-dev",
    debug: false,
    ...config,
  };

  return {
    id: "lit-action-provider",
    actions: [
      {
        id: "lit-hello",
        description:
          "Test connection to Lit Protocol. Use this to verify that Lit Protocol is working correctly. " +
          "You can optionally provide a magic number to send to the Lit Action.",
        inputSchema: HelloLitSchema,
        handler: async (input, walletProvider: WalletProvider) => {
          try {
            const client = await getLitClient(finalConfig);
            const sessionSigs = await getSessionSigs(walletProvider, finalConfig);

            const res = await client.executeJs({
              sessionSigs,
              code: HELLO_LIT_CODE,
              jsParams: {
                magicNumber: input.magicNumber || 42,
              },
            });

            return {
              success: true,
              result: JSON.stringify(res.response || res),
            };
          } catch (error) {
            return {
              success: false,
              error: `Lit Protocol hello failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            };
          }
        },
      },
      {
        id: "lit-encrypt-env",
        description:
          "Encrypts a local .env file using Lit Protocol. " +
          "Use this when the user wants to encrypt their environment variables securely. " +
          "The encrypted file can only be decrypted by the specified wallet address (defaults to the agent's wallet).",
        inputSchema: EncryptEnvSchema,
        handler: async (input, walletProvider: WalletProvider) => {
          try {
            const envContent = await fs.readFile(input.envFilePath || ".env", "utf-8");
            if (!envContent) {
              return {
                success: false,
                error: `File ${input.envFilePath || ".env"} is empty or missing`,
              };
            }

            const client = await getLitClient(finalConfig);
            const walletAddress = await walletProvider.getAddress();
            const authorizedWallet = input.walletAddress || walletAddress;

            const accessControlConditions = [
              {
                contractAddress: "",
                standardContractType: "",
                chain: "ethereum",
                method: "",
                parameters: [":userAddress"],
                returnValueTest: {
                  comparator: "=",
                  value: authorizedWallet.toLowerCase(),
                },
              },
            ];

            const { ciphertext, dataToEncryptHash } = await encryptString(
              {
                accessControlConditions,
                dataToEncrypt: envContent,
              },
              client
            );

            const encryptedData = {
              version: "1.0.0",
              encryptedAt: new Date().toISOString(),
              encryptedBy: walletAddress,
              accessControlConditions,
              ciphertext,
              dataToEncryptHash,
              network: finalConfig.litNetwork,
            };

            await fs.writeFile(
              input.outputPath || ".env.encrypted",
              JSON.stringify(encryptedData, null, 2)
            );

            return {
              success: true,
              result: `Encrypted ${input.envFilePath || ".env"} to ${input.outputPath || ".env.encrypted"}. Access control set for ${authorizedWallet}`,
            };
          } catch (error) {
            return {
              success: false,
              error: `Encryption failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            };
          }
        },
      },
      {
        id: "lit-decrypt-env",
        description:
          "Decrypts a local .env.encrypted file using Lit Protocol. " +
          "Use this when the user wants to decrypt a previously encrypted .env file. " +
          "Only the wallet address that was authorized during encryption can decrypt the file.",
        inputSchema: DecryptEnvSchema,
        handler: async (input, walletProvider: WalletProvider) => {
          try {
            const encryptedContent = await fs.readFile(
              input.encryptedFilePath || ".env.encrypted",
              "utf-8"
            );
            const encryptedData = JSON.parse(encryptedContent);

            const client = await getLitClient(finalConfig);
            const sessionSigs = await getSessionSigs(walletProvider, finalConfig);

            const decryptedString = await decryptToString(
              {
                accessControlConditions: encryptedData.accessControlConditions,
                ciphertext: encryptedData.ciphertext,
                dataToEncryptHash: encryptedData.dataToEncryptHash,
                sessionSigs,
                chain: "ethereum",
              },
              client
            );

            await fs.writeFile(input.outputPath || ".env", decryptedString);

            return {
              success: true,
              result: `Decrypted ${input.encryptedFilePath || ".env.encrypted"} to ${input.outputPath || ".env"}`,
            };
          } catch (error) {
            return {
              success: false,
              error: `Decryption failed: ${error instanceof Error ? error.message : "Unknown error"}. ` +
                     `Make sure you have permission to decrypt this file.`,
            };
          }
        },
      },
      {
        id: "lit-erc20-transfer",
        description:
          "Transfer ERC20 tokens using Lit Protocol PKP (Programmable Key Pair). " +
          "Use this when the user wants to transfer tokens using a Lit Protocol PKP address. " +
          "Requires a PKP Ethereum address, token address, recipient address, amount, chain ID, and RPC URL.",
        inputSchema: LitErc20TransferSchema,
        handler: async (input, walletProvider: WalletProvider) => {
          try {
            const client = await getLitClient(finalConfig);
            const sessionSigs = await getSessionSigs(walletProvider, finalConfig);
            const network = finalConfig.litNetwork || "datil-dev";
            const ipfsCid = IPFS_CIDS[network].erc20Transfer;

            const policy = {
              type: "ERC20Transfer" as const,
              version: ERC20TransferPolicy.version,
              erc20Decimals: "18", // Assuming 18 decimals, could be parameterized
              maxAmount: input.amount,
              allowedTokens: [input.tokenAddress],
              allowedRecipients: [input.recipientAddress],
            };

            const encodedPolicy = ERC20TransferPolicy.encode(policy);

            const res = await client.executeJs({
              sessionSigs,
              ipfsId: ipfsCid,
              jsParams: {
                params: {
                  pkpEthAddress: input.pkpEthAddress,
                  tokenIn: input.tokenAddress,
                  recipientAddress: input.recipientAddress,
                  amountIn: input.amount,
                  chainId: input.chainId,
                  rpcUrl: input.rpcUrl,
                  encodedPolicy,
                },
              },
            });

            return {
              success: true,
              result: JSON.stringify(res.response || res),
            };
          } catch (error) {
            return {
              success: false,
              error: `ERC20 transfer failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            };
          }
        },
      },
      {
        id: "lit-ecdsa-sign",
        description:
          "Sign a message using Lit Protocol PKP (Programmable Key Pair). " +
          "Use this when the user wants to sign a message or data using a Lit Protocol PKP address. " +
          "Requires a PKP Ethereum address and the message to sign.",
        inputSchema: LitEcdsaSignSchema,
        handler: async (input, walletProvider: WalletProvider) => {
          try {
            const client = await getLitClient(finalConfig);
            const sessionSigs = await getSessionSigs(walletProvider, finalConfig);
            const network = finalConfig.litNetwork || "datil-dev";
            const ipfsCid = IPFS_CIDS[network].ecdsaSign;

            const policy = {
              type: "SignEcdsa" as const,
              version: SignEcdsaPolicy.version,
              allowedPrefixes: [input.message],
            };

            const encodedPolicy = SignEcdsaPolicy.encode(policy);

            const res = await client.executeJs({
              sessionSigs,
              ipfsId: ipfsCid,
              jsParams: {
                params: {
                  pkpEthAddress: input.pkpEthAddress,
                  message: input.message,
                  encodedPolicy,
                },
              },
            });

            return {
              success: true,
              result: JSON.stringify(res.response || res),
            };
          } catch (error) {
            return {
              success: false,
              error: `ECDSA sign failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            };
          }
        },
      },
      {
        id: "lit-uniswap-swap",
        description:
          "Swap tokens on Uniswap using Lit Protocol PKP (Programmable Key Pair). " +
          "Use this when the user wants to swap tokens on Uniswap using a Lit Protocol PKP address. " +
          "Requires a PKP Ethereum address, input token, output token, amount, chain ID, and RPC URL.",
        inputSchema: LitUniswapSwapSchema,
        handler: async (input, walletProvider: WalletProvider) => {
          try {
            const client = await getLitClient(finalConfig);
            const sessionSigs = await getSessionSigs(walletProvider, finalConfig);
            const network = finalConfig.litNetwork || "datil-dev";
            const ipfsCid = IPFS_CIDS[network].uniswapSwap;

            const policy = {
              type: "UniswapSwap" as const,
              version: UniswapSwapPolicy.version,
              maxAmount: input.amountIn,
              allowedTokens: [input.tokenIn, input.tokenOut],
            };

            const encodedPolicy = UniswapSwapPolicy.encode(policy);

            const res = await client.executeJs({
              sessionSigs,
              ipfsId: ipfsCid,
              jsParams: {
                params: {
                  pkpEthAddress: input.pkpEthAddress,
                  tokenIn: input.tokenIn,
                  tokenOut: input.tokenOut,
                  amountIn: input.amountIn,
                  chainId: input.chainId,
                  rpcUrl: input.rpcUrl,
                  encodedPolicy,
                },
              },
            });

            return {
              success: true,
              result: JSON.stringify(res.response || res),
            };
          } catch (error) {
            return {
              success: false,
              error: `Uniswap swap failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            };
          }
        },
      },
    ],
  };
}

