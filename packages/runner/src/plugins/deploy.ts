import { Effect, Match, Option } from "effect"
import type {
  BuilderResult,
  Scope,
  Task,
  TaskTree,
  TaskTreeNode,
} from "../types/types.js"
import { TaskCtx, getCanisterInfo, TaskInfo } from "../index.js"
import { loadCanisterId } from "../builders/custom.js"
import { Tags, type CanisterScope } from "../builders/types.js"

const makeDeployTask = (scope: CanisterScope): Task => {
  return {
    _tag: "task",
    // TODO: hmmm?
    id: Symbol("canister/deploy"),
    dependencies: {},
    computeCacheKey: Option.none(),
    // TODO: we only want to warn at a type level?
    // TODO: type Task
    provide: {},
    effect: Effect.gen(function* () {
      const { runTask } = yield* TaskCtx
      yield* Effect.logInfo("Starting custom canister deployment")
      const { taskPath } = yield* TaskInfo
      const canisterName = taskPath.split(":").slice(0, -1).join(":")

      yield* Effect.logInfo("Loading canister ID", { canisterName })
      let canisterId = yield* loadCanisterId(taskPath).pipe(
        Effect.catchAll((e) => {
          //   Effect.logError(e.message)
          return Effect.succeed(undefined)
        }),
      )
      if (!canisterId) {
        canisterId = (yield* runTask(scope.children.create)) as string
      } else {
        // TODO: check if canister has been created already
        const canisterInfo = yield* getCanisterInfo(canisterId)
        // TODO: this may get out of sync when we change the name or taskPath
        // fix somehow
        const canisterExists = canisterInfo.status !== "not_installed"
        if (canisterExists) {
          yield* Effect.logInfo("Canister already exists")
        } else {
          canisterId = (yield* runTask(scope.children.create)) as string
        }
      }
      const build = yield* runTask(scope.children.build)
      const bindings = yield* runTask(scope.children.bindings)
      const install = yield* runTask(scope.children.install)
      yield* Effect.logInfo("Canister deployed successfully")
      return canisterId
    }),
    description: "Deploy canister code",
    tags: [Tags.CANISTER, Tags.DEPLOY],
  }
}

const transformScopes = <T extends TaskTreeNode, F extends (scope: Scope) => Scope>(
  taskTreeNode: T,
  fn: F,
) => {
  return Match.value(taskTreeNode as TaskTreeNode).pipe(
    Match.tag("scope", (scope: Scope) => {
      const transformedChildren: Record<string, TaskTreeNode> = {}
      for (const [name, child] of Object.entries(scope.children)) {
        transformedChildren[name] = transformScopes(child, fn)
      }
      return fn({
        ...scope,
        children: transformedChildren,
      })
    }),
    Match.tag("builder", (builder: BuilderResult): BuilderResult => {
      return {
        ...builder,
        _scope: transformScopes(builder._scope, fn),
      }
    }),
    Match.tag("task", (task) => task),
    Match.orElse(() => taskTreeNode),
  ) as T & { children: { deploy: Task } }
}
// TODO: should be a plugin instead? pass in scope / builder and transform it
export const deployTaskPlugin = <T extends TaskTreeNode>(taskTree: T) => {
  // TODO: take canister scope and add deploy task to it
  return transformScopes(taskTree, (scope) => {
    if (scope.tags.includes(Tags.CANISTER)) {
      const newScope = {
        ...scope,
        children: {
          ...scope.children,
          deploy: makeDeployTask(scope as CanisterScope),
        },
      }
      return newScope
    }
    return scope
  })
}
