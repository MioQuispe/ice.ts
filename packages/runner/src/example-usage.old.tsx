import { SomeCanister, ExternalCanister, ExternalGroup } from "canisters"
import { Effect, Layer, ManagedRuntime, Context } from "effect"
import { createCanister, installCanister } from "."

// Same as runtime / Crystal.make()
// TODO: Service? can we override compile / build / install?
// Or many that comes from canister which sets it in the runtime?
// Has to be composable
type Ctx = {
  agent: Agent
  identity: Identity
  users: {
    [key: string]: {
      identity: Identity
      principal: Principal
      accountId: string
    }
  }
  dfxConfig: DfxConfig
  tasks: Array<Task>
  runTask: <T>(taskName: string) => Promise<T>
}

const Crystal = (ctx: Ctx) => {
  const tag = Context.Tag("crystal")
  // TODO: create layers from ctx
  // TODO: Layer.mergeAll
  const context = Layer.succeed(ctx)

  // TODO: nope this is only for the default context
  // TODO: these are treated the same as tasks that are required
  // const context = {
  //   agent: Agent.make(),
  //   identity: Identity.make(),
  //   users: {},
  //   fs: FileSystem.make(),
  //   path: Path.make(),
  //   dfxConfig: DfxConfig.make(),
  //   runTask: (taskName) => Promise.resolve(taskName),
  //   ...ctx,
  // }

  return {
    // TODO: maybe make sure that the context is already provided? R should match the tasks R?
    canister: <A, E, R>(task: Task<A, E, R>) => {
      // TODO: this needs to warn if service is used which hasnt been provided
      // so we need to ...?
      // TODO: figure out where effect warns about services which have not been provided
      // it happens at the runtime / .runPromise part
      // Extract the context type, which is SomeContext
      // type R = Effect.Effect.Context<typeof task>
      return canister(context, task)
    },

    script: <A, E, R>(task: Task<A, E, R>) => {
      return script(context, task)
    },

    provide: (
      ...layers: [
        Layer.Layer<never, any, any>,
        ...Array<Layer.Layer<never, any, any>>,
      ]
    ) => {
      const layer = Layer.mergeAll(...layers)
      // TODO: service provide to tasks
      // TODO: runtime??
      // TODO: keep in closure
      return Crystal({ ...ctx })
    },
  }
}

// TODO; can we export default and declare in one statement?
// By defining it here, we can provide the runtime to the tasks
export const crystal = Crystal({
  users: {},
}).provide(SomeCanister)

// TODO: does it extend Layer? how does it interact with provide?
// The whole module is a Scope?
interface Scope<A, E, R> {
  __tags: Array<any>
  __description: string
  __tasks: {
    [key: string]: Task<A, E, R> | Scope<A, E, R>
  }
}

