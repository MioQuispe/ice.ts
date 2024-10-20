import { spawn as childSpawn } from "child_process"
import { IDL } from "@dfinity/candid"
import { Principal } from "@dfinity/principal"
import type { DfxJson } from "./schema.js"
import {
  AssetSpecificProperties,
  CanisterConfiguration,
  ConfigDefaults,
  ConfigNetwork,
  DfxVersion,
  MotokoSpecificProperties,
  Profile,
  RustSpecificProperties,
} from "./schema.js"
import fs from "fs"
import { Actor, ActorSubclass, HttpAgent, Identity } from "@dfinity/agent"
import { idlFactory } from "./canisters/management_new/management.did.js"
import open from "open"
import express from "express"
import path from "path"
import Emitter from "event-e3"
import { Ed25519KeyIdentity } from "@dfinity/identity"
import url from "url"
import { Repeater } from "@repeaterjs/repeater"
import * as os from "os"
import find from "find-process"
import { principalToAccountId } from "./utils"
import { Effect } from "effect"
import { Schema } from "@effect/schema"
// import { did_to_js } from "didc_js"

// Define schemas for our types
const CanisterIdSchema = Schema.String

const CanisterIdsSchema = Schema.Record({key:Schema.String,value: Schema.Record({key: Schema.Literal("local", "ic"),value: CanisterIdSchema})})

const TaskCanisterConfigurationSchema = Schema.Struct({
  candid: Schema.String,
  wasm: Schema.String,
  dfx_js: Schema.optional(Schema.Struct({
    args: Schema.optional(Schema.Array(Schema.Unknown)),
    canister_id: Schema.optional(Schema.Record({key:Schema.String,value: Schema.String}))
  }))
})

const TaskScriptConfigurationSchema = Schema.Struct({
  dependencies: Schema.optional(Schema.Array(Schema.String)),
  fn: Schema.Unknown,
})

const DfxTsSchema = Schema.Struct({
  canisters: Schema.Record({key:Schema.String, value: TaskCanisterConfigurationSchema}),
  scripts: Schema.optional(Schema.Record({key:Schema.String,value: TaskScriptConfigurationSchema})),
  Defaults: Schema.optional(Schema.Any),
  dfx: Schema.optional(Schema.Any),
  networks: Schema.optional(Schema.Record({key:Schema.String, value: Schema.Any})),
  profile: Schema.optional(Schema.Any),
  version: Schema.optional(Schema.Number)
})

// Type definitions from schemas
export type CanisterId = Schema.Schema.Type<typeof CanisterIdSchema>
export type CanisterIds = Schema.Schema.Type<typeof CanisterIdsSchema>
export type TaskCanisterConfigurationSchema = Schema.Schema.Type<typeof TaskCanisterConfigurationSchema>
export type TaskScriptConfigurationSchema = Schema.Schema.Type<typeof TaskScriptConfigurationSchema>
export type DfxTs = Schema.Schema.Type<typeof DfxTsSchema>

// Error types
export const DeploymentError = Schema.Struct({
  _tag: Schema.Literal("DeploymentError"),
  message: Schema.String
})

export const ConfigError = Schema.Struct({
  _tag: Schema.Literal("ConfigError"),
  message: Schema.String
})

export type DeploymentError = Schema.Schema.Type<typeof DeploymentError>
export type ConfigError = Schema.Schema.Type<typeof ConfigError>

const getDfxPort = async (): Promise<number> => {
  return new Promise((resolve, reject) => {
    childSpawn('dfx', ['info', 'webserver-port'], { stdio: ['ignore', 'pipe', 'ignore'] })
      .stdout!.on('data', (data) => {
        const port = parseInt(data.toString().trim(), 10);
        if (isNaN(port)) {
          reject(new Error('Failed to parse DFX webserver port'));
        } else {
          resolve(port);
        }
      })
      .on('error', (err) => {
        reject(new Error(`Failed to get DFX webserver port: ${err.message}`));
      });
  });
}


type ManagementActor = import("@dfinity/agent").ActorSubclass<import("./canisters/management_new/management.types.js")._SERVICE>

type Deps<C, S, D> = {
  [K in keyof C]: {
    // actor: ActorSubclass<C[K]["idlFactory"]>
    // canisterId: C[K]["canisterId"]
    canisterId: string
    actor: ActorSubclass<any>
    // setControllers: (controllers: Array<string>) => Promise<void>,
    // addControllers: (controllers: Array<string>) => Promise<void>
  }
}

