import { spawn as spawnCommand } from "child_process"
import { IDL } from "@dfinity/candid"
import { Principal } from "@dfinity/principal"
import type { DfxJson } from "./schema"
import { CanisterConfiguration, ConfigDefaults, ConfigNetwork, DfxVersion, Profile } from "./schema"
import { sha224 } from "js-sha256"
import fs from "fs"
import crc from "crc"
import { Actor, ActorSubclass, HttpAgent, Identity } from "@dfinity/agent"
// import { ManagementActor } from "./canisters/management"
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

type ManagementActor = import("@dfinity/agent").ActorSubclass<import("./canisters/management_new/management.types")._SERVICE>

export type ExtendedCanisterConfiguration = CanisterConfiguration & {
  _metadata?: { standard?: string; }; dfx_js?: {
    args?: any[];
    canister_id?: {
      [network: string]: string
    }
  }
}

export type TaskCanisterConfiguration<Canisters, Scripts> = {
  dependencies?: Array<`scripts:${keyof Scripts & string}` & `canisters:${keyof Canisters & string}`> // TODO: check task exists
  config: ExtendedCanisterConfiguration | ((deps: Canisters & {
    // [S in keyof Scripts]: Scripts[S] extends TaskScriptConfiguration<Canisters, Scripts> ? ReturnType<Scripts[S]["fn"]> : ReturnType<Scripts[S]> // TODO:
    // [S in keyof Scripts]: ReturnType<Scripts[S] extends TaskScriptConfiguration<Canisters, Scripts> ? Scripts[S]["fn"] : Scripts[S] extends ((any) => any) ? Scripts[S] : ((any) => any)> // TODO:
  }) => ExtendedCanisterConfiguration)
}

export type TaskScriptConfiguration<Canisters, Scripts> = {
  dependencies?: Array<keyof Scripts & keyof Canisters> // TODO: check task exists
  // fn: (deps: Canisters) => Promise<any> | any
  fn: ((deps: Canisters & {
    // [S in keyof Scripts]: ReturnType<Scripts[S] extends TaskScriptConfiguration<Canisters, Scripts> ? Scripts[S]["fn"] : Scripts[S] extends ((any) => any) ? Scripts[S] : ((any) => any)> // TODO:
  }) => any)
}

export type DfxTs<Canisters> = {
  canisters?: {
    [k: string]: TaskCanisterConfiguration<Canisters, DfxTs<Canisters>["scripts"]>
  }
  scripts?: {
    [k: string]: TaskScriptConfiguration<Canisters, DfxTs<Canisters>["scripts"]> | ((deps: Canisters) => any)
    // [k: string]: ((deps: Canisters) => any)
  }
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

  [k: string]: unknown
}

const adminName = "eight-admin"

const calculateCrc32 = (bytes: Uint8Array): Uint8Array => {
  const checksumArrayBuf = new ArrayBuffer(4)
  const view = new DataView(checksumArrayBuf)
  view.setUint32(0, crc.crc32(Buffer.from(bytes)), false)
  return Buffer.from(checksumArrayBuf)
}


const asciiStringToByteArray = (text: string): Array<number> => {
  return Array.from(text).map(c => c.charCodeAt(0))
}

export function toHexString(bytes: ArrayBuffer): string {
  return new Uint8Array(bytes).reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "")
}

export const principalToAccountId = (principal: Principal | string, subAccount?: Uint8Array): string => {
  // Hash (sha224) the principal, the subAccount and some padding
  if (!(principal instanceof Principal)) {
    principal = Principal.fromText(principal)
  }
  const padding = asciiStringToByteArray("\x0Aaccount-id")

  const shaObj = sha224.create()
  shaObj.update([...padding, ...principal.toUint8Array(), ...(subAccount ?? Array(32).fill(0))])
  const hash = new Uint8Array(shaObj.array())

  // Prepend the checksum of the hash and convert to a hex string
  const checksum = calculateCrc32(hash)
  const bytes = new Uint8Array([...checksum, ...hash])
  return toHexString(bytes)
}

// const argv = minimist(process.argv.slice(2))
const appDirectory = fs.realpathSync(process.cwd())

export const Opt = <T>(value?): [T] | [] => {
  return (value || value === 0) ? ([value]) : []
}

