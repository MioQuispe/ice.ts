import fs from "fs"
import { extendConfig, getIdentity } from "../../index"
import { ICRC1Ledger, InternetIdentity, Ledger } from "@hydra.icp/canisters"

const appDirectory = fs.realpathSync(process.cwd())
const fromAppDir = (path) => `${appDirectory}/${path}`

const defaultUser = await getIdentity()

extendConfig((config, userConfig) => {
  config.canisters = [
    ...userConfig.canisters,
    // TODO: NNS
    // ICRC1Ledger(),
    InternetIdentity({ owner: defaultUser.principal }),
    // TODO: declarations, wrapper, canisterConfig, scripts/hooks?, npm deps
    Ledger({
      minting_account: defaultUser.accountId,
      initial_values: {
        [defaultUser.accountId]: 100_000_000_000,
      },
    }),
  ]
})
