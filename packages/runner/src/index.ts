import { IDL } from "@dfinity/candid"
import { Principal } from "@dfinity/principal"
import type { DfxJson } from "./types/schema.js"
import type {
  AssetSpecificProperties,
  CanisterConfiguration,
  ConfigDefaults,
  ConfigNetwork,
  DfxVersion,
  MotokoSpecificProperties,
  Profile,
  RustSpecificProperties,
} from "./types/schema.js"
import fs from "node:fs"
import {
  Actor,
  type ActorSubclass,
  Agent,
  type HttpAgent,
  type Identity,
  type SignIdentity,
} from "@dfinity/agent"
import { idlFactory } from "./canisters/management_new/management.did.js"
import { Ed25519KeyIdentity } from "@dfinity/identity"
import * as os from "node:os"
import find from "find-process"
import { principalToAccountId } from "./utils/utils.js"
import {
  Effect,
  Data,
  Layer,
  ManagedRuntime,
  Logger,
  Config,
  ConfigProvider,
  Context,
  Stream,
  Sink,
  Match,
  Chunk,
  Cache,
  type Runtime,
  Option,
  LogLevel,
  Duration,
} from "effect"
import { Schema, ParseResult } from "@effect/schema"
import { NodeContext, NodeFileSystem, NodeRuntime } from "@effect/platform-node"
import {
  Path,
  HttpClient,
  FileSystem,
  Command,
  CommandExecutor,
  Terminal,
  PlatformLogger,
} from "@effect/platform"
// TODO: create abstraction after pic-js is done
// import { ICService } from "./services/ic.js"
import { DfxService } from "./services/dfx.js"
import type {
  Task,
  Scope,
  BuilderResult,
  TaskTree,
  TaskTreeNode,
  CrystalContext,
} from "./types/types.js"
import { Moc } from "./services/moc.js"
import { runCli } from "./cli/index.js"
import { TaskRegistry } from "./services/taskRegistry.js"

export * from "./core/builder.js"
// export * from "./plugins/withContext.js"

