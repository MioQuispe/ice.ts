import { Layer, Effect, Context, Data, Config, Match } from "effect"
import {
  createCanister,
  installCanister,
  compileMotokoCanister,
  writeCanisterIds,
  encodeArgs,
  generateDIDJS,
  TaskCtx,
  type TaskCtxShape,
  createActor,
  readCanisterIds,
  getCanisterInfo,
  getTaskPathById,
  TaskInfo,
  DependencyResults,
  deployTaskPlugin,
} from "../index.js"
import type { Actor, HttpAgent, Identity } from "@dfinity/agent"
import type { Agent } from "@dfinity/agent"
import type {
  BuilderResult,
  CrystalContext,
  Scope,
  Task,
  TaskTree,
} from "../types/types.js"
import { Principal } from "@dfinity/principal"
// import mo from "motoko"
import process from "node:process"
import { execFileSync } from "node:child_process"
import { Path, FileSystem, Command, CommandExecutor } from "@effect/platform"
import fsnode from "node:fs"
import { Moc } from "../services/moc.js"
import { DfxService } from "../services/dfx.js"

export const Tags = {
  // CANISTER: Symbol("canister"),
  // CREATE: Symbol("create"),
  // BUILD: Symbol("build"),
  // INSTALL: Symbol("install"),
  // BINDINGS: Symbol("bindings"),
  // DELETE: Symbol("delete"),
  // // TODO: hmm do we need this?
  // SCRIPT: Symbol("script"),
  CANISTER: "$$crystal/canister",
  CREATE: "$$crystal/create",
  BUILD: "$$crystal/build",
  INSTALL: "$$crystal/install",
  BINDINGS: "$$crystal/bindings",
  DEPLOY: "$$crystal/deploy",
  DELETE: "$$crystal/delete",
  // TODO: hmm do we need this?
  SCRIPT: "$$crystal/script",
}

const generatePrincipal = () => {
  // TODO: FIX!!!!
  // NOTE: This is not cryptographically secure - replace with proper implementation later
  const randomBytes = new Uint8Array(29).map(() =>
    Math.floor(Math.random() * 256),
  )
  return Principal.fromUint8Array(randomBytes)
}

export type CanisterBuilder<I = unknown> = {
  install: (
    fn: (args: { ctx: TaskCtxShape; mode: string }) => Promise<I>,
  ) => CanisterBuilder<I>
  build: (fn: (args: { ctx: TaskCtxShape }) => Promise<I>) => CanisterBuilder<I>
  deps: (
    ...deps: Array<Task | CanisterBuilder<any> | MotokoCanisterBuilder<any>>
  ) => CanisterBuilder<I>
  // TODO:
  //   bindings: (fn: (args: { ctx: TaskCtxShape }) => Promise<I>) => CanisterBuilder<I>
  // Internal property to store the current scope
  _scope: Scope
  // TODO: use BuilderResult?
  _tag: "builder"
}

type CustomCanisterConfig = {
  wasm: string
  candid: string
  // TODO: make optional
  canisterId?: string
}

