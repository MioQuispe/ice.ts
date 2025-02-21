import { Effect, Context, Config, Option } from "effect"
import {
  createCanister,
  installCanister,
  compileMotokoCanister,
  encodeArgs,
  generateDIDJS,
  TaskCtx,
  type TaskCtxShape,
  createActor,
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
  ICEContext,
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
import {
  canisterBuildGuard,
  makeInstallTask,
  makeCreateTask,
  loadCanisterId,
  resolveConfig,
  makeStopTask,
  iceDirName,
} from "./custom.js"
import type {
  CanisterBuilder,
  CanisterScope,
  UniformScopeCheck,
  DependencyMismatchError,
  IsValid,
  MergeScopeDependencies,
  MergeScopeProvide,
  ExtractProvidedDeps,
  ExtractTaskEffectSuccess,
} from "./types.js"
import { Tags } from "./types.js"

type MotokoCanisterConfig = {
  src: string
  canisterId?: string
}


export const makeMotokoBindingsTask = (
) => {
  return {
    _tag: "task",
    id: Symbol("motokoCanister/bindings"),
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
      yield* Effect.logDebug(`Bindings build guard check passed for ${canisterName}`)

      const wasmPath = path.join(
        appDir,
        iceDirName,
        "canisters",
        canisterName,
        `${canisterName}.wasm`,
      )
      const didPath = path.join(
        appDir,
        iceDirName,
        "canisters",
        canisterName,
        `${canisterName}.did`,
      )
      yield* Effect.logDebug("Artifact paths", { wasmPath, didPath })

      // yield* fs.makeDirectory(path.dirname(didPath), { recursive: true })
      yield* fs.makeDirectory(path.dirname(wasmPath), { recursive: true })

      yield* generateDIDJS(canisterName, didPath)
      yield* Effect.logDebug(`Generated DID JS for ${canisterName}`)
    }),
    description: "some description",
    tags: [Tags.CANISTER, Tags.MOTOKO, Tags.BINDINGS],
    computeCacheKey: Option.none(),
    input: Option.none(),
  } satisfies Task
}

// const plugins = <T extends TaskTreeNode>(taskTree: T) =>
//   deployTaskPlugin(taskTree)

const makeMotokoBuildTask = (
  canisterConfigOrFn:
    | ((args: { ctx: TaskCtxShape }) => Promise<MotokoCanisterConfig>)
    | ((args: { ctx: TaskCtxShape }) => MotokoCanisterConfig)
    | MotokoCanisterConfig,
) => {
  return {
    _tag: "task",
    id: Symbol("motokoCanister/build"),
    dependencies: {},
    provide: {},
    input: Option.none(),
    computeCacheKey: Option.none(),
    effect: Effect.gen(function* () {
      const path = yield* Path.Path
      const fs = yield* FileSystem.FileSystem
      const appDir = yield* Config.string("APP_DIR")
      const { taskPath } = yield* TaskInfo
      const canisterConfig = yield* resolveConfig(canisterConfigOrFn)
      const canisterName = taskPath.split(":").slice(0, -1).join(":")
      const wasmOutputFilePath = path.join(
        appDir,
        iceDirName,
        "canisters",
        canisterName,
        `${canisterName}.wasm`,
      )
      // Ensure the directory exists
      yield* fs.makeDirectory(path.dirname(wasmOutputFilePath), { recursive: true })
      yield* compileMotokoCanister(
        path.resolve(appDir, canisterConfig.src),
        canisterName,
        wasmOutputFilePath,
      )
    }),
    description: "some description",
    tags: [Tags.CANISTER, Tags.MOTOKO, Tags.BUILD],
  } satisfies Task
}

const makeMotokoDeleteTask = (): Task => {
  return {
    _tag: "task",
    id: Symbol("motokoCanister/delete"),
    dependencies: {},
    provide: {},
    input: Option.none(),
    computeCacheKey: Option.none(),
    effect: Effect.gen(function* () {
      // yield* deleteCanister(canisterId)
    }),
    description: "some description",
    tags: [Tags.CANISTER, Tags.MOTOKO, Tags.DELETE],
  }
}