import * as didc from "didc_js"
import { Tags } from "./core/builder.js"
export const configMap = new Map([
  ["APP_DIR", fs.realpathSync(process.cwd())],
  ["DFX_CONFIG_FILENAME", "crystal.config.ts"],
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

type ManagementActor = import("@dfinity/agent").ActorSubclass<
  import("./canisters/management_new/management.types.js")._SERVICE
>

export class TaskCtx extends Context.Tag("TaskCtx")<
  TaskCtx,
  {
    readonly network: string
    networks?: {
      [k: string]: ConfigNetwork
    } | null
    readonly subnet: string
    readonly agent: HttpAgent
    readonly identity: SignIdentity
    readonly users: {
      [name: string]: {
        identity: Identity
        agent: HttpAgent
        principal: Principal
        accountId: string
        // TODO: neurons?
      }
    }
    readonly runTask: typeof runTask
  }
>() {
  static Live = Layer.effect(
    TaskCtx,
    Effect.gen(function* () {
      // TODO: should be dynamically determined, whether this or pocket-ic?
      const { agent, identity } = yield* DfxService
      // const crystalConfig = yield* getCrystalConfig()
      // TODO: get layers or runtime? we need access to the tasks dependencies here

      // const runTask = <A = any, E = any, R = any>(
      //   task: Task,
      // ): Effect.Effect<A, E, R> => {
      //   return Effect.gen(function* () {
      //     // 1. Execute Dependencies
      //   })
      // }

      return {
        // TODO: get from config?
        network: "local",
        subnet: "system",
        agent,
        identity,
        runTask,
        users: {
          default: {
            identity,
            agent,
            // TODO: use Account class from connect2ic?
            principal: identity.getPrincipal(),
            accountId: principalToAccountId(identity.getPrincipal()),
          },
        },
      }
    }),
  )
}
export type TaskCtxShape = Context.Tag.Service<typeof TaskCtx>

// TODO: just one place to define this
export type Opt<T> = [T] | []
export const Opt = <T>(value?: T): Opt<T> => {
  return value || value === 0 ? [value] : []
}

export const getCanisterInfo = (canisterId: string) =>
  Effect.gen(function* () {
    const { mgmt } = yield* DfxService
    // TODO: get from environment
    const canisterInfo = yield* Effect.tryPromise({
      try: async () => {
        // TODO: this might not be defined. where do we get it from?
        if (!canisterId) {
          return { status: "not_installed" }
        }
        try {
          return await mgmt.canister_status({
            canister_id: Principal.fromText(canisterId),
          })
        } catch (error) {
          return { status: "not_installed" }
        }
      },
      catch: (error) => {
        return error
      },
    })

    // if (result.module_hash.length > 0) {
    //   console.log(
    //     `Canister ${canisterName} is already installed. Skipping deployment.`,
    //   )
    // }
    return canisterInfo
  })

export const createCanister = (canisterId?: string) =>
  Effect.gen(function* () {
    const { mgmt, identity } = yield* DfxService
    const createResult = yield* Effect.tryPromise({
      try: () =>
        mgmt.provisional_create_canister_with_cycles({
          settings: [
            {
              compute_allocation: Opt<bigint>(),
              memory_allocation: Opt<bigint>(),
              freezing_threshold: Opt<bigint>(),
              controllers: Opt<Principal[]>([identity.getPrincipal()]),
            },
          ],
          amount: Opt<bigint>(1_000_000_000_000n),
          // TODO: dont generate here. because it doesnt work on mainnet
          // instead expose the canisterId in the context for tasks which require it
          // could be through dependencies
          specified_id: Opt<Principal>(
            canisterId ? Principal.fromText(canisterId) : undefined,
          ),
          sender_canister_version: Opt<bigint>(0n),
        }) as Promise<{ canister_id: Principal }>,
      catch: (error) =>
        new DeploymentError({
          message: `Failed to create canister: ${error instanceof Error ? error.message : String(error)}`,
        }),
    })
    return createResult.canister_id.toText()
  })

export const generateDIDJS = (canisterName: string, didPath: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const appDir = yield* Config.string("APP_DIR")
    const didString = yield* fs.readFileString(didPath)
    const didJSString = didc.did_to_js(didString)
    const didJSPath = path.join(
      appDir,
      ".artifacts",
      canisterName,
      `${canisterName}.did.js`,
    )
    yield* fs.writeFile(didJSPath, Buffer.from(didJSString ?? "")) // TODO: check

    const canisterDID = yield* Effect.tryPromise({
      try: () => import(didJSPath),
      catch: (error) =>
        new DeploymentError({
          message: `Failed to import canister DID: ${error instanceof Error ? error.message : String(error)}`,
        }),
    })

    if (!canisterDID) {
      return yield* Effect.fail(
        new DeploymentError({ message: "Failed to convert DID to JS" }),
      )
    }
    return canisterDID
  })

export const encodeArgs = (args: any[], canisterDID: any) => {
  const encodedArgs = args
    ? new Uint8Array(IDL.encode(canisterDID.init({ IDL }), args))
    : new Uint8Array()
  return encodedArgs
}

export const installCanister = ({
  encodedArgs,
  canisterId,
  wasmPath,
}: {
  encodedArgs: Uint8Array
  canisterId: string
  wasmPath: string
}) =>
  Effect.gen(function* () {
    const { mgmt } = yield* DfxService
    const fs = yield* FileSystem.FileSystem
    // TODO: we need to generate did.js before?

    // Prepare WASM module
    const wasmContent = yield* fs.readFile(wasmPath)
    const wasm = Array.from(new Uint8Array(wasmContent))

    // Install code
    yield* Effect.logInfo("Installing code", {
      canisterId,
      wasmPath,
    })
    yield* Effect.tryPromise({
      try: () =>
        mgmt.install_code({
          // arg: encodedArgs,
          arg: Array.from(encodedArgs),
          canister_id: Principal.fromText(canisterId),
          sender_canister_version: Opt<bigint>(),
          wasm_module: wasm,
          mode: { reinstall: null },
        }),
      catch: (error) =>
        new DeploymentError({
          message: `Failed to install code: ${error instanceof Error ? error.message : String(error)}`,
        }),
    })
    yield* Effect.logInfo("Code installed", { canisterId })

    Effect.log(`Success with wasm bytes length: ${wasm.length}`)
    Effect.log(`Installed code for ${canisterId}`)
  })

export const compileMotokoCanister = (
  src: string,
  canisterName: string,
  wasmOutputFilePath: string,
) =>
  Effect.gen(function* () {
    const moc = yield* Moc
    // Create output directories if they don't exist
    yield* Effect.log(`Compiling ${canisterName} to ${wasmOutputFilePath}`)
    // TODO: we need to make dirs if they don't exist
    yield* moc.compile(src, wasmOutputFilePath)
    yield* Effect.log(
      `Successfully compiled ${src} ${canisterName} outputFilePath: ${wasmOutputFilePath}`,
    )
    return wasmOutputFilePath
  })

export const writeCanisterIds = (canisterName: string, canisterId: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const appDir = yield* Config.string("APP_DIR")
    const canisterIdsPath = path.join(appDir, "canister_ids.json")

    // TODO: should they be shared between dfx / pic-js?
    let canisterIds: {
      [canisterName: string]: {
        [network: string]: string
      }
    } = {}

    const exists = yield* fs.exists(canisterIdsPath)
    if (exists) {
      const content = yield* fs.readFileString(canisterIdsPath)
      canisterIds = yield* Effect.try({
        try: () => JSON.parse(content),
        catch: () => ({}),
      })
    }

    canisterIds[canisterName] = {
      ...canisterIds[canisterName],
      local: canisterId,
    }

    yield* fs.writeFile(
      canisterIdsPath,
      Buffer.from(JSON.stringify(canisterIds, null, 2)),
    )
  })

