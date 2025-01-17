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
  Agent,
  HttpAgent,
  type Identity,
} from "@dfinity/agent"
import { idlFactory } from "./canisters/management_new/management.did.js"
import { Ed25519KeyIdentity } from "@dfinity/identity"
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
  type Runtime,
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
// TODO: create abstraction after pic-js is done
// import { ICService } from "./services/ic.js"
import { DfxService } from "./services/dfx.js"
import type { Task, Scope } from "./types.js"
import { Moc } from "./services/moc.js"

export * from "./builder.js"
import * as didc from "didc_js"

export const configLayer = Layer.setConfigProvider(
  ConfigProvider.fromMap(
    new Map([
      ["APP_DIR", fs.realpathSync(process.cwd())],
      ["DFX_CONFIG_FILENAME", "crystal.config.ts"],
      ["CANISTER_IDS_FILENAME", "canister_ids.json"],
      // TODO: IC_PORT / IC_HOST
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
  runTask: <T>(taskName: string) => Promise<T>
  // TODO: identities & other context. agent, etc.
  // users: {
  //   [name: string]: {
  //     identity: Identity
  //     agent: HttpAgent
  //     principal: Principal
  //     accountId: string
  //   }
  // }

  // config: DfxConfig

  // [K in keyof DfxTs["canisters"]]: {
  //   // actor: ActorSubclass<C[K]["idlFactory"]>
  //   // canisterId: C[K]["canisterId"]
  //   canisterId: string
  //   actor: ActorSubclass<any>
  //   // setControllers: (controllers: Array<string>) => Promise<void>,
  //   // addControllers: (controllers: Array<string>) => Promise<void>
  // }
}

// TODO: Service? can we override compile / build / install?
// Or many that comes from canister which sets it in the runtime?
// Has to be composable
export type CrystalRuntime = {
  agent: HttpAgent
  identity: Identity
  users: {
    [key: string]: {
      identity: Identity
      principal: Principal
      accountId: string
    }
  }
  // fs: FileSystem
  // path: Path
  dfxConfig: DfxJson
  runTask: <T>(taskName: string) => Promise<T>
  /**
   * Mapping between network names and their configurations. Networks 'ic' and 'local' are implicitly defined.
   */
  networks?: {
    [k: string]: ConfigNetwork
  } | null
  profile?: Profile | null
}

// TODO: hmmmmm?
// export type ExtendedCanisterConfiguration = (
//   | CanisterConfiguration
//   | RustSpecificProperties
//   | MotokoSpecificProperties
//   | AssetSpecificProperties
// ) & {
//   _metadata?: { standard?: string }
//   dfx_js?: {
//     args?: any[]
//     canister_id?: {
//       [network: string]: string
//     }
//   }
// }

export const Opt = <T>(value?: any): [T] | [] => {
  return value || value === 0 ? [value] : []
}

export const getAccountId = (principal: string) =>
  // TODO: get straight from ledger canister?
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

export const getCurrentIdentity = Effect.gen(function* () {
  // TODO: pass in dfx
  const IC = yield* DfxService
  const identity = yield* IC.getIdentity()
  return identity
})

enum InstallMode {
  install,
  reinstall,
  upgrade,
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

export const createCanister = (canisterId: string) =>
  Effect.gen(function* () {
    const { mgmt, identity } = yield* DfxService
    // TODO: canister needs to be created if it doesn't exist
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
            canisterId ? Principal.fromText(canisterId) : undefined,
          ),
          sender_canister_version: Opt<bigint>(0n),
        }),
      catch: (error) =>
        new DeploymentError({
          message: `Failed to create canister: ${error instanceof Error ? error.message : String(error)}`,
        }),
    })
    return createResult.canister_id.toText()
  })

