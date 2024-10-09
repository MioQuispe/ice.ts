# Crystal CLI/SDK

Crystal is a powerful command-line tool and SDK that simplifies and automates complex `dfx` tasks for Internet Computer developers. It provides a TypeScript interface for managing canisters, making your development workflow more efficient and type-safe.

## 🚀 Key Features

- **TypeScript-based Configuration**: Replace `dfx.json` with a more ergonomic `crystal.config.ts`
- **Task Automation**: Create dependency chains with async logic for maximum efficiency
- **Canister Management**: Install and manage canisters directly via npm
- **Boilerplate Generation**: Quickly scaffold common patterns like tokens, NFTs, and DAOs
- **Type Generation**: Automatically generate TypeScript declarations for your canisters
- **Testing Utilities**: Simplify canister testing, with potential `pocket-ic` integration

## 🛠 Quick Start

1. Initialize a new project or integrate with an existing one:
   ```bash
   npx crystal init
   ```

2. Install the necessary packages:
   ```bash
   npm install @crystal/runner @crystal/canisters
   ```

3. Create a `crystal.config.ts` file in your project root:
   ```typescript
   import { defineConfig } from '@crystal/runner';

   export default defineConfig({
     canisters: {
       // Define your canisters here
     },
     tasks: {
       // Define your custom tasks here
     }
   });
   ```

4. Build your canisters:
   ```bash
   npx crystal c
   ```

5. Run custom tasks:
   ```bash
   npx crystal run <task-name>
   ```

## 📚 Documentation

For comprehensive documentation, visit our [official docs](https://docs.crystal-ic.dev).

## 🤝 Community & Support

- [GitHub Issues](https://github.com/MioQuispe/crystal/issues)
- [Community Forum](https://forum.dfinity.org/t/introducing-crystal-cli-sdk)
- [Twitter](https://twitter.com/antimaximal)
<!-- - [Telegram](https://t.me/crystal_ic_dev) -->

## 🌟 Why Crystal?

- **Type Safety**: Catch configuration errors at compile-time
- **Improved Developer Experience**: Intuitive TypeScript-based configuration
- **Efficiency**: Automate complex workflows and reduce boilerplate
- **Flexibility**: Easily extensible for custom project needs
- **Community-Driven**: Built by developers, for developers

## 📣 Feedback

We're constantly improving Crystal based on your feedback. Don't hesitate to open an issue or contribute to the project!

## 📄 License

Crystal is open-source software licensed under the MIT license.
