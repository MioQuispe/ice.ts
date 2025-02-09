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
  candidUITaskPlugin,
} from "../index.js"
import type { Actor, HttpAgent, Identity } from "@dfinity/agent"
import type { Agent } from "@dfinity/agent"
import type {
  BuilderResult,
  CrystalContext,
  Scope,
  Task,
  TaskTree,
  TaskTreeNode,
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
  CANISTER: "$$crystal/canister",
  CREATE: "$$crystal/create",
  BUILD: "$$crystal/build",
  INSTALL: "$$crystal/install",
  BINDINGS: "$$crystal/bindings",
  DEPLOY: "$$crystal/deploy",
  DELETE: "$$crystal/delete",
  UI: "$$crystal/ui",
  // TODO: hmm do we need this?
  SCRIPT: "$$crystal/script",
}

// TODO: later
// candidUITaskPlugin()
const plugins = <T extends TaskTreeNode>(taskTree: T) =>
  deployTaskPlugin(taskTree)

const testTask = {
  _tag: "task",
  id: Symbol("test"),
  dependencies: {},
  provide: {},
  effect: Effect.gen(function* () {}),
  description: "",
  tags: [],
} satisfies Task

const testTask2 = {
  _tag: "task",
  id: Symbol("test"),
  dependencies: {},
  provide: {},
  effect: Effect.gen(function* () {}),
  description: "",
  tags: [],
} satisfies Task

const providedTask = {
  _tag: "task",
  id: Symbol("test"),
  effect: Effect.gen(function* () {}),
  description: "",
  tags: [],
  dependencies: {
    test: testTask,
  },
  provide: {
    test: testTask,
  },
} satisfies Task

const unProvidedTask = {
  _tag: "task",
  id: Symbol("test"),
  effect: Effect.gen(function* () {}),
  description: "",
  tags: [],
  dependencies: {
    test: testTask,
    test2: testTask,
  },
  provide: {
    test: testTask,
    // TODO: does not raise a warning?
    // test2: testTask2,
    // test2: testTask,
    // test3: testTask,
  },
} satisfies Task

const unProvidedTask2 = {
  _tag: "task",
  id: Symbol("test"),
  effect: Effect.gen(function* () {}),
  description: "",
  tags: [],
  dependencies: {
    test: testTask,
    // test2: testTask,
  },
  provide: {
    // test: testTask,
    // TODO: does not raise a warning?
    // test2: testTask2,
    // test2: testTask,
    // test3: testTask,
  },
} satisfies Task

const testScope = {
  _tag: "scope",
  tags: [Tags.CANISTER],
  description: "",
  children: {
    providedTask,
    unProvidedTask,
  },
} satisfies CanisterScope

const testScope2 = {
  _tag: "scope",
  tags: [Tags.CANISTER],
  description: "",
  children: {
    unProvidedTask2,
  },
} satisfies CanisterScope

const providedTestScope = {
  _tag: "scope",
  tags: [Tags.CANISTER],
  description: "",
  children: {
    providedTask,
  },
} satisfies CanisterScope

type DependenciesOf<T> = T extends { dependencies: infer D } ? D : never
type ProvideOf<T> = T extends { provide: infer P } ? P : never
export type DepBuilder<T> =
  DependenciesOf<T> extends ProvideOf<T>
    ? ProvideOf<T> extends DependenciesOf<T>
      ? T
      : never
    : never
export type UniformScopeCheck<S extends CanisterScope> = S extends {
  children: infer C
}
  ? C extends { [K in keyof C]: DepBuilder<C[K]> }
    ? S
    : DependencyMismatchError
  : DependencyMismatchError

/**
 * Update a task's dependencies by merging its current dependencies with ND.
 */
// type MergeTaskDependencies<
//   T extends { dependencies: Record<string, Task> },
//   ND extends Record<string, Task>,
// > = Omit<T, "dependencies"> & {
//   dependencies: T["dependencies"] & ND
// }

// /**
//  * For each key in the children record (which are tasks),
//  * update the task's dependencies using MergeTaskDependencies.
//  */
// type UpdateChildrenDeps<
//   C extends Record<string, Task>,
//   ND extends Record<string, Task>,
// > = {
//   [K in keyof C]: C[K] extends { dependencies: Record<string, Task> }
//     ? MergeTaskDependencies<C[K], ND>
//     : C[K]
// }

/**
 * Merge new dependencies ND into the entire scope, updating
 * each task in `children` so that its dependencies become:
 * its existing dependencies & ND.
 */
// type MergeScopeDependencies<
//   S extends CanisterScope,
//   ND extends Record<string, Task>,
// > = Omit<S, "children"> & {
//   children: UpdateChildrenDeps<S["children"], ND>
// }

/**
 * Merge a task's dependencies with a new dependency record ND,
 * preserving exact optional property modifiers.
 */
