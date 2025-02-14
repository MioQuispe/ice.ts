import type { CanisterConstructor, Task } from "../types/types.js"
import { Effect, Option } from "effect"
import type {
  ExtractTaskEffectSuccess,
  //   ExtractProvidedDeps,
  MergeTaskDeps,
  MergeTaskProvide,
} from "./types.js"
import { TaskCtx, TaskInfo, DependencyResults } from "../index.js"
import { Tags, type TaskCtxShape } from "./types.js"

export type ValidProvidedDeps<
  D extends Record<string, Task>,
  NP extends Record<string, Task>,
> = CompareTaskEffects<D, NP> extends never ? never : NP

// export type CompareTaskEffects<
//   D extends Record<string, Task>,
//   P extends Record<string, Task>,
// > =
//   // if all keys match then never
//   Exclude<keyof D, keyof P> extends never
//     ? {
//         [K in keyof D]: TaskReturnValue<D[K]> extends TaskReturnValue<P[K]>
//           ? never
//           : K
//       }[keyof D] extends never
//       ? P
//       : never
//     : never

export type CompareTaskEffects<
  D extends Record<string, Task>,
  P extends Record<string, Task>
> = (keyof D extends keyof P ? true : false) extends true
  ? {
      [K in keyof D & keyof P]: TaskReturnValue<D[K]> extends TaskReturnValue<P[K]>
        ? never
        : K
    }[keyof D & keyof P] extends never
    ? P
    : never
  : never;

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
  deps: <ND extends Record<string, Task>>(
    deps: ND,
  ) => TaskBuilder<I, MergeTaskDeps<T, ND>, ND, P>

  provide: <NP extends Record<string, Task>>(
    providedDeps: ValidProvidedDeps<D, NP>,
  ) => TaskBuilder<
    I,
    MergeTaskProvide<T, ValidProvidedDeps<D, NP>>,
    D,
    ValidProvidedDeps<D, NP>
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
          // if (dep._tag === "builder") {
          //   return dep._scope.children.deploy
          // }
          // if (dep._tag === "scope" && dep.children.deploy) {
          //   return [key, dep.children.deploy]
          // }
          //   if ("provides" in dep) {
          //     return [key, dep.provides]
          //   }
          return [key, dep satisfies Task]
        }),
      ) satisfies Record<string, Task>

      const updatedTask = {
        ...task,
        dependencies: finalDeps,
      } satisfies Task as MergeTaskDeps<T, typeof dependencies>

      return makeTaskBuilder<I, typeof updatedTask, typeof dependencies, P>(
        updatedTask,
      )
    },

    provide: (providedDeps) => {
      const finalDeps = Object.fromEntries(
        Object.entries(providedDeps).map(([key, dep]) => {
          // if (dep._tag === "builder") {
          //   return dep._scope.children.deploy
          // }
          // if (dep._tag === "scope" && dep.children.deploy) {
          //   return [key, dep.children.deploy]
          // }
          //   if ("provides" in dep) {
          //     return [key, dep.provides]
          //   }
          return [key, dep satisfies Task]
        }),
      ) satisfies Record<string, Task>

      const updatedTask = {
        ...task,
        provide: finalDeps,
      } satisfies Task as MergeTaskProvide<T, typeof providedDeps>

      return makeTaskBuilder<I, typeof updatedTask, D, typeof providedDeps>(
        updatedTask,
      )
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

/* ------------------------------------------------------------------
   4) `task(...)` Entrypoint: returns Phase
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
  return makeTaskBuilder<
    I,
    typeof baseTask,
    {},
    {},
  >(baseTask)
}

/* ------------------------------------------------------------------
   5) Example Usage
------------------------------------------------------------------ */

// /** Example A: task -> deps -> provide -> run -> done */
// const numberTask = task()
//   .run(async () => {
//     // returns a string
//     return 12
//   })
//   .done()

// const stringTask = task()
//   .run(async () => {
//     // returns a string
//     return "hello"
//   })
//   .done()

// /** Example B: task -> run -> done */
// const task2 = task("description of task2")
//   .deps({
//     // depA: numberTask,
//     depB: numberTask,
//   })
//   // TODO: should error???
//   .provide({
//     depA: stringTask,
//     // depB: finalTask,
//     depC: stringTask,
//     depB: numberTask,
//   })
//   .run(async (ctx) => {
//     ctx.dependencies.depB
//     return "hello"
//   })
//   .done()
