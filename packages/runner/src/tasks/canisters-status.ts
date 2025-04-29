import { Effect } from "effect"
import { ICEConfigService } from "../services/iceConfig.js"
import { DeploymentError } from "../index.js"
import { CanisterIdsService } from "../services/canisterIds.js"
import { Principal } from "@dfinity/principal"
import { filterNodes } from "./lib.js"
import { runTask, TaskInfo } from "./index.js"
import { DefaultReplica, Replica } from "../services/replica.js"
import { HttpAgent } from "@dfinity/agent"

export const canistersStatusTask = () =>
	Effect.gen(function* () {
		// TODO: runTasks?
		const canisterIdsService = yield* CanisterIdsService
		const canisterIdsMap = yield* canisterIdsService.getCanisterIds()
		// TODO: what if we have multiple replicas?
		const replica = yield* DefaultReplica
		// TODO: ??
		const agent = yield* Effect.tryPromise(() => HttpAgent.create({
			host: replica.host,
		}))
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
						const status = yield* replica.getCanisterInfo({
							canisterId,
							agent,
						})
						return { canisterName, canisterId, status }
					}),
				),
		)

		const canisterStatuses = yield* Effect.all(canisterStatusesEffects, {
			concurrency: "unbounded",
		})
		// TODO: print module hash
		// For every result, inspect whether it was a success or a failure and prepare a log message accordingly
		// TODO: colorize statuses
		return canisterStatuses
	})
