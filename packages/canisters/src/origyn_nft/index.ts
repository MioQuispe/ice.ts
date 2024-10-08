import * as url from "url"
import path from "path"
import type { InitArgs } from "./origyn_nft.did"
import { Opt } from "@crystal/runner"
import { Principal } from "@dfinity/principal"
import type { ExtendedCanisterConfiguration } from "@crystal/runner"

const __dirname = url.fileURLToPath(new URL(".", import.meta.url))

const canisterName = "origyn_nft"

type Args = {
  owner: string
  storage_space?: number
}
export const OrigynNFT = ({
                            owner,
                            storage_space = 2048000000,
                          }: Args): ExtendedCanisterConfiguration => ({
  type: "custom",
  build: "",
  wasm: path.resolve(__dirname, `./${canisterName}/${canisterName}.wasm`),
  candid: path.resolve(__dirname, `./${canisterName}/${canisterName}.did`),
  _metadata: {
    standard: "origyn",
  },
  dfx_js: {
    args: [{
      owner: Principal.fromText(owner),
      storage_space: Opt(BigInt(storage_space)),
    } as InitArgs],
  },
})

OrigynNFT.setup = async () => {
  // TODO:
}
