import { Effect } from "effect"
import { ICEConfigService } from "../services/iceConfig.js"
import { filterNodes } from "./lib.js"
import { Tags } from "../builders/types.js"
import { CanisterIdsService } from "../services/canisterIds.js"
import { stopCanister } from "../canister.js"

export const canistersStopTask = () =>
  Effect.gen(function* () {
    yield* Effect.logInfo("Running canisters:stop")
    const canisterIdsService = yield* CanisterIdsService
    const canisterIdsMap = yield* canisterIdsService.getCanisterIds()
    yield* Effect.forEach(
      Object.keys(canisterIdsMap),
      (canisterId) => stopCanister(canisterId),
      { concurrency: "unbounded" },
    )
  })