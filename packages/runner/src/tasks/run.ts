import { ConfigProvider, Context, Effect, Layer, Option, Stream, Chunk } from "effect"
import { ICEConfigService } from "../services/iceConfig.js"
import { configMap } from "../index.js"
import { Tags } from "../builders/types.js"
import type { Task } from "../types/types.js"
import { TaskRegistry } from "../services/taskRegistry.js"
import {
	getTaskByPath,
	getTaskPathById,
	topologicalSortTasks,
	executeSortedTasks,
  collectDependencies,
  type ProgressUpdate,
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

export const runTaskByPath = <A, E, R, I>(taskPath: string, progressCb?: (update: ProgressUpdate<unknown>) => void) =>
	Effect.gen(function* () {
		const { task } = yield* getTaskByPath(taskPath)
    return (yield* runTask(task)) as A
	})

export const runTask = <A = unknown, E = unknown, R = unknown, I = unknown>(task: Task<A, E, R, I>) =>
	Effect.gen(function* () {
    // @ts-ignore
		const collectedTasks = collectDependencies([task])
		const sortedTasks = topologicalSortTasks(collectedTasks)
		const results = yield* executeSortedTasks(sortedTasks)
    return results.get(task.id) as A
  })