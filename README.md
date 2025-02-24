![image](https://github.com/user-attachments/assets/90c9aaeb-8421-4595-bd29-89b046636dda)


# ICE

ICE is a powerful task runner and CLI tool for the Internet Computer (similar to hardhat). With ICE, you can create composable workflows, simplify complex setups, and manage canister deployments using TypeScript instead of bash, taking the development experience of the Internet Computer to the next level.

## Features

- **Composable:** Built with composability in mind. Complex workflows & setups can easily be abstracted away.
- **Type-Safe Configuration**: Get immediate feedback on invalid canister arguments and dependencies. Leverage the full power of TypeScript.
- **Npm install canisters:** Easily install & integrate common canisters (e.g. ICRC1, Ledger, NFID, Internet Identity) from NPM with zero setup.
- **Smart context:** Access environment variables, user Principals, or custom config from a single “context object” in the deployment scripts
- **VSCode Extension:** Run tasks from inside your editor. Actor call results displayed inline in your editor, no console logs needed

## Quick Start

1. Install the necessary packages:
   ```bash
   npm i -S @ice.ts/runner @ice.ts/canisters
   ```

2. Create an `ice.config.ts` file in your project root:
   ```typescript
   import { motokoCanister } from '@ice.ts/runner';

   export const my_canister = motokoCanister({
     src: 'canisters/my_canister/main.mo',
   })
   ```

3. Now its available under the exported name:
   ```bash
   npx ice run my_canister
   ```

4. Or deploy all canisters:
   ```bash
   npx ice
   ```


## Dependencies

```typescript
import { motokoCanister, task } from "@ice.ts/runner";

// Create a canister that depends on another one
export const my_other_canister = motokoCanister({
  src: "canisters/my_other_canister/main.mo",
})
  .deps({ my_canister })
```

## Install args

```typescript
import { motokoCanister, task } from "@ice.ts/runner";

// Create a canister that depends on another one
export const my_other_canister = motokoCanister({
  src: "canisters/my_other_canister/main.mo",
})
  .deps({ my_canister })
  .installArgs(async ({ deps }) => {
    // We have access to the actor & 
    const someVal = await deps.my_canister.actor.someMethod();
    // installArgs can do whatever complex setup steps they wish
    const installArgs = [deps.my_canister.canisterId, someVal]
    return installArgs;
  })
```

## Pre-built canisters

```typescript
import {
  InternetIdentity,
  ICRC1Ledger,
  DIP721,
  Ledger,
  DIP20,
  CapRouter,
  NNS,
  CandidUI,
  ICRC7NFT,
  CyclesWallet,
  CyclesLedger,
  NFID,
} from "@ice.ts/canisters"

export const nns = NNS()

export const icrc7_nft = ICRC7NFT()

export const nfid = NFID()
...
```
It's that easy.

## 📚 Documentation

Coming soon

## 🔌 VSCode Extension

Install from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=MioQuispe.vscode-ice-extension).


- **Inline CodeLens:** Quickly execute tasks directly from your source code.
- **Actor Call Results:** results are displayed inline in your code. No more console logs.

## Community & Support

Feel free to open an issue, PR or join the Discord and message me there.

- [Discord](https://discord.gg/SdeC8PF69M)
- [Twitter](https://twitter.com/antimaximal)