// export type ExtendedCanisterConfiguration =
//   (CanisterConfiguration | RustSpecificProperties | MotokoSpecificProperties | AssetSpecificProperties)
//   & {
//     _metadata?: { standard?: string; }; dfx_js?: {
//       args?: any[];
//       canister_id?: {
//         [network: string]: string
//       }
//     }
//   }

// // Define a more specific type for canister configurations
// export type TaskCanisterConfiguration<T = ExtendedCanisterConfiguration> = ExtendedCanisterConfiguration & T

// export type TaskCanisterConfiguration = ExtendedCanisterConfiguration

// export type TaskScriptConfiguration<
//   C,
//   S,
//   D = Array<`canisters:${keyof C}` | `scripts:${keyof S}` | "canisters:*" | "scripts:*">,
// > = {
//   dependencies?: D
//   fn: (deps: Deps<C, S, D>) => any | Promise<void>
// }

// export type TaskConfiguration<
//   T,
//   D = Array<keyof T>,
// > = {
//   name: string,
//   dependencies: Array<string>,
//   // TODO:
//   fn: (env, deps: any) => any | Promise<void>
// }

// export type DfxTs<
//   C extends Record<string, TaskCanisterConfiguration>,
//   S extends Record<string, TaskScriptConfiguration<C, S>>,
// > = {
//   canisters: C
//   scripts?: S
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
// //   | {
// //   tasks: Array<TaskConfiguration>
// //   Defaults?: ConfigDefaults | null
// //   dfx?: DfxVersion
// //   /**
// //    * Mapping between network names and their configurations. Networks 'ic' and 'local' are implicitly defined.
// //    */
// //   networks?: {
// //     [k: string]: ConfigNetwork
// //   } | null
// //   profile?: Profile | null
// //   /**
// //    * Used to keep track of dfx.json versions.
// //    */
// //   version?: number | null
// // }

export const defineConfig = <
  C extends Record<string, TaskCanisterConfigurationSchema>,
  S extends Record<string, TaskScriptConfigurationSchema>,
>(config: DfxTs) => {
  return config
}

const appDirectory = fs.realpathSync(process.cwd())

export const Opt = <T>(value?: any): [T] | [] => {
  return (value || value === 0) ? ([value]) : []
}

const spawn = ({
  command,
  args,
  stdout,
}: {
  command: string,
  args: Array<string>,
  stdout?: (data: string) => void,
}) => {
  return new Promise((resolve, reject) => {
    const child = childSpawn(command, args)
    // @ts-ignore
    child.stdin.setEncoding("utf-8")
    child.stdin.write("yes\n")
    child.stdout.on("data", (data) => {
      if (stdout) {
        stdout(`${data}`)
        return
      }
    })
    child.stderr.on("data", (data) => console.error(`${data}`))
    child.on("close", (code) => resolve(code))
    child.on("error", (err) => reject(err))
  })
}

export const getAccountId = async (principal: string): Promise<string> => {
  return await new Promise((resolve, reject) => {
    spawn({
      command: "dfx",
      args: ["ledger", "account-id", "--of-principal", principal],
      stdout: (data) => {
        resolve(data.slice(0, -1))
      },
    })
  })
}

export const getCurrentIdentity = async (): Promise<string> => {
  return await new Promise((resolve, reject) => {
    spawn({
      command: "dfx",
      args: ["identity", "whoami"],
      stdout: (data) => {
        resolve(data.slice(0, -1))
      },
    })
  })
}

const emitter = new Emitter()

const waitFor = async (taskName: string) => {
  return await new Promise((resolve, reject) => {
    emitter.once(taskName, resolve)
  })
}

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