export const readCanisterIds = () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const appDir = yield* Config.string("APP_DIR")
    const canisterIdsPath = path.join(appDir, "canister_ids.json")
    const content = yield* fs.readFileString(canisterIdsPath)
    return JSON.parse(content)
  })

export class TaskNotFoundError extends Data.TaggedError("TaskNotFoundError")<{
  path: string[]
  reason: string
}> {}

export const findTaskInTaskTree = (
  obj: TaskTree,
  keys: Array<string>,
): Effect.Effect<Task, TaskNotFoundError> => {
  const firstKey = keys[0]
  const rest = keys.slice(1)
  let currentNode = obj[firstKey]
  return Effect.gen(function* () {
    for (const key of rest) {
      // TODO: this becomes undefined
      const node = Match.value(currentNode).pipe(
        Match.tag("task", (task): Task => task),
        Match.tag("scope", (scope): Scope => scope),
        Match.tag("builder", (result): Scope => result._scope),
        Match.option,
      )

      if (Option.isNone(node)) {
        return yield* Effect.fail(
          new TaskNotFoundError({
            path: keys,
            reason: `Invalid node type encountered at key "${key}"`,
          }),
        )
      }

      const isLastKey = keys.indexOf(key) === keys.length - 1

      if (node.value._tag === "scope") {
        const nextNode = node.value.children[key]
        if (!nextNode) {
          return yield* Effect.fail(
            new TaskNotFoundError({
              path: keys,
              reason: `No child found for key "${key}" in scope`,
            }),
          )
        }
        if (isLastKey && nextNode._tag === "task") {
          return nextNode
        }
        currentNode = nextNode
      } else if (node.value._tag === "task") {
        if (!isLastKey) {
          return yield* Effect.fail(
            new TaskNotFoundError({
              path: keys,
              reason: `Found task before end of path at key "${key}"`,
            }),
          )
        }
        return node.value
      } else {
        return yield* Effect.fail(
          new TaskNotFoundError({
            path: keys,
            reason: `Unexpected node type "${node.value}" at key "${key}"`,
          }),
        )
      }
    }

    return yield* Effect.fail(
      new TaskNotFoundError({
        path: keys,
        reason: "Path traversal completed without finding a task",
      }),
    )
  })
}

