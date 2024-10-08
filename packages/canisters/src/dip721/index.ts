import { Opt } from "../types"
import * as url from "url"
import path from "path"
import type { ExtendedCanisterConfiguration } from "@crystal/runner"

const __dirname = url.fileURLToPath(new URL(".", import.meta.url))
// const __dirname = url.fileURLToPath(import.meta.url)

const canisterName = "dip721"
export const DIP721 = ({ custodians, logo, name, symbol }, override = { dfx_js: {} }): ExtendedCanisterConfiguration => ({
  type: "custom",
  wasm: path.resolve(__dirname, `./${canisterName}/${canisterName}.wasm`),
  build: "",
  // TODO: fix
  candid: path.resolve(__dirname, `./${canisterName}/${canisterName}.did`),
  // dependencies: [...providers],
  _metadata: {
    standard: "DIP721v2",
  },
  ...override,
  dfx_js: {
    ...override.dfx_js,
    args: [
      Opt({
        custodians: Opt(custodians),
        logo: Opt(logo),
        name: Opt(name),
        symbol: Opt(symbol),
      }),
    ],
  },
})
