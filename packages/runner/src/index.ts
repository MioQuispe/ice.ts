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
import { DfxService } from "./services/dfx.js"
import type {
  TaskTree,
  TaskTreeNode,
} from "./types/types.js"
import { Moc } from "./services/moc.js"
import { TaskRegistry } from "./services/taskRegistry.js"
import { ICEConfigService } from "./services/iceConfig.js"
import { CanisterIdsService } from "./services/canisterIds.js"
import { TaskCtx } from "./tasks/lib.js"
export * from "./builders/index.js"

export const configMap = new Map([
  ["APP_DIR", fs.realpathSync(process.cwd())],
  ["DFX_CONFIG_FILENAME", "ice.config.ts"],
  ["CANISTER_IDS_FILENAME", "canister_ids.json"],
  // TODO: IC_PORT / IC_HOST
  ["DFX_PORT", "8080"],
  ["DFX_HOST", "http://0.0.0.0"],
  ["REPLICA_PORT", "8080"],
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

export const removeBuilders = (
  taskTree: TaskTree | TaskTreeNode,
): TaskTree | TaskTreeNode => {
  if ("_tag" in taskTree && taskTree._tag === "builder") {
    return removeBuilders(taskTree.done())
  }
  if ("_tag" in taskTree && taskTree._tag === "scope") {
    return {
      ...taskTree,
      children: Object.fromEntries(
        Object.entries(taskTree.children).map(([key, value]) => [
          key,
          removeBuilders(value),
        ]),
      ) as Record<string, TaskTreeNode>,
    }
  }
  if ("_tag" in taskTree && taskTree._tag === "task") {
    return taskTree
  }
  return Object.fromEntries(
    Object.entries(taskTree).map(([key, value]) => [
      key,
      removeBuilders(value),
    ]),
  ) as TaskTree
}

// const fileLogger = Logger.logfmtLogger.pipe(
//   PlatformLogger.toFile("logs/ice.log", { flag: "a" }),
// )
// const LoggerLive = Logger.replaceScoped(Logger.defaultLogger, fileLogger).pipe(
//   Layer.provide(NodeFileSystem.layer)
// )
// const fileLogger = Logger.logfmtLogger.pipe(
//   PlatformLogger.toFile("logs/ice.log"),
// )
// const LoggerLive = Logger.addScoped(fileLogger).pipe(
//   Layer.provide(NodeFileSystem.layer),
// )
// Convert the fileLogger Effect into a Layer
// const FileLoggerLayer = Logger.zip(fileLogger)

// const mainLogger = Logger.zip(Logger.prettyLogger(), LoggerLive)

// const customLogger = Logger.make((ctx) => {
//   // console.log("attempting to serialize:", ctx)
//   fs.appendFileSync("logs/ice.log", `${JSON.stringify(ctx, null, 2)}\n`)
// })

// TODO: layer memoization should work? do we need this?
const DfxLayer = DfxService.Live.pipe(
  Layer.provide(NodeContext.layer),
  Layer.provide(configLayer),
)
// TODO: construct later? or this is just defaults
export const DefaultsLayer = Layer.mergeAll(
  NodeContext.layer,
  DfxLayer,
  TaskRegistry.Live,
  TaskCtx.Live.pipe(Layer.provide(DfxLayer), Layer.provide(NodeContext.layer)),
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
  Logger.minimumLogLevel(LogLevel.Info),
)
export const TUILayer = Layer.mergeAll(DefaultsLayer)
export const runtime = ManagedRuntime.make(CLILayer)
export { runCli } from "./cli/index.js"
export { Opt } from "./canister.js"
export type { TaskCtxShape } from "./tasks/lib.js"