export const deployCanister = async (canisterName: string, canisterConfig: TaskCanisterConfigurationSchema): Promise<string> => {
  try {
    const { agent, identity } = await getEnv()
    const mgmt = Actor.createActor<ManagementActor>(idlFactory, {
      canisterId: "aaaaa-aa",
      agent,
    })

    let canister_id = canisterConfig.dfx_js?.canister_id?.local

    // Check if the canister already exists
    if (canister_id) {
      try {
        const status = await mgmt.canister_status({ canister_id: Principal.fromText(canister_id) })
        console.log(`Canister ${canisterName} (${canister_id}) exists. Status:`, status)

        // Check if the canister is running and has the correct module hash
        if (status.module_hash.length > 0) {
          // TODO: Compare module_hash with the hash of the current WASM module
          // If they match, we can skip deployment
          // If they don't match, we might want to upgrade the canister
          console.log(`Canister ${canisterName} is already installed. Skipping deployment.`)
          return canister_id
        } else {
          console.log(`Canister ${canisterName} exists but has no module installed. Proceeding with installation.`)
        }
      } catch (error) {
        console.log(`Error checking status of canister ${canisterName}:`, error)
        console.log(`Proceeding with deployment for ${canisterName}.`)
      }
    }

    // If we reach here, we need to create a new canister
    const result = await mgmt.provisional_create_canister_with_cycles({
      settings: [{
        compute_allocation: Opt<bigint>(),
        memory_allocation: Opt<bigint>(),
        freezing_threshold: Opt<bigint>(),
        controllers: Opt<Principal[]>([identity.getPrincipal()]),
      }],
      amount: Opt<bigint>(1_000_000_000_000n),
      specified_id: Opt<Principal>(canister_id ? Principal.fromText(canister_id) : undefined),
      sender_canister_version: Opt<bigint>(0n),
    })
    canister_id = result.canister_id.toText()
    console.log(`Created ${canisterName} with canister_id:`, canister_id)

    const didPath = canisterConfig.candid + ".js"
    const canisterDID = await import(didPath)
    if (!canisterDID) {
      console.log("Failed to convert DID to JS")
      throw { kind: "CanisterDIDFailed" }
    }
    const wasmPath = canisterConfig.wasm as string

    let encodedArgs = canisterConfig.dfx_js?.args ? IDL.encode(canisterDID.init({ IDL }), canisterConfig.dfx_js.args) : new Uint8Array()

    const wasm = Array.from(new Uint8Array(fs.readFileSync(wasmPath)))
    await mgmt.install_code({
      arg: encodedArgs,
      canister_id: Principal.from(canister_id),
      sender_canister_version: Opt<bigint>(),
      wasm_module: wasm,
      mode: { reinstall: null },
    })
    console.log(`Success with wasm bytes length: ${wasm.length}`)
    console.log(`Installed code for ${canisterName} with canister_id:`, canister_id)
    return canister_id

  } catch (e: Error) {
    console.error("Failed to deploy canister:", e)
    throw { kind: 'CanisterDeploymentError', message: `Failed to deploy canister ${canisterName}: ${e.message}` }
  }
}

export const execTasks = async (taskStream: Repeater<any>, currentNetwork: string = "local") => {
  for await (const { taskName: fullName, taskConfig } of taskStream) {
    const [taskType, taskName] = fullName.split(":")
    console.log(`Running ${taskType} ${taskName}`)
    if (taskType === "canisters") {
      try {
        const canisterName = taskName
        const canisterId = await deployCanister(canisterName, taskConfig)
        if (!canisterId) {
          throw { kind: "CanisterDeploymentFailed" }
        }
        let canisterIds: {
          [canisterName: string]: {
            [network: string]: string
          }
        } = {}
        try {
          const mod = await import(`${appDirectory}/canister_ids.json`, { assert: { type: "json" } })
          canisterIds = mod.default
        } catch (e) {

        }
        canisterIds[canisterName] = {
          ...canisterIds[canisterName],
          [currentNetwork]: canisterId,
        }
        fs.writeFile(`${appDirectory}/canister_ids.json`, JSON.stringify(canisterIds), "utf-8", (err) => {
          if (!err) {
            console.log("Wrote canister id to file")
          } else {
            console.log("Failed to write canister id to file:", err)
          }
        })


      } catch (e) {
        // TODO: dont create actors
        console.log("Failed to deploy canister: ", e)
      }
      try {
        const actors = await createActors([taskName], { canisterConfig: taskConfig })
        console.log("Task finished:", fullName)
        emitter.emit(fullName, actors[taskName])
      } catch (e) {
        // TODO: handle
        console.log("Failed to create actors: ", e)
      }
    }
    if (taskType === "scripts") {
      const taskResult = taskConfig instanceof Promise ? await taskConfig : taskConfig
      console.log("Task finished:", fullName)
      emitter.emit(fullName, taskResult)
    }
  }
}

