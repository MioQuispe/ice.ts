import { expect, describe, it } from "vitest"
import {
  Effect,
  Layer,
  ManagedRuntime,
  Context,
  ConfigProvider,
  Exit,
  Cause,
  Stream,
  Chunk,
} from "effect"
import { NodeContext } from "@effect/platform-node"
import { FileSystem, CommandExecutor, Command, Path } from "@effect/platform"
import { NodeInspectSymbol } from "effect/Inspectable"
import { SystemError } from "@effect/platform/Error"
import { DevTools } from "@effect/experimental"
import { NodeRuntime, NodeSocket } from "@effect/platform-node"
import fs from "node:fs"
import path from "node:path"
import {
  CanisterIds,
  ConfigError,
  configLayer,
  createActorsEffect,
  createTaskStreamEffect,
  deployCanister,
  DeploymentError,
  CrystalEnvironment,
  CrystalConfig,
  getCanisterIdsEffect,
  getCurrentIdentityEffect,
  getIdentityEffect,
  runTasksEffect,
  type TaskCanisterConfiguration,
  type TaskContext,
  type TaskFullName,
} from "../index"
import { DIP721 } from "@crystal/canisters"
import { Actor, ActorSubclass } from "@dfinity/agent"

const mockCanisterIds = {
  internet_identity: { local: "rdmx6-jaaaa-aaaaa-aaadq-cai" },
  ledger: { local: "ryjl3-tyaaa-aaaaa-aaaba-cai" },
  dip721: { local: "dlbnd-beaaa-aaaaa-qaana-cai" },
}

const mockPem = `-----BEGIN PRIVATE KEY-----
MFMCAQEwBQYDK2VwBCIEIPA21+3x4vWMUMNEdytWJbkmsnxW6NbFEenOaH1T8BQo
oSMDIQBNhLmptpWBUDNmEXxaPw5LuHWSDCFU8eIC/PZPSN/7Og==
-----END PRIVATE KEY-----`

const FileSystemTest = FileSystem.makeNoop({
  readFileString: (_path: string, _encoding?: string) =>
    Effect.succeed(JSON.stringify(mockCanisterIds)),
})

const FileSystemTestLayer = Layer.succeed(FileSystem.FileSystem, FileSystemTest)

const FileSystemError = FileSystem.makeNoop({
  readFileString: (_path: string, _encoding?: string) =>
    Effect.fail(
      SystemError({
        reason: "NotFound",
        pathOrDescriptor: "canister_ids.json",
        module: "FileSystem",
        method: "readFileString",
        message: "File not found",
      }),
    ),
})

const FileSystemErrorLayer = Layer.succeed(
  FileSystem.FileSystem,
  FileSystemError,
)

/**
 * @group getCanisterIdsEffect
 */
describe("getCanisterIdsEffect", () => {
  it("should return canister IDs", async () => {
    const layers = Layer.mergeAll(
      NodeContext.layer,
      FileSystemTestLayer,
      configLayer,
    )
    const runtime = ManagedRuntime.make(layers)
    const program = getCanisterIdsEffect

    const result = await runtime.runPromise(program)
    expect(result).toEqual(mockCanisterIds)
  })

  it("should return error if file is not found", async () => {
    const layers = Layer.mergeAll(
      NodeContext.layer,
      FileSystemErrorLayer,
      configLayer,
    )
    const runtime = ManagedRuntime.make(layers)
    const program = Effect.flip(getCanisterIdsEffect)
    // const program = getCanisterIdsEffect
    const result = await runtime.runPromise(program)

    expect(result._tag).toBe("SystemError")
    expect(result.message).toBe("File not found")
  })
})

describe("getCurrentIdentityEffect", () => {
  it("should return current identity", async () => {
    const layers = Layer.mergeAll(
      NodeContext.layer,
      configLayer,
      // Layer.succeed(CommandExecutor.CommandExecutor, CommandExecutorTest),
    )
    const runtime = ManagedRuntime.make(layers)
    const program = getCurrentIdentityEffect
    const result = await runtime.runPromise(program)
    expect(result).toBe("default")
  })
})

/**
 * @group getIdentityEffect
 */