interface Task<A, E, R> {
  __task: Effect.Effect<A, E, R>
  __description: string
  __tags: Array<any>
  // TODO: hmm? is this needed?
  __flags: {
    [key: `--${string}`]: any
  }
  __transformArgs?: (args: string[]) => any[]
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

// TODO: warn about context if not provided
export const canister = (
  ctx: Ctx,
  // TODO: rust / motoko / etc.
  config: {
    src: string
    wasm: string
    candid: string
  }
) => {
  // TODO: convert async to effect
  // let effect: Effect.Effect<A, E, R>
  // if (task instanceof Promise) {
  //   effect = Effect.tryPromise<A, E>({
  //     try: () => task,
  //     catch: Effect.fail,
  //   })
  // } else {
  //   const effect = task
  // }
  // type C = Effect.Effect.Context<typeof effect>
  // TODO: use ctx

  // TODO: builder api
  const scope = {
    __tags: [Tags.CANISTER],
    __description: "some description",
    // TODO: default implementations
    __tasks: {
      // TODO: we need to provide the context. do we do it here or later?
      create: {
        __task: createCanister(config),
        __description: "some description",
        __tags: [],
        __ctx: ctx,
      },
      // TODO: maybe just the return value of install? like a cleanup
      delete: {
        __task: deleteCanister(config),
        __description: "some description",
        __tags: [],
        __ctx: ctx,
      },
      build: {
        __task: buildCanister(config),
        __description: "some description",
        __tags: [],
        __ctx: ctx,
      },
      install: {
        __task: installCanister(config),
        // __transformArgs: (args) => args,
        __description: "some description",
        __tags: [],
        __ctx: ctx,
      },
    },
    // TODO: in the future?
    // __render: () => {}
  }
  return {
    install: (task) => {
      // TODO: we need to create the task
      return {
        ...scope,
        __tasks: {
          ...scope.__tasks,
          install: Effect.gen(function* () {
            const result = yield* Effect.tryPromise({
              try: () => task(args, ctx),
              catch: Effect.fail,
            })
            const canisterConfig = {
              ...config,
              args: result,
            }
            return yield* installCanister(canisterConfig)
          }),
        },
      }
    },
    delete: (task) => {
      return {
        ...scope,
        __tasks: {
          ...scope.__tasks,
          delete: task,
        },
      }
    },
    build: (task) => {
      return {
        ...scope,
        __tasks: {
          ...scope.__tasks,
          build: task,
        },
      }
    },
  }
}

// export const task: Task = script(function* () {
//   const result = yield* SomeCanister
//   return result
// })
// task.__description = "some description"
// task.__tags = [Tags.CANISTER]
// // for cli
// task.__transformArgs = (args) => args

// {
//     tags: [Tags.CANISTER],
//     description: "some description",
//     // TODO: what format? do we need it?
//     args: [],
//     // TODO: do we need dependencies?
//     dependencies: [],
//     task,
//   }

export const script = <A, E, R>(ctx: Ctx, task: Effect.Effect<A, E, R> | () => Promise<A>) => {
  let effect: Effect.Effect<A, E, R>
  if (task instanceof Promise) {
    effect = Effect.tryPromise<A, E>({
      try: () => task,
      catch: Effect.fail,
    })
  } else {
    effect = task
  }
  return {
    __tags: [Tags.SCRIPT],
    __description: "some description",
    __transformArgs: (args) => args,
    // __context: ctx,
    __task: effect,
  }
}

const SomeScope: Scope<A, E, R> = {
  // TODO: if someone defines this, but we dont want it, how do we override it?
  // is there some better way to define tags?
  __tags: [Tags.GROUP],
  __description: "some description",
  // TODO: this can just be import * as SomeGroup from "some-external-plugin"?
  // but how do we add context to the group? are they effects too?
  __tasks: {
    SomeCanister,
  },
}

export const OtherCanister = canister({
  src: "test.did",
  wasm: "test.wasm",
})

export const ExternalCanister = crystal.canister(ExternalCanisterTask)
// TODO: how to add task args?
// TODO: how to register sub-tasks and why?

// export const InternetIdentity = crystal
//   .canister(async (args, ctx) => {
//     const arg1 = args[0]
//     // TODO: how to provide SomeCanister
//     // TODO: how to specify it depends only on initialization step
//     // maybe we just memoize the result and don't re-run it
//     const sendArgs = ["1", "2"]
//     const result = await ctx.runTask(() => SomeCanister(sendArgs))
//     // TODO: initialization args separate from compilation / build step
//     const artifacts = await ctx.buildCustom({
//       // canister_id: result.canister_id,
//       candid: "test.did",
//       wasm: "test.wasm",
//     })
//     const canisterId = await ctx.install({
//       artifacts,
//       args: {
//         some_arg: "some_value",
//       },
//     })
//     return {
//       canisterId,
//     }
//     // TODO: this is a group actually. no need for subTasks or provide. it can be done with a group
//     // but we need a better name for groups. runtime, context, or something else? should be easy to understand
//   })
//   .script(async (canister, ctx) => {
//     const result = await canister.init()
//     return result
//   })
//   // .subTasks({
//   //   SomeCanister,
//   // })
//   .provide(SomeCanister)

export const InternetIdentity = crystal
  // TODO: should be available as data / metadata on the task?
  .canister({
    src: "test.did",
    wasm: "test.wasm",
  })
  .install(async (args, ctx) => {
    const result = await ctx.runTask(SomeCanister)
    // TODO: canister must be initialized. init does it under the hood?
    // TODO: how to type check init args?
    return {
      controller: result.canister_id,
    }
  })
  .build(async (args, ctx) => {
    const result = await ctx.buildCustom({
      candid: "test.did",
      wasm: "test.wasm",
    })
    return result
  })
  .compile(async (args, ctx) => {
    const result = await ctx.compile({
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
  init(async (args, ctx) => {
    const result = await ctx.runTask(SomeCanister)
    return result
  }),
  build(async (args, ctx) => {
    const result = await ctx.buildCustom({
      candid: "test.did",
      wasm: "test.wasm",
    })
    return result
  }),
  compile(async (args, ctx) => {
    const result = await ctx.compile({
      candid: "test.did",
      wasm: "test.wasm",
    })
    return result
  }),
)

const InternetIdentity2 = canister(runtime, {
  candid: "test.did",
  wasm: "test.wasm",
})

const TestTask = task(async (ctx) => {
  const result = await ctx.runTask(InternetIdentity)
  console.log(result)
  return result
})

// export const someGroup = {}
