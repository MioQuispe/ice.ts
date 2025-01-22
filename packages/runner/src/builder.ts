import { Layer, Effect, Context, Data, Config } from "effect"
import {
  createCanister,
  installCanister,
  compileMotokoCanister,
  generateCandidJS,
  writeCanisterIds,
  encodeArgs,
  generateDIDJS,
  TaskCtx,
  type TaskCtxShape,
  createActor,
} from "./index.js"
import type { Actor, HttpAgent, Identity } from "@dfinity/agent"
import type { Agent } from "@dfinity/agent"
import type { Scope, Task } from "./types"
import { Principal } from "@dfinity/principal"
// import mo from "motoko"
import process from "node:process"
import { execFileSync } from "node:child_process"
import { Path, FileSystem, Command, CommandExecutor } from "@effect/platform"
import { Moc } from "./services/moc.js"
import { DfxService } from "./services/dfx.js"

// // Common tasks you might reuse across canister builders
// function createBaseTasks(canisterId: string) {
//   return {
//     create: <Task<string, Error, void>>{
//       task: () => Effect.succeed(canisterId),
//       description: "Create canister",
//       tags: [],
//     },
//     build: <Task<void, Error, void>>{
//       task: () => Effect.succeed(),
//       description: "Build canister",
//       tags: [],
//     },
//     install: <Task<void, Error, void>>{
//       task: () => Effect.succeed(),
//       description: "Install canister",
//       tags: [],
//     },
//   } as const
// }

// /**
//  * Merges new tasks into an existing scope to avoid duplication or rewriting.
//  */
// function mergeTasks(baseScope: Scope, newTasks: Record<string, Task>): Scope {
//   return {
//     ...baseScope,
//     tasks: {
//       ...baseScope.tasks,
//       ...newTasks,
//     },
//   }
// }

// type Builder = {
//   scope: Scope
//   extend: (tasks: Record<string, Task>) => Builder
// }

// /**
//  * Creates a composable builder interface.
//  */
// export function createBuilder(canisterId: string): Builder {
//   const baseScope: Scope = {
//     tags: [],
//     description: "",
//     tasks: createBaseTasks(canisterId),
//   }

//   // Provide a composable "extend" to add or override tasks.
//   function extend(tasks: Record<string, Task>): Builder {
//     return {
//       scope: mergeTasks(baseScope, tasks),
//       extend,
//     }
//   }

//   return { scope: baseScope, extend }
// }

// /**
//  * Example usage for a custom canister
//  */
// export function createCustomCanisterBuilder(canisterId: string) {
//   return createBuilder(canisterId).extend({
//     // Add or override tasks that are specific to a custom canister
//     build: {
//       task: Effect.succeedWith(() => {
//         // e.g. read .wasm / .did and write to artifact
//       }),
//       description: "Build custom canister",
//       tags: [],
//     },
//   })
// }

// /**
//  * Example usage for a Motoko canister
//  */
// export function createMotokoCanisterBuilder(canisterId: string) {
//   return createBuilder(canisterId).extend({
//     build: {
//       task: Effect.succeedWith(() => {
//         // e.g. compile Motoko source -> .wasm
//       }),
//       description: "Build Motoko canister",
//       tags: [],
//     },
//   })
// }

export const Tags = {
  CANISTER: Symbol("canister"),
  GROUP: Symbol("group"),
  TASK: Symbol("task"),
  SCRIPT: Symbol("script"),
}

const taskWithContext = <A, E, R>(Ctx: TaskCtx, task: Task<A, E, R>) => {
  return {
    ...task,
    effect: Effect.gen(function* () {
      const taskCtx = yield* Ctx
      return task.effect(taskCtx)
    }),
  }
}
// TODO: handle scope as well
const scopeWithContext = (Ctx: TaskCtx, scope: Scope) => {
  return {
    ...scope,
    tasks: Object.fromEntries(
      Object.entries(scope.tasks).map(([key, task]) => [
        key,
        taskWithContext(Ctx, task),
      ]),
    ),
  }
}

