import { DfxJson } from "../../schema.js"
import url from "url"
import fs from "fs"
import path from "path"
import { getCanisterIds } from "../../index.js"
import Handlebars from "handlebars"

const appDirectory = fs.realpathSync(process.cwd())
const fromAppDir = (path) => `${appDirectory}/${path}`

export const generateDeclarations = async (dfxConfig: DfxJson) => {
  // TODO: write did / ts files to declarations dir
  const canisterIds = getCanisterIds()
  const __dirname = url.fileURLToPath(new URL(".", import.meta.url))
  for (const [canisterName, canisterId] of Object.entries(canisterIds)) {
    const canisterTemplateString = fs.readFileSync(path.resolve(__dirname, "./templates/canister.hbs"), "utf8")
    const canisterTemplate = Handlebars.compile(canisterTemplateString)
    const canisterResult = canisterTemplate({
      // TODO:
      metadata: {},
      // TODO: different networks
      canister_id: canisterId,
      canister_service_path: `../.dfx/local/canisters/${canisterName}/service.did`,
      canister_idl_factory_path: `../.dfx/local/canisters/${canisterName}/service.did.js`,
      service_type_param: "<_SERVICE>",
    })
    try {
      // TODO: check if dir exists
      fs.writeFileSync(fromAppDir(`declarations/${canisterName}.ts`), canisterResult)
    } catch (e) {
      console.log(e)
    }
  }
  const canistersTemplateString = fs.readFileSync(path.resolve(__dirname, "./templates/canisters.hbs"), "utf8")
  const canistersTemplate = Handlebars.compile(canistersTemplateString)
  const canistersResult = canistersTemplate({ canisters: Object.keys(canisterIds) })
  try {
    fs.writeFileSync(fromAppDir(`declarations/canisters.ts`), canistersResult)
  } catch (e) {
    console.log(e)
  }
}

// TODO: extend task?