// type MergeTaskDeps<
//   T extends Task,
//   ND extends Record<string, Task>
// > = {
//   [K in keyof T]: K extends "dependencies" ? T[K] & ND : T[K]
// }

type MergeTaskDeps<T extends Task, ND extends Record<string, Task>> = 
  Omit<T, "dependencies"> & { dependencies: ND }

type MergeTaskProvide<T extends Task, NP extends Record<string, Task>> = 
  Omit<T, "provide"> & { provide: NP }

/**
 * Update every task in the children record by merging in ND.
 */
type MergeAllChildrenDeps<
  C extends Record<string, Task>,
  ND extends Record<string, Task>
> = {
  [K in keyof C]: MergeTaskDeps<C[K], ND>
}

type MergeAllChildrenProvide<
  C extends Record<string, Task>,
  NP extends Record<string, Task>
> = {
  [K in keyof C]: MergeTaskProvide<C[K], NP>
}
/**
 * Merge new dependencies ND into the entire scope S by updating its children.
 */
type MergeScopeDependencies<
  S extends CanisterScope,
  ND extends Record<string, Task>
> = Omit<S, "children"> & {
  children: MergeAllChildrenDeps<S["children"], ND>
}

type MergeScopeProvide<S extends CanisterScope, NP extends Record<string, Task>> = Omit<S, "children"> & {
  children: MergeAllChildrenProvide<S["children"], NP>
}

// export type UpdatedDeps<S extends CanisterScope, ND extends Record<string, Task>> = {
//   [K in keyof S["children"]]: S["children"][K] extends Task
//     ? ND[K] extends S["children"][K]
//       ? S["children"][K]
//       : never
//     : never
// }

// Type checks
// const pt = providedTask satisfies DepBuilder<typeof providedTask>
// const upt = unProvidedTask satisfies DepBuilder<typeof unProvidedTask>
// const uts = testScope satisfies UniformScopeCheck<typeof testScope>
// const pts = providedTestScope satisfies UniformScopeCheck<
//   typeof providedTestScope
// >
// const uts2 = testScope2 satisfies UniformScopeCheck<typeof testScope2>

/**
 * @doc
 * [ERROR] Missing required dependencies:
 * Please call .setDependencies() with all required keys before finalizing the builder.
 */
export type DependencyMismatchError = {
  // This property key is your custom error message.
  "[CRYSTAL-ERROR: Dependency mismatch. Please provide all required dependencies.]": true
}

// Compute a boolean flag from our check.
export type IsValid<S extends CanisterScope> =
  UniformScopeCheck<S> extends DependencyMismatchError ? false : true

export interface CanisterBuilder<
  I,
  S extends CanisterScope,
  D extends Record<string, Task>,
  P extends Record<string, Task>,
> {
  create: (
    canisterConfigOrFn:
      | CustomCanisterConfig
      | ((ctx: TaskCtxShape) => CustomCanisterConfig)
      | ((ctx: TaskCtxShape) => Promise<CustomCanisterConfig>),
  ) => CanisterBuilder<I, S, D, P>
  install: (
    installArgsOrFn:
      | ((args: { ctx: TaskCtxShape; mode: string }) => Promise<I>)
      | ((args: { ctx: TaskCtxShape; mode: string }) => I)
      | I,
  ) => CanisterBuilder<I, S, D, P>
  build: (
    canisterConfigOrFn:
      | CustomCanisterConfig
      | ((ctx: TaskCtxShape) => CustomCanisterConfig)
      | ((ctx: TaskCtxShape) => Promise<CustomCanisterConfig>),
  ) => CanisterBuilder<I, S, D, P>
  deps: <ND extends Record<string, Task>>(
    deps: ND,
  ) => CanisterBuilder<I, MergeScopeDependencies<S, ND>, D & ND, P>
  provide: <NP extends Record<string, Task>>(
    providedDeps: NP,
  ) => CanisterBuilder<I, MergeScopeProvide<S, NP>, D, P & NP>
  // done: () => UniformScopeCheck<S extends CanisterScope ? S : never>
  // done: () => S
  /**
   * Finalizes the builder state.
   *
   * This method is only callable if the builder is in a valid state. If not,
   * the builder does not have the required dependency fields and this method
   * will produce a compile-time error with a descriptive message.
   *
   * @returns The finalized builder state if valid.
   */
  done(
    this: IsValid<S> extends true
      ? CanisterBuilder<I, S, D, P>
      : DependencyMismatchError,
  ): UniformScopeCheck<S>

  // TODO:
  //   bindings: (fn: (args: { ctx: TaskCtxShape }) => Promise<I>) => CanisterBuilder<I>
  // Internal property to store the current scope
  _scope: S
  // TODO: use BuilderResult?
  _tag: "builder"
}