// TODO: some kind of metadata?
// TODO: warn about context if not provided
export const customCanister = <I>(
  canisterConfigOrFn:
    | CustomCanisterConfig
    | ((ctx: TaskCtxShape) => CustomCanisterConfig),
) => {
  const makeBindingsTask = (): Task => {
    return {
      _tag: "task",
      id: Symbol("customCanister/bindings"),
      dependencies: [],
      // TODO: do we allow a fn as args here?
      effect: Effect.gen(function* () {
        const path = yield* Path.Path
        const fs = yield* FileSystem.FileSystem
        const appDir = yield* Config.string("APP_DIR")
        const { taskPath } = yield* TaskInfo
        const canisterName = taskPath.split(":").slice(0, -1).join(":")
        yield* canisterBuildGuard
        yield* Effect.logInfo("Bindings build guard check passed")

        const wasmPath = path.join(
          appDir,
          ".artifacts",
          canisterName,
          `${canisterName}.wasm`,
        )
        const didPath = path.join(
          appDir,
          ".artifacts",
          canisterName,
          `${canisterName}.did`,
        )
        yield* Effect.logInfo("Artifact paths", { wasmPath, didPath })

        yield* generateDIDJS(canisterName, didPath)
        yield* Effect.logInfo("Generated DID JS")
      }),
      description: "some description",
      tags: [Tags.CANISTER, Tags.BINDINGS],
    }
  }
  const makeInstallTask = (
    fn?: (args: { ctx: TaskCtxShape; mode: string }) => Promise<I>,
  ): Task => {
    return {
      _tag: "task",
      id: Symbol("customCanister/install"),
      dependencies: [],
      effect: Effect.gen(function* () {
        yield* Effect.logInfo("Starting custom canister installation")
        const taskCtx = yield* TaskCtx
        const canisterConfig =
          typeof canisterConfigOrFn === "function"
            ? canisterConfigOrFn(taskCtx)
            : canisterConfigOrFn
        yield* Effect.logInfo("Loaded canister config", { canisterConfig })

        const { taskPath } = yield* TaskInfo
        const canisterName = taskPath.split(":").slice(0, -1).join(":")
        const canisterId = yield* loadCanisterId(taskPath)
        yield* Effect.logInfo("Loaded canister ID", { canisterId })

        const path = yield* Path.Path
        const fs = yield* FileSystem.FileSystem
        const appDir = yield* Config.string("APP_DIR")

        yield* canisterBuildGuard
        yield* Effect.logInfo("Build guard check passed")

        const didJSPath = path.join(
          appDir,
          ".artifacts",
          canisterName,
          `${canisterName}.did.js`,
        )
        const canisterDID = yield* Effect.tryPromise({
          try: () => import(didJSPath),
          catch: Effect.fail,
        })
        yield* Effect.logInfo("Loaded canisterDID", { canisterDID })

        let installArgs = [] as unknown as I
        if (fn) {
          yield* Effect.logInfo("Executing install args function")
          installArgs = yield* Effect.tryPromise({
            // TODO: pass everything
            try: () => fn({ ctx: taskCtx, mode: "install" }),
            catch: Effect.fail, // TODO: install args fail? proper error handling
          })
          yield* Effect.logInfo("Install args generated", { args: installArgs })
        }

        yield* Effect.logInfo("Encoding args", { installArgs, canisterDID })
        const encodedArgs = yield* Effect.try({
          // TODO: do we accept simple objects as well?
          // @ts-ignore
          try: () => encodeArgs(installArgs, canisterDID),
          catch: (error) => {
            throw new Error(
              `Failed to encode args: ${error instanceof Error ? error.message : String(error)}`,
            )
          },
        })
        yield* Effect.logInfo("Args encoded successfully")

        const wasmPath = path.join(
          appDir,
          ".artifacts",
          canisterName,
          `${canisterName}.wasm`,
        )
        yield* Effect.tap(
          installCanister({
            encodedArgs,
            canisterId,
            wasmPath,
          }),
          () => Effect.logInfo("Canister installed successfully"),
        )
      }),
      description: "Install canister code",
      tags: [Tags.CANISTER, Tags.INSTALL],
    }
  }

  const makeBuildTask = (
    fn?: (args: { ctx: TaskCtxShape }) => Promise<I>,
  ): Task => {
    return {
      _tag: "task",
      id: Symbol("customCanister/build"),
      dependencies: [],
      effect: Effect.gen(function* () {
        const taskCtx = yield* TaskCtx
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path
        const appDir = yield* Config.string("APP_DIR")
        const canisterConfig =
          typeof canisterConfigOrFn === "function"
            ? canisterConfigOrFn(taskCtx)
            : canisterConfigOrFn
        const { taskPath } = yield* TaskInfo
        const canisterName = taskPath.split(":").slice(0, -1).join(":")
        const outWasmPath = path.join(
          appDir,
          ".artifacts",
          canisterName,
          `${canisterName}.wasm`,
        )
        const wasm = yield* fs.readFile(canisterConfig.wasm)
        yield* fs.writeFile(outWasmPath, wasm)

        const outCandidPath = path.join(
          appDir,
          ".artifacts",
          canisterName,
          `${canisterName}.did`,
        )
        const candid = yield* fs.readFile(canisterConfig.candid)
        yield* fs.writeFile(outCandidPath, candid)

        if (fn) {
          yield* Effect.tryPromise({
            // TODO: why are we passing this in?
            try: () => fn({ ctx: taskCtx }),
            catch: Effect.fail,
          })
        }
      }),
      description: "some description",
      tags: [Tags.CANISTER, Tags.BUILD],
    }
  }

  const makeCreateTask = (): Task => {
    const id = Symbol("customCanister/create")
    return {
      _tag: "task",
      id,
      dependencies: [],
      effect: Effect.gen(function* () {
        const path = yield* Path.Path
        const fs = yield* FileSystem.FileSystem
        const taskCtx = yield* TaskCtx
        const canisterConfig =
          typeof canisterConfigOrFn === "function"
            ? canisterConfigOrFn(taskCtx)
            : canisterConfigOrFn
        const canisterId = yield* createCanister(canisterConfig?.canisterId)
        // TODO: handle errors? what to do if already exists?
        const appDir = yield* Config.string("APP_DIR")
        // TODO: doesnt work with dynamically run tasks
        const { taskPath } = yield* TaskInfo
        const canisterName = taskPath.split(":").slice(0, -1).join(":")
        const outDir = path.join(appDir, ".artifacts", canisterName)
        yield* fs.makeDirectory(outDir, { recursive: true })
        yield* writeCanisterIds(canisterName, canisterId)
        return canisterId
      }),
      description: "some description",
      tags: [Tags.CANISTER, Tags.CREATE],
    }
  }

  const initialScope: Scope = {
    _tag: "scope",
    tags: [Tags.CANISTER],
    description: "some description",
    // TODO: default implementations
    children: {
      // TODO: we need to provide the context. do we do it here or later?
      create: makeCreateTask(),
      bindings: makeBindingsTask(),

      // TODO: maybe just the return value of install? like a cleanup
      // delete: {
      //   task: deleteCanister(config),
      //   description: "some description",
      //   tags: [],
      //   ctx: ctx,
      // },
      build: makeBuildTask(),
      install: makeInstallTask(),
    },
  }

  const makeBuilder = (scope: Scope): CanisterBuilder<I> => {
    return deployTaskPlugin({
      // TODO: write canisterIds to file
      // TODO: we need to provide the context. do we do it here or later?
      install: (
        fn: (args: { ctx: TaskCtxShape; mode: string }) => Promise<I>,
      ) => {
        // TODO: is this a flag, arg, or what?
        const mode = "install"
        return deployTaskPlugin(
          makeBuilder({
            ...scope,
            children: {
              ...scope.children,
              install: makeInstallTask(fn),
            },
          }),
        )
      },
      build: (fn: (args: { ctx: TaskCtxShape }) => Promise<I>) => {
        return deployTaskPlugin(
          makeBuilder({
            ...scope,
            children: {
              ...scope.children,
              build: makeBuildTask(fn),
            },
          }),
        )
      },
      deps: (
        ...deps: Array<Task | CanisterBuilder | MotokoCanisterBuilder>
      ) => {
        return deployTaskPlugin(
          makeBuilder({
            ...scope,
            children: {
              ...scope.children,
              install: {
                ...scope.children.install,
                // TODO: check that its a canister builder
                dependencies: deps.map((dep) =>
                  dep._tag === "builder" ? dep._scope.children.deploy : dep,
                ),
              } as Task,
            },
          }),
        )
      },
      // Add scope property to the initial builder
      _scope: scope,
      _tag: "builder",
    }) as CanisterBuilder<I>
  }

  return makeBuilder(initialScope)
}

