import { Effect, Console, Match, Option } from "effect"
import { Spinner, ProgressBar, UnorderedList } from "@inkjs/ui"
import React, { useState, useEffect } from "react"
import { Box, render, Text, Static, useFocusManager, useInput } from "ink"
import type {
  CrystalConfigFile,
  Scope,
  Task as TaskType,
  TaskTree,
  TaskTreeNode,
} from "../../types/types.js"
import { filterTasks } from "../../index.js"
import { TaskList, Task } from 'ink-task-list';
import spinners from 'cli-spinners';

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
      <Text>{title}</Text>
      {keys.map((key) => {
        const node =
          taskTree._tag === "scope"
            ? (taskTree as Scope).children[key]
            : (taskTree as TaskTree)[key]
        const fullPath = [ ...path, key,]
        console.log(fullPath)
        const state = fullPath.includes("cap") ? "loading" : "pending"
        if (node._tag === "task") {
          return (
            <>
            <Task state={state} spinner={spinners.dots} key={fullPath.join(":")} label={fullPath.join(":")} />
            {/* <Text>
                {node.description}
            </Text> */}
            </>
          )
        }
        if (node._tag === "builder") {
          return (
            <>
              <UnorderedList.Item key={fullPath.join(":")}>
                <TaskTreeList
                  key={fullPath.join(":")}
                  taskTree={node._scope}
                  title={fullPath.join(":")}
                  path={fullPath}
                />
              </UnorderedList.Item>
            </>
          )
        }
        if (node._tag === "scope") {
          return (
            <>
              <UnorderedList.Item key={fullPath.join(":")}>
                <TaskTreeList
                  key={fullPath.join(":")}
                  taskTree={node.children}
                  title={fullPath.join(":")}
                  path={fullPath}
                />
              </UnorderedList.Item>
            </>
          )
        }
      })}
    </TaskList>
  )
}

const CliApp = ({ crystalConfig }: { crystalConfig: CrystalConfigFile }) => {

    const focusManager = useFocusManager();
    const [editingField, setEditingField] = useState<string>();

    useEffect(() => {
      focusManager.enableFocus();
    }, [focusManager]);

    useInput(
        (input, key) => {
          if (key.upArrow) {
            focusManager.focusPrevious();
          } else if (key.downArrow) {
            focusManager.focusNext();
          }
        },
        { isActive: !editingField }
      );

    return (
      <Box margin={2} flexDirection="column">
        {/* <Static items={[crystalConfig]}>
          {(item) => (
          )}
        </Static> */}
        <TaskTreeList key={"tasks"} taskTree={crystalConfig} title="Available tasks" />
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
    render(
        <CliApp crystalConfig={crystalConfig} />
    )
    //   void render(
    //     React.createElement(Text, {}, "Hello world")
    //   )
  })