export const installCanister = ({
  args,
  canisterId,
  didPath,
  wasmPath,
}: {
  args: any[]
  canisterId: string
  didPath: string
  wasmPath: string
}) =>
  Effect.gen(function* () {
    const { mgmt } = yield* DfxService
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const appDir = yield* Config.string("APP_DIR")
    // TODO: we need to generate did.js before?

    // const didPath = `${canisterConfig.candid}.js`
    const didString = yield* fs.readFileString(didPath)
    const didJSString = didc.did_to_js(didString)
    // TODO: save it to file?
    const didJSPath = path.join(appDir, ".artifacts", canisterId, `${canisterId}.did.js`)
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

    // Prepare WASM module
    const wasmContent = yield* fs.readFile(wasmPath)
    const wasm = Array.from(new Uint8Array(wasmContent))

    // Encode arguments if present
    const encodedArgs = args
      ? new Uint8Array(IDL.encode(canisterDID.init({ IDL }), args))
      : new Uint8Array()

    // Install code
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

    Effect.log(`Success with wasm bytes length: ${wasm.length}`)
    Effect.log(`Installed code for ${canisterId}`)
  })

export const compileMotokoCanister = (src: string, canisterName: string) =>
  Effect.gen(function* () {
    const moc = yield* Moc
    const path = yield* Path.Path
    const fs = yield* FileSystem.FileSystem
    const appDir = yield* Config.string("APP_DIR")
    // TODO: where?
    const outDir = path.join(appDir, ".artifacts", canisterName)
    const wasmOutputFilePath = path.join(outDir, `${canisterName}.wasm`)
    const candidOutputFilePath = path.join(outDir, `${canisterName}.did`)
    // Create output directories if they don't exist
    yield* fs.makeDirectory(outDir, { recursive: true })
    yield* Effect.log(`Compiling ${canisterName} to ${outDir}`)
    // TODO: we need to make dirs if they don't exist
    yield* moc.compile(src, wasmOutputFilePath)
    yield* Effect.log(`Successfully compiled ${src} ${canisterName} to ${outDir} outputFilePath: ${wasmOutputFilePath}`)
    return {
      wasmPath: wasmOutputFilePath,
      candidPath: candidOutputFilePath,
    }
  })

