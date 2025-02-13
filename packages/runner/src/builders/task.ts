import type { Task } from "../types/types.js"
import { Effect, Option } from "effect"
import { Tags, type ExtractTaskEffectSuccess } from "./types.js"
import {
  TaskCtx,
  TaskInfo,
  DependencyResults,
  type TaskCtxShape,
} from "../index.js"

// TODO: support CanisterConstructor etc.
export const task = <I, P extends Record<string, Task>>(args: {
  provide: P
  run: (ctx: TaskCtxShape<ExtractTaskEffectSuccess<P>>) => Promise<I>
}) => {
  return {
    _tag: "task",
    id: Symbol("task"),
    computeCacheKey: Option.none(),
    description: "",
    dependencies: {},
    provide: args.provide,
    effect: Effect.gen(function* () {
      const taskCtx = yield* TaskCtx
      // TODO: should be part of the taskCtx?
      const taskInfo = yield* TaskInfo
      const { dependencies } = yield* DependencyResults
      const ctx = {
        ...taskCtx,
        dependencies,
        // taskPath: taskInfo.taskPath,
      } as TaskCtxShape<ExtractTaskEffectSuccess<P>>
      const result = yield* Effect.tryPromise({
        try: () => args.run(ctx),
        catch: (error) => {
          // TODO: proper error handling
          console.error("Error executing task:", error)
          return error instanceof Error ? error : new Error(String(error))
        },
      })
      return result
    }),
    tags: [Tags.SCRIPT],
  } satisfies Task
}

const testTask2 = task({
  provide: {},
  run: async (ctx) => {
    return 12
  },
})

const testTask = task({
  provide: {
    testTask2,
  },
  run: async (ctx) => {
    ctx.dependencies.testTask2
    // return "test"
  },
})
// TODO: builder?
