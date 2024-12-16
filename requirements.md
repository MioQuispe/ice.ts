# Crystal CLI/SDK - Requirements Specification

## Overview
**Crystal** is a command-line tool (CLI) and SDK designed to simplify and automate complex `dfx` tasks for Internet Computer developers. It provides a TypeScript interface for managing canisters, making canister-related tasks composable and easier to automate. Crystal replaces the traditional `dfx.json` with a more ergonomic and type-safe `crystal.config.ts` file. It is a task runner and allows you to generate templates, bindings and boilerplate code for tokens, NFTs, and DAOs as well.

## Purpose
Crystal aims to:
- Automate workflows for the Internet Computer with a focus on ease of use and developer experience.
- Provide a TypeScript-based configuration system that reduces errors through type checking.
- Generate common boilerplate code for tokens, NFTs, and DAOs to accelerate development.

## Target Audience
- **Developers** working on Internet Computer projects, writing smart contracts in Motoko, Rust, or TypeScript.
- Teams seeking improved automation, type safety, and an ergonomic interface for managing canisters.

## Tech Stack
- **Blockchain**: Internet Computer
- **Languages**: Motoko / Rust (for smart contracts) and TypeScript (for configuration).
- **Installation**: Via npm: `npm i -S @crystal/runner`

## User Flow
1. Users either initialize a new project with `npx crystal` or integrate Crystal into an existing project.
2. Install necessary packages: `@crystal/runner` and `@crystal/canisters` via npm.
3. Create a `crystal.config.ts` file in the project root.
4. Define canisters and tasks within `crystal.config.ts`.
5. Build canisters using `npx crystal c` or as an npm script (e.g., `"canisters": "crystal canisters:*"`).
6. Automatically generate TypeScript declarations and types for the canisters, which can be imported by the developer.

## Core Features

### 1. Canister Installation via npm
Crystal allows developers to install canisters directly from npm, managing dependencies in a more efficient way than modifying `dfx.json` manually.

#### Requirements:
- Use `npm i <canister-name>` to install a canister.
- Configure installed canisters in `crystal.config.ts`.

### 2. TypeScript-Based Configuration (`crystal.config.ts`)
Crystal replaces the `dfx.json` file with `crystal.config.ts`, giving developers the power of TypeScript for their canister configurations.

#### Requirements:
- Developers define canisters, tasks, and configurations using TypeScript.
- Support async/await logic within the configuration file for better task handling.
- Automatically catch type errors at compile time.

### 3. Task Automation with Dependencies & Async Logic
Crystal allows developers to create tasks with dependency chains and asynchronous logic. Tasks should run concurrently with maximum parallelism, enhancing workflow efficiency.

#### Requirements:
- Tasks should support dependencies and concurrent execution.
- Developers can define tasks with async/await syntax.
- Tasks can be executed via the CLI with commands such as `crystal run <task-name>`.

### 4. Boilerplate Code Generation (Tokens, NFTs, DAOs)
Crystal generates starter templates for common use cases, reducing the need for developers to write repetitive boilerplate code.

#### Requirements:
- Generate `icrc1` token boilerplate code with future plans to add NFTs and DAOs.
- Developers should use a command like `crystal generate <type>` to create the necessary scaffolding.
- Support customization of generated code (e.g., initial token supply for `icrc1` tokens).

### 5. Declarations and Type Generation
Crystal generates TypeScript declarations and types for the canisters to facilitate easy importing and type-safe interactions.

#### Requirements:
- Automatically generate types when canisters are built with `crystal c`.
- Types should be importable into the project’s TypeScript codebase.
- Generate React, Vue, Svelte and other frameworks bindings for canisters.
    - useCanister() hook for React
    - useCanister() composable for Vue
    - useCanister() function for Svelte
    These should be automatically typed for the canisters

## Non-functional Requirements

### 1. Error Handling
- Handle all `dfx`-related errors, providing clear and actionable error messages.
- Suggest fixes for common issues, such as configuration or dependency errors.

### 2. Documentation and Help
- Provide a comprehensive documentation site detailing all commands, configurations, and features.
- Offer inline help via `crystal <command> --help` to provide immediate assistance with syntax and options.

### 3. Testing Support
Crystal includes utilities for easier testing of canisters, possibly integrating with `pocket-ic`. Have canisters deployed already in the test environment (see hardhat-deploy).

#### Requirements:
- Simplify testing by generating test utilities for canisters.
- Potential integration with lightweight tools such as `pocket-ic` for running tests.

### 4. Extensibility
Crystal’s architecture should support future extensibility, including potential integration with a plugin system.

#### Future Requirement:
- Support plugin extensions to allow developers to add custom functionality.
- Evolve task definition to resemble Hardhat’s structure for improved scalability and flexibility.

## Feedback and Community Engagement

### 1. GitHub Repository and Forum Post
- Create a GitHub repository for issues, pull requests, and feature suggestions.
- Post on the official forum for community feedback and discussions.

### 2. Marketing and Outreach
- Promote the tool via Twitter, Telegram, and the forum.
- Create videos and presentations to showcase the tool and its features to attract more users and gain support for a grant application.

#### Grant Application:
- Develop a compelling grant proposal, including video showcases, to convince the community to vote in favor of the tool.

## Future Features (Backlog)
- **Canister Update Automation**: Automate updating of canisters to newer versions.
- **Multi-Environment Configuration**: Add support for handling multiple environments (e.g., development, production) within `crystal.config.ts`.
- **Plugin System**: Evolve the architecture to support a plugin system, allowing developers to extend Crystal’s functionality with custom commands and features.
- **Templates**: Add templates for React, Vue, Svelte, and more with `crystal create <project-name>`