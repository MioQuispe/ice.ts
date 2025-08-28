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
import { StandardSchemaV1 } from "@standard-schema/spec"
import { ICEConfigService } from "./iceConfig.js"
import { NodeContext } from "@effect/platform-node"
import { type } from "arktype"
import { Logger, Tracer } from "effect"
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
import { TaskRuntimeError } from "../tasks/lib.js"
import { TelemetryConfig } from "./telemetryConfig.js"
import { makeTelemetryLayer } from "./telemetryConfig.js"

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

export class TaskRunnerContext extends Context.Tag("TaskRunnerContext")<
	TaskRunnerContext,
	{
		isRootTask: boolean
        // TODO: cli flags etc.
	}
>() {}

export class TaskRunner extends Context.Tag("TaskRunner")<
	TaskRunner,
	{
		runtime: ManagedRuntime.ManagedRuntime<any, any>
	}
>() {}

export const TaskRunnerLive = () =>
	Layer.effect(
		TaskRunner,
		Effect.gen(function* () {
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
			// TODO: dont pass down to child tasks
			const CLIFlagsService = yield* CLIFlags
			const { globalArgs, taskArgs } = CLIFlagsService
			const CLIFlagsLayer = Layer.succeed(CLIFlags, CLIFlagsService)
			const ICEConfig = yield* ICEConfigService
			const ICEConfigLayer = Layer.succeed(ICEConfigService, ICEConfig)
			// TODO: make it work for tests too
			const telemetryConfig = yield* TelemetryConfig
			const telemetryLayer = makeTelemetryLayer(telemetryConfig)
			const telemetryConfigLayer = Layer.succeed(
				TelemetryConfig,
				telemetryConfig,
			)

			const taskRuntime = ManagedRuntime.make(
				Layer.mergeAll(
					telemetryLayer,
					NodeContext.layer,
					TaskRegistry.Live.pipe(
                        // TODO: tests need this to be in memory
						Layer.provide(layerFileSystem(".ice/cache")),
						Layer.provide(NodeContext.layer),
					),
					DefaultReplicaService,
					DefaultConfig.Live.pipe(
						Layer.provide(DefaultReplicaService),
					),
					Moc.Live.pipe(Layer.provide(NodeContext.layer)),
					CanisterIdsService.Live.pipe(
						Layer.provide(NodeContext.layer),
						Layer.provide(configLayer),
					),
					// DevTools.layerWebSocket().pipe(
					// 	Layer.provide(NodeSocket.layerWebSocketConstructor),
					// ),
					CLIFlagsLayer,
					ICEConfigLayer,
					telemetryConfigLayer,
					// TODO: share logger with parent runtime
					// LoggerBundleLayer,
					Logger.pretty,
					Logger.minimumLogLevel(logLevelMap[globalArgs.logLevel]),
				),
			)
			return {
				runtime: taskRuntime,
			}
		}),
	)
