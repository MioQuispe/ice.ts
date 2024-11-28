import path from "node:path"
import { Opt } from "../types"
import { Principal } from "@dfinity/principal"
import * as url from "node:url"
import fs from "node:fs"
import type { ExtendedCanisterConfiguration } from "../types"

const appDirectory = fs.realpathSync(process.cwd())
const __dirname = url.fileURLToPath(new URL(".", import.meta.url))

export const ICRC1Ref = ({
                           founder,
                           fee = 0,
                           name = "ICRC1 Token",
                           symbol = "ICRC1",
                           totalSupply = 100_000_000,
                           decimals = 8,
                         }, override = {}): ExtendedCanisterConfiguration => ({
  type: "motoko",
  main: path.resolve(appDirectory, "./canisters/icrc1_ref_token/ICRC1.mo"),
  _metadata: {
    standard: "ICRC1",
  },
  dfx_js: {
    args: [{
      initial_mints: [
        { account: { owner: Principal.from(founder), subaccount: Opt() }, amount: totalSupply },
      ],
      // TODO: check if optional
      minting_account: { owner: Principal.from(founder), subaccount: Opt() },
      token_name: name,
      token_symbol: symbol,
      decimals,
      transfer_fee: fee,
      // initial_mints : [{ account : { owner : Principal; subaccount : ?Blob }; amount : Nat }];
      // minting_account : { owner : Principal; subaccount : ?Blob };
      // token_name : Text;
      // token_symbol : Text;
      // decimals : Nat8;
      // transfer_fee : Nat
    }],
  },
  ...override,
})
