import { useContext } from "react"
import { Connect2ICContext } from "../context"
import { IDL } from "@dfinity/candid"
// import { createAnonymousActor } from "@connect2ic/core"
import { useQuery } from "@tanstack/react-query"
import { useConnect } from "./useConnect"
import { useAnonymousProvider } from "./useAnonymousProvider"
import { useClient } from "./useClient"

export type CanisterOptions<T> = {
  mode?: string
  network?: string
  sessionId?: string
  agentOptions?: any // TODO: proper types
  // onInit?: (service: T) => void
}

export const useCanisterById = <T>(canisterId, options: CanisterOptions<T> = {
  mode: "auto", // "anonymous" | "connected"
  network: "local",
}) => {
  const { canisters } = useContext(Connect2ICContext)
  const canisterIds = Object.keys(canisters).reduce((acc, canisterName) => {
    const { canisterId } = canisters[canisterName]
    acc[canisterId] = canisterName
    return acc
  }, {})
  const canisterName = canisterIds[canisterId]
  // TODO: __get_candid_interface_tmp_hack ?
  return useCanister(canisterName, options)
}

export const useCanisters: any = () => {
  const { canisters } = useContext(Connect2ICContext)
  return canisters
}

type CanisterDeclaration<T> = {
  // TODO: mandatory
  canisterId: string,
  idlFactory: IDL.InterfaceFactory,
  service?: T,
}

export const useCanister: any = <T>(canisterNameOrDeclaration: string | CanisterDeclaration<T>, options: CanisterOptions<T> = {}) => {
  const {
    mode = "auto", // "anonymous" | "connected"
    network = "local",
    agentOptions,
    // onInit = () => {
    // },
  } = options
  const hasCanisterName = typeof canisterNameOrDeclaration === "string"
  const { canisters } = useContext(Connect2ICContext)
  // TODO: broken
  const { isConnected, activeProvider } = useConnect()
  const client = useClient()
  let canisterId = hasCanisterName ? canisters[canisterNameOrDeclaration].canisterId : canisterNameOrDeclaration.canisterId
  let idlFactory = hasCanisterName ? canisters[canisterNameOrDeclaration].idlFactory : canisterNameOrDeclaration.idlFactory

  const actorQueryKey = ["canister", mode, canisterId]
  return useQuery({
    queryKey: actorQueryKey,
    queryFn: () => {
      if (mode === "auto") {
        if (isConnected) {
          return activeProvider!.createActor(canisterId, idlFactory)
        } else {
          return client.createAnonymousActor(canisterId, idlFactory)
          // return createAnonymousActor(
          //   canisterId,
          //   idlFactory,
          //   agentOptions,
          // )
        }
      }
      if (mode === "anonymous") {
        return client.createAnonymousActor(canisterId, idlFactory)
        // return createAnonymousActor(
        //   canisterId,
        //   idlFactory,
        //   agentOptions,
        // )
      }
      if (mode === "connected") {
        return activeProvider!.createActor(canisterId, idlFactory)
      }
    },
  })

  // useEffect(() => {
  //   // TODO: what happens if mode changes? does it re-init?
  //   if (queries[mode].status === "success") {
  //     onInit(queries[mode].data as T)
  //   }
  // }, [queries[mode]])

}
