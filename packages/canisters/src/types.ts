import type { HttpAgent } from "@dfinity/agent"
import type { AssetSpecificProperties, CanisterConfiguration, MotokoSpecificProperties, RustSpecificProperties } from "./schema"

export type Opt<T> = [T] | []
export const Opt = <T>(value?: T): Opt<T> => {
  return (value || value === 0) ? ([value]) : []
}

export type CreateProps = {
  canisterId?: string
  agent: HttpAgent
}

export type ExtendedCanisterConfiguration = (
  | CanisterConfiguration
  | RustSpecificProperties
  | MotokoSpecificProperties
  | AssetSpecificProperties
) & {
  _metadata?: { standard?: string }
  dfx_js?: {
    args?: any[]
    canister_id?: {
      [network: string]: string
    }
  }
}
//
// const agent = new HttpAgent({
//   host: "http://0.0.0.0:8000",
//   identity,
//   // TODO: get dfx port
// })
//
// await agent.fetchRootKey().catch(err => {
//   console.warn("Unable to fetch root key. Check to ensure that your local replica is running")
//   console.error(err)
// })
