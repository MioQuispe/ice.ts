import { spawn as childSpawn } from "node:child_process"
import { IDL } from "@dfinity/candid"
import { Principal } from "@dfinity/principal"
import type { DfxJson } from "./schema.js"
import type {
  AssetSpecificProperties,
  CanisterConfiguration,
  ConfigDefaults,
  ConfigNetwork,
  DfxVersion,
  MotokoSpecificProperties,
  Profile,
  RustSpecificProperties,
} from "./schema.js"
import fs from "node:fs"
import {
  Actor,
  type ActorSubclass,
  HttpAgent,
  type Identity,
} from "@dfinity/agent"
import { idlFactory } from "./canisters/management_new/management.did.js"
import open from "open"
import express from "express"
import path from "node:path"
import Emitter from "event-e3"
import { Ed25519KeyIdentity } from "@dfinity/identity"
import url from "node:url"
import { Repeater } from "@repeaterjs/repeater"
import * as os from "node:os"
import find from "find-process"
import { principalToAccountId } from "./utils"
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
} from "effect"
import { Schema, ParseResult } from "@effect/schema"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import {
  Path,
  HttpClient,
  FileSystem,
  Command,
  CommandExecutor,
  Terminal,
} from "@effect/platform"
// import { did_to_js } from "didc_js"

export const configLayer = Layer.setConfigProvider(
  ConfigProvider.fromMap(
    new Map([
      ["APP_DIR", fs.realpathSync(process.cwd())],
      ["DFX_CONFIG_FILENAME", "crystal.config.ts"],
      ["CANISTER_IDS_FILENAME", "canister_ids.json"],
      ["DFX_PORT", "8080"],
      ["DFX_HOST", "http://0.0.0.0"],
      ["REPLICA_PORT", "8080"],
    ]),
  ),
)

export class DeploymentError extends Data.TaggedError("DeploymentError")<{
  message: string
}> {}

export class ConfigError extends Data.TaggedError("ConfigError")<{
  message: string
}> {}