// TODO: more accurate type
type TaskFullName = string
// TODO: figure out if multiple tasks are needed
export const getTaskByPath = (taskPathString: TaskFullName) =>
  Effect.gen(function* () {
    const taskPath: string[] = taskPathString.split(":")
    const crystalConfig = yield* getCrystalConfig()
    const task = yield* findTaskInTaskTree(crystalConfig, taskPath)
    return { task, crystalConfig: crystalConfig.crystal }
  })

// const fileLogger = Logger.logfmtLogger.pipe(
//   PlatformLogger.toFile("logs/crystal.log", { flag: "a" }),
// )
// const LoggerLive = Logger.replaceScoped(Logger.defaultLogger, fileLogger).pipe(
//   Layer.provide(NodeFileSystem.layer)
// )
// const fileLogger = Logger.logfmtLogger.pipe(
//   PlatformLogger.toFile("logs/crystal.log"),
// )
// const LoggerLive = Logger.addScoped(fileLogger).pipe(
//   Layer.provide(NodeFileSystem.layer),
// )
// Convert the fileLogger Effect into a Layer
// const FileLoggerLayer = Logger.zip(fileLogger)

// const mainLogger = Logger.zip(Logger.prettyLogger(), LoggerLive)

const customLogger = Logger.make((ctx) => {
  // console.log("attempting to serialize:", ctx)
  fs.appendFileSync("logs/crystal.log", `${JSON.stringify(ctx, null, 2)}\n`)
})

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
  // TODO: do not depend on DfxService directly?
  TaskCtx.Live.pipe(
    // Layer.provide(DfxService.Live),
    Layer.provide(DfxLayer),
    Layer.provide(NodeContext.layer),
  ),
  Moc.Live.pipe(Layer.provide(NodeContext.layer)),
  configLayer,
  Logger.pretty,
  // Logger.add(customLogger),
  // Layer.effect(fileLogger),
  // LoggerLive,
  // fileLogger,
)
export const runtime = ManagedRuntime.make(DefaultsLayer)

// export const runCLI = async () => {
//   const result = await runtime.runPromise(cliProgram)
//   console.log(result)
// }

export type LayerRequirements<L extends Layer.Layer<any, any, any>> =
  L extends Layer.Layer<infer R, any, any> ? R : never

// export const DependencyResultsArray = Context.Tag<DependencyResultsArray, any[]>("DependencyResultsArray") // Tag for the array
// export type DependencyResultsArrayShape = Context.Tag.Service<typeof DependencyResultsArray>

// class TaskNotFoundError extends Data.TaggedError("TaskNotFoundError")<{
//   message: string
// }> {}

// TODO: do we need to get by id? will symbol work?
export const getTaskPathById = (id: Symbol) =>
  Effect.gen(function* () {
    // TODO: initialize with all tasks
    const crystalConfig = yield* getCrystalConfig()
    const result = yield* filterTasks(
      crystalConfig,
      (node) => node._tag === "task" && node.id === id,
    )
    // TODO: use effect Option?
    if (result?.[0]) {
      return result[0].path.join(":")
    }
    // return undefined
    return yield* Effect.fail(
      new TaskNotFoundError({
        reason: "Task not found by id",
        path: [""],
      }),
    )
  })

export const runTaskByPath = (taskPath: string) =>
  Effect.gen(function* () {
    const { task, crystalConfig } = yield* getTaskByPath(taskPath)
    yield* runTask(task)
  })

export class DependencyResults extends Context.Tag("DependencyResults")<
  DependencyResults,
  {
    readonly dependencies: any[]
  }
>() {}

export class TaskInfo extends Context.Tag("TaskInfo")<
  TaskInfo,
  {
    readonly taskPath: string
  }
