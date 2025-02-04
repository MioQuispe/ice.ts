import { Effect, Match } from "effect"
import type {
  BuilderResult,
  Scope,
  Task,
  TaskTree,
  TaskTreeNode,
} from "../types/types.js"
import { TaskCtx, getCanisterInfo, Tags, TaskInfo } from "../index.js"
import { loadCanisterId } from "../core/builder.js"

type CanisterScope = Scope & {
  children: {
    create: Task
    bindings: Task
    build: Task
    install: Task
  }
}

const makeDeployTask = (scope: CanisterScope): Task => {
  return {
    _tag: "task",
    // TODO: hmmm?
    id: Symbol("customCanister/deploy"),
    dependencies: [
      // TODO: we only want to warn at a type level?
    ], // TODO: type Task
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
        const canisterExists = canisterInfo.status !== "not_installed"
        if (canisterExists) {
          yield* Effect.logInfo("Canister already exists")
        } else {
          canisterId = (yield* runTask(scope.children.create)) as string
        }
      }
      const bindings = yield* runTask(scope.children.bindings)
      const build = yield* runTask(scope.children.build)
      const install = yield* runTask(scope.children.install)
      yield* Effect.logInfo("Canister deployed successfully")
    }),
    description: "Deploy canister code",
    tags: [Tags.CANISTER, Tags.DEPLOY],
  }
}

const transformScopes = (
  taskTreeNode: TaskTreeNode,
  fn: (scope: Scope) => Scope,
): TaskTreeNode => {
  return Match.value(taskTreeNode).pipe(
    Match.tag("scope", (scope) => {
      const transformedChildren: Record<string, TaskTreeNode> = {}
      for (const [name, child] of Object.entries(scope.children)) {
        transformedChildren[name] = transformScopes(child, fn)
      }
      return fn({
        ...scope,
        children: transformedChildren,
      })
    }),
    Match.tag("builder", (builder) => {
      return {
        ...builder,
        _scope: transformScopes(builder._scope, fn),
      } as BuilderResult
    }),
    Match.tag("task", (task) => task),
    Match.orElse(() => taskTreeNode),
  )
}
// TODO: should be a plugin instead? pass in scope / builder and transform it
export const deployTaskPlugin = (taskTree: TaskTreeNode): TaskTreeNode => {
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