describe("getIdentityEffect", () => {
  const FileSystemTest = FileSystem.makeNoop({
    exists: (_path: string) => Effect.succeed(true),
    readFileString: (_path: string, _encoding?: string) =>
      Effect.succeed(mockPem),
  })

  const FileSystemError = FileSystem.makeNoop({
    exists: (_path: string) => Effect.succeed(false),
  })

  it("should return identity details", async () => {
    const layers = Layer.mergeAll(
      NodeContext.layer,
      Layer.succeed(FileSystem.FileSystem, FileSystemTest),
      configLayer,
    )
    const runtime = ManagedRuntime.make(layers)
    const program = getIdentityEffect()

    const result = await runtime.runPromise(program)
    expect(result.name).toBe("default")
    expect(result.principal).toBeDefined()
    expect(result.accountId).toBeDefined()
    expect(result.identity).toBeDefined()
    expect(result.pem).toBeDefined()
  })

  it("should fail if identity does not exist", async () => {
    const layers = Layer.mergeAll(
      NodeContext.layer,
      Layer.succeed(FileSystem.FileSystem, FileSystemError),
      configLayer,
    )
    const runtime = ManagedRuntime.make(layers)
    const program = Effect.flip(getIdentityEffect())

    const result = await runtime.runPromise(program)
    expect(result._tag).toBe("ConfigError")
    expect(result.message).toBe("Identity does not exist")
  })
})

/**
 * @group CrystalEnvironment.Live
 */
describe("CrystalEnvironment.Live", () => {
  // TODO: import of cystal.config.ts fails
  const FileSystemTest = FileSystem.makeNoop({
    exists: (_path: string) => Effect.succeed(true),
    readFileString: (_path: string, _encoding?: string) =>
      Effect.succeed(mockPem),
  })

  it("should create CrystalEnvironment with correct properties", async () => {
    const layers = Layer.mergeAll(
      NodeContext.layer,
      configLayer,
      Layer.provide(
        CrystalEnvironment.Live,
        Layer.mergeAll(
          configLayer,
          NodeContext.layer,
          Layer.succeed(FileSystem.FileSystem, FileSystemTest),
        ),
      ),
    )
    const runtime = ManagedRuntime.make(layers)
    const program = Effect.gen(function* () {
      const env = yield* CrystalEnvironment
      return env
    })

    // const runnable = Effect.provide(program, layers)
    // const result = await Effect.runPromise(runnable)
    const result = await runtime.runPromise(program)

    expect(result.network).toBe("local")
    expect(result.agent).toBeDefined()
    expect(result.identity).toBeDefined()
    expect(result.identity.getPrincipal()).toBeDefined()
  })

  it("should fail if identity does not exist", async () => {
    const FileSystemError = FileSystem.makeNoop({
      exists: (_path: string) => Effect.succeed(false),
    })

    const layers = Layer.mergeAll(
      NodeContext.layer,
      configLayer,
      Layer.provide(
        CrystalEnvironment.Live,
        Layer.mergeAll(
          configLayer,
          NodeContext.layer,
          Layer.succeed(FileSystem.FileSystem, FileSystemError),
        ),
      ),
    )
    const runtime = ManagedRuntime.make(layers)
    const program = Effect.gen(function* () {
      const env = yield* CrystalEnvironment
      return env
    })
    const result = await runtime.runPromiseExit(program)
    expect(
      Exit.match(result, {
        onFailure: (cause) => {
          const error = Cause.failureOption(cause)
          if (error._tag !== "Some") {
            return false
          }
          return (
            error.value._tag === "ConfigError" &&
            error.value.message === "Identity does not exist"
          )
        },
        onSuccess: () => false,
      }),
    ).toBe(true)
  })
})

/**
 * @group deployCanisterEffect
 */
