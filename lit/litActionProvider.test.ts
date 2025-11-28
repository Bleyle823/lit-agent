import { litActionProvider } from "./litActionProvider";
import { EvmWalletProvider } from "../../wallet-providers/evmWalletProvider";
import * as LitJsSdk from "@lit-protocol/lit-node-client";
import * as fs from "fs/promises";

jest.mock("@lit-protocol/lit-node-client");
jest.mock("@lit-protocol/encryption");
jest.mock("@lit-protocol/auth-helpers");
jest.mock("fs/promises");

describe("LitActionProvider", () => {
  let provider: ReturnType<typeof litActionProvider>;
  let mockWalletProvider: jest.Mocked<EvmWalletProvider>;
  let mockLitNodeClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLitNodeClient = {
      connect: jest.fn(),
      getSessionSigs: jest.fn(),
      executeJs: jest.fn().mockResolvedValue({ response: JSON.stringify({ message: "success" }) }),
      getLatestBlockhash: jest.fn().mockResolvedValue("0xblockhash"),
    };

    (LitJsSdk.LitNodeClient as unknown as jest.Mock).mockImplementation(() => mockLitNodeClient);

    mockWalletProvider = {
      getAddress: jest.fn().mockResolvedValue("0x1234567890123456789012345678901234567890"),
      signMessage: jest.fn().mockResolvedValue("0xsignature"),
      getNetwork: jest.fn().mockResolvedValue({ chainId: "1" }),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    provider = litActionProvider();
  });

  describe("hello", () => {
    it("should execute hello action", async () => {
      const args = { magicNumber: 42 };
      const result = await provider.hello(mockWalletProvider, args);
      
      expect(result).toContain("success");
      expect(mockLitNodeClient.connect).toHaveBeenCalled();
      expect(mockLitNodeClient.executeJs).toHaveBeenCalled();
    });
  });

  describe("encryptEnv", () => {
    it("should encrypt env file", async () => {
      (fs.readFile as jest.Mock).mockResolvedValue("SECRET=value");
      const encryptionMock = require("@lit-protocol/encryption");
      encryptionMock.encryptString.mockResolvedValue({
        ciphertext: "encrypted",
        dataToEncryptHash: "hash",
      });

      const args = {
        envFilePath: ".env",
        outputPath: ".env.encrypted",
      };

      const result = await provider.encryptEnv(mockWalletProvider, args);

      expect(result).toContain("Encrypted .env to .env.encrypted");
      expect(fs.readFile).toHaveBeenCalledWith(".env", "utf-8");
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });
});

