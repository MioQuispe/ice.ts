import { Effect, Option, Config } from "effect"
import {
  createCanister,
  installCanister,
  writeCanisterIds,
  encodeArgs,
  generateDIDJS,
  createActor,
  TaskCtx,
  TaskInfo,
  DependencyResults,
  readCanisterIds,
  type TaskCtxShape,
} from "../index.js"
import type {
  Task,
  CanisterScope,
  Scope,
  CrystalContext,
  BuilderResult,
  CanisterConstructor,
} from "../types/types.js"
import type {
  MergeScopeDependencies,
  MergeScopeProvide,
  ExtractTaskEffectSuccess,
  DependencyMismatchError,
  UniformScopeCheck,
  IsValid,
} from "./types.js"
import { Path, FileSystem } from "@effect/platform"
import { Principal } from "@dfinity/principal"
import { Tags } from "./types.js"

type CustomCanisterConfig = {
  wasm: string
  candid: string
  canisterId?: string
}

type ConfigOrFn<Config> =
  | ((ctx: TaskCtxShape) => Promise<Config>)
  | ((ctx: TaskCtxShape) => Config)
  | Config

type InstallArgsFn<I, P extends Record<string, unknown>> =
  | ((args: { ctx: TaskCtxShape<P>; mode: string }) => Promise<I>)
  | ((args: { ctx: TaskCtxShape<P>; mode: string }) => I)

/* ------------------------------------------------------------------
   A) AllowedDep + Normalization (Unchanged)
------------------------------------------------------------------ */
type AllowedDep = Task | CanisterScope | CanisterConstructor

export type NormalizeDep<T> = T extends Task
  ? T
  : T extends CanisterConstructor
    ? T["provides"] extends Task
      ? T["provides"]
      : never
    : T extends CanisterScope
      ? T["children"]["install"] extends Task
        ? T["children"]["install"]
        : never
      : never

export function normalizeDep(dep: AllowedDep): Task {
  if ("_tag" in dep && dep._tag === "task") return dep
  if ("provides" in dep) return dep.provides as Task
  if ("_tag" in dep && dep._tag === "scope" && dep.children?.install)
    return dep.children.install as Task
  throw new Error("Invalid dependency type provided to normalizeDep()")
}

export type NormalizeDeps<Deps extends Record<string, AllowedDep>> = {
  [K in keyof Deps]: NormalizeDep<Deps[K]> extends Task
    ? NormalizeDep<Deps[K]>
    : never
}

/* ------------------------------------------------------------------
   B) Effect Checks (Unchanged)
------------------------------------------------------------------ */
export type TaskReturnValue<T extends Task> = T extends {
  effect: Effect.Effect<infer S, any, any>
}
  ? S
  : never

export type CompareTaskEffects<
  D extends Record<string, Task>,
  P extends Record<string, Task>,
> = (keyof D extends keyof P ? true : false) extends true
  ? {
      [K in keyof D & keyof P]: TaskReturnValue<D[K]> extends TaskReturnValue<
        P[K]
      >
        ? never
        : K
    }[keyof D & keyof P] extends never
    ? P
    : never
  : never

export type ValidProvidedDeps<
  D extends Record<string, AllowedDep>,
  NP extends Record<string, AllowedDep>,
> =
  CompareTaskEffects<NormalizeDeps<D>, NormalizeDeps<NP>> extends never
    ? never
    : NP

/**
 * Resolves a canister configuration.
 */
