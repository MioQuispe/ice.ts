import { useConnect } from "./useConnect"
import { useWallet } from "./useWallet"

type Props = {
  message?: string
}

export const useSignMessage = ({ message }: Props) => {
  // TODO: check if supported or not
  const {activeProvider} = useConnect()
  const [wallet] = useWallet()

  const signMessage = () => {
    if (!wallet || !activeProvider) {
      return
    }
    activeProvider.signMessage?.({ message })
  }

  const loading = false
  const error = false

  return [signMessage, { loading, error }] as const
}