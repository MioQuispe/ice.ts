import { Effect, Match, Option } from "effect"
import type {
  BuilderResult,
  Scope,
  Task,
  TaskTree,
  TaskTreeNode,
} from "../types/types.js"
import { TaskCtx, getCanisterInfo, TaskInfo } from "../index.js"
import { Tags } from "../builders/types.js"
import { loadCanisterId } from "../builders/custom.js"
import {
  Box,
  render,
  Text,
  Static,
  useFocusManager,
  useInput,
  useFocus,
  useApp,
  useStdout,
} from "ink"
import React, { useState, useEffect } from "react"
import type { HttpAgent, SignIdentity } from "@dfinity/agent"
import { TextInput } from "@inkjs/ui"

const CandidUI = ({
  canisterId,
  canisterName,
  agent,
  identity,
}: {
  canisterId: string
  canisterName: string
  agent: HttpAgent
  identity: SignIdentity
}) => {

  return (
    <Box>
      <Text>{canisterName}</Text>
      <Text>{canisterId}</Text>
      <TextInput placeholder="write value..." onSubmit={() => {}} />
    </Box>
  )
}

type CanisterScope = Scope & {
  children: {
    create: Task
    bindings: Task
    build: Task
    install: Task
  }
}

const makeCandidUITask = (scope: CanisterScope): Task => {
  return {
    _tag: "task",
    // TODO: get from task?
    id: Symbol("canister/candid_ui"),
    provide: {},
    dependencies: {},
    computeCacheKey: Option.none(),
    // TODO: do we only want to warn at a type level?
    // TODO: type Task
    effect: Effect.gen(function* () {
      const { runTask, agent, identity } = yield* TaskCtx
      const { taskPath } = yield* TaskInfo
      const canisterName = taskPath.split(":").slice(0, -1).join(":")
      const canisterId = yield* loadCanisterId(taskPath)
      // TODO: exits immediately
      render(<CandidUI canisterId={canisterId} canisterName={canisterName} agent={agent} identity={identity} />)
    }),
    description: "Open canister candid ui",
    tags: [Tags.CANISTER, Tags.UI],
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
export const candidUITaskPlugin = (taskTree: TaskTreeNode): TaskTreeNode => {
  return transformScopes(taskTree, (scope) => {
    if (scope.tags.includes(Tags.CANISTER)) {
      const newScope = {
        ...scope,
        children: {
          ...scope.children,
          candid_ui: makeCandidUITask(scope as CanisterScope),
        },
      }
      return newScope
    }
    return scope
  })
}
