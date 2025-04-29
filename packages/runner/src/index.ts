import fs from "node:fs"
import {
	Data,
	Layer,
	ManagedRuntime,
	Logger,
	ConfigProvider,
	LogLevel,
} from "effect"
import { NodeContext } from "@effect/platform-node"
import { DfxDefaultReplica } from "./services/dfx.js"
import type { ICECtx, TaskTree, TaskTreeNode } from "./types/types.js"
import { Moc } from "./services/moc.js"
import { TaskRegistry } from "./services/taskRegistry.js"
import { ICEConfigService } from "./services/iceConfig.js"
import { PocketICService } from "./services/pic.js"
import { CanisterIdsService } from "./services/canisterIds.js"
import { TaskCtx } from "./tasks/lib.js"
import type { ICEConfig } from "./types/types.js"
import { Ids } from "./ids.js"
export * from "./builders/index.js"
export * from "./ids.js"



// const defaultICEConfig: ICEConfig = {
//       // TODO: dfx defaults etc.
// 	  type: "system",
// 	  replica: DfxReplica,
// 	  users: {
// 		default: Ids.fromDfx("default"),
// 	  },
// 	  roles: {
// 		deployer: 
// 	  }
//     }

// is this where we construct the runtime / default environment?
// TODO: can we make this async as well?
export const ICE = (configOrFn: ICEConfig | ((ctx: ICECtx) => Promise<ICEConfig>)) => {
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

export class DeploymentError extends Data.TaggedError("DeploymentError")<{
	message: string
}> {}

export class ConfigError extends Data.TaggedError("ConfigError")<{
	message: string
}> {}

// TODO: construct later? or this is just defaults
export const DefaultsLayer = Layer.mergeAll(
	NodeContext.layer,
	TaskRegistry.Live,
	// PocketICService.Live.pipe(
	// 	Layer.provide(NodeContext.layer),
	// 	Layer.provide(configLayer),
	// ),
	// TODO: use pocket-ic
	DfxDefaultReplica.pipe(
		Layer.provide(NodeContext.layer),
		Layer.provide(configLayer),
	),
	Moc.Live.pipe(Layer.provide(NodeContext.layer)),
	configLayer,
	ICEConfigService.Live.pipe(Layer.provide(NodeContext.layer)),
	CanisterIdsService.Live.pipe(
		Layer.provide(NodeContext.layer),
		Layer.provide(configLayer),
	),
)

export const CLILayer = Layer.mergeAll(
	DefaultsLayer,
	Logger.pretty,
	// TODO: set with logLevel flag
	Logger.minimumLogLevel(LogLevel.Debug),
)

export const TUILayer = Layer.mergeAll(
	DefaultsLayer,
	Logger.minimumLogLevel(LogLevel.Debug),
)
export const runtime = ManagedRuntime.make(CLILayer)
export { runCli } from "./cli/index.js"
export { Opt } from "./canister.js"
export type { TaskCtxShape } from "./tasks/lib.js"