type MotokoCanisterConfig = {
  src: string
  canisterId?: string
}

export type MotokoCanisterBuilder<I = unknown> = {
  install: (
    fn: (args: { ctx: TaskCtxShape }) => Promise<I>,
  ) => MotokoCanisterBuilder<I>
  deps: (
    ...deps: Array<Task | CanisterBuilder<any> | MotokoCanisterBuilder<any>>
  ) => MotokoCanisterBuilder<I>
  //   build: <A, E, R>(fn: Task<A, E, R>) => MotokoCanisterBuilder
  // TODO: generate
  //   bindings: <A, E, R>(fn: Task<A, E, R>) => MotokoCanisterBuilder
  // Internal property to store the current scope
  _scope: Scope
  _tag: "builder"
}

// TODO: should take taskPath as arg
export const loadCanisterId = (taskPath: string) =>
  Effect.gen(function* () {
    const canisterName = taskPath.split(":").slice(0, -1).join(":")
    const canisterIds = yield* readCanisterIds()
    // TODO: dont hardcode local. add support for networks
    const canisterId = canisterIds[canisterName]?.local
    if (canisterId) {
      return canisterId as string
    }
    return yield* Effect.fail(new Error("Canister ID not found"))
  })

const canisterBuildGuard = Effect.gen(function* () {
  const path = yield* Path.Path
  const fs = yield* FileSystem.FileSystem
  const appDir = yield* Config.string("APP_DIR")
  // TODO: dont wanna pass around id everywhere
  const { taskPath } = yield* TaskInfo
  const canisterName = taskPath.split(":").slice(0, -1).join(":")
  const didPath = path.join(
    appDir,
    ".artifacts",
    canisterName,
    `${canisterName}.did`,
  )
  const wasmPath = path.join(
    appDir,
    ".artifacts",
    canisterName,
    `${canisterName}.wasm`,
  )
  const didExists = yield* fs.exists(didPath)
  if (!didExists) {
    yield* Effect.fail(new Error("Candid file not found"))
  }
  const wasmExists = yield* fs
    .exists(wasmPath)
    .pipe(Effect.mapError((e) => new Error("Wasm file not found")))
  if (!wasmExists) {
    yield* Effect.fail(new Error("Wasm file not found"))
  }
  return true
})

