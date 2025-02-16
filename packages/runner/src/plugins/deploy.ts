import { Effect, Match, Option } from "effect"
import type {
  BuilderResult,
  CrystalConfigFile,
  Scope,
  Task,
  TaskTree,
  TaskTreeNode,
} from "../types/types.js"
import { TaskCtx, getCanisterInfo, TaskInfo } from "../index.js"
import { loadCanisterId } from "../builders/custom.js"
import { Tags, type CanisterScope } from "../builders/types.js"

// /**
//  * Recursively adds a `deploy` task to every scope node.
//  *
//  * For any scope S (with a children record), the new type is the same
//  * as S except that in its children record a new key `deploy` of type Task is added.
//  * For every child that is itself a scope, we transform it recursively.
//  */
export type AddDeployToScope<S extends { children: Record<string, unknown> }> =
  S extends { children: infer C }
    ? Omit<S, "children"> & {
        children: {
          deploy: Task
        } & {
          [K in keyof C]: C[K] extends {
            _tag: "scope"
            children: Record<string, unknown>
          }
            ? AddDeployToScope<C[K]>
            : C[K]
        }
      }
    : S

const makeDeployTask = (scope: CanisterScope): Task => {
  return {
    _tag: "task",
    // TODO: hmmm?
    id: Symbol("canister/deploy"),
    dependencies: {},
    computeCacheKey: Option.none(),
    input: Option.none(),
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

// const transformScopes = <T extends TaskTreeNode, F extends (scope: T) => T>(
//   taskTreeNode: T,
//   fn: F,
// ) => {
//   return Match.type<TaskTreeNode>().pipe(
//     Match.tag("scope", (scope) => {
//       const transformedChildren = Object.entries(scope.children).map(([name, child]) => {
//         return [name, transformScopes(child, fn)]
//       })

//       // for (const [name, child] of Object.entries(scope.children)) {
//       //   transformedChildren[name] = transformScopes(child, fn)
//       // }
//       return fn({
//         ...scope,
//         children: transformedChildren,
//       })
//     }),
//     // Match.tag("builder", (builder) => {
//     //   return {
//     //     ...builder,
//     //     _scope: transformScopes(builder._scope, fn),
//     //   } satisfies BuilderResult
//     // }),
//     Match.tag("task", (task) => task),
//     Match.orElse(() => taskTreeNode),
//   )(taskTreeNode)
// }

// const transformScopes = <
//   T extends TaskTreeNode,
//   F extends <S extends Scope>(scope: S) => S,
// >(
//   taskTreeNode: T,
//   fn: F,
// ): T => {
//   return Match.type<TaskTreeNode>().pipe(
//     Match.tag("scope", (scope) => {
//       // // Transform children recursively and rebuild the children record
//       // const transformedChildren: Record<string, TaskTreeNode> = {};
//       // for (const [name, child] of Object.entries(scope.children)) {
//       //   transformedChildren[name] = transformScopes(child, fn);
//       // }
//       // // Apply the transformation function to the current scope and update its children
//       return fn(scope) as T // Assert type T to ensure type preservation
//     }),
//     Match.tag("task", (task) => task),
//     Match.orElse(() => taskTreeNode),
//   )(taskTreeNode) as T // Assert type T for the overall result
// }

const transformScopes = <T extends TaskTreeNode | TaskTree, F extends (scope: Scope) => Scope>(
  taskTree: T,
  fn: F,
) => {
  return Match.value(taskTree as TaskTree | TaskTreeNode).pipe(
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
    Match.tag("task", (task) => task),
    // TODO: do we need to refine?
    Match.when(Match.record, (taskTree) => {
      const transformedTree: Record<string, TaskTreeNode> = {}
      for (const [name, child] of Object.entries(taskTree)) {
        transformedTree[name] = transformScopes(child, fn)
      }
      return transformedTree
    }),
    Match.orElse(() => taskTree),
  ) as T
}

// // TODO: should be a plugin instead? pass in scope / builder and transform it
// export const deployTaskPlugin = <T extends TaskTreeNode>(taskTree: T) => {
//   // TODO: take canister scope and add deploy task to it
//   return transformScopes(taskTree, (scope) => {
//     if (scope.tags.includes(Tags.CANISTER)) {
//       const newScope = {
//         ...scope,
//         children: {
//           ...scope.children,
//           deploy: makeDeployTask(scope as CanisterScope),
//         },
//       }
//       return newScope
//     }
//     return scope
//   })
// }

// TODO: should be a plugin instead? pass in scope / builder and transform it
export const deployTaskPlugin = <T extends TaskTree>(taskTree: T) => {
  // TODO: take canister scope and add deploy task to it
  return transformScopes(taskTree, (scope) => {
    if (scope.tags.includes(Tags.CANISTER)) {
      const newScope = {
        ...scope,
        // TODO: if defined it wont be overridden?
        defaultTask: Option.some("deploy"),
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