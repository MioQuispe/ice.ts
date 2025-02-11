import {
  Effect,
  Console,
  Match,
  Option,
  SubscriptionRef,
  Stream,
  Fiber,
  ManagedRuntime,
  Layer,
  Logger,
} from "effect"
import { Spinner, ProgressBar, UnorderedList } from "@inkjs/ui"
import React, {
  useState,
  useEffect,
  useSyncExternalStore,
  createContext,
  useContext,
} from "react"
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
import type {
  CrystalConfigFile,
  Scope,
  Task as TaskType,
  TaskTree,
  TaskTreeNode,
  CrystalConfig,
} from "../../types/types.js"
import { filterTasks, runTaskByPath, TUILayer } from "../../index.js"
import { TaskList, Task, type StateOthers } from "./components/Task.js"

export function useSynchronizedState<T>(defaultState: T) {
  const [subscriptionRef] = useState(() =>
    Effect.runSync(SubscriptionRef.make<T>(defaultState)),
  )

  const value = useSyncExternalStore(
    (callback) =>
      Stream.runForEach(subscriptionRef.changes, () =>
        Effect.sync(callback),
      ).pipe(Effect.runCallback),
    () => {
      return Effect.runSync(SubscriptionRef.get(subscriptionRef))
    },
  )

  return [value, subscriptionRef] as const
}

const TaskTreeListItem = <A, E, R, I>({
  label,
  task,
  path,
  ...props
}: {
  label: string
  task: TaskType<A, E, R, I>
  path: string[]
}) => {
  const { isFocused } = useFocus()
  // TODO: get state
  const [state, setState] = useState<StateOthers>("pending")
  const [logs, setLogs] = useState<string[]>([])
  // TODO: should logs be separate for each task?
  const { runTask } = useCrystal()
  useInput(
    async (input, key) => {
      if (!isFocused) {
        return
      }
      if (key.return || input === " ") {
        setState((currentState) =>
          currentState === "loading" ? "pending" : "loading",
        )
        try {
          await runTask(path)
          setState("success")
        } catch (e) {
          console.log(e)
          setState("error")
        }
      }
    },
    { isActive: isFocused },
  )
  return (
    <>
      <Task
        state={isFocused ? "selected" : state}
        label={label}
        {...props}
      />
      <Text>{logs.join("\n")}</Text>
    </>
  )
}
const CrystalContext = createContext<{
  logs: string[]
  runTask: (path: string[]) => Promise<void>
} | null>(null)

// TODO: add generic type
const CrystalProvider: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  const [logs, setLogs] = useState<string[]>([])
  const [runtime] = useState(() => {
    // TODO: create Logger here
    const logger = Logger.make(({ logLevel, message }) => {
      setLogs((prevLogs) => [...prevLogs, `${logLevel}: ${message}`])
    })
    const runtime = ManagedRuntime.make(
      Layer.mergeAll(
        TUILayer,
        //   Logger.pretty,
        // TODO: custom logger
        Logger.replace(Logger.defaultLogger, logger),
      ),
    )
    return runtime
  })

  const runTask = async (path: string[]) => {
    // TODO: what do we return from this? async await?
    // @ts-ignore
    await runtime.runPromise(runTaskByPath(path.join(":")))
  }

  return (
    <CrystalContext.Provider value={{ logs, runTask }}>
      {children}
    </CrystalContext.Provider>
  )
}

export const useCrystal = () => {
  const crystal = useContext(CrystalContext)
  if (!crystal) {
    throw new Error("useCrystal must be used within a CrystalProvider")
  }
  return crystal
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
                task={node}
                path={fullPath}
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

function useStdoutDimensions(): [number, number] {
  const { stdout } = useStdout()
  const [dimensions, setDimensions] = useState<[number, number]>([
    stdout.columns,
    stdout.rows,
  ])

  useEffect(() => {
    const handler = () => setDimensions([stdout.columns, stdout.rows])
    stdout.on("resize", handler)
    return () => {
      stdout.off("resize", handler)
    }
  }, [stdout])

  return dimensions
}

const Logs = () => {
  const { logs } = useCrystal()
  const [columns, rows] = useStdoutDimensions()
  const offset = columns * rows * 0.25
  // const offset = 40
  const start = logs.length - offset > 0 ? logs.length - offset : 0
  const end = logs.length - 1

  return (
    <Box>
      <Text>{logs.slice(start, end).join("\n")}</Text>
    </Box>
  )
}

const CliApp = ({
  config,
  taskTree,
}: {
  config: CrystalConfig
  taskTree: TaskTree
}) => {
  const focusManager = useFocusManager()
  const [editingField, setEditingField] = useState<string>()
  const { exit } = useApp()
  useEffect(() => {
    focusManager.enableFocus()
  }, [focusManager])

  useInput(
    (input, key) => {
      if (key.upArrow) {
        focusManager.focusPrevious()
      } else if (key.downArrow) {
        focusManager.focusNext()
      } else if (key.escape || input === "q") {
        exit()
      }
    },
    { isActive: !editingField },
  )

  return (
    <CrystalProvider>
      <Box margin={2} rowGap={2} flexDirection="row">
        {/* <Static items={[crystalConfig]}>
          {(item) => (
          )}
        </Static> */}
        <Box width="50%">
          <TaskTreeList
            key={"tasks"}
            taskTree={taskTree}
            title="Available tasks"
          />
        </Box>

        <Box width="50%" height="100%" flexDirection="column">
          <Text color="blue">Logs</Text>
          <Box borderStyle="single" width="100%" height="100%">
            <Logs />
          </Box>
        </Box>
      </Box>
    </CrystalProvider>
  )
}

// export const uiTask = () => {
export const uiTask = ({
  config,
  taskTree,
}: {
  config: CrystalConfig
  taskTree: TaskTree
}) =>
  Effect.gen(function* () {
    //   yield* Console.log("Coming soon...")
    // TODO: react-ink
    //   render(<App />)
    const allTasks = yield* filterTasks(
      taskTree,
      (task) => task._tag === "task",
    )
    render(<CliApp config={config} taskTree={taskTree} />)
    //   void render(
    //     React.createElement(Text, {}, "Hello world")
    //   )
  })