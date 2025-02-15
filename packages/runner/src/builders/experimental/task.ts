import type { CanisterConstructor, Task } from "../types/types.js"
import { Effect, Option } from "effect"
import type {
  ExtractTaskEffectSuccess,
  //   ExtractProvidedDeps,
  MergeTaskDeps,
  MergeTaskProvide,
  CanisterScope,
} from "./types.js"
import { TaskCtx, TaskInfo, DependencyResults } from "../index.js"
import { Tags, type TaskCtxShape } from "./types.js"

type AllowedDep = Task | CanisterScope | CanisterConstructor

/**,
  CanisterScope
 * If T is already a Task, it stays the same.
 * If T is a CanisterScope, returns its provided Task (assumed to be under the "provides" property).
 */
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

export function normalizeDep(
  dep: Task | CanisterScope | CanisterConstructor,
): Task {
  if ("_tag" in dep && dep._tag === "task") return dep
  if ("provides" in dep) return dep.provides as Task
  if ("_tag" in dep && dep._tag === "scope" && dep.children?.install)
    return dep.children.install as Task
  throw new Error("Invalid dependency type provided to normalizeDep")
}

/**
 * Normalizes a record of dependencies.
 */
export type NormalizeDeps<Deps extends Record<string, AllowedDep>> = {
  [K in keyof Deps]: NormalizeDep<Deps[K]> extends Task
    ? NormalizeDep<Deps[K]>
    : never
}

// export type ValidProvidedDeps<
//   D extends Record<string, Task>,
//   NP extends Record<string, Task>,
// > = CompareTaskEffects<D, NP> extends never ? never : NP

export type ValidProvidedDeps<
  D extends Record<string, AllowedDep>,
  NP extends Record<string, AllowedDep>,
> =
  CompareTaskEffects<NormalizeDeps<D>, NormalizeDeps<NP>> extends never
    ? never
    : NP

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

export type TaskReturnValue<T extends Task> = T extends {
  effect: Effect.Effect<infer S, any, any>
}
  ? S
  : never

export interface TaskBuilder<
  I,
  T extends Task,
  D extends Record<string, Task>,
  P extends Record<string, Task>,
> {
  deps: <ND extends Record<string, AllowedDep>>(
    deps: ND,
  ) => TaskBuilder<I, MergeTaskDeps<T, NormalizeDeps<ND>>, NormalizeDeps<ND>, P>

  provide: <NP extends Record<string, AllowedDep>>(
    providedDeps: ValidProvidedDeps<D, NP>,
  ) => TaskBuilder<
    I,
    MergeTaskProvide<T, NormalizeDeps<ValidProvidedDeps<D, NP>>>,
    D,
    NormalizeDeps<ValidProvidedDeps<D, NP>>
  >

  run<Output>(
    fn: (
      ctx: TaskCtxShape<
        ExtractTaskEffectSuccess<D> & ExtractTaskEffectSuccess<P>
      >,
    ) => Promise<Output>,
  ): TaskBuilder<
    I,
    Omit<T, "effect"> & {
      effect: Effect.Effect<
        Output,
        Error,
        TaskCtx | TaskInfo | DependencyResults
      >
    },
    D,
    P
  >
  done: () => T
}

/* ------------------------------------------------------------------
   3) Phase Implementation (merged)
------------------------------------------------------------------ */

function makeTaskBuilder<
  I,
  T extends Task,
  D extends Record<string, Task>,
  P extends Record<string, Task>,
>(task: T): TaskBuilder<I, T, D, P> {
  return {
    deps: (dependencies) => {
      const finalDeps = Object.fromEntries(
        Object.entries(dependencies).map(([key, dep]) => {
          const normalizedDep = normalizeDep(dep)
          return [key, normalizedDep]
        }),
      ) as Record<string, Task>

      const updatedTask = {
        ...task,
        dependencies: finalDeps,
      } satisfies Task as MergeTaskDeps<T, NormalizeDeps<typeof dependencies>>

      return makeTaskBuilder<
        I,
        typeof updatedTask,
        NormalizeDeps<typeof dependencies>,
        P
      >(updatedTask)
    },

    provide: (providedDeps) => {
      const finalDeps = Object.fromEntries(
        Object.entries(providedDeps).map(([key, dep]) => {
          const normalizedDep = normalizeDep(dep)
          return [key, normalizedDep]
        }),
      ) as Record<string, Task>

      const updatedTask = {
        ...task,
        provide: finalDeps,
      } satisfies Task as MergeTaskProvide<
        T,
        NormalizeDeps<ValidProvidedDeps<D, typeof providedDeps>>
      >

      return makeTaskBuilder<
        I,
        typeof updatedTask,
        D,
        NormalizeDeps<ValidProvidedDeps<D, typeof providedDeps>>
      >(updatedTask)
    },

    run<Output>(
      fn: (
        ctx: TaskCtxShape<
          ExtractTaskEffectSuccess<P> & ExtractTaskEffectSuccess<D>
        >,
      ) => Promise<Output>,
    ) {
      const newTask = {
        ...task,
        effect: Effect.gen(function* () {
          const taskCtx = yield* TaskCtx
          const taskInfo = yield* TaskInfo
          const { dependencies } = yield* DependencyResults
          const ctx = {
            ...taskCtx,
            dependencies,
          } as TaskCtxShape<
            ExtractTaskEffectSuccess<P> & ExtractTaskEffectSuccess<D>
          >
          const result = yield* Effect.tryPromise({
            //   try: () => fn(ctx),
            try: () => fn(ctx),
            catch: (error) => {
              console.error("Error executing task:", error)
              return error instanceof Error ? error : new Error(String(error))
            },
          })
          return result // or return the desired type (here U)
        }),
      } as Omit<T, "effect"> & {
        effect: Effect.Effect<
          Output,
          Error,
          TaskCtx | TaskInfo | DependencyResults
        >
      } satisfies Task

      return makeTaskBuilder<I, typeof newTask, D, P>(newTask)
    },

    done() {
      return task
    },
  }
}

export function task<I = unknown>(description = "description") {
  const baseTask: Task = {
    _tag: "task",
    id: Symbol("task"),
    description,
    computeCacheKey: Option.none(),
    dependencies: {},
    provide: {},
    tags: [],
    effect: Effect.gen(function* () {}),
  }
  return makeTaskBuilder<I, typeof baseTask, {}, {}>(baseTask)
}

/* ------------------------------------------------------------------
   5) Test Cases
------------------------------------------------------------------ */

// /** Example A: task -> deps -> provide -> run -> done */
const numberTask = task()
  .run(async () => {
    // returns a string
    return 12
  })
  .done()

const stringTask = task()
  .run(async () => {
    // returns a string
    return "hello"
  })
  .done()

const objTask = task()
  .run(async () => {
    // returns a string
    return {
      a: 1,
      b: 2,
    }
  })
  .done()


const canScope = {
  _tag: "scope",
  tags: [],
  description: "canScope",
  children: {
    install: objTask,
  },
} satisfies CanisterScope

/** Example B: task -> run -> done */
const task2 = task("description of task2")
  .deps({
    // depA: numberTask,
    depB: numberTask,
    depC: canScope,
  })
  // TODO: should error???
  .provide({
    depA: stringTask,
    // depB: finalTask,
    // TODO: should error???
    depC: canScope,
    depB: numberTask,
  })
  .run(async (ctx) => {
    ctx.dependencies.depC
    return "hello"
  })
  .done()
