import { HttpAgent } from "@dfinity/agent"

export const Opt = <T>(value?): [T] | [] => {
  return (value || value === 0) ? ([value]) : []
}

export type CreateProps = {
  canisterId?: string
  agent: HttpAgent
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