export const makeMotokoBuilder = <
  I,
  S extends CanisterScope,
  D extends Record<string, Task>,
  P extends Record<string, Task>,
  Config extends MotokoCanisterConfig,
  _SERVICE = unknown,
>(
  scope: S,
): CanisterBuilder<I, S, D, P, Config> => {
  return {
    create: (canisterConfigOrFn) => {
      const updatedScope = {
        ...scope,
        children: {
          ...scope.children,
          create: makeCreateTask(canisterConfigOrFn, [Tags.MOTOKO]),
        },
      } satisfies CanisterScope
      return makeMotokoBuilder<I, typeof updatedScope, D, P, Config, _SERVICE>(
        updatedScope,
      )
    },

    installArgs: (installArgsFn) => {
      // TODO: is this a flag, arg, or what?
      const mode = "install"
      // we need to inject dependencies again! or they can be overwritten
      const dependencies = scope.children.install.dependencies
      const provide = scope.children.install.provide
      const installTask = makeInstallTask<
        I,
        ExtractTaskEffectSuccess<D> & ExtractTaskEffectSuccess<P>,
        _SERVICE
      >(installArgsFn)
      const updatedScope = {
        ...scope,
        children: {
          ...scope.children,
          install: {
            ...installTask,
            dependencies,
            provide,
          },
        },
      } satisfies CanisterScope
      return makeMotokoBuilder<I, typeof updatedScope, D, P, Config, _SERVICE>(
        updatedScope,
      )
    },

    build: (canisterConfigOrFn) => {
      const updatedScope = {
        ...scope,
        children: {
          ...scope.children,
          build: makeMotokoBuildTask(canisterConfigOrFn),
        },
      } satisfies CanisterScope
      return makeMotokoBuilder<I, typeof updatedScope, D, P, Config, _SERVICE>(
        updatedScope,
      )
    },

    dependsOn: (dependencies) => {
      // TODO: check that its a canister builder
      const finalDeps = Object.fromEntries(
        Object.entries(dependencies).map(([key, dep]) => {
          // if (dep._tag === "builder") {
          //   return dep._scope.children.deploy
          // }
          // if (dep._tag === "scope" && dep.children.deploy) {
          //   return [key, dep.children.deploy]
          // }
          if ("provides" in dep) {
            return [key, dep.provides]
          }
          return [key, dep satisfies Task]
        }),
      ) satisfies Record<string, Task>

      const updatedScope = {
        ...scope,
        children: {
          ...scope.children,
          install: {
            ...scope.children.install,
            dependencies: finalDeps,
          },
        },
      } satisfies CanisterScope as MergeScopeDependencies<
        S,
        ExtractProvidedDeps<typeof dependencies>
      >

      return makeMotokoBuilder<
        I,
        typeof updatedScope,
        // TODO: update type?
        ExtractProvidedDeps<typeof dependencies>,
        P,
        Config
      >(updatedScope)
    },

    deps: (providedDeps) => {
      // TODO: do we transform here?
      // TODO: do we type check here?
      const finalDeps = Object.fromEntries(
        Object.entries(providedDeps).map(([key, dep]) => {
          // if (dep._tag === "builder") {
          //   return dep._scope.children.deploy
          // }
          // if (dep._tag === "scope" && dep.children.deploy) {
          //   return [key, dep.children.deploy]
          // }
          if ("provides" in dep) {
            return [key, dep.provides]
          }
          return [key, dep satisfies Task]
        }),
      ) satisfies Record<string, Task>

      // TODO: do we need to pass in to create as well?
      const updatedScope = {
        ...scope,
        children: {
          ...scope.children,
          install: {
            ...scope.children.install,
            provide: finalDeps,
          },
        },
      } satisfies CanisterScope as MergeScopeProvide<
        S,
        ExtractProvidedDeps<typeof providedDeps>
      >

      return makeMotokoBuilder<
        I,
        typeof updatedScope,
        D,
        // TODO: update type?
        ExtractProvidedDeps<typeof providedDeps>,
        Config
      >(updatedScope)
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

    done: () => {
      return scope as unknown as UniformScopeCheck<S>
    },

    // Add scope property to the initial builder
    _tag: "builder",
  }
}

export const motokoCanister = <I = unknown, _SERVICE = unknown>(
  canisterConfigOrFn:
    | MotokoCanisterConfig
    | ((args: { ctx: TaskCtxShape }) => MotokoCanisterConfig)
    | ((args: { ctx: TaskCtxShape }) => Promise<MotokoCanisterConfig>),
) => {
  // TODO: maybe just the return value of install? like a cleanup
  // delete: {
  //   task: deleteCanister(config),
  //   description: "some description",
  //   tags: [],
  //   ctx: ctx,
  // },
  const initialScope = {
    _tag: "scope",
    tags: [Tags.CANISTER, Tags.MOTOKO],
    description: "some description",
    defaultTask: Option.none(),
    children: {
      create: makeCreateTask(canisterConfigOrFn, [Tags.MOTOKO]),
      build: makeMotokoBuildTask(canisterConfigOrFn),
      bindings: makeMotokoBindingsTask(),
      stop: makeStopTask(),
      // delete: createDeleteTask(),
      install: makeInstallTask<I, Record<string, unknown>, _SERVICE>(),
    },
  } satisfies CanisterScope

  return makeMotokoBuilder<
    I,
    typeof initialScope,
    Record<string, Task>,
    Record<string, Task>,
    MotokoCanisterConfig,
    _SERVICE
  >(initialScope)
}

const testTask = {
  _tag: "task",
  id: Symbol("test"),
  dependencies: {},
  provide: {},
  effect: Effect.gen(function* () {}),
  description: "",
  tags: [],
  computeCacheKey: Option.none(),
  input: Option.none(),
} satisfies Task

const testTask2 = {
  _tag: "task",
  id: Symbol("test"),
  dependencies: {},
  provide: {},
  effect: Effect.gen(function* () {}),
  description: "",
  tags: [],
  computeCacheKey: Option.none(),
  input: Option.none(),
} satisfies Task

const providedTask = {
  _tag: "task",
  id: Symbol("test"),
  effect: Effect.gen(function* () {}),
  description: "",
  tags: [],
  computeCacheKey: Option.none(),
  input: Option.none(),
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
  computeCacheKey: Option.none(),
  input: Option.none(),
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
  computeCacheKey: Option.none(),
  input: Option.none(),
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
  defaultTask: Option.none(),
  children: {
    providedTask,
    unProvidedTask,
  },
} satisfies CanisterScope

const testScope2 = {
  _tag: "scope",
  tags: [Tags.CANISTER],
  description: "",
  defaultTask: Option.none(),
  children: {
    unProvidedTask2,
  },
} satisfies CanisterScope

const providedTestScope = {
  _tag: "scope",
  tags: [Tags.CANISTER],
  description: "",
  defaultTask: Option.none(),
  children: {
    providedTask,
  },
} satisfies CanisterScope

// Type checks
// const pt = providedTask satisfies DepBuilder<typeof providedTask>
// const upt = unProvidedTask satisfies DepBuilder<typeof unProvidedTask>
// const uts = testScope satisfies UniformScopeCheck<typeof testScope>
// const pts = providedTestScope satisfies UniformScopeCheck<
//   typeof providedTestScope
// >
// const uts2 = testScope2 satisfies UniformScopeCheck<typeof testScope2>

// const test = customCanister(async () => ({
//   wasm: "",
//   candid: "",
// }))

// // test._scope.children.install.computeCacheKey = (task) => {
// //   return task.id.toString()
// // }

// const t = test.deps({ asd: test._scope.children.create }).provide({
//   asd: test._scope.children.create,
//   // TODO: extras also cause errors? should it be allowed?
//   // asd2: test._scope.children.create,
// }).done()
// t.children.install.computeCacheKey
// // t.children.install.dependencies

// const testMotokoCanister = motokoCanister(async () => ({ src: "src/motoko/canister.mo" }))
// .deps({
//   providedTask: providedTask,
// })
// .provide({
//   providedTask: providedTask,
// })
// .done()
