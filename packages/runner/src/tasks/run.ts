import {
	ConfigProvider,
	Context,
	Effect,
	Layer,
	Option,
	Stream,
	Chunk,
} from "effect"
import { ICEConfigService } from "../services/iceConfig.js"
import { configMap, TaskArgsService } from "../index.js"
import { Tags, TaskReturnValue } from "../builders/lib.js"
import type { Task } from "../types/types.js"
import { TaskRegistry } from "../services/taskRegistry.js"
import {
	getTaskByPath,
	getTaskPathById,
	topologicalSortTasks,
	executeTasks,
	collectDependencies,
	type ProgressUpdate,
	TaskParamsToArgs,
} from "./lib.js"
import { CanisterIdsService } from "../services/canisterIds.js"
import { NodeContext } from "@effect/platform-node"
import { CLIFlags } from "../services/cliFlags.js"
import { DefaultConfig } from "../services/defaultConfig.js"
import { Moc } from "../services/moc.js"
import { DefaultReplica } from "../services/replica.js"

export class DependencyResults extends Context.Tag("DependencyResults")<
	DependencyResults,
	{
		readonly dependencies: Record<
			string,
			{
				cacheKey: string | undefined
				result: unknown
			}
		>
	}
>() {}

export class TaskInfo extends Context.Tag("TaskInfo")<
	TaskInfo,
	{
		readonly taskPath: string
	}
>() {}

export interface RunTaskOptions {
	forceRun?: boolean
}

export const runTaskByPath = (
	taskPath: string,
	args: TaskParamsToArgs<Task> = {},
	progressCb: (update: ProgressUpdate<unknown>) => void = () => {},
) =>
	Effect.gen(function* () {
		yield* Effect.logDebug("Running task by path", { taskPath })
		const { task } = yield* getTaskByPath(taskPath)
		yield* Effect.logDebug("Task found", taskPath)
		return yield* runTask(task, args, progressCb)
	})

export const runTask = <T extends Task>(
	task: T,
	args: TaskParamsToArgs<T> = {} as TaskParamsToArgs<T>,
	progressCb: (update: ProgressUpdate<unknown>) => void = () => {},
) =>
	Effect.gen(function* () {
		yield* Effect.logDebug("Getting task path...", task.description)
		const path = yield* getTaskPathById(task.id)
		yield* Effect.logDebug("Got task path:", path)
		const taskWithArgs = {
			...task,
			// TODO: this adds args: undefined. fix
			args,
		}
		yield* Effect.logDebug("Collecting dependencies...")
		const collectedTasks = collectDependencies([task])
		yield* Effect.logDebug("Collected dependencies")
		collectedTasks.set(task.id, taskWithArgs)
		yield* Effect.logDebug("Sorting tasks...")
		const sortedTasks = topologicalSortTasks(collectedTasks)
		yield* Effect.logDebug("Sorted tasks")
		yield* Effect.logDebug("Executing tasks...")
		const results = yield* executeTasks(sortedTasks, progressCb)
		yield* Effect.logDebug("Tasks executed")
		return results.get(task.id) as Effect.Effect.Success<T["effect"]>
	})
