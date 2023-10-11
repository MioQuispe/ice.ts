import React, { useCallback, useContext, useEffect, useState, useSyncExternalStore } from "react"
import { Connect2ICContext } from "../context"
import { CLIENT_STATUS } from "@connect2ic/core"
import { useClient } from "./useClient"

type Props = {
  onInit?: () => void
}

export const useAnonymousProvider = (props?: Props) => {
  // TODO: handle
  const {
    onInit = () => {
      // TODO: pass provider status?
    },
  } = props ?? {}
  const client = useClient()

  // TODO: selector?
  const {
    anonymousProvider
    // principal,
  } = useSyncExternalStore(client.subscribe, client.getSnapshot)

  useEffect(() => {
    const unsub = client.on("init", onInit)
    return () => {
      unsub()
    }
  }, [client])

  return {
    anonymousProvider,
    principal: anonymousProvider?.principal,
    status,
    isInitializing: status === CLIENT_STATUS.INITIALIZING,
    isConnected: status === CLIENT_STATUS.CONNECTED,
    isConnecting: status === CLIENT_STATUS.CONNECTING,
    isDisconnecting: status === CLIENT_STATUS.DISCONNECTING,
    isLocked: status === CLIENT_STATUS.LOCKED,
    isIdle: status === CLIENT_STATUS.IDLE,
  } as const
}
