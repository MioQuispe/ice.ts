import { Effect } from "effect"
import { ICEConfigService } from "../services/iceConfig.js"
import { filterNodes } from "./lib.js"
import { Tags } from "../builders/types.js"
import { CanisterIdsService } from "../services/canisterIds.js"
import { stopCanister } from "../canister.js"
import type { ProgressUpdate } from "./lib.js"

export const canistersStopTask = (progressCb?: (update: ProgressUpdate<unknown>) => void) =>
  Effect.gen(function* () {
    yield* Effect.logDebug("Running canisters:stop")
    const canisterIdsService = yield* CanisterIdsService
    const canisterIdsMap = yield* canisterIdsService.getCanisterIds()
    // TODO: runTask?
    yield* Effect.forEach(
      Object.keys(canisterIdsMap),
      (canisterId) => stopCanister(canisterId),
      { concurrency: "unbounded" },
    )
  })