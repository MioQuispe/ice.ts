// import { DevTools } from "@effect/experimental"
import { NodeContext, NodeSocket } from "@effect/platform-node"
import { layerFileSystem } from "@effect/platform/KeyValueStore"
import { StandardSchemaV1 } from "@standard-schema/spec"
import { type } from "arktype"
import { ConfigProvider, Layer, Logger, LogLevel, ManagedRuntime } from "effect"
import fs from "node:fs"
import { CanisterIdsService } from "./services/canisterIds.js"
import { CLIFlags } from "./services/cliFlags.js"
import { DefaultConfig } from "./services/defaultConfig.js"
import { DfxReplica } from "./services/dfx.js"
import { ICEConfigService } from "./services/iceConfig.js"
import { Moc } from "./services/moc.js"
import { picReplicaImpl } from "./services/pic/pic.js"
import { DefaultReplica } from "./services/replica.js"
import { TaskArgsService } from "./services/taskArgs.js"
import { TaskRegistry } from "./services/taskRegistry.js"
import type { ICEConfig, ICECtx } from "./types/types.js"
import { TaskCtxService } from "./services/taskCtx.js"
import { NodeSdk as OpenTelemetryNodeSdk } from "@effect/opentelemetry"
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
export { Opt } from "./types/types.js"

export * from "./builders/index.js"
export type { CanisterScope } from "./builders/lib.js"
export * from "./ids.js"
export type { InstallModes } from "./services/replica.js"

export const Ice = (
	configOrFn:
		| Partial<ICEConfig>
		| ((ctx: ICECtx) => Promise<Partial<ICEConfig>>),
) => {
	return configOrFn
}

export const configMap = new Map([
	["APP_DIR", fs.realpathSync(process.cwd())],
	["ICE_DIR_NAME", ".ice"],
])

export const configLayer = Layer.setConfigProvider(
	ConfigProvider.fromMap(configMap),
)

const DfxReplicaService = DfxReplica.pipe(Layer.provide(NodeContext.layer))

// const DefaultReplicaService = DfxDefaultReplica.pipe(
// 	Layer.provide(NodeContext.layer),
// 	Layer.provide(configLayer),
// )

const DefaultReplicaService = Layer.effect(DefaultReplica, picReplicaImpl).pipe(
	Layer.provide(NodeContext.layer),
)

export const DefaultsLayer = Layer.mergeAll(
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

// export const TUILayer = Layer.mergeAll(
// 	DefaultsLayer,
// 	ICEConfigService.Live.pipe(
// 		Layer.provide(NodeContext.layer),
// 		Layer.provide(
// 			Layer.succeed(CLIFlags, {
// 				globalArgs: { network: "local", logLevel: "debug" },
// 				taskArgs: {
// 					positionalArgs: [],
// 					namedArgs: {},
// 				},
// 			}),
// 		),
// 	),
// 	Layer.succeed(CLIFlags, {
// 		globalArgs: { network: "local", logLevel: "debug" },
// 		taskArgs: {
// 			positionalArgs: [],
// 			namedArgs: {},
// 		},
// 	}),
// 	Layer.succeed(TaskArgsService, {
// 		taskArgs: {},
// 	}),
// 	Logger.minimumLogLevel(LogLevel.Debug),
// )

const GlobalArgs = type({
	network: "string" as const,
	logLevel: "'debug' | 'info' | 'error'",
}) satisfies StandardSchemaV1<Record<string, unknown>>

const logLevelMap = {
	debug: LogLevel.Debug,
	info: LogLevel.Info,
	error: LogLevel.Error,
}

type MakeRuntimeArgs = {
	globalArgs: { network: string; logLevel: string }
	// TODO: either this or taskArgs
	// fix type
	cliTaskArgs?: {
		positionalArgs: string[]
		namedArgs: Record<string, string>
	}
	taskArgs?: Record<string, unknown>
	iceConfigServiceLayer?: Layer.Layer<
		ICEConfigService,
		Layer.Layer.Error<typeof ICEConfigService.Live>
	>
}

const telemetryLayer = OpenTelemetryNodeSdk.layer(() => ({
	resource: { serviceName: "ice" },
	spanProcessor: new BatchSpanProcessor(
		new OTLPTraceExporter(),
	),
}))

export const makeRuntime = ({
	globalArgs: rawGlobalArgs,
	cliTaskArgs = { positionalArgs: [], namedArgs: {} },
	taskArgs = {},
	iceConfigServiceLayer,
}: MakeRuntimeArgs) => {
	// TODO: pass this in from outside instead
	const globalArgs = GlobalArgs(rawGlobalArgs)
	if (globalArgs instanceof type.errors) {
		throw new Error(globalArgs.summary)
	}

	const ICEConfigLayer =
		iceConfigServiceLayer ??
		ICEConfigService.Live.pipe(
			Layer.provide(NodeContext.layer),
			Layer.provide(
				Layer.succeed(CLIFlags, {
					globalArgs,
					taskArgs: cliTaskArgs,
				}),
			),
		)
	const CLIFlagsLayer = Layer.succeed(CLIFlags, {
		globalArgs,
		taskArgs: cliTaskArgs,
	})
	const TaskArgsLayer = Layer.succeed(TaskArgsService, { taskArgs })
	const TaskCtxLayer = TaskCtxService.Live.pipe(
		// TODO: it doesnt need the whole DefaultsLayer
		Layer.provide(DefaultsLayer),
		Layer.provide(ICEConfigLayer),
		Layer.provide(CLIFlagsLayer),
		Layer.provide(TaskArgsLayer),
	)

	return ManagedRuntime.make(
		Layer.mergeAll(
			telemetryLayer,
			DefaultsLayer,
			CLIFlagsLayer,
			TaskArgsLayer,
			ICEConfigLayer,
			TaskCtxLayer,
			Logger.pretty,
			Logger.minimumLogLevel(logLevelMap[globalArgs.logLevel]),
		),
	)
}

export { runCli } from "./cli/index.js"
export type { TaskCtxShape } from "./tasks/lib.js"