describe("deployCanisterEffect", () => {
  // TODO: use real canister from @crystal/canisters
  const mockCanisterId = "rrkah-fqaaa-aaaaa-aaaaq-cai"
  let mockCanisterConfig: ReturnType<typeof DIP721> = {
    // TODO: fix DIP721 type
    ...DIP721({ custodians: [], logo: "", name: "", symbol: "" }),
  }
  // @ts-ignore
  mockCanisterConfig.dfx_js.canister_id = { local: mockCanisterId }

  const mockWasm = fs.readFileSync(mockCanisterConfig.wasm)
  const mockDidFactory = {
    idlFactory: {},
    init: () => ({}),
  }

  const FileSystemTest = FileSystem.makeNoop({
    exists: (_path: string) => Effect.succeed(true),
    readFile: (_path: string) => Effect.succeed(Buffer.from(mockWasm)),
    readFileString: (path: string) => {
      if (path.includes("identity.pem")) {
        return Effect.succeed(mockPem)
      }
      if (path.includes("canister_ids.json")) {
        return Effect.succeed(JSON.stringify(mockCanisterIds))
      }
      // if (path.includes(".did.js")) {
      //   return Effect.fail(
      //     new PlatformError({
      //       message: "Failed to import canister DID",
      //     }),
      //   )
      // }
      return Effect.succeed("")
    },
    writeFile: (path: string, data: Uint8Array) => Effect.succeed(data),
  })

  const FileSystemTestLayer = Layer.succeed(
    FileSystem.FileSystem,
    FileSystemTest,
  )

  const FileSystemError = FileSystem.makeNoop({
    exists: (_path: string) => Effect.succeed(false),
    readFile: (_path: string) =>
      Effect.fail(
        SystemError({
          reason: "NotFound",
          pathOrDescriptor: "wasm",
          module: "FileSystem",
          method: "readFile",
          message: "WASM file not found",
        }),
      ),
  })

  const FileSystemErrorLayer = Layer.succeed(
    FileSystem.FileSystem,
    FileSystemError,
  )

  it("should deploy a new canister successfully", async () => {
    const layers = Layer.mergeAll(
      NodeContext.layer,
      FileSystemTestLayer,
      configLayer,
      Layer.provide(
        CrystalEnvironment.Live,
        Layer.mergeAll(configLayer, NodeContext.layer, FileSystemTestLayer),
      ),
    )
    const runtime = ManagedRuntime.make(layers)

    const program = deployCanister("test_canister", mockCanisterConfig)

    const result = await runtime.runPromise(program)
    // TODO: get canister wasm hash instead from mgmt canister
    expect(result).toBe(mockCanisterId)
  })

  it("should fail if WASM file is not found", async () => {
    const layers = Layer.mergeAll(
      NodeContext.layer,
      FileSystemErrorLayer,
      configLayer,
      Layer.provide(
        CrystalEnvironment.Live,
        Layer.mergeAll(configLayer, NodeContext.layer, FileSystemTestLayer),
      ),
    )
    const runtime = ManagedRuntime.make(layers)

    const program = Effect.flip(
      deployCanister("test_canister", mockCanisterConfig),
    )

    const result = await runtime.runPromise(program)
    expect(result._tag).toBe("SystemError")
    expect(result.message).toBe("WASM file not found")
  })

  it("should fail if canister DID import fails", async () => {
    const FileSystemBadDid = FileSystem.makeNoop({
      exists: (_path: string) => Effect.succeed(true),
      readFile: (_path: string) => Effect.succeed(Buffer.from(mockWasm)),
      readFileString: (_path: string) =>
        Effect.fail(
          SystemError({
            reason: "NotFound",
            pathOrDescriptor: "candid",
            module: "FileSystem",
            method: "readFileString",
            message: "Candid file not found",
          }),
        ),
    })

    const layers = Layer.mergeAll(
      NodeContext.layer,
      Layer.succeed(FileSystem.FileSystem, FileSystemBadDid),
      configLayer,
      Layer.provide(
        CrystalEnvironment.Live,
        Layer.mergeAll(configLayer, NodeContext.layer, FileSystemTestLayer),
      ),
    )
    const runtime = ManagedRuntime.make(layers)

    const program = Effect.flip(
      deployCanister("test_canister", mockCanisterConfig),
    )

    const result = await runtime.runPromise(program)
    expect(result._tag).toBe("SystemError")
    expect(result.message).toContain("Candid file not found")
  })

  it("should handle canister creation failure", async () => {
    const FileSystemTestLayer = Layer.succeed(
      FileSystem.FileSystem,
      FileSystemError,
    )
    // Mock environment where canister creation fails

    const layers = Layer.mergeAll(
      NodeContext.layer,
      FileSystemTestLayer,
      configLayer,
      Layer.provide(
        CrystalEnvironment.Live,
        Layer.mergeAll(configLayer, NodeContext.layer, FileSystemTestLayer),
      ),
    )
    const runtime = ManagedRuntime.make(layers)

    const program = deployCanister("test_canister", mockCanisterConfig)

    const result = await runtime.runPromiseExit(program)
    expect(result.cause.error._tag).toBe("ConfigError")
    expect(result.cause.error.message).toBe("Identity does not exist")
  })
})

