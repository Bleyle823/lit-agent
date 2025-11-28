import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider } from "../../wallet-providers/evmWalletProvider";
import * as fs from "fs/promises";
import * as LitJsSdk from "@lit-protocol/lit-node-client";
import { LIT_NETWORK, LIT_ABILITY } from "@lit-protocol/constants";
import { createSiweMessage, generateAuthSig, LitActionResource } from "@lit-protocol/auth-helpers";
import { encryptString, decryptToString } from "@lit-protocol/encryption";
import {
  EncryptEnvSchema,
  DecryptEnvSchema,
  LitErc20TransferSchema,
  LitEcdsaSignSchema,
  LitUniswapSwapSchema,
  HelloLitSchema
} from "./schemas";
import { IPFS_CIDS, HELLO_LIT_CODE, LitNetwork } from "./constants";
import { ERC20TransferPolicy, SignEcdsaPolicy, UniswapSwapPolicy } from "./policies";

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

/**
 * Lit Protocol Action Provider
 */
export class LitActionProvider extends ActionProvider<EvmWalletProvider> {
  private litNodeClient: LitJsSdk.LitNodeClient | null = null;
  private config: LitActionProviderConfig;

  constructor(config: LitActionProviderConfig = {}) {
    super("lit", []);
    this.config = {
      litNetwork: "datil-dev",
      debug: false,
      ...config,
    };
  }

  /**
   * Initialize Lit Node Client
   */
  private async getLitClient(): Promise<LitJsSdk.LitNodeClient> {
    if (!this.litNodeClient) {
      this.litNodeClient = new LitJsSdk.LitNodeClient({
        litNetwork: this.config.litNetwork || "datil-dev",
        debug: this.config.debug || false,
      });
      await this.litNodeClient.connect();
    }
    return this.litNodeClient;
  }

