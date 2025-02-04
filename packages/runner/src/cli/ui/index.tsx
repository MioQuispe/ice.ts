import { Effect, Console, Match, Option } from "effect"
import { Spinner, ProgressBar, UnorderedList } from "@inkjs/ui"
import React, { useState, useEffect } from "react"
import {
  Box,
  render,
  Text,
  Static,
  useFocusManager,
  useInput,
  useFocus,
  useApp,
} from "ink"
import type {
  CrystalConfigFile,
  Scope,
  Task as TaskType,
  TaskTree,
  TaskTreeNode,
} from "../../types/types.js"
import { filterTasks } from "../../index.js"
import { TaskList, Task } from "ink-task-list"
import spinners from "cli-spinners"

const App = () => {
  const [counter, setCounter] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCounter((previousCounter) => previousCounter + 1)
    }, 100)

    return () => {
      clearInterval(timer)
    }
  }, [])

  return <Text color="green">tests passed</Text>
}

const renderTasks = (
  taskTree: TaskTree | Scope,
  render: (node: TaskTreeNode, path: string[]) => React.ReactNode,
  path: string[] = [],
) => {
  const keys =
    taskTree._tag === "scope"
      ? Object.keys(taskTree.children)
      : Object.keys(taskTree)
  for (const key of keys) {
    const currentNode =
      taskTree._tag === "scope"
        ? (taskTree as Scope).children[key]
        : (taskTree as TaskTree)[key]
    const node = Match.value(currentNode).pipe(
      Match.tag("task", (task): TaskType => task),
      Match.tag("scope", (scope): Scope => scope),
      // TODO: should we transform the whole tree once, and remove builders?
      Match.tag("builder", (result): Scope => result._scope),
      Match.option,
    )
    if (Option.isSome(node)) {
      const fullPath = [...path, key]
      // if (node.value._tag === "scope") {
      //   const children = Object.keys(node.value.children)
      //   // TODO: call itself recursively
      //   render
      // }
      // TODO: this returns immediately
      return render(node.value, fullPath)
    }
  }
}

type StateOthers = "pending" | "success" | "warning" | "error" | "loading"

const TaskTreeListItem = ({ label, ...props }: { label: string }) => {
  const { isFocused } = useFocus()
  // TODO: get state
  const [state, setState] = useState<StateOthers>("pending")
  useInput(
    (input, key) => {
      if (!isFocused) {
        return
      }
      if (key.return || input === " ") {
        setState(currentState => currentState === "loading" ? "pending" : "loading")
      }
    },
    { isActive: isFocused },
  )
  return <Task state={isFocused ? "success" : state} spinner={spinners.dots} label={label} {...props} />
}

const TaskTreeList = ({
  taskTree,
  title,
  path = [],
}: {
  taskTree: TaskTree | Scope
  title: string
  path?: string[]
}) => {
  const keys =
    taskTree._tag === "scope"
      ? Object.keys(taskTree.children)
      : Object.keys(taskTree)
  return (
    <TaskList>
      {keys.map((key) => {
        const node =
          taskTree._tag === "scope"
            ? (taskTree as Scope).children[key]
            : (taskTree as TaskTree)[key]
        const fullPath = [...path, key]
        // const state = fullPath.includes("cap") ? "loading" : "pending"
        // TODO: get task state and allow running tasks
        const state = "pending"
        if (node._tag === "task") {
          return (
            <>
              <TaskTreeListItem
                key={fullPath.join(":")}
                label={fullPath[fullPath.length - 1]}
              />
              {/* <Text>
                {node.description}
            </Text> */}
            </>
          )
        }
        if (node._tag === "builder") {
          return (
            <>
              <Task
                key={fullPath.join(":")}
                isExpanded
                label={fullPath[fullPath.length - 1]}
              >
                <TaskTreeList
                  key={fullPath.join(":")}
                  taskTree={node._scope}
                  title={fullPath.join(":")}
                  path={fullPath}
                />
              </Task>
            </>
          )
        }
        if (node._tag === "scope") {
          return (
            <>
              <Task
                key={fullPath.join(":")}
                isExpanded
                label={fullPath[fullPath.length - 1]}
              >
                <TaskTreeList
                  key={fullPath.join(":")}
                  taskTree={node.children}
                  title={fullPath.join(":")}
                  path={fullPath}
                />
              </Task>
            </>
          )
        }
      })}
    </TaskList>
  )
}

const CliApp = ({ crystalConfig }: { crystalConfig: CrystalConfigFile }) => {
  const focusManager = useFocusManager()
  const [editingField, setEditingField] = useState<string>()

  useEffect(() => {
    focusManager.enableFocus()
  }, [focusManager])

  useInput(
    (input, key) => {
      if (key.upArrow) {
        focusManager.focusPrevious()
      } else if (key.downArrow) {
        focusManager.focusNext()
      }
    },
    { isActive: !editingField },
  )

  return (
    <Box margin={2} flexDirection="column">
      {/* <Static items={[crystalConfig]}>
          {(item) => (
          )}
        </Static> */}
      <TaskTreeList
        key={"tasks"}
        taskTree={crystalConfig}
        title="Available tasks"
      />
    </Box>
  )
}

// export const uiTask = () => {
export const uiTask = (crystalConfig: CrystalConfigFile) =>
  Effect.gen(function* () {
    //   yield* Console.log("Coming soon...")
    // TODO: react-ink
    //   render(<App />)
    const allTasks = yield* filterTasks(
      crystalConfig,
      (task) => task._tag === "task",
    )
    render(<CliApp crystalConfig={crystalConfig} />)
    //   void render(
    //     React.createElement(Text, {}, "Hello world")
    //   )
  })
