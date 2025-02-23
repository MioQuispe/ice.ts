import { Effect } from "effect"
import { ICEConfigService } from "../services/iceConfig.js"
import { DeploymentError } from "../index.js"
import { CanisterIdsService } from "../services/canisterIds.js"
import { DfxService } from "../services/dfx.js"
import { Principal } from "@dfinity/principal"
import { filterNodes } from "./lib.js"

export const canistersStatusTask = () =>
  Effect.gen(function* () {
    const canisterIdsService = yield* CanisterIdsService
    const canisterIdsMap = yield* canisterIdsService.getCanisterIds()
    const dfx = yield* DfxService
    // TODO: in parallel? are these tasks?
    // Create an effect for each canister that is wrapped with Effect.either
    const canisterStatusesEffects = Object.keys(canisterIdsMap).map(
      (canisterName) =>
        Effect.either(
          Effect.gen(function* () {
            const network = "local"
            const canisterInfo = canisterIdsMap[canisterName]
            const canisterId = canisterInfo[network]
            if (!canisterId) {
              throw new DeploymentError({
                message: `No canister ID found for ${canisterName} on network ${network}`,
              })
            }
            const status = yield* Effect.tryPromise({
              try: () =>
                dfx.mgmt.canister_status({
                  canister_id: Principal.fromText(canisterId),
                }),
              catch: (err) =>
                new DeploymentError({
                  message: `Failed to get status for ${canisterName}: ${
                    err instanceof Error ? err.message : String(err)
                  }`,
                }),
            })
            return { canisterName, canisterId, status }
          }),
        ),
    )

    const canisterStatuses = yield* Effect.all(canisterStatusesEffects, {
      concurrency: "unbounded",
    })
    // as Option.Option<
    //   Array<{
    //     canisterName: string
    //     canisterId: string
    //     status: canister_status_result
    //   }>
    // >
    // TODO: print module hash
    // For every result, inspect whether it was a success or a failure and prepare a log message accordingly

    // TODO: colorize statuses
    //     const statusLog = canisterStatuses
    //       .map((result) =>
    //         result._tag === "Right"
    //           ? `
    // ${result.right.canisterName} status:
    //     ID: ${result.right.canisterId}
    //     Status: ${Object.keys(result.right.status.status)[0]}
    //     Memory Size: ${result.right.status.memory_size}
    //     Cycles: ${result.right.status.cycles}
    //     Idle Cycles Burned Per Day: ${result.right.status.idle_cycles_burned_per_day}
    //     Module Hash: ${
    //       result.right.status.module_hash.length > 0 ? "Present" : "Not Present"
    //     }`
    //           : `Error for canister: ${result.left.message}`,
    //       )
    //       .join("\n")

    //     yield* Effect.logDebug(statusLog)
    return canisterStatuses
  })