export const createTaskStream = (dfxConfig: DfxTs, tasks: Array<TaskFullName>) => new Repeater<any>(async (push, stop) => {
  const jobs = tasks.map(async (fullName) => {
    const [taskType, taskName] = fullName.split(":") as [`${"canisters" | "scripts"}`, string]
    let taskConfig = dfxConfig[taskType][taskName]
    let deps = getDeps(dfxConfig, taskConfig?.dependencies ?? [])
    const depsPromises = deps.map(async (fullName) => {
      const [taskType, taskName] = fullName.split(":")
      const taskResult = await waitFor(fullName)
      return {
        [taskName]: taskResult,
      }
    })
    const taskResults = Object.assign({}, ...await Promise.all(depsPromises))
    let finalConfig
    const isJustFn = typeof taskConfig === "function"
    if (taskType === "canisters") {
      if (isJustFn) {
        finalConfig = taskConfig(...taskResults)
      } else {
        finalConfig = taskConfig
      }
    }
    if (taskType === "scripts") {
      if (isJustFn) {
        finalConfig = taskConfig({ ...taskResults })
      } else {
        finalConfig = typeof taskConfig.fn === "function" ? taskConfig.fn({ ...taskResults }) : taskConfig.fn
      }
    }
    const isPromise = dfxConfig instanceof Promise
    if (isPromise) {
      finalConfig = await finalConfig
    }
    push({ taskName: fullName, taskConfig: finalConfig })
  })
  await Promise.all(jobs)
  stop()
})

export type TaskFullName = `${"canisters" | "scripts"}:${string}`

// TODO: simplify & rename?
export const transformWildcards = (dfxConfig: DfxTs, dep: TaskFullName): Array<TaskFullName> => {
  const [depType, depName] = dep.split(":") as [`${"canisters" | "scripts"}`, string]
  // TODO: check for every iteration?
  const isWildcard = depName === "*"
  const hasCanisterWildcard = depType === "canisters" && isWildcard
  const hasScriptWildcard = depType === "scripts" && isWildcard
  const allTasks = isWildcard ? [...new Set([
    ...(hasCanisterWildcard ? Object.keys(dfxConfig.canisters).map<TaskFullName>((canisterName) => `canisters:${canisterName}`) : []),
    // TODO: .scripts might be undefined
    ...(hasScriptWildcard ? Object.keys(dfxConfig.scripts).map<TaskFullName>((scriptName) => `scripts:${scriptName}`) : []),
  ])] : [dep]
  return allTasks
}
// TODO: write tests
// Define error types
type CircularDependencyError = {
  kind: 'CircularDependencyError';
  path: string[];
};

type DependencyNotFoundError = {
  kind: 'DependencyNotFoundError';
  dependency: string;
};

export const getDeps = (dfxConfig: DfxTs, tasks: Array<TaskFullName>): Array<TaskFullName> => {
  const visited = new Set<TaskFullName>();
  const result: Array<TaskFullName> = [];

  const walkDeps = (dep: TaskFullName, path: Array<TaskFullName> = []): void => {
    if (visited.has(dep)) {
      if (path.includes(dep)) {
        throw { kind: 'CircularDependencyError', path: [...path, dep] };
      }
      return;
    }

    visited.add(dep);
    const [taskType, taskName] = dep.split(":") as [`${"canisters" | "scripts"}`, string];
    const taskConfig = dfxConfig[taskType]?.[taskName];

    if (!taskConfig) {
      throw { kind: 'DependencyNotFoundError', dependency: dep };
    }

    const dependencies = 'dependencies' in taskConfig ? taskConfig.dependencies : [];
    for (const childDep of dependencies ?? []) {
      walkDeps(childDep as TaskFullName, [...path, dep]);
    }

    result.push(dep);
  };

  tasks.flatMap(task => transformWildcards(dfxConfig, task))
    .forEach(expandedTask => walkDeps(expandedTask));

  return result;
}

export const runTasks = async (config: DfxTs, tasks: Array<TaskFullName>) => {
  const allDeps = getDeps(config, tasks)
  const allTasks = [...new Set([...allDeps, ...tasks.flatMap(t => transformWildcards(config, t))])]
  const taskStream = createTaskStream(config, allTasks)
  await execTasks(taskStream)
  // TODO: return OK?
  return getCanisterIds()
}

