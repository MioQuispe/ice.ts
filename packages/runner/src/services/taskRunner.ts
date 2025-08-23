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
} from "effect"
import type { Task } from "../types/types.js"
import { TaskParamsToArgs, TaskSuccess } from "../tasks/lib.js"
// import { executeTasks } from "../tasks/execute"
import { ProgressUpdate } from "../tasks/lib.js"
import { TaskArgsService } from "./taskArgs.js"
import { StandardSchemaV1 } from "@standard-schema/spec"
import { ICEConfigService } from "./iceConfig.js"
import { NodeContext } from "@effect/platform-node"
import { type } from "arktype"
import { Logger } from "effect"
import fs from "node:fs"
import { CLIFlags } from "./cliFlags.js"
import { NodeSdk as OpenTelemetryNodeSdk } from "@effect/opentelemetry"
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import type { Scope, TaskTree } from "../types/types.js"
import { TaskRegistry } from "./taskRegistry.js"
export { Opt } from "../types/types.js"
import { layerFileSystem } from "@effect/platform/KeyValueStore"
import { CanisterIdsService } from "./canisterIds.js"
import { DefaultConfig } from "./defaultConfig.js"
import { Moc } from "./moc.js"
import { DefaultReplica } from "./replica.js"
import type { ICEConfig, ICECtx } from "../types/types.js"
import { picReplicaImpl } from "./pic/pic.js"
import { ParentTaskCtx } from "./parentTaskCtx.js"
import { TaskRuntimeError } from "../tasks/lib.js"

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

const GlobalArgs = type({
	network: "string" as const,
	logLevel: "'debug' | 'info' | 'error'",
}) satisfies StandardSchemaV1<Record<string, unknown>>

const logLevelMap = {
	debug: LogLevel.Debug,
	info: LogLevel.Info,
	error: LogLevel.Error,
}

export class TaskRunner extends Context.Tag("TaskRunner")<
	TaskRunner,
	{
		// runTaskAsync: <T extends Task>(
		// 	task: T,
		// 	args?: TaskParamsToArgs<T>,
		// 	progressCb?: (update: ProgressUpdate<unknown>) => void,
		// ) => Promise<{
		// 	result: TaskSuccess<T>
		// 	taskId: symbol
		// 	taskPath: string
		// }>
		// // runTaskEffect: <T extends Task>(
		// // 	task: T,
		// // 	args?: TaskParamsToArgs<T>,
		// // 	progressCb?: (update: ProgressUpdate<unknown>) => void,
		// // ) => Effect.Effect<
		// // 	{
		// // 		result: TaskSuccess<T>
		// // 		taskId: symbol
		// // 		taskPath: string
		// // 	},
		// // 	TaskRunnerError | TaskRuntimeError
		// // >
		// runTaskEffect: typeof runTask
		runtime: ManagedRuntime.ManagedRuntime<any, any>
	}
>() {}

export const TaskRunnerLive = (
	rawGlobalArgs: { network: string; logLevel: string },
	cliTaskArgs: {
		positionalArgs: string[]
		namedArgs: Record<string, string>
	},
	taskArgs: Record<string, unknown>,
) =>
	Layer.effect(
		TaskRunner,
		Effect.gen(function* () {
			// const ParentTaskCtxLayer = ParentTaskCtxLive({
			// 	runTask: <T extends Task>(
			// 		task: T,
			// 		args?: TaskParamsToArgs<T>,
			// 		progressCb?: (update: ProgressUpdate<unknown>) => void,
			// 		// parent???
			// 	) => runTaskAsync(task, args, progressCb)
			// })
			// const { runTask } = yield* ParentTaskCtx

			const globalArgs = GlobalArgs(rawGlobalArgs)
			if (globalArgs instanceof type.errors) {
				throw new Error(globalArgs.summary)
			}
			const telemetryLayer = OpenTelemetryNodeSdk.layer(() => ({
				resource: { serviceName: "ice" },
				spanProcessor: new BatchSpanProcessor(new OTLPTraceExporter()),
			}))
			const configMap = new Map([
				["APP_DIR", fs.realpathSync(process.cwd())],
				["ICE_DIR_NAME", ".ice"],
			])
			const configLayer = Layer.setConfigProvider(
				ConfigProvider.fromMap(configMap),
			)
			const DefaultReplicaService = Layer.effect(
				DefaultReplica,
				picReplicaImpl,
			).pipe(Layer.provide(NodeContext.layer))
			const CLIFlagsService = yield* CLIFlags
			const CLIFlagsLayer = Layer.succeed(CLIFlags, CLIFlagsService)
			const DefaultsLayer = Layer.mergeAll(
				NodeContext.layer,
				TaskRegistry.Live.pipe(
					Layer.provide(layerFileSystem(".ice/cache")),
					Layer.provide(NodeContext.layer),
				),
				DefaultReplicaService,
				DefaultConfig.Live.pipe(Layer.provide(DefaultReplicaService)),
				Moc.Live.pipe(Layer.provide(NodeContext.layer)),
				CanisterIdsService.Live.pipe(
					Layer.provide(NodeContext.layer),
					Layer.provide(configLayer),
				),
				// DevTools.layerWebSocket().pipe(
				// 	Layer.provide(NodeSocket.layerWebSocketConstructor),
				// ),
			)
			// const runtime = yield* Effect.runtime()
			const ICEConfig = yield* ICEConfigService
			const ICEConfigLayer = Layer.succeed(ICEConfigService, ICEConfig)
			const TaskArgsLayer = Layer.succeed(TaskArgsService, { taskArgs })
			// const parentTaskCtxLayer = Layer.succeed(ParentTaskCtx, ParentTaskCtx.of({ runTask }))

			const taskRuntime = ManagedRuntime.make(
				Layer.mergeAll(
					telemetryLayer,
					DefaultsLayer,
					CLIFlagsLayer,
					TaskArgsLayer,
					ICEConfigLayer,
					Logger.pretty,
					Logger.minimumLogLevel(logLevelMap[globalArgs.logLevel]),
					// parentTaskCtxLayer,
					// TODO: needs to provide self here for nested tasks?
					// Layer.succeed(TaskRunner, { runtime: taskRuntime })
				),
			)
			// const runTaskAsync = <T extends Task>(
			// 	task: T,
			// 	args?: TaskParamsToArgs<T>,
			// 	progressCb?: (update: ProgressUpdate<unknown>) => void,
			// 	// TODO: make new parent ctx
			// ) => taskRuntime.runPromise(runTask(task, args, progressCb))
			// const runTaskEffect = runTask
			// const TaskRunnerLayer = Layer.succeed(TaskRunner, TaskRunner.of({
			//     runTaskAsync,
			//     runTaskEffect,
			// })

			// const childRuntime = ManagedRuntime.make(
			// 	Layer.mergeAll(taskRuntime, ParentTaskCtxLayer),
			// )

			// const TaskRuntimeService = Context.Tag("TaskRuntime")<
			// 	TaskRuntime,
			// 	{
			// 		runtime: typeof taskRuntime
			// 	}
			// >()
			// const TaskRuntimeLayer = Layer.succeed(TaskRuntimeService, {
			// 	runtime: taskRuntime,
			// })

			// const taskRunner = TaskRunner.of({
			// 	// taskRuntime,
			// 	runTaskAsync,
			// 	runTaskEffect,
			// })
			return {
				runtime: taskRuntime,
			}
		}),
	)