>() {}

class RunTaskError extends Data.TaggedError("RunTaskError")<{
  message: string
}> {}

// Type to extract success types from an array of Tasks
type DependencySuccessTypes<Dependencies extends Task<any, any, any>[]> = {
  [K in keyof Dependencies]: Dependencies[K] extends Task<infer A, any, any>
    ? A
    : never
}

export interface RunTaskOptions {
  forceRun?: boolean
}

// // TODO: use Effect cache or kv store?
// // TODO: use taskPath as cache key? no symbol
// const taskMap = new Map<symbol, Task>()
// const taskCache = Cache.make<[string, string], unknown>({
//   capacity: 100_000,
//   timeToLive: Duration.infinity,
//   // lookup: (key) => Effect.succeed(taskMap.get(key))
//   lookup: ([cacheKey, taskPath]) =>
//     Effect.gen(function* () {
//       const { task } = yield* getTaskByPath(taskPath)
//       return yield* runTask(task)
//     }),
// })

// export const runTaskCached = <A, E, R, I>(
//   task: Task<A, E, R, I>,
//   options: RunTaskOptions = { forceRun: false },
// ) => {
//   return Effect.gen(function* () {
//     const taskPath = yield* getTaskPathById(task.id)
//     const cacheKey = task.computeCacheKey ? task.computeCacheKey(task) : taskPath
//     const cache = yield* taskCache
//     return yield* cache.get([cacheKey, taskPath])
//   })
// }
export const runTask = <A, E, R, I>(
  task: Task<A, E, R, I>,
  options: RunTaskOptions = { forceRun: false },
): Effect.Effect<A, unknown, unknown> => {
  return Effect.gen(function* () {
    const cache = yield* TaskRegistry

    // // const cacheKey = task.id
    // // 1. If there is already a cached result, return it immediately.
    // if (!options.forceRun && cache.contains(cacheKey)) {
    //   return yield* cache.get(cacheKey)
    // }
    // type DepsSuccessTypes = DependencySuccessTypes<T["dependencies"]>
    const dependencyResults = []
    for (const dependency of task.dependencies) {
      const dependencyResult = yield* runTask(dependency)
      dependencyResults.push(dependencyResult)
    }

    const taskLayer = Layer.mergeAll(
      // configLayer,
      Layer.setConfigProvider(
        ConfigProvider.fromMap(new Map([...Array.from(configMap.entries())])),
      ),
    )
    const taskPath = yield* getTaskPathById(task.id)


    // look here if cacheKey finds something. only after dependencies are run first
    // TODO: do we need access to dependencyResults inside the computeCacheKey?
    const cacheKey = `${task.computeCacheKey ? task.computeCacheKey(task) : taskPath}:${taskPath}`
    // TODO: add taskPath
    const isCached = yield* cache.has(cacheKey)
    if (isCached && !options.forceRun) {
      return (yield* cache.get(cacheKey)) as A
    }

    const result = yield* task.effect.pipe(
      Effect.provide(taskLayer),
      Effect.provide(
        Layer.succeed(TaskInfo, {
          taskPath,
          // TODO: provide more?
        }),
      ),
      Effect.provide(
        Layer.succeed(DependencyResults, { dependencies: dependencyResults }),
      ),
    )
    // TODO: how do handle tasks which return nothing?
    yield* cache.set(cacheKey, result)

    return result
  })
}