/**
 * @group createActorsEffect
 */
describe("createActorsEffect", () => {
  const mockCanisterId = "rrkah-fqaaa-aaaaa-aaaaq-cai"
  const mockCanisterConfig = {
    ...DIP721({ custodians: [], logo: "", name: "", symbol: "" }),
    dfx_js: {
      canister_id: { local: mockCanisterId },
    },
  }

  const FileSystemTest = FileSystem.makeNoop({
    exists: (_path: string) => Effect.succeed(true),
    readFileString: (path: string) => {
      if (path.includes("identity.pem")) {
        return Effect.succeed(mockPem)
      }
      if (path.includes("canister_ids.json")) {
        return Effect.succeed(
          JSON.stringify({
            test_canister: { local: mockCanisterId },
          }),
        )
      }
      return Effect.succeed("")
    },
  })

  const FileSystemError = FileSystem.makeNoop({
    exists: (_path: string) => Effect.succeed(false),
    readFileString: (_path: string) =>
      Effect.fail(
        SystemError({
          reason: "NotFound",
          pathOrDescriptor: "candid",
          module: "FileSystem",
          method: "readFileString",
          message: "Candid file not found",
        }),
      ),
  })

  it("should create actors successfully", async () => {
    const layers = Layer.mergeAll(
      NodeContext.layer,
      Layer.succeed(FileSystem.FileSystem, FileSystemTest),
      configLayer,
      Layer.provide(
        CrystalEnvironment.Live,
        Layer.mergeAll(
          configLayer,
          NodeContext.layer,
          Layer.succeed(FileSystem.FileSystem, FileSystemTest),
        ),
      ),
    )
    const runtime = ManagedRuntime.make(layers)

    const program = createActorsEffect({
      canisterList: ["test_canister"],
      canisterConfig: mockCanisterConfig,
    })

    const result = await runtime.runPromise(program)

    expect(result.test_canister).toBeDefined()
    expect(result.test_canister.canisterId).toBe(mockCanisterId)
    expect(result.test_canister.actor).toBeDefined()
    expect(result.test_canister.actor).toBeInstanceOf(Actor)
    // TODO: check that actor calls work
  })

  it("should fail if canister DID cannot be imported", async () => {
    const layers = Layer.mergeAll(
      NodeContext.layer,
      Layer.succeed(FileSystem.FileSystem, FileSystemError),
      configLayer,
      Layer.provide(
        CrystalEnvironment.Live,
        Layer.mergeAll(
          configLayer,
          NodeContext.layer,
          Layer.succeed(FileSystem.FileSystem, FileSystemTest),
        ),
      ),
    )
    const runtime = ManagedRuntime.make(layers)

    const program = Effect.flip(
      createActorsEffect({
        canisterList: ["test_canister"],
        canisterConfig: mockCanisterConfig,
        currentNetwork: "local",
      }),
    )

    const result = await runtime.runPromise(program)
    expect(result._tag).toBe("SystemError")
    expect(result.message).toContain("Candid file not found")
  })

  // it("should handle controller operations", async () => {
  //   const mockCommandExecutor = CommandExecutor.makeExecutor((_command: Command) =>
  //     Effect.succeed({
  //       [CommandExecutor.ProcessTypeId]: CommandExecutor.ProcessTypeId,
  //       pid: 1,
  //       isRunning: false,
  //       kill: () => Effect.unit,
  //       stdin: null,
  //       stdout: null,
  //       stderr: null,
  //       exitCode: 0,
  //       wait: () => Effect.succeed({ exitCode: 0, stderr: "", stdout: "success" }),
  //       toJSON: () => ({}),
  //       [Symbol.for('nodejs.util.inspect.custom')]: () => 'Process'
  //     })
  //   )

  //   const layers = Layer.mergeAll(
  //     NodeContext.layer,
  //     Layer.succeed(FileSystem.FileSystem, FileSystemTest),
  //     Layer.succeed(CommandExecutor.CommandExecutor, mockCommandExecutor),
  //     configLayer,
  //     Layer.provide(
  //       DfxEnvironmentLive,
  //       Layer.mergeAll(
  //         configLayer,
  //         NodeContext.layer,
  //         Layer.succeed(FileSystem.FileSystem, FileSystemTest)
  //       )
  //     )
  //   )
  //   const runtime = ManagedRuntime.make(layers)

  //   const program = Effect.gen(function* (_) {
  //     const actors = yield* createActorsEffect({
  //       canisterList: ["test_canister"],
  //       canisterConfig: mockCanisterConfig,
  //       currentNetwork: "local"
  //     })
  //     const actor = actors.test_canister

  //     // Test controller operations
  //     yield* Effect.promise(() => actor.addControllers(["controller-id"]))
  //     yield* Effect.promise(() => actor.setControllers(["controller-id"]))
  //     yield* Effect.promise(() => actor.getControllers())

  //     return actor
  //   })

  //   const result = await runtime.runPromise(program)
  //   expect(result).toBeDefined()
  //   expect(result.canisterId).toBe(mockCanisterId)
  // })

  // it("should handle failed controller operations", async () => {
  //   const mockCommandExecutor = CommandExecutor.makeExecutor((_command: Command) =>
  //     Effect.fail(new Error("Command failed"))
  //   )

  //   const layers = Layer.mergeAll(
  //     NodeContext.layer,
  //     Layer.succeed(FileSystem.FileSystem, FileSystemTest),
  //     Layer.succeed(CommandExecutor.CommandExecutor, mockCommandExecutor),
  //     configLayer,
  //     Layer.provide(
  //       DfxEnvironmentLive,
  //       Layer.mergeAll(
  //         configLayer,
  //         NodeContext.layer,
  //         Layer.succeed(FileSystem.FileSystem, FileSystemTest)
  //       )
  //     )
  //   )
  //   const runtime = ManagedRuntime.make(layers)

  //   const program = Effect.gen(function* (_) {
  //     const actors = yield* createActorsEffect({
  //       canisterList: ["test_canister"],
  //       canisterConfig: mockCanisterConfig,
  //       currentNetwork: "local"
  //     })
  //     const actor = actors.test_canister

  //     // Test failed controller operation
  //     const result = yield* Effect.either(
  //       Effect.promise(() => actor.setControllers(["controller-id"]))
  //     )

  //     return result
  //   })

  //   const result = await runtime.runPromise(program)
  //   expect(result._tag).toBe("Left")
  //   expect(result.left.message).toBe("Command failed")
  // })
})

