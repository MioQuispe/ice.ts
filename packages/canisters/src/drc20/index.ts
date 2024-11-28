import path from "node:path"
import { Opt } from "../types"
import * as url from "node:url"
import fs from "node:fs"
import type { ExtendedCanisterConfiguration } from "../types"

const appDirectory = fs.realpathSync(process.cwd())
// const __dirname = url.fileURLToPath(new URL(".", import.meta.url))
const __dirname = url.fileURLToPath(import.meta.url)

export const DRC20 = ({
                 founder,
                 fee = 0,
                 name = "DRC20 Token",
                 symbol = "DRC20",
                 totalSupply = 100_000_000,
                 decimals = 8,
               }, override = {}): ExtendedCanisterConfiguration => ({
  type: "motoko",
  main: path.resolve(appDirectory, "./canisters/drc20_token/ICRC1.mo"),
  _metadata: {
    standard: "DRC20",
  },
  dfx_js: {
    args: [{
      fee: fee,
      symbol: Opt(symbol),
      decimals,
      name: Opt(name),
      totalSupply: totalSupply,
      metadata: [],
      founder: Opt(founder),
      // initial_mints : [{ account : { owner : Principal; subaccount : ?Blob }; amount : Nat }];
      // minting_account : { owner : Principal; subaccount : ?Blob };
      // token_name : Text;
      // token_symbol : Text;
      // decimals : Nat8;
      // transfer_fee : Nat
    }/* as InitArgs*/],

    // (init : {
    // initial_mints : [{ account : { owner : Principal; subaccount : ?Blob }; amount : Nat }];
    // minting_account : { owner : Principal; subaccount : ?Blob };
    // token_name : Text;
    // token_symbol : Text;
    // decimals : Nat8;
    // transfer_fee : Nat
    // })
  },
  ...override,
})
