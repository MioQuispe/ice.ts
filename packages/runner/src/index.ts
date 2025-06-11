import fs from "node:fs"
import {
	Data,
	Layer,
	ManagedRuntime,
	Logger,
	ConfigProvider,
	LogLevel,
	Effect,
	Context,
} from "effect"
import { NodeContext } from "@effect/platform-node"
import { DfxDefaultReplica, DfxReplica } from "./services/dfx.js"
import type { ICECtx } from "./types/types.js"
import { Moc } from "./services/moc.js"
import { TaskRegistry } from "./services/taskRegistry.js"
import { ICEConfigService } from "./services/iceConfig.js"
import { picReplicaImpl } from "./services/pic/pic.js"
import { CanisterIdsService } from "./services/canisterIds.js"
import type { ICEConfig } from "./types/types.js"
import { DefaultReplica } from "./services/replica.js"
import { DefaultConfig } from "./services/defaultConfig.js"
import { CLIFlags } from "./services/cliFlags.js"
import { type } from "arktype"
export * from "./builders/index.js"
export * from "./ids.js"
import { StandardSchemaV1 } from "@standard-schema/spec"

export const Ice = (
	configOrFn:
		| Partial<ICEConfig>
		| ((ctx: ICECtx) => Promise<Partial<ICEConfig>>),
) => {
	return configOrFn
}

export const configMap = new Map([
	["APP_DIR", fs.realpathSync(process.cwd())],
	["DFX_CONFIG_FILENAME", "ice.config.ts"],
	["CANISTER_IDS_FILENAME", "canister_ids.json"],
])

export const configLayer = Layer.setConfigProvider(
	ConfigProvider.fromMap(configMap),
)

const DfxReplicaService = DfxReplica.pipe(
	Layer.provide(NodeContext.layer),
	Layer.provide(configLayer),
)

// const DefaultReplicaService = DfxDefaultReplica.pipe(
// 	Layer.provide(NodeContext.layer),
// 	Layer.provide(configLayer),
// )

const DefaultReplicaService = Layer.effect(DefaultReplica, picReplicaImpl).pipe(
	Layer.provide(NodeContext.layer),
	Layer.provide(configLayer),
)

export const DefaultsLayer = Layer.mergeAll(
	NodeContext.layer,
	TaskRegistry.Live,
	DefaultReplicaService,
	DefaultConfig.Live.pipe(Layer.provide(DefaultReplicaService)),
	Moc.Live.pipe(Layer.provide(NodeContext.layer)),
	configLayer,
	CanisterIdsService.Live.pipe(
		Layer.provide(NodeContext.layer),
		Layer.provide(configLayer),
	),
)

export const TUILayer = Layer.mergeAll(
	DefaultsLayer,
	ICEConfigService.Live.pipe(
		Layer.provide(NodeContext.layer),
		Layer.provide(
			Layer.succeed(CLIFlags, {
				globalArgs: { network: "local", logLevel: "debug" },
				taskArgs: {
					positionalArgs: [],
					namedArgs: {},
				},
			}),
		),
	),
	Logger.minimumLogLevel(LogLevel.Debug),
)

const GlobalArgs = type({
	network: "string",
	logLevel: "'debug' | 'info' | 'error'",
}) satisfies StandardSchemaV1<Record<string, unknown>>

const logLevelMap = {
	debug: LogLevel.Debug,
	info: LogLevel.Info,
	error: LogLevel.Error,
}

type MakeRuntimeArgs = {
	globalArgs: { network: string; logLevel: string }
	taskArgs?: {
		positionalArgs: string[]
		namedArgs: Record<string, string>
	}
	iceConfigServiceLayer?: Layer.Layer<
		ICEConfigService,
		Layer.Layer.Error<typeof ICEConfigService.Live>
	>
}

export const makeRuntime = ({
	globalArgs: rawGlobalArgs,
	taskArgs = { positionalArgs: [], namedArgs: {} },
	iceConfigServiceLayer,
}: MakeRuntimeArgs) => {
	const globalArgs = GlobalArgs(rawGlobalArgs)
	if (globalArgs instanceof type.errors) {
		throw new Error(globalArgs.summary)
	}
	return ManagedRuntime.make(
		Layer.mergeAll(
			DefaultsLayer,
			iceConfigServiceLayer ??
				ICEConfigService.Live.pipe(
					Layer.provide(NodeContext.layer),
					Layer.provide(
						Layer.succeed(CLIFlags, {
							globalArgs,
							taskArgs,
						}),
					),
				),
			Layer.succeed(CLIFlags, {
				globalArgs,
				taskArgs,
			}),
			Logger.pretty,
			Logger.minimumLogLevel(logLevelMap[globalArgs.logLevel]),
		),
	)
}

export { runCli } from "./cli/index.js"
export { Opt } from "./canister.js"
export type { TaskCtxShape } from "./tasks/lib.js"
