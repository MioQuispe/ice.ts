[todo]
- use did_to_js to convert candid to js
    - fix wasm import issue with tsx

- convert runner to use effect-ts library for errors, loggings, etc.

- let every canister declare its own crystal.config.ts which can be used independently as well as composed with other crystal configs

- fix identity 64 byte key issue
    - this issue happens when upgrading @dfinity/identity and perhaps other @dfinity/* packages to 2.1.2

- convert project to use vitest workspaces
Defining a Workspace
A workspace should have a vitest.workspace or vitest.projects file in its root (in the same folder as your config file if you have one). Vitest supports ts/js/json extensions for this file.
    - use vite browser mode (playwright)

- write e2e tests for dfx / runner inside nix