const spawn = ({
                 command,
                 args,
                 stdout,
               }) => {
  return new Promise((resolve, reject) => {
    const child = spawnCommand(command, args)

    // @ts-ignore
    child.stdin.setEncoding("utf-8")
    child.stdin.write("yes\n")

    child.stdout.on("data", (data) => {
      if (stdout) {
        stdout(`${data}`)
        return
      }

      // console.log(`${data}`)
    })
    child.stderr.on("data", (data) => console.error(`${data}`))

    child.on("close", (code) => resolve(code))
    child.on("error", (err) => reject(err))
  })
}

export const getAccountId = async (principal): Promise<string> => {
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

function buf2hex(buffer) {
  return [...new Uint8Array(buffer)]
    .map(x => x.toString(16).padStart(2, "0"))
    .join("")
}

export const writeConfig = async (configValue) => {
  // TODO: handle if file doesnt exist?
  await new Promise<void>((resolve, reject) => {
    fs.writeFile(path.resolve(appDirectory, "dfx.json"), JSON.stringify(configValue), "utf-8", (err) => {
      if (!err) {
        resolve()
      }
    })
  })
}

type CanisterIds = {
  [id: string]: {
    "local": string
    ic?: string
  }
}

const emitter = new Emitter()

const waitFor = async (taskName) => {
  return await new Promise((resolve, reject) => {
    emitter.once(taskName, resolve)
  })
}

export const create = async (dfxConfig: DfxJson, canisters: Array<string> = Object.keys(dfxConfig.canisters)): Promise<CanisterIds> => {
  // TODO: move out?
  let clonedDfxConfig = JSON.parse(JSON.stringify(dfxConfig))
  for (let [canisterName, canisterConfig] of Object.entries(clonedDfxConfig.canisters)) {
    delete clonedDfxConfig.canisters[canisterName].dfx_js
  }

  // Write dfx.json first
  await writeConfig(clonedDfxConfig)

  for (let canisterName of canisters) {
    await spawn({
      command: "dfx",
      args: ["canister", "create", canisterName],
      stdout: (data) => {
      },
    })
    await spawn({
      command: "dfx",
      args: ["build", canisterName],
      stdout: (data) => {
      },
    })
  }

  const canisterIds = getCanisterIds()
  return canisterIds
}

const init = async (canisterName, canisterConfig) => {
  const { identity } = await getIdentity()
  const mgmt = Actor.createActor<ManagementActor>(idlFactory, {
    canisterId: "aaaaa-aa",
    agent: new HttpAgent({
      host: "http://0.0.0.0:8080",
      identity,
    }),
  })
  // TODO: create random principal
  const specified_id = canisterConfig.dfx_js?.canister_id?.local
  const { canister_id } = await mgmt.provisional_create_canister_with_cycles({
    settings: [{
      compute_allocation: Opt<bigint>(),
      // compute_allocation: Opt<bigint>(100n),
      memory_allocation: Opt<bigint>(), // 8gb
      // memory_allocation: Opt<bigint>(8_000_000_000n), // 8gb
      freezing_threshold: Opt<bigint>(), // 30 days in seconds
      // freezing_threshold: Opt<bigint>(3600n * 24n * 30n), // 30 days in seconds
      controllers: Opt<Principal[]>([
        // TODO: add more
        identity.getPrincipal(),
      ]),
    }],
    // amount: Opt<bigint>(1_000_000_000_000n),
    amount: Opt<bigint>(),
    specified_id: Opt<Principal>(specified_id ?? undefined), // TODO: add custom_id
    sender_canister_version: Opt<bigint>(), // TODO: ??
    // sender_canister_version: Opt<bigint>(0n), // TODO: ??
    // settings: [] | [canister_settings];   specified_id: [] | [Principal];   amount: [] | [bigint];   sender_canister_version: [] | [bigint];
  })
  // const installMode = InstallMode.reinstall
  let mode: { install: null } | { reinstall: null } | { upgrade: null } = { reinstall: null }
  // switch (installMode) {
  //   case InstallMode.install:
  //     mode = { install: null };
  //     break;
  //   case InstallMode.reinstall:
  //     mode = { reinstall: null };
  //     break;
  //   case InstallMode.upgrade:
  //     mode = { upgrade: null };
  //     break;
  //   default:
  //     mode = { install: null };
  //     break;
  // }
  await mgmt.install_code({
    arg: [] as number[],
    canister_id,
    sender_canister_version: Opt<bigint>(),
    // TODO: ?
    // wasm_module: Uint8Array.from(fs.readFileSync(`${appDirectory}/.dfx/local/canisters/${canisterName}/${canisterName}.wasm`)),
    // TODO: read from config
    wasm_module: Array.from(new Uint8Array(fs.readFileSync(`${appDirectory}/.dfx/local/canisters/${canisterName}/${canisterName}.wasm`))),
    mode,
  })
  // const args = [
  //   ...(canisterConfig.dfx_js?.canister_id ? [
  //     // TODO: network selection?
  //     "--specified-id", canisterConfig.dfx_js?.canister_id.local,
  //   ] : []),
  //   // "--mode", "reinstall"
  // ]
  // await spawn({
  //   command: "dfx",
  //   // TODO: get canisters
  //   args: ["canister", "create", canisterName, ...args],
  //   stdout: (data) => {
  //   },
  // })

  // await spawn({
  //   command: "dfx",
  //   // TODO: get canisters
  //   args: ["build", canisterName],
  //   stdout: (data) => {
  //   },
  // })
}

enum InstallMode {
  install,
  reinstall,
  upgrade,
}

export const deployCanister = async (canisterConfig) => {
  // const installMode = InstallMode.reinstall
  let mode: { install: null } | { reinstall: null } | { upgrade: null } = { install: null }
  // switch (installMode) {
  //   case InstallMode.install:
  //     mode = { install: null };
  //     break;
  //   case InstallMode.reinstall:
  //     mode = { reinstall: null };
  //     break;
  //   case InstallMode.upgrade:
  //     mode = { upgrade: null };
  //     break;
  //   default:
  //     mode = { install: null };
  //     break;
  // }
  const { identity } = await getIdentity()
  const agent = new HttpAgent({
    host: "http://0.0.0.0:8080",
    identity,
  })
  // TODO:
  await agent.fetchRootKey()
  const mgmt = Actor.createActor<ManagementActor>(idlFactory, {
    canisterId: "aaaaa-aa",
    agent,
  })
  // const canisterIds = getCanisterIds()
  // TODO: use didc?
  const didPath = canisterConfig.candid + ".js"
  const wasmPath = canisterConfig.wasm
  // const didPath = `${appDirectory}/.dfx/local/canisters/${canisterName}/service.did.js`
  // TODO: better way of checking?
  // const canisterExists = canisterIds[canisterName]
  // if (!canisterExists) {
  //   await initCustom(canisterName, canisterConfig)
  // }
  const canisterDID = await import(didPath)
  // TODO: add args to schema
  let encodedArgs
  try {
    encodedArgs = canisterConfig.dfx_js?.args ? IDL.encode(canisterDID.init({ IDL }), canisterConfig.dfx_js.args) : new Uint8Array()
  } catch (e) {
    console.log("Failed to encode args: ", e)
  }
  // ??
  // shell.exec()
  // TODO: use management actor?
  // TODO:
  // mgmt = Actor.createActor(ManagementCanisterIdl, {
  //
  // })
  // const mgmt = getManagementCanister({})
  // TODO: create random principal
  let canister_id = canisterConfig.dfx_js?.canister_id?.local
  try {
    // const specified_id = canisterConfig.dfx_js?.canister_id?.local
    canister_id = (await mgmt.provisional_create_canister_with_cycles({
      settings: [{
        compute_allocation: Opt<bigint>(),
        // compute_allocation: Opt<bigint>(100n),
        memory_allocation: Opt<bigint>(), // 8gb
        // memory_allocation: Opt<bigint>(8_000_000_000n), // 8gb
        freezing_threshold: Opt<bigint>(), // 30 days in seconds
        // freezing_threshold: Opt<bigint>(3600n * 24n * 30n), // 30 days in seconds
        controllers: Opt<Principal[]>([
          // TODO: add more
          identity.getPrincipal(),
        ]),
      }],
      // amount: Opt<bigint>(1_000_000_000_000n),
      amount: Opt<bigint>(1_000_000_000_000n),
      specified_id: Opt<Principal>(canister_id ? Principal.from(canister_id) : undefined), // TODO: add custom_id
      sender_canister_version: Opt<bigint>(0n), // TODO: ??
      // sender_canister_version: Opt<bigint>(0n), // TODO: ??
      // settings: [] | [canister_settings];   specified_id: [] | [Principal];   amount: [] | [bigint];   sender_canister_version: [] | [bigint];
    })).canister_id
    console.log(`Created ${canisterConfig.name} with canister_id:`, canister_id.toText())
  } catch (e) {
    console.log("Failed to create canister:", e)
    throw { kind: "CanisterCreationFailed", error: e }
  }
  try {
    const wasm = Array.from(new Uint8Array(fs.readFileSync(wasmPath)))
    await mgmt.install_code({
      arg: encodedArgs,
      canister_id: Principal.from(canister_id),
      sender_canister_version: Opt<bigint>(),
      wasm_module: wasm,
      mode,
    })
    console.log(`Success with wasm bytes length: ${wasm.length}`)
    return canister_id
  } catch (e) {
    console.log("Failed to install code:", e)
  }
  // TODO: canisterIds not there yet?
  // const { default: canisterIds } = await import(`${appDirectory}/.dfx/local/canister_ids.json`, { assert: { type: "json" } })
  // const canisterIds = getCanisterIds()
  // const canisterId = canisterIds[canisterName]
  // return canisterId
}

const execTasks = async (taskStream) => {
  for await (const { taskName: fullName, taskConfig } of taskStream) {
    const [taskType, taskName] = fullName.split(":")
    console.log(`Running ${taskType} ${taskName}`)
    if (taskType === "canisters") {
      try {
        // await deployCanister(taskName, taskConfig)
        await deployCanister(taskConfig)
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

type DeployArgs = {
  dfxConfig: DfxJson,
}
// TODO: Result?

const createTaskStream = (dfxConfig, tasks) => new Repeater<any>(async (push, stop) => {
  const jobs = tasks.map(async (fullName) => {
    const [taskType, taskName] = fullName.split(":")
    let taskConfig = dfxConfig[taskType][taskName]
    let deps = getDeps(dfxConfig, taskConfig?.dependencies ?? [])
    // const allDeps = getDeps(dfxConfig, tasks)
    // if (fullName === "scripts:setup") {
    //   // TODO: ??
    //   deps = [...new Set([...deps, ...Object.keys(dfxConfig.canisters).map((canisterName) => `canisters:${canisterName}`)])]
    // }
    const depsPromises = deps.map(async (fullName) => {
      const [taskType, taskName] = fullName.split(":")
      const taskResult = await waitFor(fullName)
      return {
        [taskName]: taskResult,
      }
    })
    const taskResults = Object.assign({}, ...await Promise.all(depsPromises))
    // TODO: rename
    let finalConfig
    const isJustFn = typeof taskConfig === "function"
    if (taskType === "canisters") {
      // TODO: allow just fns?
      if (isJustFn) {
        finalConfig = taskConfig(...taskResults)
      } else {
        finalConfig = typeof taskConfig.config === "function" ? taskConfig.config({ ...taskResults }) : taskConfig.config
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

// TODO: simplify & rename?
const transformWildcards = (dfxConfig, dep) => {
  const [depType, depName] = dep.split(":")
  // TODO: check for every iteration?
  const isWildcard = depName === "*"
  const hasCanisterWildcard = depType === "canisters" && isWildcard
  const hasScriptWildcard = depType === "scripts" && isWildcard
  const allTasks = isWildcard ? [...new Set([
    ...(hasCanisterWildcard ? Object.keys(dfxConfig.canisters).map((canisterName) => `canisters:${canisterName}`) : []),
    ...(hasScriptWildcard ? Object.keys(dfxConfig.scripts).map((scriptName) => `scripts:${scriptName}`) : []),
  ])] : [dep]
  return allTasks
}

const getDeps = (dfxConfig, tasks) => {
  const walkDeps = (dfxConfig, dep) => {
    const allTasks = transformWildcards(dfxConfig, dep)
    return allTasks.map((task) => {
      const [taskType, taskName] = task.split(":")
      const taskConfig = dfxConfig[taskType][taskName]
      let taskDeps = taskConfig?.dependencies ?? []
      const allDeps = [...taskDeps.map(task => transformWildcards(dfxConfig, task)).flat(), ...taskDeps.map((dep) => walkDeps(dfxConfig, dep)).flat()]
      return allDeps.concat(task)
    }).flat()
  }
  let allDeps = [
    ...new Set([
      ...tasks.map(task => walkDeps(dfxConfig, task)).flat(),
    ]),
  ]
  return allDeps
}

export const runTasks = async (tasks: Array<string>) => {
  console.log(".................Generated config............:\n", config)
  const allDeps = getDeps(config, tasks)
  const allTasks = [...new Set([...allDeps, ...tasks.map(t => transformWildcards(config, t)).flat()])]
  const taskStream = createTaskStream(config, allTasks)
  await execTasks(taskStream)
  // TODO: return OK?
  return getCanisterIds()
}

const fromAppDir = (path) => `${appDirectory}/${path}`

export const getDfxConfig = async (configPath: string = "hydra.config.ts") => {
  const appDirectory = fs.realpathSync(process.cwd())
  const { default: dfxConfig } = await import(path.resolve(appDirectory, configPath))
  return dfxConfig
}

// TODO: take dfx config as param?
export const createActors = async (
  canisterList: Array<string>,
  { canisterConfig, agentIdentity }: {
    canisterConfig: CanisterConfiguration,
    agentIdentity?: Identity,
  }) => {
  let canisters = canisterList ?? Object.keys((await getDfxConfig()).canisters)
  const identity = agentIdentity ?? (await getIdentity()).identity

  const agent = new HttpAgent({
    // TODO: get dfx port
    host: "http://0.0.0.0:8080",
    identity,
  })
  await agent.fetchRootKey().catch(err => {
    console.warn("Unable to fetch root key. Check to ensure that your local replica is running")
    console.error(err)
  })
  let actors = {}
  const canisterIds = getCanisterIds()
  for (let canisterName of canisters) {
    // TODO: network support?
    const canisterId = canisterIds[canisterName]
    // TODO: get did
    const didPath = canisterConfig.candid + ".js"
    // const didPath = `${appDirectory}/.dfx/local/canisters/${canisterName}/${canisterName}.did.js`

    const canisterDID = await import(didPath)
    // TODO: better way of checking? call dfx?
    const canisterExists = fs.existsSync(didPath)
    if (!canisterExists) {
      await init(canisterName, canisterConfig)
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
}

// TODO: ........ no top level await
// TODO: clone. make immutable?
// const userConfig = await getDfxConfig()
const userConfig = {}
// let config = JSON.parse(JSON.stringify(userConfig))
// let config
// const getConfig = async () => config ? JSON.parse(JSON.stringify(config)) : await getDfxConfig()
type ConfigFn = (config: DfxTs<any>, userConfig: DfxTs<any>) => void
export const extendConfig = (fn: ConfigFn) => {
  // TODO: let plugins call this function to extend config
  fn(config, JSON.parse(JSON.stringify(userConfig)))
}

export const task = (name, description, fn) => {

}

// TODO: use dfx identity export ?
export const getIdentity = async (selection?: string): Promise<{
  identity: Ed25519KeyIdentity,
  pem: string,
  name: string,
  principal: string,
  accountId: string
}> => {
  // TODO: pem to identity? not sure
  const identityName: string = selection ?? await getCurrentIdentity()
  const identityExists = fs.existsSync(`${os.homedir()}/.config/dfx/identity/${identityName}/identity.pem`)
  let identity
  if (identityExists) {
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
    identity = Ed25519KeyIdentity.fromSecretKey(key)
    const principal: string = (await identity.getPrincipal()).toText()
    const accountId = await getAccountId(principal)
    return { identity, pem, name: identityName, principal, accountId }
  }
}

// // TODO: just create identity? take an optional param of identity.json, else create new
// export const getOrCreateIdentity = async (): Promise<{ identity: Secp256k1KeyIdentity, pem: string }> => {
//   const identityExists = fs.existsSync(`${appDirectory}/identity.json`)
//   let identity
//   if (identityExists) {
//     const { default: identityJson } = await import(`${appDirectory}/identity.json`, { assert: { type: "json" } })
//     identity = Secp256k1KeyIdentity.fromParsedJson(identityJson)
//   } else {
//     identity = Secp256k1KeyIdentity.generate()
//     const identityJson = identity.toJSON()
//     await new Promise<void>((resolve, reject) => {
//       fs.writeFile(`${appDirectory}/identity.json`, JSON.stringify(identityJson), "utf-8", (err) => {
//         if (!err) {
//           resolve()
//         }
//       })
//     })
//   }
//
//   const {
//     secretKey: privateKey,
//     publicKey,
//   } = identity.getKeyPair()
//
//   const rawPrivateKey = toHexString(new Uint8Array(privateKey))
//   const rawPublicKey = toHexString(new Uint8Array(publicKey.rawKey))
//
//   const PEM_BEGIN = `-----BEGIN EC PARAMETERS-----
// BgUrgQQACg==
// -----END EC PARAMETERS-----
// -----BEGIN EC PRIVATE KEY-----`
//   const PEM_END = "-----END EC PRIVATE KEY-----"
//   const PRIV_KEY_INIT = "30740201010420"
//   const KEY_SEPARATOR = "a00706052b8104000aa144034200"
//
//   const pem = `${PEM_BEGIN}\n${Buffer.from(
//     `${PRIV_KEY_INIT}${rawPrivateKey}${KEY_SEPARATOR}${rawPublicKey}`,
//     "hex",
//   ).toString("base64")}\n${PEM_END}`
//
//   // TODO: check if exists
//   await new Promise<void>((resolve, reject) => {
//     fs.writeFile(`${appDirectory}/identity.pem`, pem, "utf-8", (err) => {
//       if (!err) {
//         resolve()
//       }
//     })
//   })
//
//   await spawn({
//     command: "dfx",
//     args: ["identity", "import", adminName, `${appDirectory}/identity.pem`, "--disable-encryption"],
//     stdout: (data) => {
//     },
//   })
//
//   await spawn({
//     command: "dfx",
//     args: ["identity", "use", adminName],
//     stdout: (data) => {
//     },
//   })
//
//   return { identity, pem }
// }

export const getUserFromBrowser = async (browserUrl) => {
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
    app.post("/key", function(req, res) {
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

type CanisterDeclarations = {
  [canisterName: string]: {
    canisterId: string
    actor: ActorSubclass<any>
    // TODO: ?
    // setControllers: (controllers: Array<string>) => Promise<void>,
    // addControllers: (controllers: Array<string>) => Promise<void>
  }
}

export const defineConfig = <Canisters extends CanisterDeclarations>(
  config: DfxTs<{
    [C in keyof Canisters]: Omit<Canisters[C], "service" | "idlFactory"> & {
    setControllers: (controllers: Array<string>) => Promise<void>,
    addControllers: (controllers: Array<string>) => Promise<void>
  }
  }>) => {
  return config
}

export const getCanisterIds = () => {
  // const { default: ids } = await import(`${appDirectory}/.dfx/local/canister_ids.json`, { assert: { type: "json" } })
  const ids = JSON.parse(fs.readFileSync(`${appDirectory}/.dfx/local/canister_ids.json`, "utf8"))
  const canisterIds = Object.keys(ids).reduce((acc, canisterName) => {
    if (canisterName !== "__Candid_UI") {
      acc[canisterName] = ids[canisterName].local
    }
    return acc
  }, {})
  return canisterIds
}

// TODO: cycles wallet
// export const getAllCanisterIds = () => {
//   // const { default: ids } = await import(`${appDirectory}/.dfx/local/canister_ids.json`, { assert: { type: "json" } })
//   const ids = JSON.parse(fs.readFileSync(`${appDirectory}/.dfx/local/canister_ids.json`, "utf8"))
//   const wallets = JSON.parse(fs.readFileSync(`${appDirectory}/.dfx/local/wallets.json`, "utf8"))
//   const canisterIds = Object.assign(ids, wallets.identities)
//   return canisterIds
// }

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

const killDfx = async () => {
  const dfxPids = await find("name", "dfx", true)
  const replicaPids = await find("name", "replica", true)
  const icxProxyPids = await find("name", "icx-proxy", true)
  process.kill(dfxPids[0]?.pid)
  process.kill(replicaPids[0]?.pid)
  process.kill(icxProxyPids[0]?.pid)
}

export const startDfx = async () => {
  await spawn({
    command: "dfx",
    args: ["start", "--background", "--clean"],
    stdout: (data) => {
      // console.log(data)
    },
  })
}