export const resolveConfig = <Config>(configOrFn: ConfigOrFn<Config>) =>
  Effect.gen(function* () {
    const taskCtx = yield* TaskCtx
    if (typeof configOrFn === "function") {
      const configFn = configOrFn as (
        ctx: TaskCtxShape,
      ) => Promise<Config> | Config
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

export const loadCanisterId = (taskPath: string) =>
  Effect.gen(function* () {
    const canisterName = taskPath.split(":").slice(0, -1).join(":")
    const canisterIds = yield* readCanisterIds()
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
    .pipe(Effect.mapError(() => new Error("Wasm file not found")))
  if (!wasmExists) {
    yield* Effect.fail(new Error("Wasm file not found"))
  }
  return true
})

export const makeBindingsTask = () => {
  return {
    _tag: "task",
    id: Symbol("customCanister/bindings"),
    dependencies: {},
    provide: {},
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
    computeCacheKey: Option.none(),
  } satisfies Task
}

export const makeInstallTask = <
  I,
  D extends Record<string, Task>,
  P extends Record<string, Task>,
  _SERVICE,
>(
  installArgsFn?: InstallArgsFn<
    I,
    ExtractTaskEffectSuccess<D> & ExtractTaskEffectSuccess<P>
  >,
) => {
  return {
    _tag: "task",
    id: Symbol("customCanister/install"),
    dependencies: {},
    provide: {},
    computeCacheKey: Option.none(),
    effect: Effect.gen(function* () {
      yield* Effect.logInfo("Starting custom canister installation")
      const taskCtx = yield* TaskCtx
      const { dependencies } = yield* DependencyResults

      const { taskPath } = yield* TaskInfo
      const canisterName = taskPath.split(":").slice(0, -1).join(":")
      const onlyCanisterName = canisterName.split(":").slice(-1)[0]
      const noEncodeArgs = onlyCanisterName === "NNSGenesisToken"
      yield* Effect.logInfo("No encode args", { noEncodeArgs, canisterName })

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
      } as TaskCtxShape<P>
      if (installArgsFn) {
        yield* Effect.logInfo("Executing install args function")
        const installFn = installArgsFn as (args: {
          ctx: TaskCtxShape<P>
          mode: string
        }) => Promise<I> | I
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
        }
        yield* Effect.logInfo("Install args generated", { args: installArgs })
      }

      yield* Effect.logInfo("Encoding args", { installArgs, canisterDID })
      const encodedArgs = noEncodeArgs
        ? (installArgs as unknown as Uint8Array)
        : yield* Effect.try({
            try: () => encodeArgs(installArgs as any[], canisterDID),
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
      yield* installCanister({
        encodedArgs,
        canisterId,
        wasmPath,
      })
      yield* Effect.logInfo("Canister installed successfully")
      const actor = yield* createActor<_SERVICE>({
        canisterId,
        canisterDID,
      })
      return {
        canisterId,
        canisterName,
        actor,
      }
    }),
    description: "Install canister code",
    tags: [Tags.CANISTER, Tags.INSTALL],
  } satisfies Task
}

const makeCustomCanisterBuildTask = (
  customCanisterConfigOrFn: ConfigOrFn<CustomCanisterConfig>,
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
      const canisterConfig = yield* resolveConfig(customCanisterConfigOrFn)
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
    }),
    description: "some description",
    tags: [Tags.CANISTER, Tags.BUILD],
    computeCacheKey: Option.none(),
  } satisfies Task
}

export const makeCreateTask = (
  canisterConfigOrFn: ConfigOrFn<CustomCanisterConfig>,
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
      const appDir = yield* Config.string("APP_DIR")
      const { taskPath } = yield* TaskInfo
      const canisterName = taskPath.split(":").slice(0, -1).join(":")
      const outDir = path.join(appDir, ".artifacts", canisterName)
      yield* fs.makeDirectory(outDir, { recursive: true })
      yield* writeCanisterIds(canisterName, canisterId)
      return canisterId
    }),
    description: "some description",
    tags: [Tags.CANISTER, Tags.CREATE],
    computeCacheKey: Option.none(),
  } satisfies Task
}

/* ------------------------------------------------------------------
   D) The "method logic" helper functions
   (No duplication of merges or replacements)
------------------------------------------------------------------ */

/**
 * For `.deps()`: merges new dependencies into scope.children.install.dependencies.
 */
function depsMethod<
  S extends CanisterScope,
  ND extends Record<string, AllowedDep>,
  _SERVICE,