export const generateCandidJS = (canisterName: string) =>
  Effect.gen(function* () {
    const path = yield* Path.Path
    const appDir = yield* Config.string("APP_DIR")
    const candidDir = path.join(appDir, ".artifacts")
    // TODO: generate candid as well
    // didc.did_to_js()
    // const candidOutputFilePath = path.join(candidDir, `${canisterName}.did`)
    // yield* generateDeclarations(candidOutputFilePath)
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

// TODO: Do we need this? or just call the tasks in sequence?
export const deployCanister = (
  canisterName: string,
  specifiedCanisterId: string,
  didPath: string,
  wasmPath: string,
  args: any[],
) =>
  Effect.gen(function* () {
    const { agent, identity } = yield* DfxService
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    // Check if canister exists and get its status
    let canisterId = specifiedCanisterId
    const canisterInfo = specifiedCanisterId
      ? yield* getCanisterInfo(specifiedCanisterId)
      : { status: "not_installed" }

    // Create new canister only if needed
    if (canisterInfo.status === "not_installed") {
      canisterId = yield* createCanister(specifiedCanisterId)
      Effect.log(`Created ${canisterName} with canister_id:`, canisterId)
    }

    yield* installCanister({ args, canisterId, didPath, wasmPath })
    // Import and verify canister DID
    yield* writeCanisterIds(canisterName, canisterId)

    // Update canister_ids.json
    return canisterId
  })

type BuilderResult = {
  _scope: Scope
}

const matcher = Match.type<Task<any, any, any> | Scope | BuilderResult>().pipe(
  Match.when(
    {
      task: Match.any,
      description: Match.any,
      tags: Match.any,
    },
    (task) => task,
  ),
  Match.when(
    {
      tasks: Match.any,
      tags: Match.any,
      description: Match.any,
    },
    (scope) => scope,
  ),
  Match.when(
    {
      _scope: Match.any,
    },
    (builderResult) => builderResult._scope,
  ),
  Match.exhaustive,
)

export const getTask = <A, E, R>(
  obj: Scope | Task<A, E, R>,
  keys: Array<string>,
): Task<A, E, R> | undefined => {
  // TODO: throw instead?
  // TODO: pass in key as well?
  const val = matcher(obj)
  if (!val) {
    return undefined
  }
  return Match.value(val).pipe(
    Match.when({ tasks: Match.any }, (scope) =>
      getTask<A, E, R>(scope.tasks[keys[0]], keys.slice(1)),
    ),
    Match.when({ task: Match.any }, (task) => task as Task<A, E, R>),
    Match.exhaustive,
  )
}

// TODO: more accurate type
type TaskFullName = string
// TODO: figure out if multiple tasks are needed
export const getTaskEffect = (taskPathString: TaskFullName) =>
  Effect.gen(function* () {
    const taskPath: string[] = taskPathString.split(":")
    const firstKey = taskPath[0]
    const rest = taskPath.slice(1)
    const crystalConfig = yield* getCrystalConfig()
    // TODO: only works for scope, not task currently?
    const task = getTask(crystalConfig[firstKey], rest)
    if (!task) {
      return yield* Effect.fail(new Error(`Task ${taskPathString} not found`))
    }
    // TODO: just store it in the task?
    const scope = crystalConfig.crystal
    return { task, scope }
  })

// TODO: construct later
const MainLayer = Layer.mergeAll(
  NodeContext.layer,
  DfxService.Live.pipe(
    Layer.provide(NodeContext.layer),
    Layer.provide(configLayer),
    // Layer.provide(Path.layer),
  ),
  Moc.Live.pipe(
    Layer.provide(NodeContext.layer)
  ),
  configLayer,
)
const runtime = ManagedRuntime.make(MainLayer)

export const runTask = async () => {
  // TODO: should it have the runtime?
  const result = await runtime.runPromise(
    Effect.gen(function* () {
      const taskPath = process.argv.slice(2).join(":")
      const { task, scope } = yield* getTaskEffect(taskPath)
      // TODO: pass in Layers?
      // const result = yield* task.task
      yield* task.task
    }),
  )
  console.log(result)
}

type CrystalConfigFile = {
  [key: string]: Scope | Task<any, any, any>
  crystal: Scope
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

export class CrystalEnvironment extends Context.Tag("CrystalEnvironment")<
  CrystalEnvironment,
  {
    readonly network: string
    readonly subnet: string
    readonly agent: HttpAgent
    readonly identity: Ed25519KeyIdentity
  }
>() {
  static Live = Layer.effect(
    CrystalEnvironment,
    Effect.gen(function* () {
      const dfxPort = yield* Config.string("DFX_PORT")
      const host = yield* Config.string("DFX_HOST")
      const { identity } = yield* getIdentity()
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
      // TODO: decode crystalconfig into TaskGroup
      return {
        network: "local",
        subnet: "system",
        agent,
        identity,
      }
    }),
  )
}

export const createActor = <T>({
  canisterName,
  canisterConfig,
}: {
  canisterName: string
  canisterConfig: CanisterConfiguration
}) =>
  Effect.gen(function* () {
    const { agent, network } = yield* DfxService
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const appDir = yield* Config.string("APP_DIR")
    const canisterIds = yield* getCanisterIds
    const canisterId = canisterIds[canisterName][network]
    const didPath = path.join(`${canisterConfig.candid}.js`)

    // Import canister DID
    const canisterDID = yield* Effect.tryPromise({
      try: () => import(didPath),
      catch: (err) =>
        new ConfigError({
          message: `Failed to import canister DID: ${err instanceof Error ? err.message : String(err)}`,
        }),
    })

    // const exists = yield* fs.exists(didPath)
    // if (!exists) {
    //   yield* deployCanister({ canisterName, canisterId, didPath, wasmPath })
    // }

    const commandExecutor = yield* CommandExecutor.CommandExecutor
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

export const createActors = <T>({
  canisterList,
  canisterConfig,
}: {
  canisterList: Array<string>
  canisterConfig: CanisterConfiguration
}) =>
  Effect.gen(function* () {
    const actors: Record<
      string,
      Effect.Effect.Success<ReturnType<typeof createActor>>
    > = {}
    for (const canisterName of canisterList) {
      actors[canisterName] = yield* createActor({
        canisterName,
        canisterConfig,
      })
    }
    return actors
  })

// TODO: this is dfx specific
export const getIdentity = (selection?: string) =>
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
    const accountId = yield* getAccountId(principal)

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
