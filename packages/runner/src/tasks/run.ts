import { Effect } from "effect"
import type { Task } from "../types/types.js"
import {
	collectDependencies,
	executeTasks,
	getTaskByPath,
	getTaskPathById,
	type ProgressUpdate,
	TaskParamsToArgs,
	TaskRuntimeError,
	TaskSuccess,
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
	Effect.fn("runTaskByPath")(function* () {
        yield* Effect.annotateCurrentSpan({
            taskPath,
        })
		yield* Effect.logDebug("Running task by path", { taskPath })
		const { task } = yield* getTaskByPath(taskPath)
		yield* Effect.logDebug("Task found", taskPath)
		return yield* runTask(task, args, progressCb)
	})()

export const runTask = Effect.fn("runTask")(function* <T extends Task>(
	task: T,
	args: TaskParamsToArgs<T> = {} as TaskParamsToArgs<T>,
	progressCb: (update: ProgressUpdate<unknown>) => void = () => {},
) {
	yield* Effect.logDebug("Getting task path...", task.description)
	const path = yield* getTaskPathById(task.id)
    yield* Effect.annotateCurrentSpan({
        taskPath: path,
    })
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
	const sortedTasks = yield* Effect.try({
		try: () => topologicalSortTasks(collectedTasks),
		catch: (error) => {
			return new TaskRuntimeError({
				message: "Error sorting tasks",
				error,
			})
		},
	})
	yield* Effect.logDebug("Sorted tasks")
	yield* Effect.logDebug("Executing tasks...")
	const taskEffects = yield* executeTasks(sortedTasks, progressCb)
	// TODO: remove once we decouple task.effect from the runtime
    const neverEffects = taskEffects as Effect.Effect<{
        taskId: symbol;
        taskPath: string;
        result: unknown;
    }, TaskRuntimeError, never>[]
	const results = yield* Effect.all(neverEffects, {
		concurrency: "unbounded",
	})
    .pipe(
		Effect.mapError((error) => {
			return new TaskRuntimeError({
				message: "Error executing tasks",
				error,
			})
		}),
	)
    // TODO: set requirements to never instead of unknown
	yield* Effect.logDebug("Tasks executed")
	const maybeResult = results.find((r) => r.taskId === task.id)
	if (!maybeResult) {
		return yield* Effect.fail(
			new TaskRuntimeError({
				message: `Task ${task.description} not found in results`,
				error: maybeResult,
			}),
		)
	}
	return maybeResult as {
		result: TaskSuccess<T>
		taskId: symbol
		taskPath: string
	}
})