export const getDfxConfig = async (configPath: string = "crystal.config.ts") => {
  const appDirectory = fs.realpathSync(process.cwd())
  try {
    const { default: dfxConfig } = await import(path.resolve(appDirectory, configPath))
    return dfxConfig
  } catch (e: Error) {
    console.error("Failed to get DFX config:", e)
    throw { kind: 'ConfigError', message: `Failed to get DFX config: ${e.message}` }
  }
}

const getEnv = async () => {
  const identity = (await getIdentity()).identity
  const agent = new HttpAgent({
    // TODO: get dfx port
    host: "http://0.0.0.0:8080",
    identity,
  })
  await agent.fetchRootKey().catch(err => {
    console.warn("Unable to fetch root key. Check to ensure that your local replica is running")
    console.error(err)
    throw { kind: 'RootKeyFetchError', message: `Unable to fetch root key: ${err.message}` }
  })
  return {
    network: "local",
    agent,
    identity,
  }
}

// TODO: take dfx config as param?
export const createActors = async (
  canisterList: Array<string>,
  { canisterConfig, agentIdentity, currentNetwork = "local" }: {
    canisterConfig: CanisterConfiguration,
    agentIdentity?: Identity,
    currentNetwork?: string,
  }) => {
  try {
    const {
      agent,
    } = await getEnv()
    let canisters = canisterList
    let actors: {
      [canisterName: string]: {
        actor: ActorSubclass<any>,
        canisterId: string,
        getControllers: () => Promise<void>,
        addControllers: (controllers: Array<string>) => Promise<void>,
        setControllers: (controllers: Array<string>) => Promise<void>,
      }
    } = {}
    const canisterIds = getCanisterIds()
    console.log("create actors:", canisterIds)
    for (let canisterName of canisters) {
      // TODO: network support?
      const canisterId = canisterIds[canisterName][currentNetwork]
      // TODO: get did
      const didPath = canisterConfig.candid + ".js"
      // const didPath = `${appDirectory}/.dfx/local/canisters/${canisterName}/${canisterName}.did.js`
      const canisterDID = await import(didPath)
      // TODO: better way of checking? call dfx?
      const canisterExists = fs.existsSync(didPath)
      if (!canisterExists) {
        // TODO: was init() before
        await deployCanister(canisterName, canisterConfig)
      }
      actors[canisterName] = {
        actor: Actor.createActor(canisterDID.idlFactory, {
          agent,
          canisterId,
        }),
        canisterId,
        getControllers: async () => {
          // dfx canister --network "${NETWORK}" update-settings --add-controller "${SNS_ROOT_ID}" "${CID}"
          // await spawn({
          //   command: "dfx",
          // })
        },
        addControllers: async (controllers: Array<string>) => {
          // dfx canister --network "${NETWORK}" update-settings --add-controller "${SNS_ROOT_ID}" "${CID}"
          await spawn({
            command: "dfx",
            args: ["canister", "--network", "local", "update-settings",
              ...controllers.map(c => ["--add-controller", c]),
              canisterId],
            stdout: (data) => {
              console.log(data)
            },
          })
        },
        setControllers: async (controllers: Array<string>) => {
          // dfx canister --network "${NETWORK}" update-settings --add-controller "${SNS_ROOT_ID}" "${CID}"
          let cyclesWallet
          await spawn({
            command: "dfx",
            // TODO: network
            args: ["identity", "get-wallet"],
            stdout: (data) => {
              cyclesWallet = data
            },
          })
          // TODO: error handling
          await spawn({
            command: "dfx",
            // TODO: network
            args: ["canister", "--network", "local", "update-settings",
              ...controllers.map(c => ["--set-controller", c]),
              "--set-controller", cyclesWallet,
              canisterId],
            stdout: (data) => {
              console.log(data)
            },
          })
        },
      }
    }
    return actors
  } catch (e: Error) {
    console.error("Failed to create actors:", e)
    throw { kind: 'ActorCreationError', message: `Failed to create actors: ${e.message}` }
  }
}

