import { Effect, Layer, Context, Option } from "effect"
import type { Task } from "../types/types.js"
import { KeyValueStore } from "@effect/platform"

export class TaskRegistry extends Context.Tag("TaskRegistry")<
  TaskRegistry,
  {
    readonly set: (cacheKey: string, result: string) => Effect.Effect<void, unknown, unknown>
    readonly get: (cacheKey: string) => Effect.Effect<Option.Option<string>, unknown, unknown>
    readonly has: (cacheKey: string) => Effect.Effect<boolean, unknown, unknown>
  }
>() {
  static Live = Layer.effect(
    TaskRegistry,
    Effect.gen(function* () {
      // TODO: persist certain task results?
      // const kv = new Map<string, unknown>()
      // TODO: cant use symbol as key. use taskPath?
      const kv = yield* KeyValueStore.KeyValueStore
      return {
        set: (cacheKey, result) => Effect.gen(function* () {
          // TODO: Effect.try
          // const serializedResult = yield* Effect.try({
          //   try: () => JSON.stringify(result),
          //   catch: (error) => {
          //     console.error(error)
          //     return Effect.fail(error)
          //   },
          // })
          yield* Effect.logDebug("writing to cache:", cacheKey, result)
          yield* kv.set(cacheKey, result)
          // kv.set(cacheKey, result)
        }),
        get: (cacheKey: string) => Effect.gen(function* () {
          // return yield* kv.get(cacheKey)
          const result = yield* kv.get(cacheKey)
          yield* Effect.logDebug("reading from cache:", cacheKey, result)
          return result
        }),
        has: (cacheKey) => Effect.gen(function* () {
          const has = yield* kv.has(cacheKey)
          return has
        }),
      }
    }),
  )
}
