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
import {
  canisterBuildGuard,
  makeInstallTask,
  makeCreateTask,
  makeBindingsTask,
  loadCanisterId,
  resolveConfig,
} from "./custom.js"
import type { CanisterBuilder, CanisterScope, UniformScope } from "./custom.js"
import { Tags } from "./custom.js"

type MotokoCanisterConfig = {
  src: string
  canisterId?: string
}

export type MotokoCanisterBuilder<
  S extends CanisterScope,
  Deps extends Array<Task>,
  Prov extends Array<Task>,
  I = unknown,
> = {
  create: (
    canisterConfigOrFn:
      | MotokoCanisterConfig
      | ((ctx: TaskCtxShape) => MotokoCanisterConfig)
      | ((ctx: TaskCtxShape) => Promise<MotokoCanisterConfig>),
  ) => CanisterBuilder<S, Deps, Prov, I>
  install: (
    installArgsOrFn:
      | ((args: { ctx: TaskCtxShape; mode: string }) => Promise<I>)
      | ((args: { ctx: TaskCtxShape; mode: string }) => I)
      | I,
  ) => CanisterBuilder<S, Deps, Prov, I>
  build: (
    canisterConfigOrFn:
      | MotokoCanisterConfig
      | ((ctx: TaskCtxShape) => MotokoCanisterConfig)
      | ((ctx: TaskCtxShape) => Promise<MotokoCanisterConfig>),
  ) => CanisterBuilder<S, Deps, Prov, I>
  deps: (...deps: Deps) => CanisterBuilder<S, Deps, Prov, I>
  provide: (...providedDeps: Prov) => CanisterBuilder<S, Deps, Prov, I>
  done: () => UniformScope<S>
  // TODO:
  //   bindings: (fn: (args: { ctx: TaskCtxShape }) => Promise<I>) => CanisterBuilder<I>
  // Internal property to store the current scope
  _scope: S
  // TODO: use BuilderResult?
  _tag: "builder"
}

const plugins = <T extends TaskTreeNode>(taskTree: T) =>
  deployTaskPlugin(taskTree)

const makeMotokoBuildTask = (
  canisterConfigOrFn:
    | ((ctx: TaskCtxShape) => Promise<MotokoCanisterConfig>)
    | ((ctx: TaskCtxShape) => MotokoCanisterConfig)
    | MotokoCanisterConfig,
): Task => {
  return {
    _tag: "task",
    id: Symbol("motokoCanister/build"),
    dependencies: [],
    provide: [],
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
    dependencies: [],
    provide: [],
    effect: Effect.gen(function* () {
      // yield* deleteCanister(canisterId)
    }),
    description: "some description",
    tags: [Tags.CANISTER, Tags.DELETE],
  }
}

export const makeMotokoBuilder = <
  S extends CanisterScope,
  D extends Array<Task>,
  P extends Array<Task>,
  I = unknown,
>(
  scope: S,
  deps: D,
) => {
  return {
    install: (
      installArgsOrFn:
        | ((args: { ctx: TaskCtxShape }) => Promise<I>)
        | ((args: { ctx: TaskCtxShape }) => I)
        | I,
    ) => {
      const updatedScope = {
        ...scope,
        children: {
          ...scope.children,
          install: makeInstallTask(installArgsOrFn),
        },
      } satisfies CanisterScope
      return makeMotokoBuilder<typeof updatedScope, D, P, I>(updatedScope, deps)
    },

    create: (
      canisterConfigOrFn:
        | ((ctx: TaskCtxShape) => Promise<MotokoCanisterConfig>)
        | ((ctx: TaskCtxShape) => MotokoCanisterConfig)
        | MotokoCanisterConfig,
    ) => {
      const updatedScope = {
        ...scope,
        children: {
          ...scope.children,
          create: makeCreateTask(canisterConfigOrFn),
        },
      }
      return makeMotokoBuilder<typeof updatedScope, D, P, I>(updatedScope, deps)
    },

    build: (
      canisterConfigOrFn:
        | ((ctx: TaskCtxShape) => Promise<MotokoCanisterConfig>)
        | ((ctx: TaskCtxShape) => MotokoCanisterConfig)
        | MotokoCanisterConfig,
    ) => {
      const updatedScope = {
        ...scope,
        children: {
          ...scope.children,
          build: makeMotokoBuildTask(canisterConfigOrFn),
        },
      } satisfies CanisterScope
      return makeMotokoBuilder<typeof updatedScope, D, P, I>(updatedScope, deps)
    },

    deps: (...deps: Array<Task | CanisterScope>) => {
      // TODO: check that its a canister builder
      const dependencies = deps.map((dep) => {
        if (dep._tag === "scope") {
          return dep.children.deploy
        }
        if (dep._tag === "task") {
          return dep
        }
        return dep
      }) satisfies Task[]
      // TODO: do we create a service out of these?
      const updatedScope = {
        ...scope,
        children: {
          ...scope.children,
          install: {
            ...scope.children.install,
            dependencies,
          },
        },
      } satisfies CanisterScope
      return makeMotokoBuilder<typeof updatedScope, typeof dependencies, P, I>(
        updatedScope,
        dependencies,
      )
    },

    provide: (...providedDeps: Array<Task | CanisterScope>) => {
      // TODO: do we transform here?
      // TODO: do we type check here?
      const finalDeps = providedDeps.map((dep) => {
        // if (dep._tag === "builder") {
        //   return dep._scope.children.deploy
        // }
        if (dep._tag === "scope" && dep.children.deploy) {
          return dep.children.deploy
        }
        return dep as Task
      }) satisfies Array<Task>
      const updatedScope = {
        ...scope,
        children: {
          ...scope.children,
          install: {
            ...scope.children.install,
            provide: finalDeps,
          },
        },
      } satisfies CanisterScope
      return makeMotokoBuilder<typeof updatedScope, D, typeof finalDeps, I>(
        updatedScope,
        deps,
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

    done: () => {
      // TODO: type check dependencies
      // provide should match dependencies

      // TODO: enable plugins
      // return plugins(scope)
      return scope
    },

    // Add scope property to the initial builder
    _scope: scope,
    _tag: "builder",
  }
}

export const motokoCanister = <I = unknown>(
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
      install: makeInstallTask<I>(),
    },
  } satisfies CanisterScope

  return makeMotokoBuilder<typeof initialScope, [], [], I>(initialScope, [])
}