const getDfxPort = async (): Promise<number> => {
  return new Promise((resolve, reject) => {
    childSpawn("dfx", ["info", "webserver-port"], {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .stdout.on("data", (data) => {
        const port = Number.parseInt(data.toString().trim(), 10)
        if (Number.isNaN(port)) {
          reject(new Error("Failed to parse DFX webserver port"))
        } else {
          resolve(port)
        }
      })
      .on("error", (err) => {
        reject(new Error(`Failed to get DFX webserver port: ${err.message}`))
      })
  })
}

type ManagementActor = import("@dfinity/agent").ActorSubclass<
  import("./canisters/management_new/management.types.js")._SERVICE
>

// TODO: change
export type TaskContext = {
  task: <T>(taskName: string) => Promise<T>
  // [K in keyof DfxTs["canisters"]]: {
  //   // actor: ActorSubclass<C[K]["idlFactory"]>
  //   // canisterId: C[K]["canisterId"]
  //   canisterId: string
  //   actor: ActorSubclass<any>
  //   // setControllers: (controllers: Array<string>) => Promise<void>,
  //   // addControllers: (controllers: Array<string>) => Promise<void>
  // }
}

export type ExtendedCanisterConfiguration = (
  | CanisterConfiguration
  | RustSpecificProperties
  | MotokoSpecificProperties
  | AssetSpecificProperties
) & {
  _metadata?: { standard?: string }
  dfx_js?: {
    args?: any[]
    canister_id?: {
      [network: string]: string
    }
  }
}

// Define a more specific type for canister configurations
// export type TaskCanisterConfiguration<T = ExtendedCanisterConfiguration> = ExtendedCanisterConfiguration & T

export type TaskCanisterConfiguration = ExtendedCanisterConfiguration

export type TaskScriptConfiguration<A> = (ctx: TaskContext) => A

export type TaskConfiguration<A> =
  | TaskCanisterConfiguration
  | TaskScriptConfiguration<A>

export type CrystalConfig = {
  canisters: Record<
    string,
    TaskCanisterConfiguration | Promise<TaskCanisterConfiguration>
  >
  scripts?: Record<
    string,
    TaskScriptConfiguration<any> | Promise<TaskScriptConfiguration<any>>
  >
  Defaults?: ConfigDefaults | null
  dfx?: DfxVersion
  /**
   * Mapping between network names and their configurations. Networks 'ic' and 'local' are implicitly defined.
   */
  networks?: {
    [k: string]: ConfigNetwork
  } | null
  profile?: Profile | null
  /**
   * Used to keep track of dfx.json versions.
   */
  version?: number | null
}
//   | {
//   tasks: Array<TaskConfiguration>
//   Defaults?: ConfigDefaults | null
//   dfx?: DfxVersion
//   /**
//    * Mapping between network names and their configurations. Networks 'ic' and 'local' are implicitly defined.
//    */
//   networks?: {
//     [k: string]: ConfigNetwork
//   } | null
//   profile?: Profile | null
//   /**
//    * Used to keep track of dfx.json versions.
//    */
//   version?: number | null
// }

export const defineConfig = (config: CrystalConfig) => {
  return config
}

// TODO: move to effect
const appDirectory = fs.realpathSync(process.cwd())

export const Opt = <T>(value?: any): [T] | [] => {
  return value || value === 0 ? [value] : []
}

export const getAccountIdEffect = (principal: string) =>
  Effect.gen(function* (_) {
    const command = Command.make(
      "dfx",
      "ledger",
      "account-id",
      "--of-principal",
      principal,
    )
    const result = yield* Command.string(command)
    return result.trim()
  })

export const getCurrentIdentityEffect = Effect.gen(function* () {
  const command = Command.make("dfx", "identity", "whoami")
  const result = yield* Command.string(command)
  return result.trim()
})

enum InstallMode {
  install,
  reinstall,
  upgrade,
}

// Define error types
// type DeploymentError = { kind: 'CanisterDeploymentError', message: string }
// type ActorError = { kind: 'ActorCreationError', message: string }
// type IdentityError = { kind: 'IdentityError', message: string }
// type ConfigError = { kind: 'ConfigError', message: string }
// // Define error types using Effect
// const DeploymentError = Effect.Tag("DeploymentError")
// const ActorError = Effect.Tag("ActorError")
// const IdentityError = Effect.Tag("IdentityError")
// const ConfigError = Effect.Tag("ConfigError")

// // Define a custom Effect type for deployment
// type DeployEffect = Effect.Effect<never, typeof DeploymentError | typeof ActorError | typeof IdentityError | typeof ConfigError, string>


export const deployCanisterEffect = (
  canisterName: string,
  canisterConfig: TaskCanisterConfiguration,
) =>
  Effect.gen(function* (_) {
    const { agent, identity } = yield* CrystalEnvironment
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    // Create management actor
    const mgmt = Actor.createActor<ManagementActor>(idlFactory, {
      canisterId: "aaaaa-aa",
      agent,
    })

    let canister_id = canisterConfig.dfx_js?.canister_id?.local

    // Check if canister exists and get its status
    const canisterInfo = yield* Effect.tryPromise({
      try: async () => {
        // TODO: this might not be defined. where do we get it from?
        if (!canister_id) {
          return { status: "not_installed" }
        }
        try {
          return await mgmt.canister_status({
            canister_id: Principal.fromText(canister_id),
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
    // Create new canister only if needed
    if (canisterInfo.status === "not_installed") {
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
            specified_id: Opt<Principal>(
              canister_id ? Principal.fromText(canister_id) : undefined,
            ),
            sender_canister_version: Opt<bigint>(0n),
          }),
        catch: (error) =>
          new DeploymentError({
            message: `Failed to create canister: ${error instanceof Error ? error.message : String(error)}`,
          }),
      })
      canister_id = createResult.canister_id.toText()
      console.log(`Created ${canisterName} with canister_id:`, canister_id)
    }

    // Import and verify canister DID
    const didPath = `${canisterConfig.candid}.js`
    const canisterDID = yield* Effect.tryPromise({
      try: () => import(didPath),
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

    // Prepare WASM module
    const wasmPath = canisterConfig.wasm as string
    const wasmContent = yield* fs.readFile(wasmPath)
    const wasm = Array.from(new Uint8Array(wasmContent))

    // Encode arguments if present
    const encodedArgs = canisterConfig.dfx_js?.args
      ? IDL.encode(canisterDID.init({ IDL }), canisterConfig.dfx_js.args)
      : new Uint8Array()

    // Install code
    yield* Effect.tryPromise({
      try: () =>
        mgmt.install_code({
          arg: encodedArgs,
          canister_id: Principal.fromText(canister_id),
          sender_canister_version: Opt<bigint>(),
          wasm_module: wasm,
          mode: { reinstall: null },
        }),
      catch: (error) =>
        new DeploymentError({
          message: `Failed to install code: ${error instanceof Error ? error.message : String(error)}`,
        }),
    })

    console.log(`Success with wasm bytes length: ${wasm.length}`)
    console.log(
      `Installed code for ${canisterName} with canister_id:`,
      canister_id,
    )

    // Update canister_ids.json
    const appDir = yield* Config.string("APP_DIR")
    const canisterIdsPath = path.join(appDir, "canister_ids.json")

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
      local: canister_id,
    }

    yield* fs.writeFile(
      canisterIdsPath,
      Buffer.from(JSON.stringify(canisterIds, null, 2)),
    )

    return canister_id
  })

export const execTasksEffect = (taskStream: Repeater<any>) =>
  Effect.flatMap(Effect.fromAsyncIterable(taskStream), (tasks) =>
    Effect.forEach(
      tasks,
      ({ taskName: fullName, taskConfig }) =>
        Effect.gen(function* () {
          const [taskType, taskName] = fullName.split(":") as [
            `${"canisters" | "scripts"}`,
            string,
          ]

          if (taskType === "canisters") {
            try {
              const canisterId = yield* Effect.promise(() =>
                deployCanister(taskName, taskConfig),
              )
              const appDirectory = yield* Config.string("APP_DIR")
              let canisterIds: {
                [canisterName: string]: {
                  [network: string]: string
                }
              } = {}

              try {
                const mod = yield* Effect.promise(
                  () =>
                    import(`${appDirectory}/canister_ids.json`, {
                      assert: { type: "json" },
                    }),
                )
                canisterIds = mod.default
              } catch (e) {}

              const currentNetwork = "local" // TODO: get from config
              canisterIds[taskName] = {
                ...canisterIds[taskName],
                [currentNetwork]: canisterId,
              }

              yield* Effect.promise(() =>
                fs.promises.writeFile(
                  `${appDirectory}/canister_ids.json`,
                  JSON.stringify(canisterIds),
                  "utf-8",
                ),
              )

              console.log("Wrote canister id to file")
            } catch (e) {
              console.log("Failed to deploy canister: ", e)
            }

            try {
              const actors = yield* Effect.promise(() =>
                createActors([taskName], {
                  canisterConfig: taskConfig,
                }),
              )
              console.log("Task finished:", fullName)
              emitter.emit(fullName, actors[taskName])
            } catch (e) {
              console.log("Failed to create actors: ", e)
            }
          }

          if (taskType === "scripts") {
            const taskResult =
              taskConfig instanceof Promise
                ? yield* Effect.promise(() => taskConfig)
                : taskConfig
            console.log("Task finished:", fullName)
            emitter.emit(fullName, taskResult)
          }
        }),
      { concurrency: 1 },
    ),
  )

export const createTaskStreamEffect = (
  crystalConfig: CrystalConfig,
  tasks: Array<TaskFullName>,
) =>
  Stream.fromIterable(tasks).pipe(
    Stream.mapEffect((fullName: TaskFullName) =>
      Effect.gen(function* () {
        // const { crystalConfig } = yield* CrystalEnvironment
        const [taskType, taskName] = fullName.split(":") as [
          `${"canisters" | "scripts"}`,
          string,
        ]
        const task = crystalConfig[taskType]?.[taskName]
        // let deps = getDeps(
        //   dfxConfig,
        //   (taskConfig?.dependencies ?? []) as Array<TaskFullName>,
        // )
        // TODO: we shouldnt waitFor
        // Process dependencies
        // const depsResults = yield* Effect.forEach(deps, (depFullName) =>
        //   Effect.gen(function* (_) {
        //     const [, depTaskName] = depFullName.split(":")
        //     const taskResult = yield* Effect.promise(() => waitFor(depFullName))
        //     return { [depTaskName]: taskResult }
        //   }),
        // )
        // TODO: handle deps
        // const taskResults = Object.assign({}, ...depsResults)
        // Process task configuration
        // TODO: check if promise
        const isJustFn = typeof task === "function"
        // TODO: asyncify
        const taskContext: TaskContext = {
          // how to exec this?
          // TODO: use reference instead of string
          task: runTasksEffect,
        }

        let finalTask = isJustFn ? task(taskContext) : task
        // // Handle promise if needed
        if (finalTask instanceof Promise) {
          finalTask = yield* Effect.tryPromise({
            try: (signal) => finalTask,
            // TODO: Effect.fail?
            catch: (e) =>
              new Error(
                `Failed to resolve promise: ${e instanceof Error ? e.message : String(e)}`,
              ),
          })
        }
        // TODO: exec
        console.log("finalTask", finalTask)
        if (taskType === "canisters") {
          const canisterId = yield* deployCanisterEffect(taskName, finalTask)
          return { taskName: fullName, taskType, taskResult: canisterId }
        } else if (taskType === "scripts") {
          // TODO: exec script
          const taskResult = yield* Effect.tryPromise({
            try: () => finalTask(),
            catch: (e) => new Error(String(e)),
          })
          return { taskName: fullName, taskType, taskResult }
        }
        return Effect.fail(new Error("Unknown task type"))
      }),
    ),
  )

export type TaskFullName = `${"canisters" | "scripts"}:${string}`

// TODO: simplify & rename?
export const transformWildcards = (
  crystalConfig: CrystalConfig,
  dep: TaskFullName,
): Array<TaskFullName> => {
  const [depType, depName] = dep.split(":") as [
    `${"canisters" | "scripts"}`,
    string,
  ]
  // TODO: check for every iteration?
  const isWildcard = depName === "*"
  const hasCanisterWildcard = depType === "canisters" && isWildcard
  const hasScriptWildcard = depType === "scripts" && isWildcard
  const allTasks = isWildcard
    ? [
        ...new Set([
          ...(hasCanisterWildcard
            ? Object.keys(crystalConfig.canisters).map<TaskFullName>(
                (canisterName) => `canisters:${canisterName}`,
              )
            : []),
          // TODO: .scripts might be undefined
          ...(hasScriptWildcard
            ? Object.keys(crystalConfig.scripts).map<TaskFullName>(
                (scriptName) => `scripts:${scriptName}`,
              )
            : []),
        ]),
      ]
    : [dep]
  return allTasks
}

// // TODO: write tests
// // Define error types
// type CircularDependencyError = {
//   kind: "CircularDependencyError"
//   path: string[]
// }

// type DependencyNotFoundError = {
//   kind: "DependencyNotFoundError"
//   dependency: string
// }

// export const getDeps = (
//   crystalConfig: DfxTs,
//   tasks: Array<TaskFullName>,
// ): Array<TaskFullName> => {
//   const visited = new Set<TaskFullName>()
//   const result: Array<TaskFullName> = []

//   const walkDeps = (
//     dep: TaskFullName,
//     path: Array<TaskFullName> = [],
//   ): void => {
//     if (visited.has(dep)) {
//       if (path.includes(dep)) {
//         throw { kind: "CircularDependencyError", path: [...path, dep] }
//       }
//       return
//     }

//     visited.add(dep)
//     const [taskType, taskName] = dep.split(":") as [
//       `${"canisters" | "scripts"}`,
//       string,
//     ]
//     const taskConfig = crystalConfig[taskType]?.[taskName]

//     if (!taskConfig) {
//       throw { kind: "DependencyNotFoundError", dependency: dep }
//     }

//     const dependencies =
//       "dependencies" in taskConfig ? taskConfig.dependencies : []
//     for (const childDep of dependencies ?? []) {
//       walkDeps(childDep as TaskFullName, [...path, dep])
//     }

//     result.push(dep)
//   }

//   tasks
//     .flatMap((task) => transformWildcards(crystalConfig, task))
//     .forEach((expandedTask) => walkDeps(expandedTask))

//   return result
// }

export const runTasksEffect = async (
  tasks: Array<TaskFullName> | TaskFullName,
) => {
  const tasksArray = Array.isArray(tasks) ? tasks : [tasks]
  const program = Effect.gen(function* () {
    const crystalConfig = yield* getCrystalConfigEffect
    const allTasks = [
      ...new Set([...tasksArray.flatMap((t) => transformWildcards(crystalConfig, t))]),
    ]
    const stream = createTaskStreamEffect(crystalConfig, allTasks)
    const tasksChunk = yield* Stream.runCollect(stream)
    return Chunk.toReadonlyArray(tasksChunk)
  })
  return await runtime.runPromise(program)
}

export const getCrystalConfig = async (
  configPath: string = "crystal.config.ts",
) => {
  const appDirectory = fs.realpathSync(process.cwd())
  try {
    const { default: crystalConfig } = await import(
      path.resolve(appDirectory, configPath)
    )
    return crystalConfig
  } catch (e: Error) {
    console.error("Failed to get config:", e)
    throw {
      kind: "ConfigError",
      message: `Failed to get Crystal config: ${e.message}`,
    }
  }
}

// TODO: improve
export const getCrystalConfigEffect = Effect.promise(() => getCrystalConfig())

export class CrystalEnvironment extends Context.Tag("CrystalEnvironment")<
  CrystalEnvironment,
  {
    readonly network: string
    readonly agent: HttpAgent
    readonly identity: Ed25519KeyIdentity
    readonly crystalConfig: CrystalConfig
  }
>() {}

export const CrystalEnvironmentLive = Layer.effect(
  CrystalEnvironment,
  Effect.gen(function* () {
    const dfxPort = yield* Config.string("DFX_PORT")
    const host = yield* Config.string("DFX_HOST")
    const { identity } = yield* getIdentityEffect()
    const agent = new HttpAgent({
      host: `${host}:${dfxPort}`,
      identity,
    })
    yield* Effect.tryPromise({
      try: () => agent.fetchRootKey(),
      catch: (err) =>
        new ConfigError({
          message: `Unable to fetch root key: ${err instanceof Error ? err.message : String(err)}`,
        }),
    })
    const crystalConfig = yield* getCrystalConfigEffect
    return {
      network: "local",
      agent,
      identity,
      crystalConfig,
    }
  }),
)

export const createActorsEffect = <T>({
  canisterList,
  canisterConfig,
  currentNetwork = "local",
}: {
  canisterList: Array<string>
  canisterConfig: CanisterConfiguration
  currentNetwork?: string
}) =>
  Effect.gen(function* () {
    const { agent } = yield* CrystalEnvironment
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const appDir = yield* Config.string("APP_DIR")

    let actors: {
      [canisterName: string]: {
        actor: ActorSubclass<any>
        canisterId: string
        getControllers: () => Promise<void>
        addControllers: (controllers: Array<string>) => Promise<void>
        setControllers: (controllers: Array<string>) => Promise<void>
      }
    } = {}

    const canisterIds = yield* getCanisterIdsEffect

    for (const canisterName of canisterList) {
      const canisterId = canisterIds[canisterName][currentNetwork]
      const didPath = path.join(canisterConfig.candid + ".js")

      // Import canister DID
      const canisterDID = yield* Effect.tryPromise({
        try: () => import(didPath),
        catch: (err) =>
          new ConfigError({
            message: `Failed to import canister DID: ${err instanceof Error ? err.message : String(err)}`,
          }),
      })

      const exists = yield* fs.exists(didPath)
      if (!exists) {
        // TODO: Implement deployCanisterEffect first
        yield* deployCanisterEffect(canisterName, canisterConfig)
      }

      const commandExecutor = yield* CommandExecutor.CommandExecutor

      const getControllers = () => Effect.unit

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
          yield* CommandExecutor.start(command)
        })

      const setControllers = (controllers: Array<string>) =>
        Effect.gen(function* () {
          const cyclesWalletCommand = Command.make(
            "dfx",
            "identity",
            "get-wallet",
          )
          const cyclesWallet = yield* Command.string(cyclesWalletCommand)

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
          yield* CommandExecutor.start(command)
        })

      actors[canisterName] = {
        actor: Actor.createActor(canisterDID.idlFactory, {
          agent,
          canisterId,
        }),
        canisterId,
        getControllers,
        addControllers,
        setControllers,
      }
    }

    return actors
  })

export const getIdentityEffect = (selection?: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const identityName = selection ?? (yield* getCurrentIdentityEffect)
    const identityPath = path.join(
      os.homedir(),
      ".config/dfx/identity",
      identityName,
      "identity.pem",
    )

    const exists = yield* fs.exists(identityPath)
    if (!exists) {
      return yield* Effect.fail(
        new ConfigError({ message: "Identity does not exist" }),
      )
    }

    const pem = yield* fs.readFileString(identityPath, "utf8")
    const cleanedPem = pem
      .replace("-----BEGIN PRIVATE KEY-----", "")
      .replace("-----END PRIVATE KEY-----", "")
      .replace("\n", "")
      .trim()

    const raw = Buffer.from(cleanedPem, "base64")
      .toString("hex")
      .replace("3053020101300506032b657004220420", "")
      .replace("a123032100", "")
    const key = new Uint8Array(Buffer.from(raw, "hex"))
    // TODO: this is not working
    const identity = Ed25519KeyIdentity.fromSecretKey(key)
    const principal = identity.getPrincipal().toText()
    const accountId = yield* getAccountIdEffect(principal)

    return {
      identity,
      pem: cleanedPem,
      name: identityName,
      principal,
      accountId,
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

export const getCanisterIdsEffect = Effect.gen(function* () {
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

const MainLayer = Layer.mergeAll(
  NodeContext.layer,
  // NodeRuntime.layer,
  // FileSystem.layer,
  Path.layer,
  configLayer,
)

const runtime = ManagedRuntime.make(MainLayer)

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

export const killDfx = async () => {
  try {
    const dfxPids = await find("name", "dfx", true)
    const replicaPids = await find("name", "replica", true)
    const icxProxyPids = await find("name", "icx-proxy", true)
    process.kill(dfxPids[0]?.pid)
    process.kill(replicaPids[0]?.pid)
    process.kill(icxProxyPids[0]?.pid)
  } catch (e: Error) {
    console.error("Failed to kill DFX processes:", e)
    throw {
      kind: "ConfigError",
      message: `Failed to kill DFX processes: ${e.message}`,
    }
  }
}

export const startDfx = async () => {
  try {
    await spawn({
      command: "dfx",
      args: ["start", "--background", "--clean"],
      stdout: (data) => {
        // console.log(data)
      },
    })
  } catch (e: Error) {
    console.error("Failed to start DFX:", e)
    throw { kind: "ConfigError", message: `Failed to start DFX: ${e.message}` }
  }
}
