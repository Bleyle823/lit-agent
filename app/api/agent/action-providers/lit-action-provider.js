import * as fs from "fs/promises";
import LitJsSdk from "@lit-protocol/lit-node-client";
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
import { IPFS_CIDS, HELLO_LIT_CODE } from "./lit/constants";
import { ERC20TransferPolicy, SignEcdsaPolicy, UniswapSwapPolicy } from "./lit/policies";

/**
 * Shared Lit client instance
 */
let litNodeClient = null;

/**
 * Initialize Lit Node Client
 */
async function getLitClient(config) {
  if (!litNodeClient) {
    try {
      litNodeClient = new LitJsSdk.LitNodeClient({
        litNetwork: config.litNetwork || "datil-dev",
        debug: config.debug || false,
      });
      await litNodeClient.connect();
    } catch (error) {
      console.error("Failed to initialize Lit Node Client:", error);
      throw new Error(`Lit Protocol connection failed: ${error.message}`);
    }
  }
  return litNodeClient;
}

/**
 * Get session signatures for Lit Protocol operations
 */
async function getSessionSigs(walletProvider, config) {
  const client = await getLitClient(config);
  const walletAddress = await walletProvider.getAddress();

  return await client.getSessionSigs({
    chain: "ethereum", // Lit usually expects "ethereum" for auth even if on L2
    expiration: new Date(Date.now() + 1000 * 60 * 10).toISOString(), // 10 mins
    resourceAbilityRequests: [
      {
        resource: new LitActionResource("*"),
        ability: LIT_ABILITY.LitActionExecution,
      },
    ],
    authNeededCallback: async ({ uri, expiration, resourceAbilityRequests }) => {
      const toSign = await createSiweMessage({
        uri,
        expiration,
        resources: resourceAbilityRequests,
        walletAddress,
        nonce: await client.getLatestBlockhash(),
        litNodeClient: client,
      });

      // Use walletProvider.signMessage if available (matches class-based version)
      // Otherwise fall back to wallet client (viem pattern)
      let signature;
      if (typeof walletProvider.signMessage === "function") {
        signature = await walletProvider.signMessage(toSign);
      } else {
        // Fallback: use wallet client (viem pattern)
        const walletClient = walletProvider.getWalletClient();
        const accounts = await walletClient.getAddresses();
        const account = accounts[0];
        signature = await walletClient.signMessage({
          message: toSign,
          account,
        });
      }

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
export function litActionProvider(config = {}) {
  const finalConfig = {
    litNetwork: "datil-dev",
    debug: false,
    ...config,
  };

  return {
    id: "lit-action-provider",
    // Lit is an overlay network and can work across EVM networks, so we
    // simply report that this provider supports any network AgentKit uses.
    // AgentKit's tooling (e.g., getLangChainTools) expects this method.
    supportsNetwork: () => true,
    // AgentKit LangChain bindings expect a getActions() method on
    // custom action providers. We simply return the underlying actions array.
    getActions() {
      return this.actions;
    },
    actions: [
      {
        id: "lit-hello",
        name: "lit-hello",
        description:
          "Test connection to Lit Protocol. Use this to verify that Lit Protocol is working correctly. " +
          "You can optionally provide a magic number to send to the Lit Action.",
        inputSchema: HelloLitSchema,
        handler: async (input, walletProvider) => {
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
        name: "lit-encrypt-env",
        description:
          "Encrypts a local .env file using Lit Protocol. " +
          "Use this when the user wants to encrypt their environment variables securely. " +
          "The encrypted file can only be decrypted by the specified wallet address (defaults to the agent's wallet).",
        inputSchema: EncryptEnvSchema,
        handler: async (input, walletProvider) => {
          try {
            // Input is already validated by AgentKit based on inputSchema
            // But we parse it to get defaults if needed
            const parsed = EncryptEnvSchema.parse(input || {});

            const envContent = await fs.readFile(parsed.envFilePath, "utf-8");
            if (!envContent) {
              return {
                success: false,
                error: `File ${parsed.envFilePath} is empty or missing`,
              };
            }

            const client = await getLitClient(finalConfig);
            const walletAddress = await walletProvider.getAddress();
            const authorizedWallet = parsed.walletAddress || walletAddress;

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

            await fs.writeFile(parsed.outputPath, JSON.stringify(encryptedData, null, 2));

            return {
              success: true,
              result: `Encrypted ${parsed.envFilePath} to ${parsed.outputPath}. Access control set for ${authorizedWallet}`,
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
        name: "lit-decrypt-env",
        description:
          "Decrypts a local .env.encrypted file using Lit Protocol. " +
          "Use this when the user wants to decrypt a previously encrypted .env file. " +
          "Only the wallet address that was authorized during encryption can decrypt the file.",
        inputSchema: DecryptEnvSchema,
        handler: async (input, walletProvider) => {
          try {
            // Input is already validated by AgentKit based on inputSchema
            const parsed = DecryptEnvSchema.parse(input || {});

            const encryptedContent = await fs.readFile(parsed.encryptedFilePath, "utf-8");
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

            await fs.writeFile(parsed.outputPath, decryptedString);

            return {
              success: true,
              result: `Decrypted ${parsed.encryptedFilePath} to ${parsed.outputPath}`,
            };
          } catch (error) {
            return {
              success: false,
              error:
                `Decryption failed: ${error instanceof Error ? error.message : "Unknown error"}. ` +
                `Make sure you have permission to decrypt this file.`,
            };
          }
        },
      },
      {
        id: "lit-erc20-transfer",
        name: "lit-erc20-transfer",
        description:
          "Transfer ERC20 tokens using Lit Protocol PKP (Programmable Key Pair). " +
          "Use this when the user wants to transfer tokens using a Lit Protocol PKP address. " +
          "Requires a PKP Ethereum address, token address, recipient address, amount, chain ID, and RPC URL.",
        inputSchema: LitErc20TransferSchema,
        handler: async (input, walletProvider) => {
          try {
            // Input is already validated by AgentKit based on inputSchema
            const parsed = LitErc20TransferSchema.parse(input);

            const client = await getLitClient(finalConfig);
            const sessionSigs = await getSessionSigs(walletProvider, finalConfig);
            const network = finalConfig.litNetwork || "datil-dev";
            const ipfsCid = IPFS_CIDS[network].erc20Transfer;

            const policy = {
              type: "ERC20Transfer",
              version: ERC20TransferPolicy.version,
              erc20Decimals: "18",
              maxAmount: parsed.amount,
              allowedTokens: [parsed.tokenAddress],
              allowedRecipients: [parsed.recipientAddress],
            };

            const encodedPolicy = ERC20TransferPolicy.encode(policy);

            const res = await client.executeJs({
              sessionSigs,
              ipfsId: ipfsCid,
              jsParams: {
                params: {
                  pkpEthAddress: parsed.pkpEthAddress,
                  tokenIn: parsed.tokenAddress,
                  recipientAddress: parsed.recipientAddress,
                  amountIn: parsed.amount,
                  chainId: parsed.chainId,
                  rpcUrl: parsed.rpcUrl,
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
        name: "lit-ecdsa-sign",
        description:
          "Sign a message using Lit Protocol PKP (Programmable Key Pair). " +
          "Use this when the user wants to sign a message or data using a Lit Protocol PKP address. " +
          "Requires a PKP Ethereum address and the message to sign.",
        inputSchema: LitEcdsaSignSchema,
        handler: async (input, walletProvider) => {
          try {
            // Input is already validated by AgentKit based on inputSchema
            const parsed = LitEcdsaSignSchema.parse(input);

            const client = await getLitClient(finalConfig);
            const sessionSigs = await getSessionSigs(walletProvider, finalConfig);
            const network = finalConfig.litNetwork || "datil-dev";
            const ipfsCid = IPFS_CIDS[network].ecdsaSign;

            const policy = {
              type: "SignEcdsa",
              version: SignEcdsaPolicy.version,
              allowedPrefixes: [parsed.message],
            };

            const encodedPolicy = SignEcdsaPolicy.encode(policy);

            const res = await client.executeJs({
              sessionSigs,
              ipfsId: ipfsCid,
              jsParams: {
                params: {
                  pkpEthAddress: parsed.pkpEthAddress,
                  message: parsed.message,
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
        name: "lit-uniswap-swap",
        description:
          "Swap tokens on Uniswap using Lit Protocol PKP (Programmable Key Pair). " +
          "Use this when the user wants to swap tokens on Uniswap using a Lit Protocol PKP address. " +
          "Requires a PKP Ethereum address, input token, output token, amount, chain ID, and RPC URL.",
        inputSchema: LitUniswapSwapSchema,
        handler: async (input, walletProvider) => {
          try {
            // Input is already validated by AgentKit based on inputSchema
            const parsed = LitUniswapSwapSchema.parse(input);

            const client = await getLitClient(finalConfig);
            const sessionSigs = await getSessionSigs(walletProvider, finalConfig);
            const network = finalConfig.litNetwork || "datil-dev";
            const ipfsCid = IPFS_CIDS[network].uniswapSwap;

            const policy = {
              type: "UniswapSwap",
              version: UniswapSwapPolicy.version,
              maxAmount: parsed.amountIn,
              allowedTokens: [parsed.tokenIn, parsed.tokenOut],
            };

            const encodedPolicy = UniswapSwapPolicy.encode(policy);

            const res = await client.executeJs({
              sessionSigs,
              ipfsId: ipfsCid,
              jsParams: {
                params: {
                  pkpEthAddress: parsed.pkpEthAddress,
                  tokenIn: parsed.tokenIn,
                  tokenOut: parsed.tokenOut,
                  amountIn: parsed.amountIn,
                  chainId: parsed.chainId,
                  rpcUrl: parsed.rpcUrl,
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


