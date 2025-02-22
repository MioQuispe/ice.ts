import { Effect } from "effect"
import { ICEConfigService } from "../services/iceConfig.js"
import {
	collectDependencies,
	executeSortedTasks,
	filterNodes,
	type ProgressUpdate,
	topologicalSortTasks,
} from "./lib.js"
import { Tags } from "../builders/types.js"
import type { Task } from "../types/types.js"

export const canistersDeployTask = (cb?: (update: ProgressUpdate<unknown>) => void) =>
	Effect.gen(function* () {
		const { taskTree } = yield* ICEConfigService
		const tasksWithPath = (yield* filterNodes(
			taskTree,
			(node) =>
				node._tag === "task" &&
				node.tags.includes(Tags.CANISTER) &&
				node.tags.includes(Tags.DEPLOY),
		)) as Array<{ node: Task; path: string[] }>
		const tasks = tasksWithPath.map(({ node }) => node)
		const collectedTasks = collectDependencies(tasks)
		const sortedTasks = topologicalSortTasks(collectedTasks)
		yield* executeSortedTasks(sortedTasks, cb)
	})
