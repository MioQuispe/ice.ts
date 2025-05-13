import fs from "node:fs"
import {
	Data,
	Layer,
	ManagedRuntime,
	Logger,
	ConfigProvider,
	LogLevel,
	Effect,
} from "effect"
import { NodeContext } from "@effect/platform-node"
import { DfxDefaultReplica, DfxReplica } from "./services/dfx.js"
import type { ICECtx, TaskTree, TaskTreeNode } from "./types/types.js"
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
	DefaultConfig.Live.pipe(
		Layer.provide(DefaultReplicaService),
	),
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
		Layer.provide(Layer.succeed(CLIFlags, { network: "local", logLevel: "debug" })),
	),
	Logger.minimumLogLevel(LogLevel.Debug),
)

const Flags = type({
	network: "string",
	logLevel: "'debug' | 'info' | 'error'",
})

const logLevelMap = {
	debug: LogLevel.Debug,
	info: LogLevel.Info,
	error: LogLevel.Error,
}

export const makeRuntime = (cliFlags: { network: string; logLevel: string }) => {
	const validatedFlags = Flags(cliFlags)
	if (validatedFlags instanceof type.errors) {
		throw new Error(validatedFlags.summary)
	}
	return ManagedRuntime.make(
		Layer.mergeAll(
			DefaultsLayer,
			ICEConfigService.Live.pipe(
				Layer.provide(NodeContext.layer),
				Layer.provide(Layer.succeed(CLIFlags, validatedFlags)),
			),
			Layer.succeed(CLIFlags, validatedFlags),
			Logger.pretty,
			Logger.minimumLogLevel(logLevelMap[validatedFlags.logLevel]),
		),
	)
}

export { runCli } from "./cli/index.js"
export { Opt } from "./canister.js"
export type { TaskCtxShape } from "./tasks/lib.js"