>(scope: S, deps: ND) {
  const normalized = Object.fromEntries(
    Object.entries(deps).map(([k, dep]) => [k, normalizeDep(dep)]),
  ) as Record<string, Task>

  const updatedScope = {
    ...scope,
    children: {
      ...scope.children,
      install: {
        ...scope.children.install,
        dependencies: normalized,
      },
    },
  }
  //   } as S & MergeScopeDependencies<S, NormalizeDeps<ND>>

  return updatedScope
}

/**
 * For `.provide()`: merges new provided tasks into scope.children.install.provide.
 */
function provideMethod<
  S extends CanisterScope,
  NP extends Record<string, AllowedDep>,
  _SERVICE,
>(scope: S, providedDeps: NP) {
  const normalized = Object.fromEntries(
    Object.entries(providedDeps).map(([k, dep]) => [k, normalizeDep(dep)]),
  ) as Record<string, Task>

  const updatedScope = {
    ...scope,
    children: {
      ...scope.children,
      install: {
        ...scope.children.install,
        provide: normalized,
      },
    },
  }
  //   } as S & MergeScopeProvide<S, NormalizeDeps<NP>>

  return updatedScope
}

/**
 * For `.install()`: replace the existing "install" child with a newly created install task,
 * while preserving any existing dependencies/provide from the old child.
 */
function installMethod<
  I,
  S extends CanisterScope,
  D extends Record<string, Task>,
  P extends Record<string, Task>,
  _SERVICE,
>(
  scope: S,
  installArgsFn?: InstallArgsFn<
    I,
    ExtractTaskEffectSuccess<D> & ExtractTaskEffectSuccess<P>
  >,
) {
  const installTask = makeInstallTask<I, D, P, _SERVICE>(installArgsFn)
  const updatedScope = {
    ...scope,
    children: {
      ...scope.children,
      install: {
        ...installTask,
        dependencies: scope.children.install.dependencies,
        provide: scope.children.install.provide,
      },
    },
  }
  return updatedScope
}

/**
 * For `.build()`: attach a new "build" task (replacing any existing one).
 */
function buildMethod<S extends CanisterScope, _SERVICE>(
  scope: S,
  configOrFn: ConfigOrFn<CustomCanisterConfig>,
) {
  const buildTask = makeCustomCanisterBuildTask(configOrFn)
  const updatedScope = {
    ...scope,
    children: {
      ...scope.children,
      build: buildTask,
    },
  }
  return updatedScope
}

/**
 * For `.bindings()`: attach a new "bindings" task (replacing any existing one).
 */
function bindingsMethod<S extends CanisterScope, _SERVICE>(scope: S) {
  const bindingsTask = makeBindingsTask()
  const updatedScope = {
    ...scope,
    children: {
      ...scope.children,
      bindings: bindingsTask,
    },
  }
  return updatedScope
}

/**
 * For `.create()`: attach a new "create" task (replacing any existing one).
 */
function createMethod<S extends CanisterScope, _SERVICE>(
  scope: S,
  configOrFn: ConfigOrFn<CustomCanisterConfig>,
) {
  const createTask = makeCreateTask(configOrFn)
  const updatedScope = {
    ...scope,
    children: {
      ...scope.children,
      create: createTask,
    },
  }
  return updatedScope
}

/**
 * Phase 1: customCanister() => transitions: .deps(), .provide(), .install(), .build(), .bindings(), .create()
 */
function makePhase1<
  I,
  S extends CanisterScope,
  D extends Record<string, Task>,
  P extends Record<string, Task>,
  Config extends CustomCanisterConfig,
  _SERVICE,