const filterTasks = (
  taskTree: TaskTree,
  predicate: (task: TaskTreeNode) => boolean,
  path: string[] = [],
): Effect.Effect<Array<{ task: TaskTreeNode; path: string[] }>> =>
  Effect.gen(function* () {
    const matchingNodes: Array<{ task: TaskTreeNode; path: string[] }> = []
    for (const key of Object.keys(taskTree)) {
      const currentNode = taskTree[key]
      const node = Match.value(currentNode).pipe(
        Match.tag("task", (task): Task => task),
        Match.tag("scope", (scope): Scope => scope),
        // TODO: should we transform the whole tree once, and remove builders?
        Match.tag("builder", (result): Scope => result._scope),
        Match.option,
      )
      if (Option.isSome(node)) {
        const fullPath = [...path, key]
        if (predicate(node.value)) {
          matchingNodes.push({ task: node.value, path: fullPath })
        }
        if (node.value._tag === "scope") {
          const children = Object.keys(node.value.children)
          // TODO: call itself recursively
          const filteredChildren = yield* filterTasks(
            node.value.children,
            predicate,
            fullPath,
          )
          matchingNodes.push(...filteredChildren)
        }
      }
    }
    return matchingNodes
  })

// const findTasksByTags = (config: CrystalConfigFile, tags: string[]) =>
//   Effect.gen(function* () {
//     return matchingTasks
//   })

export const canistersDeployTask = () =>
  Effect.gen(function* () {
    yield* Effect.log("Running canisters:deploy task")
    const crystalConfig = yield* getCrystalConfig()
    const taskTree = Object.fromEntries(
      Object.entries(crystalConfig).filter(([key]) => key !== "default"),
    ) as TaskTree
    const tasksWithPath = yield* filterTasks(
      taskTree,
      (node) =>
        node._tag === "task" &&
        node.tags.includes(Tags.CANISTER) &&
        node.tags.includes(Tags.DEPLOY),
    )
    for (const { task, path } of tasksWithPath) {
      yield* Effect.log(`Running task ${path.join(":")}`)
      yield* runTaskByPath(path.join(":"))
    }
  })

export const canistersCreateTask = () =>
  Effect.gen(function* () {
    yield* Effect.log("Running canisters:create task")
    const crystalConfig = yield* getCrystalConfig()
    const taskTree = Object.fromEntries(
      Object.entries(crystalConfig).filter(([key]) => key !== "default"),
    ) as TaskTree
    const tasksWithPath = yield* filterTasks(
      taskTree,
      (node) =>
        node._tag === "task" &&
        node.tags.includes(Tags.CANISTER) &&
        node.tags.includes(Tags.CREATE),
    )
    for (const { task, path } of tasksWithPath) {
      // TODO: parallelize? topological sort?
      yield* Effect.log(`Running task ${path.join(":")}`)
      yield* runTaskByPath(path.join(":"))
    }
  })

export const canistersBuildTask = () =>
  Effect.gen(function* () {
    yield* Effect.log("Running canisters:build task")
    const crystalConfig = yield* getCrystalConfig()
    const taskTree = Object.fromEntries(
      Object.entries(crystalConfig).filter(([key]) => key !== "default"),
    ) as TaskTree
    const tasksWithPath = yield* filterTasks(
      taskTree,
      (node) =>
        node._tag === "task" &&
        node.tags.includes(Tags.CANISTER) &&
        node.tags.includes(Tags.BUILD),
    )
    for (const { task, path } of tasksWithPath) {
      // TODO: parallelize? topological sort?
      yield* Effect.log(`Running task ${path.join(":")}`)
      yield* runTaskByPath(path.join(":"))
    }
  })

export const canistersBindingsTask = () =>
  Effect.gen(function* () {
    yield* Effect.log("Running canisters:bindings task")
    const crystalConfig = yield* getCrystalConfig()
    const taskTree = Object.fromEntries(
      Object.entries(crystalConfig).filter(([key]) => key !== "default"),
    ) as TaskTree
    const tasksWithPath = yield* filterTasks(
      taskTree,
      (node) =>
        node._tag === "task" &&
        node.tags.includes(Tags.CANISTER) &&
        node.tags.includes(Tags.BINDINGS),
    )
    for (const { task, path } of tasksWithPath) {
      // TODO: parallelize? topological sort?
      yield* Effect.log(`Running task ${path.join(":")}`)
      yield* runTaskByPath(path.join(":"))
    }
  })

