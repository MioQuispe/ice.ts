import { Context, Effect } from "effect"
import { ICEConfigService } from "../services/iceConfig.js"
import type { Task } from "../types/types.js"
import {
	collectDependencies,
	executeTasks,
	findTaskInTaskTree,
	getTaskPathById,
	type ProgressUpdate,
	TaskCtx,
	TaskParamsToArgs,
	TaskRuntimeError,
	TaskSuccess,
	topologicalSortTasks,
} from "./lib.js"
import { TaskRunner } from "../services/taskRunner.js"

export interface RunTaskOptions {
	forceRun?: boolean
}


// TODO: runTasks? we need to collect all deps once
export const runTask = Effect.fn("run_task")(function* <T extends Task>(
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
    // const ctx = yield* Effect.context<TaskRunner>()
    // const taskRunner = Context.get(ctx, TaskRunner)
    // const { runTaskAsync } = taskRunner
	const taskEffects = yield* executeTasks(sortedTasks, progressCb)
    // .pipe(
    //     Effect.succe
    // )
    // TODO: get taskRuntime here

	// TODO: remove once we decouple task.effect from the runtime
	const results = yield* Effect.all(taskEffects, {
		concurrency: "unbounded",
	}).pipe(
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
