import {
	Context,
	Effect,
	Layer,
	Queue,
	Deferred,
	Fiber,
	Data,
	ManagedRuntime,
	LogLevel,
	ConfigProvider,
	Config,
} from "effect"
import type { Task } from "../types/types.js"
import {
	ProgressUpdate,
	TaskParamsToArgs,
	TaskRuntimeError,
	TaskSuccess,
} from "../tasks/lib.js"
import { StandardSchemaV1 } from "@standard-schema/spec"
import { type } from "arktype"
export { Opt } from "../types/types.js"
import { TaskRuntime } from "./taskRuntime.js"
import { runTask, runTasks } from "../tasks/run.js"
import { NodeContext } from "@effect/platform-node"

type TaskReturnValue<T extends Task> = ReturnType<T["effect"]>

type Job = {
	task: Task
	args: Record<string, unknown>
	reply: Deferred.Deferred<unknown, unknown>
}

class TaskRunnerError extends Data.TaggedError("TaskRunnerError")<{
	message?: string
	error?: unknown
}> {}

export class TaskRunner extends Context.Tag("TaskRunner")<
	TaskRunner,
	{
		readonly runTask: <T extends Task>(
			task: T,
			args?: TaskParamsToArgs<T>,
			progressCb?: (update: ProgressUpdate<unknown>) => void,
		) => Effect.Effect<TaskSuccess<T>, TaskRuntimeError>
		readonly runTasks: (
			tasks: Array<Task & { args: TaskParamsToArgs<Task> }>,
			progressCb?: (update: ProgressUpdate<unknown>) => void,
		) => Effect.Effect<Array<TaskSuccess<Task>>, TaskRuntimeError>
	}
>() {}

export const TaskRunnerLive = () =>
	Layer.effect(
		TaskRunner,
		Effect.gen(function* () {
			const { runtime } = yield* TaskRuntime
			const ChildTaskRunner = Layer.succeed(TaskRuntime, {
				runtime,
			})

			return {
				runTask: (task, args, progressCb = () => {}) =>
					Effect.tryPromise({
						try: () =>
							runtime.runPromise(
								runTask(task, args, progressCb).pipe(
									Effect.provide(ChildTaskRunner),
									// Effect.annotateLogs("caller", "taskCtx.runTask"),
									// Effect.annotateLogs("taskPath", taskPath),
								),
							),
						catch: (error) => {
							return new TaskRuntimeError({
								message: String(error),
							})
						},
					}),
				runTasks: (tasks, progressCb = () => {}) =>
					Effect.tryPromise({
						try: () =>
							runtime.runPromise(
								runTasks(tasks, progressCb).pipe(
									Effect.provide(ChildTaskRunner),
									// Effect.annotateLogs("caller", "taskCtx.runTask"),
									// Effect.annotateLogs("taskPath", taskPath),
								),
							),
						catch: (error) => {
							return new TaskRuntimeError({
								message: String(error),
							})
						},
					}),
			}
		}),
	)
