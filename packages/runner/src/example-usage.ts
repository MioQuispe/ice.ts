import { SomeCanister, ExternalCanister, ExternalGroup } from "canisters"
import { Crystal } from "@crystal/runner"
import { Effect } from "effect"

// TODO: Service? can we override compile / build / install?
// Or many that comes from canister which sets it in the runtime?
// Has to be composable
type CrystalRuntime = {
  agent: Agent
  identity: Identity
  users: {
    [key: string]: {
      identity: Identity
      principal: Principal
      accountId: string
    }
  }
  fs: FileSystem
  path: Path
  dfxConfig: DfxConfig
  runTask: <T>(taskName: string) => Promise<T>
}

type Task<A, E, R> = {
  tags: string[]
  description: string
  args: any[]
  environment: CrystalRuntime
  task: Effect.Effect<A, E, R>
}

// The whole module is a TaskGroup?
type TaskGroup<A, E, R> = {
  // TODO: do we need this? is this just unnecessary inheritance?
  tags: string[]
  description: string
  tasks: {
    [key: string]: Task<A, E, R> | TaskGroup<A, E, R>
  }
}

// TODO: import from @crystal/runner
const Tags = {
  CANISTER: Symbol("canister"),
  GROUP: Symbol("group"),
  TASK: Symbol("task"),
  SCRIPT: Symbol("script"),
}

// TODO: need to group these kinds of tasks
// returns { _tag: "canister", task: () => Promise<{ canister_id: string }> }
// TODO: some kind of metadata?
export const canister = (task: () => Promise<{ canister_id: string }>) => {
  return {
    tags: [Tags.CANISTER],
    description: "some description",
    // TODO: what format? do we need it?
    args: [],
    // TODO: do we need dependencies?
    dependencies: [],
    environment: {},
    task,
  }
}

export const script = <A>(task: () => Promise<A>) => {
  return {
    tags: [Tags.SCRIPT],
    task,
  }
}
// TODO; can we export default and declare in one statement?
// By defining it here, we can provide the runtime to the tasks
export const crystal = Crystal.make({
  // dfx config
  provide: {
    SomeCanister,
  },
}).provide(SomeCanister)

// TODO: model as Context
const SomeGroup: TaskGroup<A, E, R> = {
  // TODO: if someone defines this, but we dont want it, how do we override it?
  // is there some better way to define tags?
  tags: [Tags.GROUP],
  description: "some description",
  // TODO: this can just be import * as SomeGroup from "some-external-plugin"?
  // but how do we add context to the group? are they effects too?
  tasks: {
    SomeCanister,
  },
}

export const ExternalCanister = crystal.canister(ExternalCanisterTask)
// TODO: how to add task args?
// TODO: how to register sub-tasks and why?
export const InternetIdentity = crystal
  .canister(async ({ args, env }) => {
    // TODO: problem: how can we add types and descriptions?
    // maybe we need a fluent interface
    const arg1 = args[0]
    // TODO: how to provide SomeCanister
    // TODO: how to specify it depends only on initialization step
    // maybe we just memoize the result and don't re-run it
    const sendArgs = ["1", "2"]
    const result = await env.runTask(SomeCanister, sendArgs)
    // TODO: initialization args separate from compilation / build step
    const artifacts = await env.buildCustom({
      // canister_id: result.canister_id,
      candid: "test.did",
      wasm: "test.wasm",
    })
    const canisterId = await env.install({
      artifacts,
      args: {
        some_arg: "some_value",
      },
    })
    return {
      canisterId,
    }
    // TODO: this is a group actually. no need for subTasks or provide. it can be done with a group
    // but we need a better name for groups. runtime, context, or something else? should be easy to understand
  })
  .script(async (canister, env) => {
    const result = await canister.init()
    return result
  })
  // .subTasks({
  //   SomeCanister,
  // })
  .provide(SomeCanister)

export const InternetIdentity = crystal
  .canister({
    src: "test.did",
    wasm: "test.wasm",
  })
  .init(async (args, env) => {
    const result = await env.runTask(SomeCanister)
    return result
  })
  .build(async (args, env) => {
    const result = await env.buildCustom({
      candid: "test.did",
      wasm: "test.wasm",
    })
    return result
  })
  .compile(async (args, env) => {
    const result = await env.compile({
      candid: "test.did",
      wasm: "test.wasm",
    })
    return result
  })

export const InternetIdentity2 = crystal.pipe(
  canister({
    src: "test.did",
    wasm: "test.wasm",
  }),
  // TODO: are these subTasks? yes they are
  // how do we define them?
  init(async (args, env) => {
    const result = await env.runTask(SomeCanister)
    return result
  }),
  build(async (args, env) => {
    const result = await env.buildCustom({
      candid: "test.did",
      wasm: "test.wasm",
    })
    return result
  }),
  compile(async (args, env) => {
    const result = await env.compile({
      candid: "test.did",
      wasm: "test.wasm",
    })
    return result
  })
)

const GenStyle = canister.gen(function* () {
  const result = yield* SomeCanister
  return result
})
const genStyle = GenStyle.provide(SomeCanister)

const InternetIdentity2 = canister({
  candid: "test.did",
  wasm: "test.wasm",
})

const TestTask = task(async (env) => {
  const result = await env.runTask(InternetIdentity)
  console.log(result)
  return result
})

// export const someGroup = {}