// TODO: fix
const builderWithContext = <T>(Ctx: TaskCtx, builder: CanisterBuilder<T>) => {
  return {
    ...builder,
    install: (fn) => builderWithContext(Ctx, builder.install(fn)),
    build: (fn) => builderWithContext(Ctx, builder.build(fn)),
  }
}

// TODO: handle better. use effect pattern matching?
const isScope = (task: Task | Scope): task is Scope => {
  return "tasks" in task
}

const isTask = (task: Task | Scope): task is Task => {
  return "task" in task
}

const isBuilder = <I extends Array<any>>(
  task: Task | Scope | CanisterBuilder<I> | MotokoCanisterBuilder,
): task is CanisterBuilder<I> | MotokoCanisterBuilder => {
  return "install" in task || "build" in task
}

const withContext = <I extends Array<any>>(
  Ctx: TaskCtx,
  task: Task | Scope | CanisterBuilder<I> | MotokoCanisterBuilder,
) => {
  if (isBuilder(task)) {
    return builderWithContext(Ctx, task)
  }
  if (isScope(task)) {
    return scopeWithContext(Ctx, task)
  }
  if (isTask(task)) {
    return taskWithContext(Ctx, task)
  }
}

const generatePrincipal = () => {
  // TODO: FIX!!!!
  // NOTE: This is not cryptographically secure - replace with proper implementation later
  const randomBytes = new Uint8Array(29).map(() =>
    Math.floor(Math.random() * 256),
  )
  return Principal.fromUint8Array(randomBytes)
}

type CanisterBuilderCtx = {
  ctx: CrystalCtx
  scope: Scope
}

export type CanisterBuilder<I extends Array<any>> = {
  install: (
    fn: (args: { ctx: TaskCtxShape; mode: string }) => Promise<I>,
  ) => CanisterBuilder<I>
  build: (fn: (args: { ctx: TaskCtxShape }) => Promise<I>) => CanisterBuilder<I>
  // Internal property to store the current scope
  _scope: Scope
}

type CustomCanisterConfig = {
  wasm: string
  candid: string
  // TODO: make optional
  canisterId?: string
}

