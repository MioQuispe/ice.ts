import type { QueryClient } from "@tanstack/react-query"
import { QueryClientProvider } from "@tanstack/react-query"
import React, { createContext, useState, PropsWithChildren, useEffect } from "react"
import { createClient } from "@connect2ic/core"
import { IDL } from "@dfinity/candid"

// TODO: give to hooks
const queryClientContext = createContext<QueryClient | undefined>(undefined)

const Connect2ICContext = createContext<{
  client: ReturnType<typeof createClient>
  dialog: {
    open: () => void
    close: () => void
    isOpen: boolean
  }
  canisters: {
    [canisterName: string]: {
      canisterId: string
      idlFactory: IDL.InterfaceFactory
    }
  }
  canisterIds: {
    [canisterId: string]: string
  }
  capRouterId?: string
}>({} as any)

type Props = {
  client: ReturnType<typeof createClient>
  capRouterId?: string
  canisters?: {
    [canisterName: string]: {
      canisterId: string
      idlFactory: IDL.InterfaceFactory
    }
  }
}

const Connect2ICProvider: React.FC<PropsWithChildren<Props>> = ({
                                                                  children,
                                                                  client,
                                                                  // canisters,
                                                                  capRouterId = "lj532-6iaaa-aaaah-qcc7a-cai",
                                                                }) => {
  const [open, setOpen] = useState<boolean>(false)

  const dialog = {
    open: () => setOpen(true),
    close: () => setOpen(false),
    isOpen: open,
  }

  const canisterIds = Object.keys(client.canisters).reduce((acc, canisterName) => {
    const canisterId = client.canisters[canisterName].canisterId
    return ({
      ...acc,
      [canisterId]: canisterName,
    })
  }, {})

  useEffect(() => {
    if (!client) {
      return
    }
    (async () => {
      await client.init()
      // TODO: failure?
    })()
  }, [client])

  return (
    <Connect2ICContext.Provider value={{
      client,
      dialog,
      canisters: client.canisters,
      canisterIds,
      capRouterId,
    }}>
      <QueryClientProvider client={client.queryClient} context={queryClientContext}>
        {children}
      </QueryClientProvider>
    </Connect2ICContext.Provider>
  )
}

export { Connect2ICProvider, Connect2ICContext }
