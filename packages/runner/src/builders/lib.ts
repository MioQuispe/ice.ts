import type { CanisterScope, Task } from "../types/types.js"
import { Effect, Option } from "effect"
import { getTaskByPath, getNodeByPath, TaskCtx } from "../tasks/lib.js"
import { runTask, TaskInfo } from "../tasks/run.js"
import { Tags } from "./types.js"
import { DfxService } from "../services/dfx.js"
import { CanisterIdsService } from "../services/canisterIds.js"
import { Principal } from "@dfinity/principal"
import { DeploymentError } from "../index.js"


// TODO: dont pass in tags, just make the effect

export const makeCanisterStatusTask = (tags: string[]) => {
	return {
		_tag: "task",
		// TODO: change
		id: Symbol("canister/status"),
		dependencies: {},
		computeCacheKey: Option.none(),
		input: Option.none(),
		// TODO: we only want to warn at a type level?
		// TODO: type Task
		provide: {},
		effect: Effect.gen(function* () {
			const network = "local"
			const { taskPath } = yield* TaskInfo
		const canisterName = taskPath.split(":").slice(0, -1).join(":")
		const canisterIdsService = yield* CanisterIdsService
		const canisterIdsMap = yield* canisterIdsService.getCanisterIds()
		// TODO: if deleted doesnt exist
		const canisterInfo = canisterIdsMap[canisterName]
		if (!canisterInfo) {
			return { canisterName, canisterId: null, status: { not_installed: null } }
		}
		const { mgmt } = yield* DfxService
		const canisterId = canisterInfo[network]
		if (!canisterId) {
			// TODO: fix format
			return { canisterName, canisterId, status: { not_installed: null } }
		}
		// export interface canister_status_result {
		//   'status' : { 'stopped' : null } |
		//     { 'stopping' : null } |
		//     { 'running' : null },
		//   'memory_size' : bigint,
		//   'cycles' : bigint,
		//   'settings' : definite_canister_settings,
		//   'query_stats' : {
		//     'response_payload_bytes_total' : bigint,
		//     'num_instructions_total' : bigint,
		//     'num_calls_total' : bigint,
		//     'request_payload_bytes_total' : bigint,
		//   },
		//   'idle_cycles_burned_per_day' : bigint,
		//   'module_hash' : [] | [Array<number>],
		//   'reserved_cycles' : bigint,
		// }
		const status = yield* Effect.tryPromise({
			try: () =>
				mgmt.canister_status({
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
		description: "Get canister status",
		tags: [Tags.CANISTER, Tags.STATUS, ...tags],
	} satisfies Task
}

export const makeDeployTask = (tags: string[]) => {
	return {
		_tag: "task",
		// TODO: change
		id: Symbol("canister/deploy"),
		dependencies: {},
		computeCacheKey: Option.none(),
		input: Option.none(),
		// TODO: we only want to warn at a type level?
		// TODO: type Task
		provide: {},
		effect: Effect.gen(function* () {
			const { taskPath } = yield* TaskInfo
			const canisterName = taskPath.split(":").slice(0, -1).join(":")
			const parentScope = (yield* getNodeByPath(canisterName)) as CanisterScope
			const [canisterId] = yield* Effect.all(
				[
					Effect.gen(function* () {
						const taskPath = `${canisterName}:create`
						const canisterId = (yield* runTask(
							parentScope.children.create,
						)) as unknown as string
						return canisterId
					}),
					Effect.gen(function* () {
						if (parentScope.tags.includes(Tags.MOTOKO)) {
							// Moc generates candid and wasm files in the same phase
							yield* runTask(parentScope.children.build)
							yield* runTask(parentScope.children.bindings)
						} else {
							yield* Effect.all(
								[
									runTask(parentScope.children.build),
									runTask(parentScope.children.bindings),
								],
								{
									concurrency: "unbounded",
								},
							)
						}
					}),
				],
				{
					concurrency: "unbounded",
				},
			)
			yield* runTask(parentScope.children.install)
			yield* Effect.logDebug("Canister deployed successfully")
			return canisterId
		}),
		description: "Deploy canister code",
		tags: [Tags.CANISTER, Tags.DEPLOY, ...tags],
	} satisfies Task
}