// TODO: need to group these kinds of tasks
// returns { _tag: "canister", task: () => Promise<{ canister_id: string }> }
// TODO: some kind of metadata?
// TODO: warn about context if not provided
export const createCustomCanisterBuilder = <I extends Array<any> = []>(
  // TODO: rust / motoko / etc.
  ctx: CrystalCtx,
  canisterConfig: CustomCanisterConfig,
) => {
  const canisterId = canisterConfig.canisterId ?? generatePrincipal().toString()
  // TODO: get canisterName!! how???
  const canisterName = canisterId
  // TODO: convert async to effect
  // let effect: Effect.Effect<A, E, R>
  // if (task instanceof Promise) {
  //   effect = Effect.tryPromise<A, E>({
  //     try: () => task,
  //     catch: Effect.fail,
  //   })
  // } else {
  //   const effect = task
  // }
  // type C = Effect.Effect.Context<typeof effect>
  // TODO: use ctx

  // TODO: builder api
  const scope: Scope = {
    tags: [Tags.CANISTER],
    description: "some description",
    // TODO: default implementations
    tasks: {
      // TODO: we need to provide the context. do we do it here or later?
      create: {
        task: Effect.gen(function* () {
          const path = yield* Path.Path
          const fs = yield* FileSystem.FileSystem
          // TODO: maybe we can get the canisterName here through context somehow?
          yield* createCanister(canisterId)
          // TODO: handle errors? what to do if already exists?
          const appDir = yield* Config.string("APP_DIR")
          const canisterName = canisterId
          // TODO: should it be here?
          const outDir = path.join(appDir, ".artifacts", canisterName)
          yield* fs.makeDirectory(outDir, { recursive: true })
          yield* writeCanisterIds(canisterName, canisterId)
          return canisterId
        }),
        description: "some description",
        tags: [],
      },

      // TODO: maybe just the return value of install? like a cleanup
      // delete: {
      //   task: deleteCanister(config),
      //   description: "some description",
      //   tags: [],
      //   ctx: ctx,
      // },

      // TODO: not doing anything!
      build: {
        task: Effect.gen(function* () {
          const taskCtx = yield* TaskCtx
          const { agent, identity } = yield* DfxService

          // we should have access to the wasm and candid here?
          // TODO: write wasm and candid to artifacts!!
          const fs = yield* FileSystem.FileSystem
          const path = yield* Path.Path
          const appDir = yield* Config.string("APP_DIR")
          const outWasmPath = path.join(
            appDir,
            ".artifacts",
            canisterId,
            `${canisterId}.wasm`,
          )
          const wasm = yield* fs.readFile(canisterConfig.wasm)
          yield* fs.writeFile(outWasmPath, wasm)

          const outCandidPath = path.join(
            appDir,
            ".artifacts",
            canisterId,
            `${canisterId}.did`,
          )
          const candid = yield* fs.readFile(canisterConfig.candid)
          yield* fs.writeFile(outCandidPath, candid)
        }),
        description: "some description",
        tags: [],
      },

      install: {
        // TODO: lets fix this!!
        task: Effect.gen(function* () {
          const path = yield* Path.Path
          const fs = yield* FileSystem.FileSystem
          const appDir = yield* Config.string("APP_DIR")
          const wasmPath = path.join(
            appDir,
            ".artifacts",
            canisterId,
            `${canisterId}.wasm`,
          )
          // TODO: generate task? or in build?
          const didJS = yield* generateDIDJS(canisterId, canisterConfig.candid)
          const args = [] as unknown as I
          // TODO: why is this being called??
          const encodedArgs = encodeArgs(args, didJS)
          yield* installCanister({
            encodedArgs,
            canisterId,
            wasmPath,
          })
        }),
        description: "some description",
        tags: [],
      },
    },
  }
  const createBuilder = (ctx: CanisterBuilderCtx): CanisterBuilder<I> => {
    return {
      // TODO: write canisterIds to file
      // TODO: we need to provide the context. do we do it here or later?
      install: (
        fn: (args: { ctx: TaskCtxShape; mode: string }) => Promise<I>,
      ) => {
        type RemainingTasks = Omit<typeof scope.tasks, "install">
        // TODO: is this a flag, arg, or what?
        const mode = "install"
        const builderArgs = {
          ...ctx,
          scope: {
            ...scope,
            tasks: {
              ...scope.tasks,
              install: {
                task: Effect.gen(function* () {
                  // TODO: create service
                  const taskCtx = yield* TaskCtx
                  // TODO: get canisterDID from somewhere
                  const path = yield* Path.Path
                  const fs = yield* FileSystem.FileSystem
                  const appDir = yield* Config.string("APP_DIR")
                  const wasmPath = path.join(
                    appDir,
                    ".artifacts",
                    canisterId,
                    `${canisterId}.wasm`,
                  )
                  // TODO: generate task? or in build?
                  const didJS = yield* generateDIDJS(
                    canisterId,
                    canisterConfig.candid,
                  )
                  const installArgs: I = yield* Effect.tryPromise({
                    // TODO: pass everything
                    try: () => fn({ ctx: taskCtx, mode }),
                    catch: Effect.fail,
                  })
                  const encodedArgs = encodeArgs(installArgs, didJS)
                  yield* installCanister({
                    encodedArgs,
                    canisterId,
                    wasmPath,
                  })
                  //   const canister = yield* createActor({
                  //     canisterId: canisterId,
                  //     canisterDID: didJS,
                  //   })
                }),
                description: "some description",
                tags: [],
              },
            } as RemainingTasks,
          },
        }
        return createBuilder(builderArgs)
      },
      build: (fn) => {
        type RemainingTasks = Omit<typeof scope.tasks, "build">
        const builderArgs = {
          ...ctx,
          scope: {
            ...scope,
            tasks: {
              ...scope.tasks,
              build: {
                task: Effect.gen(function* () {
                  const taskCtx = yield* TaskCtx
                  const { agent, identity } = yield* DfxService

                  // we should have access to the wasm and candid here?
                  // TODO: write wasm and candid to artifacts!!
                  const fs = yield* FileSystem.FileSystem
                  const path = yield* Path.Path
                  const appDir = yield* Config.string("APP_DIR")
                  const outWasmPath = path.join(
                    appDir,
                    ".artifacts",
                    canisterId,
                    `${canisterId}.wasm`,
                  )
                  const wasm = yield* fs.readFile(canisterConfig.wasm)
                  yield* fs.writeFile(outWasmPath, wasm)

                  const outCandidPath = path.join(
                    appDir,
                    ".artifacts",
                    canisterId,
                    `${canisterId}.did`,
                  )
                  const candid = yield* fs.readFile(canisterConfig.candid)
                  yield* fs.writeFile(outCandidPath, candid)

                  yield* Effect.tryPromise({
                    // TODO:
                    try: () => fn({ ctx: taskCtx }),
                    catch: Effect.fail,
                  })
                }),
                description: "some description",
                tags: [],
              },
            } as RemainingTasks,
          },
        }
        return createBuilder(builderArgs)
      },
      // Add scope property to the initial builder
      _scope: ctx.scope,
    }
  }

  return createBuilder({
    ctx,
    scope,
  })
}

