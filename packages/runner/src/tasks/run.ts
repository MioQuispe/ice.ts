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
import { configMap } from "../index.js"
import { Tags } from "../builders/lib.js"
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

export class DependencyResults extends Context.Tag("DependencyResults")<
	DependencyResults,
	{
		readonly dependencies: Record<string, {
			cacheKey: string | undefined
			result: unknown
		}>
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

export const runTask = (
	task: Task<any>,
	args: TaskParamsToArgs<Task> = {},
	progressCb: (update: ProgressUpdate<unknown>) => void = () => {},
) =>
	Effect.gen(function* () {
		const path = yield* getTaskPathById(task.id)
		const taskWithArgs = {
			...task,
			args,
		}
		const collectedTasks = collectDependencies([task])
		collectedTasks.set(task.id, taskWithArgs)
		const sortedTasks = topologicalSortTasks(collectedTasks)
		const results = yield* executeTasks(sortedTasks, progressCb)
		return results.get(task.id)
	})