export const canistersInstallTask = () =>
  Effect.gen(function* () {
    yield* Effect.log("Running canisters:install task")
    const crystalConfig = yield* getCrystalConfig()
    const taskTree = Object.fromEntries(
      Object.entries(crystalConfig).filter(([key]) => key !== "default"),
    ) as TaskTree
    const tasksWithPath = yield* filterTasks(
      taskTree,
      (node) =>
        node._tag === "task" &&
        node.tags.includes(Tags.CANISTER) &&
        node.tags.includes(Tags.INSTALL),
    )
    for (const { task, path } of tasksWithPath) {
      yield* Effect.log(`Running task ${path.join(":")}`)
      yield* runTaskByPath(path.join(":"))
    }
  })

export const canistersStatusTask = () =>
  Effect.gen(function* () {
    yield* Effect.log("Running canisters:status task")
    const canisterIdsMap = yield* getCanisterIds
    const dfx = yield* DfxService
    // TODO: in parallel? are these tasks?
    const canisterStatusesEffects = Object.keys(canisterIdsMap).map(
      (canisterName) =>
        Effect.gen(function* () {
          const network = "local"
          const canisterId = canisterIdsMap[canisterName]
          const status = yield* Effect.tryPromise({
            try: () =>
              dfx.mgmt.canister_status({
                canister_id: Principal.from(canisterId[network]),
              }),
            catch: (error) =>
              new Error(
                `Failed to get canister status for ${canisterName}: ${error}`,
              ),
          })
          return { canisterName, canisterId: canisterId[network], status }
        }),
    )

    const canisterStatuses = yield* Effect.all(canisterStatusesEffects, {
      concurrency: "unbounded",
    })

    // TODO: print module hash
    const statusLog = canisterStatuses
      .map(
        ({ canisterName, canisterId, status }) => `
  ${canisterName} status:
      ID: ${canisterId}
      Status: ${Object.keys(status.status)[0]}
      Memory Size: ${status.memory_size}
      Cycles: ${status.cycles}
      Idle Cycles Burned Per Day: ${status.idle_cycles_burned_per_day}
      Module Hash: ${status.module_hash.length > 0 ? "Present" : "Not Present"}`,
      )
      .join("\n")

    yield* Effect.log(statusLog)
  })

export const listTasksTask = () =>
  Effect.gen(function* () {
    const crystalConfig = yield* getCrystalConfig()
    const taskTree = Object.fromEntries(
      Object.entries(crystalConfig).filter(([key]) => key !== "default"),
    ) as TaskTree
    const tasksWithPath = yield* filterTasks(
      taskTree,
      (node) => node._tag === "task",
    )

    // TODO: format nicely
    const taskList = tasksWithPath.map(({ task, path }) => {
      const taskPath = path.join(":") // Use colon to represent hierarchy
      return `  ${taskPath}` // Indent for better readability
    })

    const formattedTaskList = ["Available tasks:", ...taskList].join("\n")

    yield* Effect.log(formattedTaskList)
  })

export const listCanistersTask = () =>
  Effect.gen(function* () {
    yield* Effect.log("Running list canisters task")
    const crystalConfig = yield* getCrystalConfig()
    const taskTree = Object.fromEntries(
      Object.entries(crystalConfig).filter(([key]) => key !== "default"),
    ) as TaskTree
    const tasksWithPath = yield* filterTasks(
      taskTree,
      (node) => node._tag === "task" && node.tags.includes(Tags.CANISTER),
    )

    // TODO: format nicely
    const taskList = tasksWithPath.map(({ task, path }) => {
      const taskPath = path.join(":") // Use colon to represent hierarchy
      return `  ${taskPath}` // Indent for better readability
    })

    const formattedTaskList = ["Available canister tasks:", ...taskList].join(
      "\n",
    )

    yield* Effect.log(formattedTaskList)
  })

export { runCli } from "./cli/index.js"

// TODO: fix
type CrystalConfig = CrystalContext
type CrystalConfigFile = {
  default: CrystalContext
} & {
  [key: string]: TaskTreeNode
}