type CustomCanisterConfig = {
  wasm: string
  candid: string
  // TODO: make optional
  canisterId?: string
}

export type CanisterScope = {
  _tag: "scope"
  tags: Array<string>
  description: string
  // only limited to tasks
  children: Record<string, Task>
}

export const makeBindingsTask = () => {
  return {
    _tag: "task",
    id: Symbol("customCanister/bindings"),
    dependencies: {},
    provide: {},
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
  } satisfies Task
}

export const makeInstallTask = <I>(
  installArgsOrFn?:
    | ((args: { ctx: TaskCtxShape; mode: string }) => Promise<I>)
    | ((args: { ctx: TaskCtxShape; mode: string }) => I)
    | I,
) => {
  return {
    _tag: "task",
    id: Symbol("customCanister/install"),
    dependencies: {},
    provide: {},
    effect: Effect.gen(function* () {
      yield* Effect.logInfo("Starting custom canister installation")
      const taskCtx = yield* TaskCtx
      const { dependencies } = yield* DependencyResults

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
      const finalCtx = {
        ...taskCtx,
        dependencies,
      }
      if (installArgsOrFn) {
        yield* Effect.logInfo("Executing install args function")

        if (typeof installArgsOrFn === "function") {
          const installFn = installArgsOrFn as (args: {
            ctx: TaskCtxShape
            mode: string
          }) => Promise<I> | I
          // TODO: handle different modes
          const installResult = installFn({
            mode: "install",
            ctx: finalCtx,
          })
          if (installResult instanceof Promise) {
            installArgs = yield* Effect.tryPromise({
              try: () => installResult,
              catch: (error) => {
                console.error("Error resolving config function:", error)
                return error instanceof Error ? error : new Error(String(error))
              },
            })
          } else {
            installArgs = installResult
          }
        }
        // installArgs = yield* Effect.tryPromise({
        //   // TODO: pass everything
        //   try: () => fn({ ctx: finalCtx, mode: "install" }),
        //   catch: Effect.fail, // TODO: install args fail? proper error handling
        // })
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
  } satisfies Task
}

const makeBuildTask = (
  canisterConfigOrFn:
    | ((ctx: TaskCtxShape) => Promise<CustomCanisterConfig>)
    | ((ctx: TaskCtxShape) => CustomCanisterConfig)
    | CustomCanisterConfig,
) => {
  return {
    _tag: "task",
    id: Symbol("customCanister/build"),
    dependencies: {},
    provide: {},
    effect: Effect.gen(function* () {
      const taskCtx = yield* TaskCtx
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const appDir = yield* Config.string("APP_DIR")
      // TODO: could be a promise
      const canisterConfig = yield* resolveConfig(canisterConfigOrFn)
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

      // if (fn) {
      //   yield* Effect.tryPromise({
      //     // TODO: why are we passing this in?
      //     try: () => fn(taskCtx),
      //     catch: Effect.fail,
      //   })
      // }
    }),
    description: "some description",
    tags: [Tags.CANISTER, Tags.BUILD],
  } satisfies Task
}

export const resolveConfig = <T>(
  configOrFn:
    | ((ctx: TaskCtxShape) => Promise<T>)
    | ((ctx: TaskCtxShape) => T)
    | T,
) =>
  Effect.gen(function* () {
    const taskCtx = yield* TaskCtx
    if (typeof configOrFn === "function") {
      const configFn = configOrFn as (ctx: TaskCtxShape) => Promise<T> | T
      const configResult = configFn(taskCtx)
      if (configResult instanceof Promise) {
        return yield* Effect.tryPromise({
          try: () => configResult,
          catch: (error) => {
            console.error("Error resolving config function:", error)
            return error instanceof Error ? error : new Error(String(error))
          },
        })
      }
      return configResult
    }
    return configOrFn
  })

type CreateConfig = {
  canisterId?: string
}
export const makeCreateTask = (
  canisterConfigOrFn:
    | ((ctx: TaskCtxShape) => Promise<CreateConfig>)
    | ((ctx: TaskCtxShape) => CreateConfig)
    | CreateConfig,
) => {
  const id = Symbol("customCanister/create")
  return {
    _tag: "task",
    id,
    dependencies: {},
    provide: {},
    effect: Effect.gen(function* () {
      const path = yield* Path.Path
      const fs = yield* FileSystem.FileSystem
      const taskCtx = yield* TaskCtx
      const canisterConfig = yield* resolveConfig(canisterConfigOrFn)
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
  } satisfies Task
}

const makeCustomCanisterBuilder = <
  I,
  S extends CanisterScope,
  D extends Record<string, Task>,
  P extends Record<string, Task>,
>(
  scope: S,
): CanisterBuilder<I, S, D, P> => {
  return {
    create: (canisterConfigOrFn) => {
      const updatedScope = {
        ...scope,
        children: {
          ...scope.children,
          create: makeCreateTask(canisterConfigOrFn),
        },
      } satisfies CanisterScope
      return makeCustomCanisterBuilder<I, typeof updatedScope, D, P>(
        updatedScope,
      )
    },
    install: (installArgsOrFn) => {
      // TODO: is this a flag, arg, or what?
      const mode = "install"
      // TODO: passing in I makes the return type: any
      const updatedScope = {
        ...scope,
        children: {
          ...scope.children,
          install: makeInstallTask(installArgsOrFn),
        },
      } satisfies CanisterScope
      // TODO: updatedScope is not typed correctly
      return makeCustomCanisterBuilder<I, typeof updatedScope, D, P>(
        updatedScope,
      )
    },
    build: (canisterConfigOrFn) => {
      const updatedScope = {
        ...scope,
        children: {
          ...scope.children,
          build: makeBuildTask(canisterConfigOrFn),
        },
      } satisfies CanisterScope
      return makeCustomCanisterBuilder<I, typeof updatedScope, D, P>(
        updatedScope,
      )
    },
    // Here we extract the real tasks from the deps
    // is it enough to compare symbols?
    deps: (dependencies) => {
      // TODO: check that its a canister builder
      // const dependencies = Object.fromEntries(
      //   Object.entries(deps).map(([key, dep]) => {
      //     // if (dep._tag === "builder") {
      //     //   return dep._scope.children.deploy
      //     // }
      //     // if (dep._tag === "scope") {
      //     //   return [key, dep.children.deploy]
      //     // }
      //     if (dep._tag === "task") {
      //       return [key, dep]
      //     }
      //     return [key, dep]
      //   }),
      // ) satisfies Record<string, Task> as MergeScopeDependencies<S, typeof deps>

      const updatedScope = {
        ...scope,
        children: {
          ...scope.children,
          install: {
            ...scope.children.install,
            dependencies,
          },
        },
      } satisfies CanisterScope as MergeScopeDependencies<S, typeof dependencies>

      return makeCustomCanisterBuilder<
        I,
        typeof updatedScope,
        // TODO: update type?
        typeof dependencies,
        P
      >(updatedScope)
    },

    provide: (providedDeps) => {
      // TODO: do we transform here?
      // TODO: do we type check here?
      // const finalDeps = Object.fromEntries(
      //   Object.entries(providedDeps).map(([key, dep]) => {
      //     // if (dep._tag === "builder") {
      //     //   return dep._scope.children.deploy
      //     // }
      //     // if (dep._tag === "scope" && dep.children.deploy) {
      //     //   return [key, dep.children.deploy]
      //     // }
      //     return [key, dep as Task]
      //   }),
      // ) satisfies Record<string, Task>
      // const finalDeps = providedDeps

      // TODO: do we need to pass in to create as well?
      const updatedScope = {
        ...scope,
        children: {
          ...scope.children,
          install: {
            ...scope.children.install,
            provide: providedDeps,
          },
        },
      } satisfies CanisterScope as MergeScopeProvide<S, typeof providedDeps>

      return makeCustomCanisterBuilder<
        I,
        typeof updatedScope,
        D,
        // TODO: update type?
        typeof providedDeps
      >(updatedScope)
    },

    done: () => {
      return scope as unknown as UniformScopeCheck<S>
    },

    // Add scope property to the initial builder
    _scope: scope,
    _tag: "builder",
  }
}

// TODO: some kind of metadata?
// TODO: warn about context if not provided
export const customCanister = <I = unknown>(
  canisterConfigOrFn:
    | ((ctx: TaskCtxShape) => Promise<CustomCanisterConfig>)
    | ((ctx: TaskCtxShape) => CustomCanisterConfig)
    | CustomCanisterConfig,
) => {
  const initialScope = {
    _tag: "scope",
    tags: [Tags.CANISTER],
    description: "some description",
    // TODO: default implementations
    children: {
      create: makeCreateTask(canisterConfigOrFn),
      bindings: makeBindingsTask(),

      // TODO: maybe just the return value of install? like a cleanup
      // delete: {
      //   task: deleteCanister(config),
      //   description: "some description",
      //   tags: [],
      //   ctx: ctx,
      // },
      build: makeBuildTask(canisterConfigOrFn),
      // install: makeInstallTask<I>(),
      install: makeInstallTask<I>(),
    },
  } satisfies CanisterScope

  return makeCustomCanisterBuilder<
    I,
    typeof initialScope,
    Record<string, Task>,
    Record<string, Task>
  >(initialScope)
}

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

export const canisterBuildGuard = Effect.gen(function* () {
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

const test = customCanister(async () => ({
  wasm: "",
  candid: "",
}))

const t = test.deps({ asd: test._scope.children.create }).provide({
  asd: test._scope.children.create,
}).done()
// t.children.install.dependencies