/**
 * @group createTaskStreamEffect
 */
describe("createTaskStreamEffect", () => {
  const mockCanisterConfig: TaskCanisterConfiguration = {
    ...DIP721({ custodians: [], logo: "", name: "", symbol: "" }),
    candid: "test.did",
    wasm: "test.wasm",
    dfx_js: {
      canister_id: { local: "rrkah-fqaaa-aaaaa-aaaaq-cai" }
    }
  }

  const mockAsyncCanisterConfig = async (ctx: TaskContext) => mockCanisterConfig

  const mockScriptConfig = async (ctx: TaskContext) => {
    // TODO: use reference instead of string
    const result = await ctx.task("canisters:canister_1")
    return "mockScript returned"
  }

  const mockConfig = {
    canisters: {
      test_canister: mockCanisterConfig
    },
    scripts: {
      test_script: mockScriptConfig
    }
  }

  it("should create task stream for canister tasks", async () => {
    const tasks: Array<TaskFullName> = ["canisters:test_canister"]
    const layers = Layer.mergeAll(
      NodeContext.layer,
      Layer.succeed(FileSystem.FileSystem, FileSystemTest),
      configLayer,
      // Layer.provide(
      //   DfxEnvironmentLive,
      //   Layer.mergeAll(
      //     configLayer,
      //     NodeContext.layer,
      //     Layer.succeed(FileSystem.FileSystem, FileSystemTest),
      //   ),
      // ),
    )
    const runtime = ManagedRuntime.make(layers)

    const program = Effect.gen(function* (_) {
      const taskStream = createTaskStreamEffect(mockConfig, tasks)
      const result = yield* Stream.runCollect(taskStream)
      return Chunk.toReadonlyArray(result)
    })

    const result = await runtime.runPromise(program)
    expect(result).toBeDefined()
    expect(result).toEqual([{
      taskName: "canisters:test_canister",
      taskConfig: mockCanisterConfig
    }])
  })
  it("should handle async canister config", async () => {
    const mockAsyncConfig = {
      canisters: {
        test_canister: mockAsyncCanisterConfig
      },
      scripts: {}
    }
    const tasks = ["canisters:test_canister"]
    const layers = Layer.mergeAll(
      NodeContext.layer, 
      Layer.succeed(FileSystem.FileSystem, FileSystemTest),
      configLayer
    )
    const runtime = ManagedRuntime.make(layers)

    const program = Effect.gen(function* (_) {
      const taskStream = createTaskStreamEffect(mockAsyncConfig, tasks)
      const result = yield* Stream.runCollect(taskStream)
      return Chunk.toReadonlyArray(result)
    })

    const result = await runtime.runPromise(program)
    expect(result).toBeDefined()
    expect(result).toEqual([{
      taskName: "canisters:test_canister",
      taskConfig: mockCanisterConfig,
    }])
  })


  it("should create task stream for script tasks", async () => {
    const tasks = ["scripts:test_script"] 
    const layers = Layer.mergeAll(
      NodeContext.layer,
      Layer.succeed(FileSystem.FileSystem, FileSystemTest),
      configLayer
    )
    const runtime = ManagedRuntime.make(layers)

    const program = Effect.gen(function* (_) {
      const taskStream = createTaskStreamEffect(mockConfig, tasks)
      const result = yield* Stream.runCollect(taskStream)
      return Chunk.toReadonlyArray(result)
    })

    const result = await runtime.runPromise(program)
    expect(result).toBeDefined()
    expect(result).toEqual([{
      taskName: "scripts:test_script",
      taskConfig: "mockScript returned",
    }])
  })

  it("should handle dependencies correctly", async () => {
    const tasks = ["scripts:test_script"]
    const layers = Layer.mergeAll(
      NodeContext.layer,
      Layer.succeed(FileSystem.FileSystem, FileSystemTest),
      configLayer
    )
    const runtime = ManagedRuntime.make(layers)

    const program = Effect.gen(function* (_) {
      const taskStream = createTaskStreamEffect(mockConfig, tasks)
      const result = yield* Stream.runCollect(taskStream)
      return Chunk.toReadonlyArray(result)
    })

    const result = await runtime.runPromise(program)
    expect(result).toBeDefined()
    console.log("should handle dependencies correctly", result)
    expect(result).toEqual([{
      taskName: "canisters:test_canister",
      taskConfig: mockCanisterConfig
    }, {
      taskName: "scripts:test_script",
      taskConfig: "mockScript returned",
    }])
  })

  it("should throw error for invalid task names", async () => {
    const tasks = ["invalid:task"]
    const layers = Layer.mergeAll(
      NodeContext.layer,
      Layer.succeed(FileSystem.FileSystem, FileSystemTest),
      configLayer
    )
    const runtime = ManagedRuntime.make(layers)

    const program = Effect.gen(function* (_) {
      const taskStream = createTaskStreamEffect(mockConfig, tasks)
      const result = yield* Stream.runCollect(taskStream)
      return Chunk.toReadonlyArray(result)
    })

    await expect(runtime.runPromise(program)).rejects.toThrow()
  })
})