// TODO: types
export const getCrystalConfig = (configPath = "crystal.config.ts") =>
  Effect.gen(function* () {
    const path = yield* Path.Path
    const fs = yield* FileSystem.FileSystem
    const appDirectory = yield* fs.realPath(process.cwd())
    return yield* Effect.tryPromise({
      try: () =>
        import(
          path.resolve(appDirectory, configPath)
        ) as Promise<CrystalConfigFile>,
      catch: (error) =>
        new ConfigError({
          message: `Failed to get Crystal config: ${error instanceof Error ? error.message : String(error)}`,
        }),
    })
  })

export const createActor = <T>({
  canisterId,
  canisterDID,
}: {
  canisterId: string
  canisterDID: any
}) =>
  Effect.gen(function* () {
    const { agent } = yield* DfxService
    const commandExecutor = yield* CommandExecutor.CommandExecutor
    // TODO: should be agnostic of dfx
    const getControllers = () => Promise.resolve()
    const addControllers = (controllers: Array<string>) =>
      Effect.gen(function* () {
        const command = Command.make(
          "dfx",
          "canister",
          "--network",
          "local",
          "update-settings",
          ...controllers.flatMap((c) => ["--add-controller", c]),
          canisterId,
        )
        yield* commandExecutor.start(command)
      })

    const setControllers = (controllers: Array<string>) =>
      Effect.gen(function* () {
        // TODO: dont depend on dfx
        const cyclesWalletCommand = Command.make(
          "dfx",
          "identity",
          "get-wallet",
        )
        const cyclesWallet = yield* Command.string(cyclesWalletCommand)

        // TODO: dont depend on dfx
        const command = Command.make(
          "dfx",
          "canister",
          "--network",
          "local",
          "update-settings",
          ...controllers.flatMap((c) => ["--set-controller", c]),
          "--set-controller",
          cyclesWallet.trim(),
          canisterId,
        )
        yield* commandExecutor.start(command)
      })

    return {
      actor: Actor.createActor(canisterDID.idlFactory, {
        agent,
        canisterId,
      }),
      canisterId,
      getControllers,
      addControllers,
      setControllers,
    }
  })

const CanisterIdsSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Record({
    key: Schema.String,
    value: Schema.String,
  }),
})
export type CanisterIds = Schema.Schema.Type<typeof CanisterIdsSchema>
const decodeCanisterIds = Schema.decodeUnknown(CanisterIdsSchema)
// type CanisterIds = Schema.To<typeof CanisterIdsSchema>

export const getCanisterIds = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const appDir = yield* Config.string("APP_DIR")
  const canisterIdsFilename = yield* Config.string("CANISTER_IDS_FILENAME")
  const canisterIdsPath = path.join(appDir, canisterIdsFilename)

  const idsContent = yield* fs.readFileString(canisterIdsPath)
  const idsUnknown = yield* Effect.try({
    try: () => JSON.parse(idsContent),
    catch: () => new ConfigError({ message: "Failed to parse canister IDs" }),
  })
  const ids = yield* decodeCanisterIds(idsUnknown)
  const canisterIds = Object.keys(ids).reduce<CanisterIds>(
    (acc, canisterName) => {
      if (canisterName !== "__Candid_UI") {
        return { ...acc, [canisterName]: ids[canisterName] }
      }
      return acc
    },
    {},
  )

  return canisterIds
})

export { deployTaskPlugin } from "./plugins/deploy"

export const dfxDefaults: DfxJson = {
  defaults: {
    build: {
      packtool: "",
      args: "--force-gc",
    },
    replica: {
      subnet_type: "system",
    },
  },
  networks: {
    local: {
      bind: "127.0.0.1:8080",
      type: "ephemeral",
    },
    staging: {
      providers: ["https://ic0.app"],
      type: "persistent",
    },
    ic: {
      providers: ["https://ic0.app"],
      type: "persistent",
    },
  },
  version: 1,
}
