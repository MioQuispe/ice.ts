import { Opt } from "../types"
import * as url from "url"
import type { ExtendedCanisterConfiguration } from "@hydra.icp/runner"

const __dirname = url.fileURLToPath(new URL(".", import.meta.url))

const canisterName = "is20_token_factory"
export const IS20 = ({
                  owner,
                }, override = {}): ExtendedCanisterConfiguration => ({
  package: canisterName,
  type: "rust",
  wasm: `target/wasm32-unknown-unknown/release/${canisterName}.wasm`,
  // TODO: fix
  candid: `canisters/${canisterName}/${canisterName}.did`,
  // dependencies: [...providers],
  _metadata: {
    standard: "IS20",
  },
  dfx_js: {
    args: [
      owner, // TODO: ???
      Opt(null), // TODO: ???
    ],
  },
  ...override,
})
