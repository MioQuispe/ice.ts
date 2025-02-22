import { scope } from "@ice.ts/runner"
import { NFIDDelegationFactory } from "./delegation_factory/index.js"
import { NFIDIcrc1Oracle } from "./icrc1_oracle/index.js"
import { NFIDIcrc1Registry } from "./icrc1_registry/index.js"
import { NFIDIdentityManager } from "./identity_manager/index.js"
import { NFIDStorage } from "./nfid_storage/index.js"
import { NFIDSignerIc } from "./signer_ic/index.js"
import { NFIDSwapTrsStorage } from "./swap_trs_storage/index.js"

export { NFIDIdentityManager } from "./identity_manager/index.js"
export { NFIDDelegationFactory } from "./delegation_factory/index.js"
export { NFIDIcrc1Oracle } from "./icrc1_oracle/index.js"
export { NFIDIcrc1Registry } from "./icrc1_registry/index.js"
export { NFIDStorage } from "./nfid_storage/index.js"
export { NFIDSignerIc } from "./signer_ic/index.js"
export { NFIDSwapTrsStorage } from "./swap_trs_storage/index.js"

export const NFIDScope = () => {
  const identityManager = NFIDIdentityManager().done()
  // TODO: feed in IdentityManager to all others
  const delegationFactory = NFIDDelegationFactory().deps({
    NFIDIdentityManager: identityManager.children.install,
  })
  const icrc1Oracle = NFIDIcrc1Oracle().deps({
    NFIDIdentityManager: identityManager.children.install,
  })
  const icrc1Registry = NFIDIcrc1Registry().deps({
    NFIDIdentityManager: identityManager.children.install,
  })
  const storage = NFIDStorage().deps({
    NFIDIdentityManager: identityManager.children.install,
  })
  const signerIc = NFIDSignerIc().deps({
    NFIDIdentityManager: identityManager.children.install,
  })
  const swapTrsStorage = NFIDSwapTrsStorage().deps({
    NFIDIdentityManager: identityManager.children.install,
  })

  return scope("NFID tasks", {
    identityManager,
    delegationFactory,
    icrc1Oracle,
    icrc1Registry,
    storage,
    signerIc,
    swapTrsStorage,
  })
}
