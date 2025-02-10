import { Effect, Context, Config, Option } from "effect"
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
import {
  canisterBuildGuard,
  makeInstallTask,
  makeCreateTask,
  makeBindingsTask,
  loadCanisterId,
  resolveConfig,
} from "./custom.js"
import type {
  CanisterBuilder,
  CanisterScope,
  UniformScopeCheck,
  DependencyMismatchError,
  IsValid,
  MergeScopeDependencies,
  MergeScopeProvide,
} from "./types.js"
import { Tags } from "./types.js"

type MotokoCanisterConfig = {
  src: string
  canisterId?: string
}

// const plugins = <T extends TaskTreeNode>(taskTree: T) =>
//   deployTaskPlugin(taskTree)

const makeMotokoBuildTask = (
  canisterConfigOrFn:
    | ((ctx: TaskCtxShape) => Promise<MotokoCanisterConfig>)
    | ((ctx: TaskCtxShape) => MotokoCanisterConfig)
    | MotokoCanisterConfig,
): Task => {
  return {
    _tag: "task",
    id: Symbol("motokoCanister/build"),
    dependencies: {},
    provide: {},
    computeCacheKey: Option.none(),
    effect: Effect.gen(function* () {
      const path = yield* Path.Path
      const appDir = yield* Config.string("APP_DIR")
      const { taskPath } = yield* TaskInfo
      const canisterId = yield* loadCanisterId(taskPath)
      const taskCtx = yield* TaskCtx
      const canisterConfig = yield* resolveConfig(canisterConfigOrFn)
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

const makeMotokoDeleteTask = (): Task => {
  return {
    _tag: "task",
    id: Symbol("motokoCanister/delete"),
    dependencies: {},
    provide: {},
    computeCacheKey: Option.none(),
    effect: Effect.gen(function* () {
      // yield* deleteCanister(canisterId)
    }),
    description: "some description",
    tags: [Tags.CANISTER, Tags.DELETE],
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
    install: (installArgsOrFn) => {
      const updatedScope = {
        ...scope,
        children: {
          ...scope.children,
          install: makeInstallTask(installArgsOrFn),
        },
      } satisfies CanisterScope
      return makeMotokoBuilder<I, typeof updatedScope, D, P, Config, _SERVICE>(
        updatedScope,
      )
    },

    create: (canisterConfigOrFn) => {
      const updatedScope = {
        ...scope,
        children: {
          ...scope.children,
          create: makeCreateTask(canisterConfigOrFn),
        },
      }
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
      } satisfies CanisterScope as MergeScopeDependencies<
        S,
        typeof dependencies
      >

      return makeMotokoBuilder<
        I,
        typeof updatedScope,
        // TODO: update type?
        typeof dependencies,
        P,
        Config
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

      return makeMotokoBuilder<
        I,
        typeof updatedScope,
        D,
        // TODO: update type?
        typeof providedDeps,
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
    _scope: scope,
    _tag: "builder",
  }
}

export const motokoCanister = <I = unknown, _SERVICE = unknown>(
  canisterConfigOrFn:
    | MotokoCanisterConfig
    | ((ctx: TaskCtxShape) => MotokoCanisterConfig)
    | ((ctx: TaskCtxShape) => Promise<MotokoCanisterConfig>),
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
    tags: [Tags.CANISTER],
    description: "some description",
    children: {
      create: makeCreateTask(canisterConfigOrFn),
      build: makeMotokoBuildTask(canisterConfigOrFn),
      bindings: makeBindingsTask(),
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
} satisfies Task

const providedTask = {
  _tag: "task",
  id: Symbol("test"),
  effect: Effect.gen(function* () {}),
  description: "",
  tags: [],
  computeCacheKey: Option.none(),
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