type MotokoCanisterConfig = {
  src: string
  canisterId?: string
}

export type MotokoCanisterBuilder = {
  install: <A, E, R>(fn: Task<A, E, R>) => MotokoCanisterBuilder
  build: <A, E, R>(fn: Task<A, E, R>) => MotokoCanisterBuilder
  // Internal property to store the current scope
  _scope: Scope
}

const createMotokoCanisterBuilder = <I extends Array<any>>(
  ctx: CrystalCtx,
  canisterConfig: MotokoCanisterConfig,
) => {
  const canisterId = canisterConfig.canisterId ?? generatePrincipal().toString()
  // TODO: get canisterName!! how???
  const canisterName = canisterId
  const scope: Scope = {
    tags: [Tags.CANISTER],
    description: "some description",
    // TODO: default implementations
    tasks: {
      // TODO: write canisterIds to file
      // TODO: we need to provide the context. do we do it here or later?
      create: {
        task: Effect.gen(function* () {
          const path = yield* Path.Path
          const fs = yield* FileSystem.FileSystem
          // TODO: maybe we can get the canisterName here through context somehow?
          yield* createCanister(canisterId)
          // TODO: handle errors? retry logic? should it be atomic?
          const appDir = yield* Config.string("APP_DIR")
          const canisterName = canisterId
          // TODO: should it be here?
          const outDir = path.join(appDir, ".artifacts", canisterName)
          yield* fs.makeDirectory(outDir, { recursive: true })
          yield* writeCanisterIds(canisterName, canisterId)
          return canisterId
        }),
        description: "some description",
        tags: [],
      },

      // TODO: maybe just the return value of install? like a cleanup
      // delete: {
      //   task: deleteCanister(config),
      //   description: "some description",
      //   tags: [],
      //   ctx: ctx,
      // },

      build: {
        // TODO: needs to return the paths to wasm and candid
        task: Effect.gen(function* () {
          const path = yield* Path.Path
          const fs = yield* FileSystem.FileSystem
          const appDir = yield* Config.string("APP_DIR")
          const canisterName = canisterId
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
        tags: [],
      },
      // TODO: candid declarations
      //   generate: {
      //     task: generateCandidJS(canisterConfig.canisterId),
      //     description: "some description",
      //     tags: [],
      //   },

      install: {
        // task: installCanister({
        //   args: [],
        //   canisterId: canisterId,
        //   // TODO: get candid & wasm
        //   didPath: canisterConfig.candid,
        //   wasmPath: canisterConfig.wasm,
        // }),
        task: Effect.gen(function* () {
          // TODO: run task build task first?
          const path = yield* Path.Path
          const fs = yield* FileSystem.FileSystem
          const appDir = yield* Config.string("APP_DIR")
          const didPath = path.join(
            appDir,
            ".artifacts",
            canisterId,
            `${canisterId}.did`,
          )
          const wasmPath = path.join(
            appDir,
            ".artifacts",
            canisterId,
            `${canisterId}.wasm`,
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
          const canisterDID = yield* generateDIDJS(canisterId, didPath)
          // TODO: define where????
          const args: Array<any> = []
          const encodedArgs = encodeArgs(args, canisterDID)
          yield* installCanister({
            encodedArgs,
            canisterId,
            wasmPath,
          })
        }),
        description: "some description",
        tags: [],
      },
    },
  }
  // TODO: should return scope
  const createBuilder = (ctx: CanisterBuilderCtx): MotokoCanisterBuilder => {
    return {
      install: <A, E, R>(fn: Task<A, E, R>) => {
        type RemainingTasks = Omit<typeof ctx.scope.tasks, "install">
        return createBuilder({
          ...ctx,
          scope: {
            ...ctx.scope,
            tasks: {
              ...ctx.scope.tasks,
              install: fn,
            } as RemainingTasks & { install: Task<A, E, R> },
          },
        })
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
      build: <A, E, R>(fn: Task<A, E, R>) => {
        type RemainingTasks = Omit<typeof ctx.scope.tasks, "build">
        return createBuilder({
          ...ctx,
          scope: {
            ...ctx.scope,
            tasks: {
              ...ctx.scope.tasks,
              build: fn,
            } as RemainingTasks & { build: Task<A, E, R> },
          },
        })
      },
      // Add scope property to the initial builder
      _scope: ctx.scope,
    }
  }

  return createBuilder({
    ctx,
    scope,
  })
}

// TODO: create service?
type CrystalConfig = {
  agent?: Agent
  identity?: Identity
  users?: {
    [key: string]: {
      identity: Identity
      principal: Principal
      accountId: string
    }
  }
  // dfxConfig: DfxConfig
  // tasks: Array<Task>
  // runTask: <T>(taskName: string) => Promise<T>
}

type CrystalBuilder = {
  customCanister: <I extends Array<any>>(
    config: CustomCanisterConfig,
  ) => ReturnType<typeof createCustomCanisterBuilder<I>>
  motokoCanister: <I extends Array<any>>(
    config: MotokoCanisterConfig,
  ) => ReturnType<typeof createMotokoCanisterBuilder<I>>
  // TODO:
  //   rustCanister: (config: RustCanisterConfig) => ReturnType<typeof createRustCanisterBuilder>
  //   azleCanister: (config: AzleCanisterConfig) => ReturnType<typeof createAzleCanisterBuilder>
  provide: (
    ...layers: [
      Layer.Layer<never, any, any>,
      ...Array<Layer.Layer<never, any, any>>,
    ]
  ) => CrystalBuilder
  // script: (config: CanisterConfig) => ScriptBuilder
}

type CrystalCtx = {
  config: CrystalConfig
  dependencies?: Layer.Layer<never, any, any>
}

// TODO: can we make this async as well?
export const Crystal = (config?: CrystalConfig) => {
  const tag = Context.Tag("crystal")

  // const createScriptBuilder = (ctx: Ctx, config: CanisterConfig): ScriptBuilder => {
  //   // TODO:
  // }

  // TODO: rename ctx to runtime or config or something??
  const createCrystalBuilder = (ctx: CrystalCtx): CrystalBuilder => {
    // TODO: pass crystalConfig
    return {
      customCanister: <I extends Array<any>>(
        canisterConfig: CustomCanisterConfig,
      ) => createCustomCanisterBuilder<I>(ctx, canisterConfig),
      motokoCanister: <I extends Array<any>>(
        canisterConfig: MotokoCanisterConfig,
      ) => createMotokoCanisterBuilder<I>(ctx, canisterConfig),
      // script: (config: CanisterConfig) => createScriptBuilder(config),
      // script: (config: CanisterConfig) => createScriptBuilder(config),
      // TODO: support scopes?
      withContext: (
        fn: (ctx: TaskCtxShape) => Promise<CanisterBuilder<any>>,
      ) => {
        // TODO: is it a higher order task?
        // TODO: we need to wrap all the tasks
        return withContext(ctx, fn)
      },
      provide: (
        ...layers: [
          Layer.Layer<never, any, any>,
          ...Array<Layer.Layer<never, any, any>>,
        ]
      ) => {
        const layer = Layer.mergeAll(...layers)
        // TODO: service provide to tasks
        // TODO: runtime??
        // TODO: keep in closure
        return createCrystalBuilder({
          ...ctx,
          dependencies: layer,
        })
      },
    }
  }

  return createCrystalBuilder({
    config: config ?? {},
  })
}