>(scope: S) {
  return {
    deps<ND extends Record<string, AllowedDep>>(dependencies: ND) {
      const updatedScope = depsMethod<S, ND, _SERVICE>(scope, dependencies)
      return makePhase2<
        I,
        typeof updatedScope,
        NormalizeDeps<ND>,
        P,
        Config,
        _SERVICE
      >(updatedScope)
    },

    provide<NP extends Record<string, AllowedDep>>(
      providedDeps: ValidProvidedDeps<D, NP>,
    ) {
      const updatedScope = provideMethod<S, NP, _SERVICE>(scope, providedDeps)
      return makePhase3<
        I,
        typeof updatedScope,
        D,
        NormalizeDeps<ValidProvidedDeps<D, NP>>,
        Config,
        _SERVICE
      >(updatedScope)
    },

    install(
      installArgsFn?: InstallArgsFn<
        I,
        ExtractTaskEffectSuccess<D> & ExtractTaskEffectSuccess<P>
      >,
    ) {
      const updatedScope = installMethod<I, S, D, P, _SERVICE>(
        scope,
        installArgsFn,
      )
      return makePhase4<I, typeof updatedScope, D, P, Config, _SERVICE>(
        updatedScope,
      )
    },

    build(canisterConfigOrFn: ConfigOrFn<CustomCanisterConfig>) {
      const updatedScope = buildMethod<S, _SERVICE>(scope, canisterConfigOrFn)
      return makePhase6<I, typeof updatedScope, D, P, Config, _SERVICE>(
        updatedScope,
      )
    },

    bindings() {
      const updatedScope = bindingsMethod<S, _SERVICE>(scope)
      return makePhase7<I, typeof updatedScope, D, P, Config, _SERVICE>(
        updatedScope,
      )
    },

    create(canisterConfigOrFn: ConfigOrFn<CustomCanisterConfig>) {
      const updatedScope = createMethod<S, _SERVICE>(scope, canisterConfigOrFn)
      return makePhase5<I, typeof updatedScope, D, P, Config, _SERVICE>(
        updatedScope,
      )
    },

    done() {
      return scope
    },

    _scope: scope,
  }
}

/**
 * Phase 2: .deps() => transitions: .provide()
 */
function makePhase2<
  I,
  S extends CanisterScope,
  D extends Record<string, Task>,
  P extends Record<string, Task>,
  Config extends CustomCanisterConfig,
  _SERVICE,
>(scope: S) {
  return {
    provide<NP extends Record<string, AllowedDep>>(
      providedDeps: ValidProvidedDeps<D, NP>,
    ) {
      const updatedScope = provideMethod<S, NP, _SERVICE>(scope, providedDeps)
      return makePhase3<
        I,
        typeof updatedScope,
        D,
        NormalizeDeps<ValidProvidedDeps<D, NP>>,
        Config,
        _SERVICE
      >(updatedScope)
    },

    install(
      installArgsFn?: InstallArgsFn<
        I,
        ExtractTaskEffectSuccess<D> & ExtractTaskEffectSuccess<P>
      >,
    ) {
      const updatedScope = installMethod<I, S, D, P, _SERVICE>(
        scope,
        installArgsFn,
      )
      return makePhase4<I, typeof updatedScope, D, P, Config, _SERVICE>(
        updatedScope,
      )
    },

    done() {
      return scope
    },

    _scope: scope,
  }
}

/**
 * Phase 3: .provide() => transitions: .install(), .create(), .build(), .bindings()
 */
function makePhase3<
  I,
  S extends CanisterScope,
  D extends Record<string, Task>,
  P extends Record<string, Task>,
  Config extends CustomCanisterConfig,
  _SERVICE,
>(scope: S) {
  return {
    install(
      installArgsFn?: InstallArgsFn<
        I,
        ExtractTaskEffectSuccess<D> & ExtractTaskEffectSuccess<P>
      >,
    ) {
      const updatedScope = installMethod<I, S, D, P, _SERVICE>(
        scope,
        installArgsFn,
      )
      return makePhase4<I, typeof updatedScope, D, P, Config, _SERVICE>(
        updatedScope,
      )
    },

    create(canisterConfigOrFn: ConfigOrFn<CustomCanisterConfig>) {
      const updatedScope = createMethod<S, _SERVICE>(scope, canisterConfigOrFn)
      return makePhase5<I, typeof updatedScope, D, P, Config, _SERVICE>(
        updatedScope,
      )
    },

    build(canisterConfigOrFn: ConfigOrFn<CustomCanisterConfig>) {
      const updatedScope = buildMethod<S, _SERVICE>(scope, canisterConfigOrFn)
      return makePhase6<I, typeof updatedScope, D, P, Config, _SERVICE>(
        updatedScope,
      )
    },

    bindings() {
      const updatedScope = bindingsMethod<S, _SERVICE>(scope)
      return makePhase7<I, typeof updatedScope, D, P, Config, _SERVICE>(
        updatedScope,
      )
    },

    done() {
      return scope
    },

    _scope: scope,
  }
}

