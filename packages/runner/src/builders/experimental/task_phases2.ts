import type { CanisterConstructor, Task } from "../types/types.js"
import { Effect, Option } from "effect"
import type {
  ExtractTaskEffectSuccess,
  MergeTaskDeps,
  MergeTaskProvide,
  CanisterScope,
} from "./types.js"
import { TaskCtx, TaskInfo, DependencyResults } from "../index.js"
import { type TaskCtxShape } from "./types.js"

/* ------------------------------------------------------------------
   1) AllowedDep + Normalization
------------------------------------------------------------------ */

type AllowedDep = Task | CanisterScope | CanisterConstructor

/**
 * For a single dependency:
 * - If it’s already a Task, return it as-is.
 * - If it’s a CanisterConstructor, use `provides`.
 * - If it’s a CanisterScope, use `children.install`.
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

/**
 * Convert a record of AllowedDep → record of Task at the type level.
 */
export type NormalizeDeps<Deps extends Record<string, AllowedDep>> = {
  [K in keyof Deps]: NormalizeDep<Deps[K]> extends Task
    ? NormalizeDep<Deps[K]>
    : never
}

/**
 * The corresponding runtime function for normalizing one dependency.
 */
export function normalizeDep(dep: AllowedDep): Task {
  if ("_tag" in dep && dep._tag === "task") return dep
  if ("provides" in dep) return dep.provides as Task
  if ("_tag" in dep && dep._tag === "scope" && dep.children?.install)
    return dep.children.install as Task
  throw new Error("Invalid dependency type provided to normalizeDep()")
}

/* ------------------------------------------------------------------
   2) Effect-Comparison Types
------------------------------------------------------------------ */

export type TaskReturnValue<T extends Task> = T extends {
  effect: Effect.Effect<infer S, any, any>
}
  ? S
  : never

/**
 * CompareTaskEffects:
 * - Check if all keys in D are in P
 * - For each shared key, if `TaskReturnValue<D[K]> extends TaskReturnValue<P[K]>`,
 *   produce `never` (which your code currently treats as "compatible").
 * - If all shared keys produce `never`, return `P`. Otherwise `never`.
 *
 * Note: The logic is a bit reversed. If you want a mismatch to produce `never`,
 * you’d flip `extends` or the ternary. For now, this preserves your current code.
 */
export type CompareTaskEffects<
  D extends Record<string, Task>,
  P extends Record<string, Task>,
> =
  (keyof D extends keyof P ? true : false) extends true
    ? {
        [K in keyof D & keyof P]:
          TaskReturnValue<D[K]> extends TaskReturnValue<P[K]>
            ? never  // "matched" in your current code
            : K      // "mismatch"
      }[keyof D & keyof P] extends never
      ? P
      : never
    : never

/**
 * ValidProvidedDeps:
 * - Normalize both declared (D) and new provided (NP).
 * - Compare effect types with CompareTaskEffects.
 * - If mismatch, yield never; else yield the original NP shape.
 */
export type ValidProvidedDeps<
  D extends Record<string, AllowedDep>,
  NP extends Record<string, AllowedDep>,
> =
  CompareTaskEffects<NormalizeDeps<D>, NormalizeDeps<NP>> extends never
    ? never
    : NP

/* ------------------------------------------------------------------
   3) The Builder Interface
------------------------------------------------------------------ */

/**
 * A single builder that can `.deps(...)`, `.provide(...)`, `.run(...)`, then `.done()`.
 */
export interface TaskBuilder<
  I,
  T extends Task,
  D extends Record<string, Task>,
  P extends Record<string, Task>,
> {
  /**
   * .deps(...) → merges new dependencies (AllowedDep) into the existing builder state.
   */
  deps: <ND extends Record<string, AllowedDep>>(
    deps: ND,
  ) => TaskBuilder<I, MergeTaskDeps<T, NormalizeDeps<ND>>, NormalizeDeps<ND>, P>

  /**
   * .provide(...) → merges new provided deps, but must pass effect-compat check.
   */
  provide: <NP extends Record<string, AllowedDep>>(
    providedDeps: ValidProvidedDeps<D, NP>,
  ) => TaskBuilder<
    I,
    MergeTaskProvide<T, NormalizeDeps<ValidProvidedDeps<D, NP>>>,
    D,
    NormalizeDeps<ValidProvidedDeps<D, NP>>
  >

  /**
   * .run(...) → finalize the effect, returning a new TaskBuilder with updated effect type.
   */
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

  /** .done() → return the final Task. */
  done: () => T
}

/* ------------------------------------------------------------------
   4) Factory function to construct a builder.
------------------------------------------------------------------ */

function makeTaskBuilder<
  I,
  T extends Task,
  D extends Record<string, Task>,
  P extends Record<string, Task>,
