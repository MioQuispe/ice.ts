# ICE CLI/SDK

ICE is a powerful command-line tool and SDK that simplifies and automates complex `dfx` tasks for Internet Computer developers. Experience an efficient, type-safe, and integrated workflow when managing canisters and deploying advanced projects.

## Features

- **TypeScript-based Configuration:** Replace cumbersome `dfx.json` with a more ergonomic `ice.config.ts` for seamless configuration.
- **Task Automation:** Create dependency chains with async logic for efficient custom task workflows.
- **Canister Management:** Easily install, update, and maintain canisters directly via npm.
- **Type Generation:** Automatically generate TypeScript declarations for your canisters for improved type safety.
- **Integrated VSCode Extension:** Enhance your development experience with inline logs, CodeLens commands, and more through our dedicated VSCode extension.

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

3. Build your canisters:
   ```bash
   npx ice
   ```

4. Run custom tasks:
   ```bash
   npx ice run <task-name>
   ```

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