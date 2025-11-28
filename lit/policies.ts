import { z } from "zod";
import { ethers } from "ethers";

const ethereumAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid Ethereum address");

// --- ERC20 Transfer Policy ---

const erc20TransferPolicySchema = z.object({
  type: z.literal("ERC20Transfer"),
  version: z.string(),
  erc20Decimals: z.string(),
  maxAmount: z.string(),
  allowedTokens: z.array(ethereumAddressSchema),
  allowedRecipients: z.array(ethereumAddressSchema),
});

export type ERC20TransferPolicyType = z.infer<typeof erc20TransferPolicySchema>;

export const ERC20TransferPolicy = {
  version: "1.0.0",
  schema: erc20TransferPolicySchema,
  encode: (policy: ERC20TransferPolicyType): string => {
    erc20TransferPolicySchema.parse(policy);
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    return abiCoder.encode(
      [
        "tuple(uint8 erc20Decimals, uint256 maxAmount, address[] allowedTokens, address[] allowedRecipients)",
      ],
      [
        {
          erc20Decimals: policy.erc20Decimals,
          maxAmount: ethers
            .parseUnits(policy.maxAmount, Number(policy.erc20Decimals))
            .toString(),
          allowedTokens: policy.allowedTokens,
          allowedRecipients: policy.allowedRecipients,
        },
      ],
    );
  },
};

// --- ECDSA Sign Policy ---

const signEcdsaPolicySchema = z.object({
  type: z.literal("SignEcdsa"),
  version: z.string(),
  allowedPrefixes: z.array(z.string()),
});

export type SignEcdsaPolicyType = z.infer<typeof signEcdsaPolicySchema>;

export const SignEcdsaPolicy = {
  version: "1.0.0",
  schema: signEcdsaPolicySchema,
  encode: (policy: SignEcdsaPolicyType): string => {
    signEcdsaPolicySchema.parse(policy);
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    return abiCoder.encode(
      ["tuple(string[] allowedPrefixes)"],
      [{ allowedPrefixes: policy.allowedPrefixes }]
    );
  },
};

// --- Uniswap Swap Policy ---

const uniswapSwapPolicySchema = z.object({
  type: z.literal("UniswapSwap"),
  version: z.string(),
  maxAmount: z.string(),
  allowedTokens: z.array(ethereumAddressSchema),
});

export type UniswapSwapPolicyType = z.infer<typeof uniswapSwapPolicySchema>;

export const UniswapSwapPolicy = {
  version: "1.0.0",
  schema: uniswapSwapPolicySchema,
  encode: (policy: UniswapSwapPolicyType): string => {
    uniswapSwapPolicySchema.parse(policy);
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    return abiCoder.encode(
      ["tuple(uint256 maxAmount, address[] allowedTokens)"],
      [
        {
          maxAmount: policy.maxAmount,
          allowedTokens: policy.allowedTokens,
        },
      ],
    );
  },
};