/**
 * Phase 4: .install() => no further transitions
 */
function makePhase4<
  I,
  S extends CanisterScope,
  D extends Record<string, Task>,
  P extends Record<string, Task>,
  Config,
  _SERVICE,
>(scope: S) {
  return {
    done() {
      return scope
    },
    _scope: scope,
  }
}

/**
 * Phase 5: .create() => transitions: .build(), .bindings(), .install()
 */
function makePhase5<
  I,
  S extends CanisterScope,
  D extends Record<string, Task>,
  P extends Record<string, Task>,
  Config extends CustomCanisterConfig,
  _SERVICE,
>(scope: S) {
  return {
    build(canisterConfigOrFn: ConfigOrFn<CustomCanisterConfig>) {
      const updatedScope = buildMethod<S, _SERVICE>(scope, canisterConfigOrFn)
      return makePhase6<I, typeof updatedScope, D, P, Config, _SERVICE>(
        updatedScope,
      )
    },

    bindings() {
      const updatedScope = bindingsMethod<S, _SERVICE>(scope)
      return makePhase7<I, typeof updatedScope, D, P, Config, _SERVICE>(
        updatedScope,
      )
    },

    install(
      installArgsFn?: InstallArgsFn<
        I,
        ExtractTaskEffectSuccess<D> & ExtractTaskEffectSuccess<P>
      >,
    ) {
      const updatedScope = installMethod<I, S, D, P, _SERVICE>(
        scope,
        installArgsFn,
      )
      return makePhase4<I, typeof updatedScope, D, P, Config, _SERVICE>(
        updatedScope,
      )
    },

    done() {
      return scope
    },

    _scope: scope,
  }
}

/**
 * Phase 6: .build() => transitions: .bindings(), .install()
 */
function makePhase6<
  I,
  S extends CanisterScope,
  D extends Record<string, Task>,
  P extends Record<string, Task>,
  Config extends CustomCanisterConfig,
  _SERVICE,
>(scope: S) {
  return {
    bindings() {
      const updatedScope = bindingsMethod<S, _SERVICE>(scope)
      return makePhase7<I, typeof updatedScope, D, P, Config, _SERVICE>(
        updatedScope,
      )
    },

    install(
      installArgsFn?: InstallArgsFn<
        I,
        ExtractTaskEffectSuccess<D> & ExtractTaskEffectSuccess<P>
      >,
    ) {
      const updatedScope = installMethod<I, S, D, P, _SERVICE>(
        scope,
        installArgsFn,
      )
      return makePhase4<I, typeof updatedScope, D, P, Config, _SERVICE>(
        updatedScope,
      )
    },

    done() {
      return scope
    },

    _scope: scope,
  }
}

/**
 * Phase 7: .bindings() => transitions: .install()
 */
function makePhase7<
  I,
  S extends CanisterScope,
  D extends Record<string, Task>,
  P extends Record<string, Task>,
  Config extends CustomCanisterConfig,
  _SERVICE,
>(scope: S) {
  return {
    install(
      installArgsFn?: InstallArgsFn<
        I,
        ExtractTaskEffectSuccess<D> & ExtractTaskEffectSuccess<P>
      >,
    ) {
      const updatedScope = installMethod<I, S, D, P, _SERVICE>(
        scope,
        installArgsFn,
      )
      return makePhase4<I, typeof updatedScope, D, P, Config, _SERVICE>(
        updatedScope,
      )
    },

    done() {
      return scope
    },

    _scope: scope,
  }
}

