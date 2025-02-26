import type { CanisterScope, Task } from "../types/types.js"
import { Effect, Option } from "effect"
import { getTaskByPath, getNodeByPath, TaskCtx } from "../tasks/lib.js"
import { TaskInfo } from "../tasks/run.js"
import { Tags } from "./types.js"
import { ICEConfigService } from "src/services/iceConfig.js"

export const makeDeployTask = (tags: string[]): Task => {
	return {
		_tag: "task",
		// TODO: hmmm?
		id: Symbol("canister/deploy"),
		dependencies: {},
		computeCacheKey: Option.none(),
		input: Option.none(),
		// TODO: we only want to warn at a type level?
		// TODO: type Task
		provide: {},
		effect: Effect.gen(function* () {
			const { runTask } = yield* TaskCtx
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
	}
}
