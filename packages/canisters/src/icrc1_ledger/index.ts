import { Opt } from "../types"
import * as url from "node:url"
import path from "node:path"
import type { ExtendedCanisterConfiguration } from "../types"
import type { InitArgs, Account, MetadataValue, FeatureFlags } from "./icrc1_ledger.types"

const __dirname = url.fileURLToPath(new URL(".", import.meta.url))
// const __dirname = url.fileURLToPath(import.meta.url)


// $ dfx deploy icrc1-ledger --argument "(record {
// token_symbol = \"TEX\";
// token_name = \"Token example\";
// minting_account = record { owner = principal \"$PRINCIPAL\"  };
//   transfer_fee = 10_000;
//   metadata = vec {};
//   initial_balances = vec {};
//   archive_options = record {
//     num_blocks_to_archive = 2000;
//     trigger_threshold = 1000;
//     controller_id = principal \"$PRINCIPAL\";
//   };
// },)"


// It’s finally time to mint some tokens! Let’s mint 1_000_000 tokens to the principal akllx-q5q7v-sgdck-cjd7y-izqql-ck5rp-ee3c7-kzrea-k3fnf-pcuaw-pqe.
//
//     $ dfx canister call icrc1-ledger icrc1_transfer '(record {
// to = record {owner = principal "akllx-q5q7v-sgdck-cjd7y-izqql-ck5rp-ee3c7-kzrea-k3fnf-pcuaw-pqe"};
// amount=1_000_000
// },)'

const canisterName = "icrc1_ledger"
export const ICRC1Ledger = ({ custodians, logo, name, symbol, minting_account, controller_id }, override = { dfx_js: {} }): ExtendedCanisterConfiguration => ({
  type: "custom",
  wasm: path.resolve(__dirname, `./${canisterName}/${canisterName}.wasm`),
  build: "",
  // TODO: fix
  candid: path.resolve(__dirname, `./${canisterName}/${canisterName}.did`),
  // dependencies: [...providers],
  _metadata: {
    standard: "icrc1",
  },
  ...override,
  dfx_js: {
    ...override.dfx_js,
    args: [{
      // Opt({
      //   custodians: Opt(custodians),
      //   logo: Opt(logo),
      //   name: Opt(name),
      //   symbol: Opt(symbol),
      // }),
      decimals: Opt<number>(8),
      token_symbol: "",
      transfer_fee: 0n,
      // metadata : Array<[string, MetadataValue]>,
      metadata : [],
      minting_account: minting_account,
      // initial_balances: Array<[Account, bigint]>,
      initial_balances: [],
      maximum_number_of_accounts: Opt<bigint>(),
      accounts_overflow_trim_quantity: Opt<bigint>(),
      fee_collector_account: Opt<Account>(),
      archive_options: {
        num_blocks_to_archive: 0n,
        max_transactions_per_response: Opt<bigint>(0n),
        trigger_threshold: 0n,
        max_message_size_bytes: Opt<bigint>(0n),
        cycles_for_archive_creation: Opt<bigint>(0n),
        node_max_memory_size_bytes: Opt<bigint>(0n),
        controller_id: controller_id,
      },
      max_memo_length: Opt<number>(0),
      token_name: "",
      feature_flags: Opt<FeatureFlags>(),
    } as InitArgs],
  },
})
