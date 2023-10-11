import { useContext, useEffect, useMemo, useState } from "react"
import { TokenStandards, TOKEN, TokenWrapper } from "@connect2ic/core"
import { useCanister } from "./useCanister"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useCapRoot, useCapRouter } from "./useCap"

// TODO: unify with other maps
const tokenStandardsMeta = {
  [TOKEN.dip20]: { cap: true },
  [TOKEN.drc20]: { cap: false },
  [TOKEN.xtc]: { cap: false },
  [TOKEN.wicp]: { cap: false },
  [TOKEN.ext]: { cap: false },
  [TOKEN.icp]: { cap: false },
  [TOKEN.icrc1]: { cap: false },
}

type Params = {
  standard: string,
  canisterId: string,
  onInit?: (wrapper: TokenWrapper) => void
  mode?: string
}

export const useToken = (config: Params) => {
  const {
    standard,
    canisterId,
    onInit = () => {
    },
    mode = "auto",
  } = config
  // TODO: modes?
  const wrapperQueryKey = ["canister", "anonymous", "wrapper", canisterId]
  const { Wrapper, IDL } = TokenStandards[standard]
  const { data: capRoot } = useCapRoot(canisterId)
  const { data: capRouter } = useCapRouter()
  const { data: actor } = useCanister({
    canisterId,
    idlFactory: IDL.idlFactory,
    mode,
  })
  const hasCap = tokenStandardsMeta[standard].cap
  const isCapReady = hasCap ? !!(capRoot && capRouter) : true
  const { data: wrapper } = useQuery({
    queryKey: wrapperQueryKey,
    enabled: !!actor && isCapReady,
    queryFn: async () => {
      // TODO: capRoot, capRouter, actor dont exist yet...
      if (hasCap) {
        return new Wrapper({ actor, canisterId, capRoot, capRouter })
      }
      return new Wrapper({ actor, canisterId })
    },
  })
  const hooks = useMemo(() => {
    return {
      useBalance: (user) => {
        return useQuery({
          queryKey: [...wrapperQueryKey, "getBalance"],
          enabled: !!wrapper && !!user,
          queryFn: () => {
            return wrapper.getBalance(user)
          },
        })
      },
      useMetadata: () => {
        return useQuery({
          queryKey: [...wrapperQueryKey, "getMetadata"],
          enabled: !!wrapper,
          queryFn: () => {
            return wrapper.getMetadata()
          },
        })
      },
      useDecimals: () => {
        return useQuery({
          queryKey: [...wrapperQueryKey, "getDecimals"],
          enabled: !!wrapper,
          queryFn: () => {
            return wrapper.getDecimals()
          },
        })
      },
      useHistory: () => {
        return useQuery({
          queryKey: [...wrapperQueryKey, "getHistory"],
          enabled: !!wrapper && hasCap && isCapReady,
          queryFn: () => {
            return wrapper.getHistory()
          },
        })
      },
      useHolders: () => {
        return useQuery({
          queryKey: [...wrapperQueryKey, "getHolders"],
          enabled: !!wrapper,
          queryFn: () => {
            return wrapper.getHolders()
          },
        })
      },
      useSend: () => {
        return useMutation({
          mutationKey: [...wrapperQueryKey, "send"],
          // enabled: !!wrapper,
          mutationFn: (...params) => {
            return wrapper.send(...params)
          },
        })
      },
      useMint: () => {
        return useMutation({
          mutationKey: [...wrapperQueryKey, "mint"],
          // enabled: !!wrapper,
          mutationFn: (...params) => {
            return wrapper.mint(...params)
          },
        })
      },
    }
  }, [wrapper])

  return { wrapper, hooks, actor }
}