export const motokoCanister = <I>(
  canisterConfigOrFn:
    | MotokoCanisterConfig
    | ((ctx: TaskCtxShape) => MotokoCanisterConfig),
) => {
  const makeBindingsTask = (): Task => {
    return {
      _tag: "task",
      id: Symbol("motokoCanister/bindings"),
      dependencies: [],
      // TODO: do we allow a fn as args here?
      effect: Effect.gen(function* () {
        const path = yield* Path.Path
        const fs = yield* FileSystem.FileSystem
        const appDir = yield* Config.string("APP_DIR")
        const { taskPath } = yield* TaskInfo
        const canisterName = taskPath.split(":").slice(0, -1).join(":")
        yield* canisterBuildGuard
        yield* Effect.logInfo("Bindings build guard check passed")

        const wasmPath = path.join(
          appDir,
          ".artifacts",
          canisterName,
          `${canisterName}.wasm`,
        )
        const didPath = path.join(
          appDir,
          ".artifacts",
          canisterName,
          `${canisterName}.did`,
        )
        yield* Effect.logInfo("Artifact paths", { wasmPath, didPath })

        yield* generateDIDJS(canisterName, didPath)
        yield* Effect.logInfo("Generated DID JS")
      }),
      description: "some description",
      tags: [Tags.CANISTER, Tags.BINDINGS],
    }
  }

  const makeInstallTask = (
    fn?: (args: { ctx: TaskCtxShape }) => Promise<I>,
  ): Task => {
    return {
      _tag: "task",
      id: Symbol("motokoCanister/install"),
      dependencies: [],
      effect: Effect.gen(function* () {
        const path = yield* Path.Path
        const fs = yield* FileSystem.FileSystem
        const appDir = yield* Config.string("APP_DIR")
        const taskCtx = yield* TaskCtx
        // TODO: this is needed for args
        const canisterConfig =
          typeof canisterConfigOrFn === "function"
            ? canisterConfigOrFn(taskCtx)
            : canisterConfigOrFn

        const { taskPath } = yield* TaskInfo
        const canisterId = yield* loadCanisterId(taskPath)
        const canisterName = taskPath.split(":").slice(0, -1).join(":")
        yield* canisterBuildGuard
        const didJSPath = path.join(
          appDir,
          ".artifacts",
          canisterName,
          `${canisterName}.did.js`,
        )
        const canisterDID = yield* Effect.tryPromise({
          try: () => import(didJSPath),
          catch: Effect.fail,
        })
        const args = (typeof fn === "function"
          ? yield* Effect.tryPromise({
              try: () => fn({ ctx: taskCtx }),
              catch: Effect.fail,
            })
          : []) as unknown as I
        // @ts-ignore
        const encodedArgs = encodeArgs(args, canisterDID)
        const wasmPath = path.join(
          appDir,
          ".artifacts",
          canisterName,
          `${canisterName}.wasm`,
        )
        yield* installCanister({
          encodedArgs,
          canisterId,
          wasmPath,
        })
      }),
      description: "some description",
      tags: [Tags.CANISTER, Tags.INSTALL],
    }
  }

  const makeBuildTask = (): Task => {
    return {
      _tag: "task",
      id: Symbol("motokoCanister/build"),
      dependencies: [],
      effect: Effect.gen(function* () {
        const path = yield* Path.Path
        const appDir = yield* Config.string("APP_DIR")
        const { taskPath } = yield* TaskInfo
        const canisterId = yield* loadCanisterId(taskPath)
        const taskCtx = yield* TaskCtx
        const canisterConfig =
          typeof canisterConfigOrFn === "function"
            ? canisterConfigOrFn(taskCtx)
            : canisterConfigOrFn
        const canisterName = taskPath.split(":").slice(0, -1).join(":")
        const wasmOutputFilePath = path.join(
          appDir,
          ".artifacts",
          canisterName,
          `${canisterName}.wasm`,
        )
        yield* compileMotokoCanister(
          canisterConfig.src,
          canisterName,
          wasmOutputFilePath,
        )
      }),
      description: "some description",
      tags: [Tags.CANISTER, Tags.BUILD],
    }
  }

  const makeDeleteTask = (): Task => {
    return {
      _tag: "task",
      id: Symbol("motokoCanister/delete"),
      dependencies: [],
      effect: Effect.gen(function* () {
        // yield* deleteCanister(canisterId)
      }),
      description: "some description",
      tags: [Tags.CANISTER, Tags.DELETE],
    }
  }

  // TODO: maybe just the return value of install? like a cleanup
  // delete: {
  //   task: deleteCanister(config),
  //   description: "some description",
  //   tags: [],
  //   ctx: ctx,
  // },
  const initialScope: Scope = {
    _tag: "scope",
    tags: [Tags.CANISTER],
    description: "some description",
    children: {
      create: {
        _tag: "task",
        id: Symbol("motokoCanister/create"),
        dependencies: [],
        effect: Effect.gen(function* () {
          const path = yield* Path.Path
          const fs = yield* FileSystem.FileSystem
          const taskCtx = yield* TaskCtx
          // TODO: ...?
          const canisterConfig =
            typeof canisterConfigOrFn === "function"
              ? canisterConfigOrFn(taskCtx)
              : canisterConfigOrFn
          const canisterId = yield* createCanister(canisterConfig?.canisterId)
          // TODO: handle errors? retry logic? should it be atomic?
          const appDir = yield* Config.string("APP_DIR")
          const { taskPath } = yield* TaskInfo
          // TODO: this gets "" in the name. remove them
          const canisterName = taskPath.split(":").slice(0, -1).join(":")
          // TODO: should this be here?
          const outDir = path.join(appDir, ".artifacts", canisterName)
          yield* fs.makeDirectory(outDir, { recursive: true })
          yield* writeCanisterIds(canisterName, canisterId)
          return canisterId
        }),
        description: "some description",
        tags: [Tags.CANISTER, Tags.CREATE],
      },

      build: makeBuildTask(),
      bindings: makeBindingsTask(),

      // delete: createDeleteTask(),

      install: makeInstallTask(),
    },
  }
  // TODO: should return scope
  const makeBuilder = (scope: Scope): MotokoCanisterBuilder<I> => {
    return deployTaskPlugin({
      install: (fn: (args: { ctx: TaskCtxShape }) => Promise<I>) => {
        return deployTaskPlugin(
          makeBuilder({
            ...scope,
            children: {
              ...scope.children,
              install: makeInstallTask(fn),
            },
          }),
        )
      },
      deps: (
        ...deps: Array<Task | CanisterBuilder | MotokoCanisterBuilder>
      ) => {
        return deployTaskPlugin(
          makeBuilder({
            ...scope,
            children: {
              ...scope.children,
              install: {
                ...scope.children.install,
                // TODO: check that its a canister builder
                dependencies: deps.map((dep) =>
                  dep._tag === "builder" ? dep._scope.children.deploy : dep,
                ),
              } as Task,
            },
          }),
        )
      },
      //   delete: (task) => {
      //     return {
      //       ...scope,
      //       tasks: {
      //         ...scope.tasks,
      //         delete: task,
      //       },
      //     }
      //   },

      // Add scope property to the initial builder
      _scope: scope,
      _tag: "builder",
    }) as MotokoCanisterBuilder<I>
  }

  return makeBuilder(initialScope)
}

type CrystalConfig = CrystalContext & {
  setup?: () => Promise<CrystalContext>
}

export const scope = (description: string, children: TaskTree) => {
  return {
    _tag: "scope",
    tags: [],
    description,
    children,
  }
}

// is this where we construct the runtime / default environment?
// TODO: can we make this async as well?
export const Crystal = (config?: CrystalConfig) => {
  // TODO: rename ctx to runtime or config or something??
  return (
    config ??
    {
      // TODO: dfx defaults etc.
    }
  )
}