/**
 * @group runTasksEffect
 */

describe("runTasksEffect", () => {
  // Use existing mock canister config from earlier tests
  const mockCanisterId = "rrkah-fqaaa-aaaaa-aaaaq-cai"
  const mockCanisterConfig = {
    ...DIP721({ custodians: [], logo: "", name: "", symbol: "" }),
    dfx_js: {
      canister_id: { local: mockCanisterId }
    }
  }
  const mockCanisterConfig2 = {
    ...DIP721({ custodians: [], logo: "", name: "", symbol: "" }),
    dfx_js: {
      canister_id: { local: "bkyz2-fmaaa-aaaaa-qaaaq-cai" }
    }
  }
  //@ts-ignore
  const mockWasm = fs.readFileSync(mockCanisterConfig.wasm)
  const FileSystemTest = FileSystem.makeNoop({
    exists: (_path: string) => Effect.succeed(true),
    readFile: (_path: string) => Effect.succeed(Buffer.from(mockWasm)),
    readFileString: (path: string) => {
      if (path.includes("identity.pem")) {
        return Effect.succeed(mockPem)
      }
      if (path.includes("canister_ids.json")) {
        return Effect.succeed(JSON.stringify({
          test_canister: { local: mockCanisterId }
        }))
      }
      return Effect.succeed("")
    },
    writeFile: (_path: string, _data: Uint8Array) => Effect.unit
  })

  it("should execute tasks successfully", async () => {
    const mockConfig = {
      canisters: {
        test_canister: mockCanisterConfig
      },
      scripts: {}
    }

    const layers = Layer.mergeAll(
      NodeContext.layer,
      Layer.succeed(FileSystem.FileSystem, FileSystemTest),
      configLayer,
      Layer.provide(
        CrystalEnvironment.Live,
        Layer.mergeAll(
          configLayer,
          NodeContext.layer,
          Layer.succeed(FileSystem.FileSystem, FileSystemTest)
        )
      )
    )
    const runtime = ManagedRuntime.make(layers)

    const program = runTasksEffect(
      mockConfig,
      ["canisters:test_canister"]
    )

    const result = await runtime.runPromise(program)
    expect(result).toEqual({
      test_canister: { local: mockCanisterId }
    })
  })

  it("should handle dependencies correctly", async () => {
    const mockConfig = {
      canisters: {
        canister_1: {
          ...mockCanisterConfig,
          dependencies: [] as string[]
        },
        canister_2: {
          ...mockCanisterConfig2,
          dependencies: ["canisters:canister_1"]
        }
      },
      scripts: {}
    }

    const layers = Layer.mergeAll(
      NodeContext.layer,
      Layer.succeed(FileSystem.FileSystem, FileSystemTest),
      configLayer,
      Layer.provide(
        CrystalEnvironment.Live,
        Layer.mergeAll(
          configLayer,
          NodeContext.layer,
          Layer.succeed(FileSystem.FileSystem, FileSystemTest)
        )
      )
    )
    const runtime = ManagedRuntime.make(layers)

    const program = runTasksEffect(
      mockConfig,
      ["canisters:canister_2"]
    )

    const result = await runtime.runPromise(program)
    expect(result).toBeDefined()
    console.log("should handle dependencies correctly", result)
    expect(result.canister_1).toBeDefined()
    expect(result.canister_2).toBeDefined()
  })

  it("should fail if a dependency is missing", async () => {
    const mockConfig = {
      canisters: {
        test_canister: {
          ...mockCanisterConfig,
          dependencies: ["canisters:non_existent"]
        }
      },
      scripts: {}
    }

    const layers = Layer.mergeAll(
      NodeContext.layer,
      Layer.succeed(FileSystem.FileSystem, FileSystemTest),
      configLayer,
      Layer.provide(
        CrystalEnvironment.Live,
        Layer.mergeAll(
          configLayer,
          NodeContext.layer,
          Layer.succeed(FileSystem.FileSystem, FileSystemTest)
        )
      )
    )
    const runtime = ManagedRuntime.make(layers)

    const program = Effect.flip(runTasksEffect(
      mockConfig,
      ["canisters:test_canister"]
    ))

    const result = await runtime.runPromise(program)
    expect(result._tag).toBe("DependencyNotFoundError")
    expect(result.dependency).toBe("canisters:non_existent")
  })

  // it("should detect circular dependencies", async () => {
    // const mockConfig = {
    //   canisters: {
    //     canister_1: {
    //       ...mockCanisterConfig,
    //       dependencies: ["canisters:canister_2"]
    //     },
    //     canister_2: {
    //       ...mockCanisterConfig,
    //       dependencies: ["canisters:canister_1"]
    //     }
    //   },
    //   scripts: {}
    // }

    // const layers = Layer.mergeAll(
    //   NodeContext.layer,
    //   Layer.succeed(FileSystem.FileSystem, FileSystemTest),
    //   configLayer,
    //   Layer.provide(
    //     CrystalEnvironment.Live,
    //     Layer.mergeAll(
    //       configLayer,
    //       NodeContext.layer,
    //       Layer.succeed(FileSystem.FileSystem, FileSystemTest)
    //     )
    //   )
    // )
    // const runtime = ManagedRuntime.make(layers)

    // const program = Effect.flip(runTasksEffect(
    //   mockConfig,
    //   ["canisters:canister_1"]
    // ))

    // const result = await runtime.runPromise(program)
    // expect(result._tag).toBe("CircularDependencyError")
    // expect(result.path).toContain("canisters:canister_1")
    // expect(result.path).toContain("canisters:canister_2")
  // })
})


