import { NodeContext } from "@effect/platform-node"
import { layerMemory } from "@effect/platform/KeyValueStore"
import {
	Effect,
	Layer,
	Logger,
	LogLevel,
	ManagedRuntime,
	Record,
	Ref,
} from "effect"
import { describe, expect, it } from "vitest"
import { task } from "../../src/builders/task.js"
import { configLayer } from "../../src/index.js"
import {
	CanisterIds,
	CanisterIdsService,
} from "../../src/services/canisterIds.js"
import { CLIFlags } from "../../src/services/cliFlags.js"
import { DefaultConfig } from "../../src/services/defaultConfig.js"
import { ICEConfigService } from "../../src/services/iceConfig.js"
import { Moc } from "../../src/services/moc.js"
import { picReplicaImpl } from "../../src/services/pic/pic.js"
import { DefaultReplica } from "../../src/services/replica.js"
import { TaskArgsService } from "../../src/services/taskArgs.js"
import { TaskRegistry } from "../../src/services/taskRegistry.js"
import { executeTasks } from "../../src/tasks/lib.js"
import { CachedTask, ICEConfig, TaskTree } from "../../src/types/types.js"

const DefaultReplicaService = Layer.effect(DefaultReplica, picReplicaImpl).pipe(
	Layer.provide(NodeContext.layer),
	Layer.provide(configLayer),
)

const makeTestRuntime = (
	{ cliTaskArgs = { positionalArgs: [], namedArgs: {} }, taskArgs = {} } = {
		cliTaskArgs: { positionalArgs: [], namedArgs: {} },
		taskArgs: {},
	},
	taskTree: TaskTree = {},
) => {
	const globalArgs = { network: "local", logLevel: "debug" } as const
	const config = {} satisfies Partial<ICEConfig>
	const testICEConfigService = Layer.succeed(ICEConfigService, {
		config,
		taskTree,
	})
	
	let testCanisterIds: CanisterIds = {}
	const testCanisterIdsService = Layer.succeed(CanisterIdsService, {
		getCanisterIds: () => Effect.succeed(testCanisterIds),
		setCanisterId: (params: {
			canisterName: string
			network: string
			canisterId: string
		}) =>
			Effect.gen(function* () {
				testCanisterIds = {
					...testCanisterIds,
					[params.canisterName]: {
						...(testCanisterIds[params.canisterName] ?? {}),
						canisterId: params.canisterId,
					},
				}
			}),
		removeCanisterId: (canisterName: string) =>
			Effect.gen(function* () {
				testCanisterIds = Record.filter(
					testCanisterIds,
					(_, key) => key !== canisterName,
				)
			}),
		flush: () => Effect.gen(function* () {}),
	})
	
	const layer = Layer.mergeAll(
		NodeContext.layer,
		TaskRegistry.Live.pipe(
			Layer.provide(layerMemory),
			Layer.provide(NodeContext.layer),
		),
		DefaultReplicaService,
		DefaultConfig.Live.pipe(Layer.provide(DefaultReplicaService)),
		Moc.Live.pipe(Layer.provide(NodeContext.layer)),
		configLayer,
		testCanisterIdsService,
		testICEConfigService,
		Layer.succeed(CLIFlags, {
			globalArgs,
			taskArgs: cliTaskArgs,
		}),
		Layer.succeed(TaskArgsService, { taskArgs }),
		Logger.pretty,
		Logger.minimumLogLevel(LogLevel.Debug),
	)
	return ManagedRuntime.make(layer)
}

// Mock canister deployment task that simulates the real deploy behavior
const makeCanisterDeployTask = (name: string, canisterId: string): CachedTask<{ canisterId: string, deployed: boolean, deployCount: number }> => {
	let deployCount = 0
	
	const cachedTask = {
		...task()
			.run(() => Effect.succeed({
				canisterId,
				deployed: true,
				deployCount: ++deployCount
			}))
			.make(),
		computeCacheKey: (input) => `${name}-deploy-${canisterId}-${JSON.stringify(input)}`,
		input: () => Effect.succeed({ canisterId, name }),
		encode: (v, input) => Effect.succeed(JSON.stringify(v)),
		decode: (v: string | Uint8Array<ArrayBufferLike>, input) => {
			const decoded = JSON.parse(v as string)
			return Effect.succeed(decoded)
		},
		encodingFormat: "string" as const,
	} satisfies CachedTask<{ canisterId: string, deployed: boolean, deployCount: number }>
	
	return cachedTask
}

// Mock replica service that can be "restarted"
const makeReplicaService = () => {
	const replicaState = Ref.unsafeMake({ isRunning: true, restartCount: 0 })
	
	const restartReplica = () => {
		return Ref.update(replicaState, (state) => ({
			isRunning: true,
			restartCount: state.restartCount + 1
		}))
	}
	
	const getReplicaState = () => Ref.get(replicaState)
	
	return { restartReplica, getReplicaState }
}

