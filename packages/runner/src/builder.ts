import { Layer, Effect, Context, Data, Config } from "effect"
import { createCanister, installCanister, compileMotokoCanister, generateCandidJS } from "./index.js"
import type { Identity } from "@dfinity/agent"
import type { Agent } from "@dfinity/agent"
import type { Scope, Task } from "./types"
import { Principal } from "@dfinity/principal"
// import mo from "motoko"
import process from "node:process"
import { execFileSync } from "node:child_process"
import { Path, FileSystem, Command, CommandExecutor } from "@effect/platform"
import { Moc } from "./services/moc.js"

export const Tags = {
  CANISTER: Symbol("canister"),
  GROUP: Symbol("group"),
  TASK: Symbol("task"),
  SCRIPT: Symbol("script"),
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

type CanisterConfig = {
  src: string
  wasm: string
  candid: string
  // TODO: make optional
  canisterId: string
}

// TODO: need to group these kinds of tasks
// returns { _tag: "canister", task: () => Promise<{ canister_id: string }> }
// TODO: some kind of metadata?
// TODO: warn about context if not provided
export const createCanisterBuilder = (
  // TODO: rust / motoko / etc.
  ctx: CrystalCtx,
  canisterConfig: CanisterConfig,
) => {
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
        task: createCanister(canisterConfig.canisterId),
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

      //   build: {
      //     task: buildCanister,
      //     description: "some description",
      //     tags: [],
      //   },

      install: {
        task: installCanister({
          args: [],
          canisterId: canisterConfig.canisterId,
          didPath: canisterConfig.candid,
          wasmPath: canisterConfig.wasm,
        }),
        description: "some description",
        tags: [],
      },
    },
  }
  const canisterBuilder = (ctx: CanisterBuilderCtx) => {
    return {
      install: <A, E, R>(fn: Task<A, E, R>) => {
        type RemainingTasks = Omit<typeof ctx.scope.tasks, "install">
        return canisterBuilder({
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
        return canisterBuilder({
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
    }
  }

  return canisterBuilder({
    ctx,
    scope,
  })
}

type MotokoCanisterConfig = {
  src: string
  canisterId?: string
}

const createMotokoCanisterBuilder = (
  ctx: CrystalCtx,
  canisterConfig: MotokoCanisterConfig,
) => {
  const canisterId = canisterConfig.canisterId ?? generatePrincipal().toString()
  const scope: Scope = {
    tags: [Tags.CANISTER],
    description: "some description",
    // TODO: default implementations
    tasks: {
      // TODO: we need to provide the context. do we do it here or later?
      create: {
        task: createCanister(canisterId),
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
        task: compileMotokoCanister(canisterConfig.src, canisterId),
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
          const didPath = path.join(appDir, ".artifacts", canisterId, `${canisterId}.did`)
          const wasmPath = path.join(appDir, ".artifacts", canisterId, `${canisterId}.wasm`)
          const didExists = yield* fs.exists(didPath)
          if (!didExists) {
            yield* Effect.fail(new Error("Candid file not found"))
          }
          const wasmExists = yield* fs.exists(wasmPath)
          if (!wasmExists) {
            yield* Effect.fail(new Error("Wasm file not found"))
          }
          yield* installCanister({
            args: [],
            canisterId: canisterId,
            didPath,
            wasmPath,
          })
        }),
        description: "some description",
        tags: [],
      },
    },
  }
  // TODO: should return scope
  const motokoCanisterBuilder = (ctx: CanisterBuilderCtx) => {
    return {
      install: <A, E, R>(fn: Task<A, E, R>) => {
        type RemainingTasks = Omit<typeof ctx.scope.tasks, "install">
        return motokoCanisterBuilder({
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
        return motokoCanisterBuilder({
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
    }
  }

  return motokoCanisterBuilder({
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

type BuildContext = {
  runTask: <T>(taskName: string) => Promise<T>
  buildCustom: (config: CanisterConfig) => Promise<any>
  compile: (config: CanisterConfig) => Promise<any>
}

type CrystalBuilder = {
  canister: (config: CanisterConfig) => ReturnType<typeof createCanisterBuilder>
  motokoCanister: (
    config: MotokoCanisterConfig,
  ) => ReturnType<typeof createMotokoCanisterBuilder>
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

export const Crystal = (config?: CrystalConfig) => {
  const tag = Context.Tag("crystal")

  // const createScriptBuilder = (ctx: Ctx, config: CanisterConfig): ScriptBuilder => {
  //   // TODO:
  // }

  const createCrystalBuilder = (ctx: CrystalCtx): CrystalBuilder => {
    // TODO: pass crystalConfig
    return {
      canister: (canisterConfig) => createCanisterBuilder(ctx, canisterConfig),
      motokoCanister: (canisterConfig) =>
        createMotokoCanisterBuilder(ctx, canisterConfig),
      // script: (config: CanisterConfig) => createScriptBuilder(config),
      // script: (config: CanisterConfig) => createScriptBuilder(config),
      provide: (...layers) => {
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

// const Crystal = (ctx: Ctx) => {
//   const tag = Context.Tag("crystal")
//   // TODO: create layers from ctx
//   // TODO: Layer.mergeAll
//   const context = {}

//   // TODO: nope this is only for the default context
//   // TODO: these are treated the same as tasks that are required
//   // const context = {
//   //   agent: Agent.make(),
//   //   identity: Identity.make(),
//   //   users: {},
//   //   fs: FileSystem.make(),
//   //   path: Path.make(),
//   //   dfxConfig: DfxConfig.make(),
//   //   runTask: (taskName) => Promise.resolve(taskName),
//   //   ...ctx,
//   // }

//   return {
//     context,
//     // TODO: maybe make sure that the context is already provided? R should match the tasks R?
//     canister: <A, E, R>(task: Task<A, E, R>) => {
//       // TODO: this needs to warn if service is used which hasnt been provided
//       // so we need to ...?
//       // TODO: figure out where effect warns about services which have not been provided
//       // it happens at the runtime / .runPromise part
//       // Extract the context type, which is SomeContext
//       // type R = Effect.Effect.Context<typeof task>
//       return CanisterBuilder(context, task)
//     },

//     // script: <A, E, R>(task: Task<A, E, R>) => {
//     //   return script(context, task)
//     // },

//     provide: (
//       ...layers: [
//         Layer.Layer<never, any, any>,
//         ...Array<Layer.Layer<never, any, any>>,
//       ]
//     ) => {
//       const layer = Layer.mergeAll(...layers)
//       // TODO: service provide to tasks
//       // TODO: runtime??
//       // TODO: keep in closure
//       return Crystal({ ...ctx })
//     },
//   }
// }
