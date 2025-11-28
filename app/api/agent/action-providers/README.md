# Custom Action Providers

This directory contains custom action providers for your AgentKit agent.

## Quick Start

1. **Create a new action provider file** (e.g., `my-custom-provider.ts`)
2. **Export a function** that returns an `ActionProvider`
3. **Import and add it** to `prepare-agentkit.ts`

## Example Integration

```typescript
// 1. In your action provider file (e.g., my-custom-provider.ts)
import { ActionProvider, Action, WalletProvider } from "@coinbase/agentkit";
import { z } from "zod";

export function myCustomActionProvider(): ActionProvider {
  return {
    id: "my-custom-provider",
    actions: [
      {
        id: "my-action",
        description: "What this action does and when to use it",
        inputSchema: z.object({
          param1: z.string().describe("Description of param1"),
        }),
        handler: async (input, walletProvider: WalletProvider) => {
          // Your logic here
          return { success: true, result: "Action completed!" };
        },
      },
    ],
  };
}

// 2. In prepare-agentkit.ts
import { myCustomActionProvider } from "./action-providers/my-custom-provider";

// 3. Add to actionProviders array
actionProviders: [
  // ... existing providers ...
  myCustomActionProvider(),
]
```

## Files in This Directory

- `example-custom-provider.ts` - A complete working example you can use as a template
- `README.md` - This file

## See Also

- [CUSTOM_ACTION_PROVIDERS_GUIDE.md](../../../../CUSTOM_ACTION_PROVIDERS_GUIDE.md) - Comprehensive guide
- [AgentKit Documentation](https://docs.cdp.coinbase.com/agentkit/docs/welcome)