  /**
   * Get session signatures for Lit Protocol operations
   */
  private async getSessionSigs(walletProvider: EvmWalletProvider) {
    const client = await this.getLitClient();
    const walletAddress = await walletProvider.getAddress();
    const chainId = (await walletProvider.getNetwork()).chainId;

    return await client.getSessionSigs({
      chain: "ethereum", // Lit usually expects "ethereum" for auth even if on L2, or specific chain name. AgentKit provides chainId.
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

        const signature = await walletProvider.signMessage(toSign);

        return {
          sig: signature,
          derivedVia: "web3.eth.personal.sign",
          signedMessage: toSign,
          address: walletAddress,
        };
      },
    });
  }

  @CreateAction({
    name: "hello",
    description: "Test connection to Lit Protocol",
    schema: HelloLitSchema,
  })
  async hello(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof HelloLitSchema>
  ): Promise<string> {
    const client = await this.getLitClient();
    const sessionSigs = await this.getSessionSigs(walletProvider);

    const res = await client.executeJs({
      sessionSigs,
      code: HELLO_LIT_CODE,
      jsParams: {
        magicNumber: args.magicNumber || 42,
      },
    });

    return JSON.stringify(res.response || res);
  }

  @CreateAction({
    name: "encrypt_env",
    description: "Encrypts a local .env file using Lit Protocol",
    schema: EncryptEnvSchema,
  })
  async encryptEnv(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof EncryptEnvSchema>
  ): Promise<string> {
    const envContent = await fs.readFile(args.envFilePath, "utf-8");
    if (!envContent) throw new Error(`File ${args.envFilePath} is empty or missing`);

    const client = await this.getLitClient();
    const walletAddress = await walletProvider.getAddress();
    const authorizedWallet = args.walletAddress || walletAddress;

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
      network: this.config.litNetwork,
    };

    await fs.writeFile(args.outputPath, JSON.stringify(encryptedData, null, 2));

    return `Encrypted ${args.envFilePath} to ${args.outputPath}. Access control set for ${authorizedWallet}`;
  }

  @CreateAction({
    name: "decrypt_env",
    description: "Decrypts a local .env.encrypted file using Lit Protocol",
    schema: DecryptEnvSchema,
  })
  async decryptEnv(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof DecryptEnvSchema>
  ): Promise<string> {
    const encryptedContent = await fs.readFile(args.encryptedFilePath, "utf-8");
    const encryptedData = JSON.parse(encryptedContent);

    const client = await this.getLitClient();
    const sessionSigs = await this.getSessionSigs(walletProvider);

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

    await fs.writeFile(args.outputPath, decryptedString);

    return `Decrypted ${args.encryptedFilePath} to ${args.outputPath}`;
  }

  @CreateAction({
    name: "erc20_transfer",
    description: "Transfer ERC20 tokens using Lit Protocol",
    schema: LitErc20TransferSchema,
  })
  async erc20Transfer(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof LitErc20TransferSchema>
  ): Promise<string> {
    const client = await this.getLitClient();
    const sessionSigs = await this.getSessionSigs(walletProvider);
    const network = this.config.litNetwork || "datil-dev";
    const ipfsCid = IPFS_CIDS[network].erc20Transfer;

    const policy = {
      type: "ERC20Transfer" as const,
      version: ERC20TransferPolicy.version,
      erc20Decimals: "18", // Assuming 18 decimals, could be parameterized
      maxAmount: args.amount,
      allowedTokens: [args.tokenAddress],
      allowedRecipients: [args.recipientAddress],
    };

    const encodedPolicy = ERC20TransferPolicy.encode(policy);

    const res = await client.executeJs({
      sessionSigs,
      ipfsId: ipfsCid,
      jsParams: {
        params: {
          pkpEthAddress: args.pkpEthAddress,
          tokenIn: args.tokenAddress,
          recipientAddress: args.recipientAddress,
          amountIn: args.amount,
          chainId: args.chainId,
          rpcUrl: args.rpcUrl,
          encodedPolicy,
        },
      },
    });

    return JSON.stringify(res.response || res);
  }

  @CreateAction({
    name: "ecdsa_sign",
    description: "Sign a message using Lit Protocol PKP",
    schema: LitEcdsaSignSchema,
  })
  async ecdsaSign(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof LitEcdsaSignSchema>
  ): Promise<string> {
    const client = await this.getLitClient();
    const sessionSigs = await this.getSessionSigs(walletProvider);
    const network = this.config.litNetwork || "datil-dev";
    const ipfsCid = IPFS_CIDS[network].ecdsaSign;

    const policy = {
      type: "SignEcdsa" as const,
      version: SignEcdsaPolicy.version,
      allowedPrefixes: [args.message],
    };

    const encodedPolicy = SignEcdsaPolicy.encode(policy);

    const res = await client.executeJs({
      sessionSigs,
      ipfsId: ipfsCid,
      jsParams: {
        params: {
          pkpEthAddress: args.pkpEthAddress,
          message: args.message,
          encodedPolicy,
        },
      },
    });

    return JSON.stringify(res.response || res);
  }

  @CreateAction({
    name: "uniswap_swap",
    description: "Swap tokens on Uniswap using Lit Protocol",
    schema: LitUniswapSwapSchema,
  })
  async uniswapSwap(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof LitUniswapSwapSchema>
  ): Promise<string> {
    const client = await this.getLitClient();
    const sessionSigs = await this.getSessionSigs(walletProvider);
    const network = this.config.litNetwork || "datil-dev";
    const ipfsCid = IPFS_CIDS[network].uniswapSwap;

    const policy = {
      type: "UniswapSwap" as const,
      version: UniswapSwapPolicy.version,
      maxAmount: args.amountIn,
      allowedTokens: [args.tokenIn, args.tokenOut],
    };

    const encodedPolicy = UniswapSwapPolicy.encode(policy);

    const res = await client.executeJs({
      sessionSigs,
      ipfsId: ipfsCid,
      jsParams: {
        params: {
          pkpEthAddress: args.pkpEthAddress,
          tokenIn: args.tokenIn,
          tokenOut: args.tokenOut,
          amountIn: args.amountIn,
          chainId: args.chainId,
          rpcUrl: args.rpcUrl,
          encodedPolicy,
        },
      },
    });

    return JSON.stringify(res.response || res);
  }

  supportsNetwork = (network: Network) => true; // Lit works across networks (it's an overlay)
}

export const litActionProvider = (config?: LitActionProviderConfig) => new LitActionProvider(config);

