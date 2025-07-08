import {
	Effect
} from "effect"
import type { Task } from "../types/types.js"
import {
	collectDependencies,
	executeTasks,
	getTaskByPath,
	getTaskPathById,
	type ProgressUpdate,
	TaskParamsToArgs,
	topologicalSortTasks,
} from "./lib.js"

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
		const taskEffects = yield* executeTasks(sortedTasks, progressCb)
		// TODO:
		const results = yield* Effect.all(taskEffects, { concurrency: "unbounded" })
		yield* Effect.logDebug("Tasks executed")
		const maybeResult = results.find((r) => r.taskId === task.id)
		if (!maybeResult) {
			return yield* Effect.fail(new Error(`Task ${task.description} not found in results`))
		}
		return maybeResult as { 
			result: Effect.Effect.Success<T["effect"]> 
			taskId: symbol
			taskPath: string
		}
	})
