import { ConfigProvider, Context, Effect, Layer, Option } from "effect"
import { ICEConfigService } from "../services/iceConfig.js"
import { configMap } from "../index.js"
import { Tags } from "../builders/types.js"
import type { Task } from "../types/types.js"
import { TaskRegistry } from "../services/taskRegistry.js"
import { getTaskByPath, getTaskPathById } from "./lib.js"


export const runTaskByPath = (taskPath: string) =>
  Effect.gen(function* () {
    const { task } = yield* getTaskByPath(taskPath)
    yield* runTask(task)
  })

export class DependencyResults extends Context.Tag("DependencyResults")<
  DependencyResults,
  {
    readonly dependencies: Record<string, unknown>
  }
>() {}

export class TaskInfo extends Context.Tag("TaskInfo")<
  TaskInfo,
  {
    readonly taskPath: string
  }
>() {}

export interface RunTaskOptions {
  forceRun?: boolean
}

export const runTask = <A, E, R, I>(
  task: Task<A, E, R, I>,
  options: RunTaskOptions = { forceRun: false },
): Effect.Effect<A, unknown, unknown> => {
  return Effect.gen(function* () {
    const cache = yield* TaskRegistry
    const taskPath = yield* getTaskPathById(task.id)
    yield* Effect.logInfo(`Running task: ${taskPath}`)

    // // const cacheKey = task.id
    // // 1. If there is already a cached result, return it immediately.
    // if (!options.forceRun && cache.contains(cacheKey)) {
    //   return yield* cache.get(cacheKey)
    // }
    // type DepsSuccessTypes = DependencySuccessTypes<T["dependencies"]>
    const dependencyResults: Record<string, unknown> = {}
    yield* Effect.logDebug("Running dependencies", {
      dependencies: task.provide,
      taskPath: taskPath,
    })
    const dependencyEffects = Object.entries(task.provide).map(
      ([dependencyName, dependency]) =>
        Effect.map(runTask(dependency), (result) => [
          dependencyName,
          result,
        ]) as Effect.Effect<[string, unknown], E, R>,
    )
    const results = yield* Effect.all(dependencyEffects, {
      concurrency: "unbounded",
    })
    for (const [dependencyName, dependencyResult] of results) {
      dependencyResults[dependencyName] = dependencyResult
    }

    const taskLayer = Layer.mergeAll(
      // configLayer,
      Layer.setConfigProvider(
        ConfigProvider.fromMap(new Map([...Array.from(configMap.entries())])),
      ),
    )

    // look here if cacheKey finds something. only after dependencies are run first
    // TODO: do we need access to dependencyResults inside the computeCacheKey?
    // const cacheKey = `${task.computeCacheKey ? task.computeCacheKey(task) : taskPath}:${taskPath}`
    const cacheKey = `${Option.match(task.computeCacheKey, {
      onSome: (computeCacheKey) => computeCacheKey(task),
      onNone: () => taskPath,
    })}:${taskPath}`
    // TODO: add taskPath
    const isCached = yield* cache.has(cacheKey)
    if (isCached && !options.forceRun) {
      return (yield* cache.get(cacheKey)) as A
    }

    const result = yield* task.effect.pipe(
      Effect.provide(taskLayer),
      Effect.provide(
        Layer.succeed(TaskInfo, {
          taskPath,
          // TODO: provide more?
        }),
      ),
      Effect.provide(
        Layer.succeed(DependencyResults, { dependencies: dependencyResults }),
      ),
    )
    // TODO: how do handle tasks which return nothing?
    yield* cache.set(cacheKey, result)

    return result
  })
}