import * as url from "url"
import path from "path"
import type { ExtendedCanisterConfiguration } from "@hydra.icp/runner"

const __dirname = url.fileURLToPath(new URL(".", import.meta.url))

const canisterName = "dip20"
export const DIP20 = ({
                        logo,
                        name,
                        symbol,
                        decimals,
                        totalSupply,
                        owner,
                        fee,
                        feeTo,
                        capRouterId,
                      }, override = {}): ExtendedCanisterConfiguration => ({
  type: "custom",
  build: "",
  wasm: path.resolve(__dirname, `./${canisterName}/${canisterName}.wasm`),
  candid: path.resolve(__dirname, `./${canisterName}/${canisterName}.did`),
  _metadata: {
    standard: "DIP20",
  },
  dfx_js: {
    args: [
      logo, // logo: String
      name, // name: String
      symbol, // symbol: String
      decimals, // decimals: u8,
      totalSupply, // total_supply: Nat,
      owner, // owner: Principal,
      fee, // fee: Nat,
      feeTo, // fee_to: Principal,
      capRouterId, // cap: Principal,
    ],
  },
  ...override,
})