// TODO: ........ no top level await
// TODO: clone. make immutable?
// const userConfig =
// const initialConfig = await getDfxConfig()
// let config = JSON.parse(JSON.stringify(initialConfig))
// let config
// const getConfig = async () => config ? JSON.parse(JSON.stringify(config)) : await getDfxConfig()
// type ConfigFn<
//   C extends Record<string, TaskCanisterConfiguration>,
//   S extends Record<string, TaskScriptConfiguration<C, S>>,
// >
//   = (config: DfxTs<C, S>, initialConfig: DfxTs<C, S>) => void
// export const extendConfig = <
//   C extends Record<string, TaskCanisterConfiguration>,
//   S extends Record<string, TaskScriptConfiguration<C, S>>,
// >(fn: ConfigFn<C, S>) => {
//   // TODO: let plugins call this function to extend config
//   fn(initialConfig, initialConfig)
// }

// TODO: use dfx identity export ?
export const getIdentity = async (selection?: string): Promise<{
  identity: Ed25519KeyIdentity,
  pem: string,
  name: string,
  principal: string,
  accountId: string
}> => {
  try {
    // TODO: pem to identity? not sure
    const identityName: string = selection ?? await getCurrentIdentity()
    const identityExists = fs.existsSync(`${os.homedir()}/.config/dfx/identity/${identityName}/identity.pem`)
    let identity
    if (!identityExists) {
      throw { kind: "IdentityDoesNotExist" }
    }
    let pem = fs.readFileSync(`${os.homedir()}/.config/dfx/identity/${identityName}/identity.pem`, "utf8")
    pem = pem
      .replace("-----BEGIN PRIVATE KEY-----", "")
      .replace("-----END PRIVATE KEY-----", "")
      .replace("\n", "")
      .trim()

    const raw = Buffer.from(pem, "base64")
      .toString("hex")
      .replace("3053020101300506032b657004220420", "")
      .replace("a123032100", "")
    const key = new Uint8Array(Buffer.from(raw, "hex"))
    // TODO: not working, Failed to get identity: private key expected 32 bytes, got 64
    // This issue happens when upgrading @dfinity/identity and perhaps other @dfinity/* packages to 2.1.2
    identity = Ed25519KeyIdentity.fromSecretKey(key)
    const principal: string = (await identity.getPrincipal()).toText()
    const accountId = await getAccountId(principal)
    return { identity, pem, name: identityName, principal, accountId }
  } catch (e: Error) {
    console.error("Failed to get identity:", e)
    throw { kind: 'IdentityError', message: `Failed to get identity: ${e.message}` }
  }
}

export const getUserFromBrowser = async (browserUrl: string) => {
  // TODO: move out?
  // TODO: get port from vite
  const __dirname = url.fileURLToPath(new URL(".", import.meta.url))
  const browser = await new Promise<{ accountId: string, principal: string }>(async (resolve, reject) => {
    const app = express()
    app.use(express.json())
    app.use(express.static(`${__dirname}/public`))
    app.use(express.static(`${__dirname}/public/assets`))
    const server = app.listen(666)
    // TODO: serve overrides this
    app.post("/key", function (req, res) {
      // TODO: ?
      // const key = Ed25519KeyIdentity.fromJSON(req.body.key)
      // const chain = DelegationChain.fromJSON(req.body.chain)
      // const identity = DelegationIdentity.fromDelegation(key, chain)
      const principal = req.body.principal
      const accountId = principalToAccountId(principal)
      resolve({ principal, accountId })
      res.send("")
      server.close()
    })
    await open(browserUrl)
  })
  return browser
}

export const getCanisterIds = (): CanisterIds => {
  try {
    const ids: CanisterIds = JSON.parse(fs.readFileSync(`${appDirectory}/canister_ids.json`, "utf8"))
    const canisterIds = Object.keys(ids).reduce<CanisterIds>((acc, canisterName) => {
      if (canisterName !== "__Candid_UI") {
        acc[canisterName] = ids[canisterName]
      }
      return acc
    }, {})
    return canisterIds
  } catch (e: Error) {
    console.error("Failed to get canister IDs:", e)
    throw { kind: 'ConfigError', message: `Failed to get canister IDs: ${e.message}` }
  }
}

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
      providers: [
        "https://ic0.app",
      ],
      "type": "persistent",
    },
    ic: {
      providers: [
        "https://ic0.app",
      ],
      "type": "persistent",
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
    throw { kind: 'ConfigError', message: `Failed to kill DFX processes: ${e.message}` }
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
    throw { kind: 'ConfigError', message: `Failed to start DFX: ${e.message}` }
  }
}