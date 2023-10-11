import { useMemo } from "react"
import { NFT, NFTStandards } from "@connect2ic/core"
import { useCanister } from "./useCanister"
import { useConnect } from "./useConnect"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useCapRoot, useCapRouter } from "./useCap"
// TODO: export
import type { TokenWrapper } from "@connect2ic/core"

type NFTName = "icpunks" | "crowns"

type NFTOptions = {
  network?: string
  canisterId: string
  standard: string
  mode?: string
} | {
  // TODO: just use nft name for convenience?
  name: string
}

// TODO: unify with other maps
const nftStandardsMeta = {
  [NFT.dip721]: { cap: true },
  [NFT.dip721v2]: { cap: true },
  // TODO: true...?
  [NFT.dip721v2Final]: { cap: true },
  [NFT.ext]: { cap: false },
  [NFT.c3]: { cap: false },
  [NFT.erc721]: { cap: false },
  [NFT.departuresLabs]: { cap: false },
  [NFT.icpunks]: { cap: false },
  // which version is this??
  [NFT.origyn]: { cap: false },
  // TODO: rename? origynv1?
  ["nftOrigyn"]: { cap: false },
  [NFT.icNaming]: { cap: false },
}

const queryMethods = [
  "getBalance",
  "getDecimals",
  "getHistory",
  "getHolders",
  "getMetadata",
]

const mutationMethods = [
  "mint",
  "send",
]

type NFTParams = {
  standard: string,
  canisterId: string,
  onInit?: (wrapper: TokenWrapper) => void
  mode?: string
}

export const useNFT = (config: NFTParams) => {
  const {
    standard,
    canisterId,
    onInit = () => {
    },
    mode = "auto",
  } = config
  // TODO: modes?
  const wrapperQueryKey = ["canister", "anonymous", "wrapper", canisterId]
  // let s
  // if (standard === "Origyn") {
  //   s = Origyn
  // } else if (standard === "nftOrigyn") {
  //   s = NftOrigyn
  // } else {
  //   s = NFTStandards[standard]
  // }
  const s = NFTStandards[standard]
  const Wrapper = s.Wrapper
  const IDL = s.IDL
  const { data: capRoot } = useCapRoot(canisterId)
  const { data: capRouter } = useCapRouter()
  const { data: actor } = useCanister({
    canisterId,
    idlFactory: IDL.idlFactory,
    mode,
  })
  const hasCap = nftStandardsMeta[standard].cap
  const isCapReady = hasCap ? !!(capRoot && capRouter) : true
  const { data: wrapper } = useQuery({
    queryKey: wrapperQueryKey,
    enabled: !!actor && isCapReady,
    queryFn: async () => {
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
          queryKey: [...wrapperQueryKey, "getUserTokens"],
          enabled: !!wrapper && !!user,
          // TODO: return array if error? or make the return values consistent at least
          queryFn: () => wrapper.getUserTokens(user),
        })
      },
      useCollectionDetails: () => {
        return useQuery({
          queryKey: [...wrapperQueryKey, "getCollectionDetails"],
          enabled: !!wrapper,
          queryFn: () => wrapper.getCollectionDetails(),
        })
      },
      useHistory: () => {
        return useQuery({
          queryKey: [...wrapperQueryKey, "getHistory"],
          enabled: !!wrapper && hasCap && isCapReady,
          queryFn: () => wrapper.getHistory(),
        })
      },
      // useHolders: () => {
      //   return useQuery({
      //     queryKey: [...wrapperQueryKey, "getHolders"],
      //     enabled: !!wrapper,
      //     queryFn: () => wrapper.getHolders()
      //     }
      //   })
      // },
      useSend: () => {
        return useMutation({
          mutationKey: [...wrapperQueryKey, "send"],
          // enabled: !!wrapper,
          mutationFn: (...params) => {
            return wrapper.transfer(...params)
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
      // useBurn: () => {
      //   return useMutation({
      //     mutationKey: [...wrapperQueryKey, "burn"],
      //     // enabled: !!wrapper,
      //     mutationFn: (...params) => {
      //       return wrapper.burn(...params);
      //     }
      //   })
      // },
    }
  }, [wrapper])

  return { wrapper, hooks, actor }
}
