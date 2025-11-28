# Lit Protocol Action Provider Integration

The Lit Protocol action provider has been successfully integrated into your AgentKit agent! 🎉

## What Was Done

1. **Created Lit Action Provider Adapter** (`app/api/agent/action-providers/lit-action-provider.ts`)
   - Converted the class-based Lit provider to AgentKit's function-based format
   - Integrated all 6 Lit Protocol actions:
     - `lit-hello` - Test Lit Protocol connection
     - `lit-encrypt-env` - Encrypt .env files using Lit Protocol
     - `lit-decrypt-env` - Decrypt encrypted .env files
     - `lit-erc20-transfer` - Transfer ERC20 tokens via Lit PKP
     - `lit-ecdsa-sign` - Sign messages using Lit PKP
     - `lit-uniswap-swap` - Swap tokens on Uniswap via Lit PKP

2. **Installed Required Dependencies**
   - `@lit-protocol/lit-node-client`
   - `@lit-protocol/constants`
   - `@lit-protocol/auth-helpers`
   - `@lit-protocol/encryption`
   - `ethers`

3. **Integrated into Agent Configuration**
   - Added the Lit provider to `prepare-agentkit.ts`
   - Configured with environment variables support

## Configuration

The Lit provider can be configured via environment variables in your `.env` file:

```env
# Lit Protocol Configuration (optional)
LIT_NETWORK=datil-dev  # Options: "datil-dev", "datil-test", "datil"
LIT_DEBUG=false        # Set to "true" to enable debug mode
```

## Available Actions

Your agent can now use these Lit Protocol actions:

### 1. **lit-hello**
Test the Lit Protocol connection.
- **Usage**: "Test Lit Protocol" or "Hello Lit"
- **Optional Parameters**: `magicNumber` (number)

### 2. **lit-encrypt-env**
Encrypt a .env file using Lit Protocol.
- **Usage**: "Encrypt my .env file"
- **Parameters**:
  - `envFilePath` (optional, default: ".env")
  - `outputPath` (optional, default: ".env.encrypted")
  - `walletAddress` (optional, defaults to agent's wallet)

### 3. **lit-decrypt-env**
Decrypt an encrypted .env file.
- **Usage**: "Decrypt my .env file"
- **Parameters**:
  - `encryptedFilePath` (optional, default: ".env.encrypted")
  - `outputPath` (optional, default: ".env")

### 4. **lit-erc20-transfer**
Transfer ERC20 tokens using Lit Protocol PKP.
- **Usage**: "Transfer 100 tokens to 0x..."
- **Required Parameters**:
  - `pkpEthAddress` - The PKP Ethereum address
  - `tokenAddress` - ERC20 token contract address
  - `recipientAddress` - Recipient wallet address
  - `amount` - Amount to transfer (as string)
  - `chainId` - Network chain ID
  - `rpcUrl` - RPC URL for the network

### 5. **lit-ecdsa-sign**
Sign a message using Lit Protocol PKP.
- **Usage**: "Sign this message: Hello World"
- **Required Parameters**:
  - `pkpEthAddress` - The PKP Ethereum address
  - `message` - Message to sign

### 6. **lit-uniswap-swap**
Swap tokens on Uniswap using Lit Protocol PKP.
- **Usage**: "Swap 1 ETH for USDC on Uniswap"
- **Required Parameters**:
  - `pkpEthAddress` - The PKP Ethereum address
  - `tokenIn` - Token to sell (contract address)
  - `tokenOut` - Token to buy (contract address)
  - `amountIn` - Amount to swap (as string)
  - `chainId` - Network chain ID
  - `rpcUrl` - RPC URL for the network

## Testing the Integration

1. **Start the development server** (already running):
   ```bash
   npm run dev
   ```

2. **Open the application**: http://localhost:3000

3. **Test with the agent**:
   - Try: "Test Lit Protocol connection"
   - Try: "Hello Lit with magic number 42"
   - Try: "Encrypt my .env file"

## File Structure

```
app/api/agent/action-providers/
├── lit-action-provider.ts      # Main Lit provider adapter
├── lit/
│   ├── schemas.ts              # Zod schemas for all actions
│   ├── constants.ts            # IPFS CIDs and Lit network configs
│   └── policies.ts             # Policy encoding for Lit actions
└── README.md                   # Action providers documentation
```

## Next Steps

1. **Test each action** with your agent to ensure they work correctly
2. **Configure Lit Network** if you want to use a different network (datil-test or datil)
3. **Set up PKP addresses** if you plan to use PKP-based actions (erc20-transfer, ecdsa-sign, uniswap-swap)
4. **Review security** - Make sure you understand the access control conditions for encrypted files

## Troubleshooting

- **Connection Issues**: Check that your network allows connections to Lit Protocol nodes
- **Signing Errors**: Ensure your wallet provider is properly configured with CDP credentials
- **PKP Actions**: Make sure you have valid PKP addresses configured before using PKP-based actions

## Resources

- [Lit Protocol Documentation](https://developer.litprotocol.com/)
- [AgentKit Documentation](https://docs.cdp.coinbase.com/agentkit/docs/welcome)
- [Custom Action Providers Guide](./CUSTOM_ACTION_PROVIDERS_GUIDE.md)