export function customCanister<I = unknown, _SERVICE = unknown>(
  canisterConfigOrFn: ConfigOrFn<CustomCanisterConfig>,
) {
  const initialScope = {
    _tag: "scope",
    tags: [Tags.CANISTER],
    description: "some description",
    children: {
      create: makeCreateTask(canisterConfigOrFn),
      bindings: makeBindingsTask(),
      build: makeCustomCanisterBuildTask(canisterConfigOrFn),
      install: makeInstallTask<
        I,
        Record<string, Task>,
        Record<string, Task>,
        _SERVICE
      >(),
    },
  } satisfies CanisterScope

  return makePhase1<
    I,
    typeof initialScope,
    Record<string, Task>,
    Record<string, Task>,
    CustomCanisterConfig,
    _SERVICE
  >(initialScope)
}

/* ------------------------------------------------------------------
   G) Example Usage
------------------------------------------------------------------ */

const exampleTask = {
  _tag: "task",
  id: Symbol("exampleTask"),
  dependencies: {},
  provide: {},
  effect: Effect.gen(function* () {
    return { bla: 12 }
  }),
  description: "example",
  tags: [],
  computeCacheKey: Option.none(),
} satisfies Task

const exampleTask2 = {
  _tag: "task",
  id: Symbol("exampleTask2"),
  dependencies: {},
  provide: {},
  effect: Effect.gen(function* () {
    return "hello"
  }),
  description: "example",
  tags: [],
  computeCacheKey: Option.none(),
} satisfies Task

// Let's declare a canister builder
const finalScope = customCanister(() => ({
  wasm: "path/to.wasm",
  candid: "path/to.did",
}))
  .deps({
    // Inline type for .deps():
    // <ND extends Record<string, AllowedDep>>
    depA: exampleTask,
  })
  .provide({
    // Inline type for .provide():
    // <NP extends Record<string, AllowedDep>>
    // validated by ValidProvidedDeps<D, NP>
    depA: exampleTask,
    depB: exampleTask2,
  })
  .install(async ({ ctx }) => {
    ctx.dependencies.depA
    ctx.dependencies.depB
    // ...
    return {}
  })

// .build(() => ({}))._scope.children.build
//   .done()

//   finalScope._scope.children.install
//   customCanister(() => ({
//     wasm: "path/to.wasm",
//     candid: "path/to.did",
//   }))

// console.log("Final scope:", finalScope)

const phases = {
  states: {
    "customCanister()": {
      transitions: [
        ".deps()",
        ".provide()",
        ".install()",
        ".build()",
        ".bindings()",
        ".create()",
      ],
    },
    ".deps()": {
      transitions: [
        ".provide()",
        ".install()",
        ".create()",
        ".build()",
        ".bindings()",
        ".install_unprovided()",
        ".create_unprovided()",
        ".build_unprovided()",
        ".bindings_unprovided()",
      ],
    },
    ".create_unprovided()": {
      transitions: [
        ".provide()",
        ".bindings_unprovided()",
        ".install_unprovided()",
        ".build_unprovided()",
      ],
    },
    ".build_unprovided()": {
      transitions: [
        ".provide()",
        ".bindings_unprovided()",
        ".install_unprovided()",
      ],
    },
    ".bindings_unprovided()": {
      transitions: [
        ".provide()",
        ".install_unprovided()",
      ],
    },
    ".install_unprovided()": {
      transitions: [
        ".provide()",
      ],
    },
    ".provide()": {
      transitions: [".install()", ".create()", ".build()", ".bindings()", ".done()"],
    },
    ".install()": {
      transitions: [".done()"],
    },
    ".create()": {
      transitions: [".build()", ".bindings()", ".install()", ".done()"],
    },
    ".build()": {
      transitions: [".bindings()", ".install()", ".done()"],
    },
    ".bindings()": {
      transitions: [".install()", ".done()"],
    },
    ".done()": {
      transitions: [],
    },
  },
}