describe("Replica Cache Invalidation", () => {
	it("should invalidate cached canister deployment tasks when replica is restarted", async () => {
		const canisterId = "test-canister-id"
		const deployTask = makeCanisterDeployTask("test_canister", canisterId)
		
		const taskTree = {
			test_canister: deployTask,
		}
		const runtime = makeTestRuntime({}, taskTree)
		
		// First deployment - should be a cache miss
		const firstResult = await runtime.runPromise(
			Effect.gen(function* () {
				const taskEffects = yield* executeTasks([deployTask])
				const results = yield* Effect.all(taskEffects, {
					concurrency: "unbounded",
				})
				return results
			}),
		)
		
		expect(firstResult[0]?.result).toEqual({
			canisterId,
			deployed: true,
			deployCount: 1
		})
		
		// Second deployment without replica restart - should be a cache hit
		const secondResult = await runtime.runPromise(
			Effect.gen(function* () {
				const taskEffects = yield* executeTasks([deployTask])
				const results = yield* Effect.all(taskEffects, {
					concurrency: "unbounded",
				})
				return results
			}),
		)
		
		// This should still be deployCount: 1 because of cache hit
		expect(secondResult[0]?.result).toEqual({
			canisterId,
			deployed: true,
			deployCount: 1
		})
		
		// TODO: Simulate replica restart here
		// This is where the bug manifests - the cache should be invalidated
		// but currently it's not happening
		
		// Third deployment after replica restart - should be a cache miss but currently isn't
		const thirdResult = await runtime.runPromise(
			Effect.gen(function* () {
				const taskEffects = yield* executeTasks([deployTask])
				const results = yield* Effect.all(taskEffects, {
					concurrency: "unbounded",
				})
				return results
			}),
		)
		
		// BUG: This currently fails because the cache is not invalidated
		// The deployCount should be 2 (indicating a fresh deployment)
		// but it's still 1 (cache hit)
		expect(thirdResult[0]?.result).toEqual({
			canisterId,
			deployed: true,
			deployCount: 2  // This expectation will fail, demonstrating the bug
		})
	})
	
	it("should detect replica state changes and invalidate relevant caches", async () => {
		const { restartReplica, getReplicaState } = makeReplicaService()
		
		// Create a cached task that depends on replica state
		const replicaStateTask: CachedTask<{ replicaRestartCount: number }> = {
			...task()
				.run(() => 
					Effect.gen(function* () {
						const state = yield* getReplicaState()
						return { replicaRestartCount: state.restartCount }
					})
				)
				.make(),
			computeCacheKey: (input) => `replica-state-task-${JSON.stringify(input)}`,
			input: () => Effect.succeed({}),
			encode: (v, input) => Effect.succeed(JSON.stringify(v)),
			decode: (v: string | Uint8Array<ArrayBufferLike>, input) => 
				Effect.succeed(JSON.parse(v as string)),
			encodingFormat: "string" as const,
		}
		
		const taskTree = {
			replica_state: replicaStateTask,
		}
		const runtime = makeTestRuntime({}, taskTree)
		
		// First run - should get initial state
		const firstResult = await runtime.runPromise(
			Effect.gen(function* () {
				const taskEffects = yield* executeTasks([replicaStateTask])
				const results = yield* Effect.all(taskEffects, {
					concurrency: "unbounded",
				})
				return results
			}),
		)
		
		expect(firstResult[0]?.result).toEqual({
			replicaRestartCount: 0
		})
		
		// Restart replica
		await runtime.runPromise(restartReplica())
		
		// Second run after restart - should detect the change and invalidate cache
		const secondResult = await runtime.runPromise(
			Effect.gen(function* () {
				const taskEffects = yield* executeTasks([replicaStateTask])
				const results = yield* Effect.all(taskEffects, {
					concurrency: "unbounded",
				})
				return results
			}),
		)
		
		// BUG: This currently fails because the cache is not invalidated
		// when replica state changes
		expect(secondResult[0]?.result).toEqual({
			replicaRestartCount: 1  // This expectation will fail, demonstrating the bug
		})
	})
	
	it("should distinguish between replica-dependent and replica-independent tasks", async () => {
		// Create a task that doesn't depend on replica state
		const staticTask: CachedTask<{ value: string }> = {
			...task()
				.run(() => Effect.succeed({ value: "static-value" }))
				.make(),
			computeCacheKey: (input) => `static-task-${JSON.stringify(input)}`,
			input: () => Effect.succeed({}),
			encode: (v, input) => Effect.succeed(JSON.stringify(v)),
			decode: (v: string | Uint8Array<ArrayBufferLike>, input) => 
				Effect.succeed(JSON.parse(v as string)),
			encodingFormat: "string" as const,
		}
		
		// Create a task that depends on replica state (canister deployment)
		const deployTask = makeCanisterDeployTask("another_canister", "another-id")
		
		const taskTree = {
			static_task: staticTask,
			deploy_task: deployTask,
		}
		const runtime = makeTestRuntime({}, taskTree)
		
		// First run - both tasks should execute
		const firstResult = await runtime.runPromise(
			Effect.gen(function* () {
				const taskEffects = yield* executeTasks([staticTask, deployTask])
				const results = yield* Effect.all(taskEffects, {
					concurrency: "unbounded",
				})
				return results
			}),
		)
		
		expect(firstResult.find(r => r.taskId === staticTask.id)?.result).toEqual({
			value: "static-value"
		})
		expect(firstResult.find(r => r.taskId === deployTask.id)?.result).toEqual({
			canisterId: "another-id",
			deployed: true,
			deployCount: 1
		})
		
		// TODO: Simulate replica restart
		
		// Second run after restart
		const secondResult = await runtime.runPromise(
			Effect.gen(function* () {
				const taskEffects = yield* executeTasks([staticTask, deployTask])
				const results = yield* Effect.all(taskEffects, {
					concurrency: "unbounded",
				})
				return results
			}),
		)
		
		// Static task should still be cached (no replica dependency)
		expect(secondResult.find(r => r.taskId === staticTask.id)?.result).toEqual({
			value: "static-value"
		})
		
		// Deploy task should be re-executed (replica dependency)
		// BUG: This currently fails because all tasks are cached regardless of replica state
		expect(secondResult.find(r => r.taskId === deployTask.id)?.result).toEqual({
			canisterId: "another-id",
			deployed: true,
			deployCount: 2  // This expectation will fail, demonstrating the bug
		})
	})
})