>(task: T): TaskBuilder<I, T, D, P> {
  return {
    // 1) .deps(...)
    deps<ND extends Record<string, AllowedDep>>(dependencies: ND) {
      // Normalize each dep at runtime
      const finalDeps = Object.fromEntries(
        Object.entries(dependencies).map(([key, dep]) => {
          const normalizedDep = normalizeDep(dep)
          return [key, normalizedDep]
        }),
      ) as Record<string, Task>

      // Merge into the existing task as "dependencies"
      const updatedTask = {
        ...task,
        dependencies: finalDeps,
      } satisfies Task as MergeTaskDeps<T, NormalizeDeps<ND>>

      // Return a new builder with updated generics
      return makeTaskBuilder<
        I,
        typeof updatedTask,
        NormalizeDeps<ND>,
        P
      >(updatedTask)
    },

    // 2) .provide(...)
    provide<NP extends Record<string, AllowedDep>>(providedDeps: ValidProvidedDeps<D, NP>) {
      // Normalize each provided dep at runtime
      const finalDeps = Object.fromEntries(
        Object.entries(providedDeps).map(([key, dep]) => {
          const normalizedDep = normalizeDep(dep)
          return [key, normalizedDep]
        }),
      ) as Record<string, Task>

      // Merge into the existing task as "provide"
      const updatedTask = {
        ...task,
        provide: finalDeps,
      } satisfies Task as MergeTaskProvide<
        T,
        NormalizeDeps<ValidProvidedDeps<D, NP>>
      >

      // Return a new builder with updated generics
      return makeTaskBuilder<
        I,
        typeof updatedTask,
        D,
        NormalizeDeps<ValidProvidedDeps<D, NP>>
      >(updatedTask)
    },

    // 3) .run(...)
    run<Output>(
      fn: (
        ctx: TaskCtxShape<
          ExtractTaskEffectSuccess<D> & ExtractTaskEffectSuccess<P>
        >,
      ) => Promise<Output>,
    ) {
      const newTask = {
        ...task,
        effect: Effect.gen(function* () {
          const taskCtx = yield* TaskCtx
          const taskInfo = yield* TaskInfo
          const { dependencies } = yield* DependencyResults

          // build a typed context with D + P's success types
          const ctx = {
            ...taskCtx,
            dependencies,
          } as TaskCtxShape<
            ExtractTaskEffectSuccess<P> & ExtractTaskEffectSuccess<D>
          >

          // run the user-provided async
          const result = yield* Effect.tryPromise({
            try: () => fn(ctx),
            catch: (error) => {
              console.error("Error executing task:", error)
              return error instanceof Error ? error : new Error(String(error))
            },
          })
          return result
        }),
      } as Omit<T, "effect"> & {
        effect: Effect.Effect<
          Output,
          Error,
          TaskCtx | TaskInfo | DependencyResults
        >
      } satisfies Task

      // Return a new builder with the updated effect type
      return makeTaskBuilder<I, typeof newTask, D, P>(newTask)
    },

    // 4) .done()
    done() {
      return task
    },
  }
}

/* ------------------------------------------------------------------
   5) `task()` entry point to create an empty base Task.
------------------------------------------------------------------ */

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
   6) Test Cases
------------------------------------------------------------------ */

//
// Example A: a number-returning Task
//
const numberTask = task()
  .run(async () => {
    // returns a number
    return 12
  })
  .done()

//
// Example B: a string-returning Task
//
const stringTask = task()
  .run(async () => {
    // returns a string
    return "hello"
  })
  .done()

//
// Another Task returning an object
//
const objTask = task()
  .run(async () => {
    // returns an object
    return { a: 1, b: 2 }
  })
  .done()

//
// A mock CanisterScope with an "install" child
//
const canScope: CanisterScope = {
  _tag: "scope",
  tags: [],
  description: "canScope",
  children: {
    install: objTask,
  },
}

//
// Example C: A final "task2" that declares and provides dependencies
//
const task2 = task("description of task2")
  .deps({
    // If you want to declare "depA" here, you'd do it. 
    // Currently we only declare depB and depC:
    // depB: numberTask,
    depC: canScope,
  })
  // If you want it to error on extra/missing keys, you'd change CompareTaskEffects logic.
  .provide({
    // This adds depA (which wasn't declared). 
    // The code as written allows extra keys in "provide".
    depA: stringTask,

    // Provide matching tasks for depB & depC:
    depB: numberTask,
    depC: canScope,
  })
  .run(async (ctx) => {
    // In the run function, we have { depB, depC, depA } as "dependencies" from .provide().
    ctx.dependencies.depC
    console.log("depC is an object with shape {a, b}:", ctx.dependencies.depC)
    return "hello"
  })
  .done()

console.log("final effect of task2:", task2.effect)