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
import { Tags } from "../builders/types.js"
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
		readonly dependencies: Record<string, unknown>
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
		const { task } = yield* getTaskByPath(taskPath)
		return yield* runTask(task, args, progressCb)
	})

export const runTask = (
	task: Task,
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