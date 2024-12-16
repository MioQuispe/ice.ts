[todo]
- use did_to_js to convert candid to js
    - fix wasm import issue with tsx

- convert runner to use effect-ts library for errors, loggings, etc.

- let every canister declare its own crystal.config.ts which can be used independently as well as composed with other crystal configs

- Add testing support with pocket-ic. Have canisters deployed already in the test environment (see hardhat-deploy).

- fix identity 64 byte key issue
    - this issue happens when upgrading @dfinity/identity and perhaps other @dfinity/* packages to 2.1.2

- convert project to use vitest workspaces
Defining a Workspace
A workspace should have a vitest.workspace or vitest.projects file in its root (in the same folder as your config file if you have one). Vitest supports ts/js/json extensions for this file.
    - use vite browser mode (playwright)

- write e2e tests for dfx / runner inside nix

- Boilerplate for tasks / plugins

- Allow defining tasks as streams

- what if we could just clone a git repo and import the crystal config and run it?
    - or package.json? add fields? hmm
    - import dfx.json files?
