import { NodeContext } from "@effect/platform-node"
import { layerMemory } from "@effect/platform/KeyValueStore"
import fs from "node:fs"
import { Effect, Layer, Logger, LogLevel, ManagedRuntime, Ref } from "effect"
import { Principal } from "@dfinity/principal"
import { Ed25519KeyIdentity } from "@dfinity/identity"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
	BindingsTask,
	BuildTask,
	CanisterScope,
	CanisterScopeSimple,
	configLayer,
	CreateTask,
	customCanister,
	CustomCanisterConfig,
	InstallTask,
	// telemetryLayer,
} from "../../src/index.js"
import { CanisterIdsService } from "../../src/services/canisterIds.js"
import { CLIFlags } from "../../src/services/cliFlags.js"
import { DefaultConfig } from "../../src/services/defaultConfig.js"
import { ICEConfigService } from "../../src/services/iceConfig.js"
import { Moc } from "../../src/services/moc.js"
import { picReplicaImpl } from "../../src/services/pic/pic.js"
import { DefaultReplica, Replica } from "../../src/services/replica.js"
import { TaskArgsService } from "../../src/services/taskArgs.js"
import { TaskRegistry } from "../../src/services/taskRegistry.js"
import { executeTasks, topologicalSortTasks } from "../../src/tasks/lib.js"
import { runTask } from "../../src/tasks/run.js"
import { ICEConfig, Task, TaskTree } from "../../src/types/types.js"
import { telemetryExporter, telemetryLayer, makeTestLayer } from "./setup.js"

const DefaultReplicaService = Layer.effect(DefaultReplica, picReplicaImpl).pipe(
	Layer.provide(NodeContext.layer),
	Layer.provide(configLayer),
)

// Not needed for now

// const program = Effect.gen(function* () {
// 	const replica = yield* DefaultReplica
// 	const topology = yield* replica.getTopology()
// 	return topology
// }).pipe(Effect.provide(DefaultReplicaService))

// const topology = await Effect.runPromise(program)
// const serializableTopology = topology.map((t) => [
// 	t.type,
// 	t.canisterRanges.map((r) => [r.start.toHex(), r.end.toHex()]),
// ])
// fs.writeFileSync(
// 	"topology.json",
// 	JSON.stringify(serializableTopology, null, 2),
// )

type SubnetType = "II" | "Application" | "Fiduciary" | "NNS" | "SNS" | "Bitcoin"

const subnetRanges: Record<SubnetType, [string, string][]> = {
	II: [
		["00000000000000070101", "00000000000000070101"],
		["00000000021000000101", "00000000021FFFFF0101"],
		["FFFFFFFFFFC000000101", "FFFFFFFFFFCFFFFF0101"],
	],
	Application: [["FFFFFFFFFF9000000101", "FFFFFFFFFF9FFFFF0101"]],
	Fiduciary: [
		["00000000023000000101", "00000000023FFFFF0101"],
		["FFFFFFFFFFB000000101", "FFFFFFFFFFBFFFFF0101"],
	],
	NNS: [
		["00000000000000000101", "00000000000000060101"],
		["00000000000000080101", "00000000000FFFFF0101"],
		["FFFFFFFFFFE000000101", "FFFFFFFFFFEFFFFF0101"],
	],
	SNS: [
		["00000000020000000101", "00000000020FFFFF0101"],
		["FFFFFFFFFFD000000101", "FFFFFFFFFFDFFFFF0101"],
	],
	Bitcoin: [
		["0000000001A000000101", "0000000001AFFFFF0101"],
		["FFFFFFFFFFA000000101", "FFFFFFFFFFAFFFFF0101"],
	],
}

const generateRandomCanisterIdInRange = (
	startHex: string,
	endHex: string,
): string => {
	const start = BigInt(`0x${startHex}`)
	const end = BigInt(`0x${endHex}`)
	const range = end - start + 1n

	// Generate random BigInt within range
	const randomBytes = new Uint8Array(10)
	crypto.getRandomValues(randomBytes)

	let randomBigInt = 0n
	for (let i = 0; i < 10; i++) {
		randomBigInt = (randomBigInt << 8n) + BigInt(randomBytes[i]!)
	}

	const scaledRandom = start + (randomBigInt % range)

	// Convert back to 10-byte array
	const hex = scaledRandom.toString(16).padStart(20, "0")
	const bytes = new Uint8Array(10)
	for (let i = 0; i < 10; i++) {
		bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
	}

	return Principal.fromUint8Array(bytes).toString()
}

// const generateRandomCanisterIdInSubnet = (subnetType: SubnetType): string => {
//   const subnet = subnetRanges.find(([type]) => type === subnetType)
//   if (!subnet) {
//     throw new Error(`Unknown subnet type: ${subnetType}`)
//   }

//   const [, ranges] = subnet
//   // Pick a random range within the subnet
//   const randomRange = ranges[Math.floor(Math.random() * ranges.length)]
//   const [startHex, endHex] = randomRange

//   return generateRandomCanisterIdInRange(startHex, endHex)
// }

// Updated makeCanisterId function for your test
const makeCanisterId = (
	ranges: [string, string][] = subnetRanges.NNS,
): string => {
	const randomRange = ranges[Math.floor(Math.random() * ranges.length)]
	const [startHex, endHex] = randomRange!

	return generateRandomCanisterIdInRange(startHex, endHex)
	//   return generateRandomCanisterIdInSubnet(subnetType)
}

// const makeCanisterId = (): string => {
// 	// Generate a random 10-byte array for canister ID
// 	const randomBytes = new Uint8Array(10)
// 	crypto.getRandomValues(randomBytes)

// 	return Principal.fromUint8Array(randomBytes).toString()
// }

// const makePrincipal = () => {
// 	Ed25519KeyIdentity.generate().getPrincipal()
// }

const makeTestRuntime = (
	{ cliTaskArgs = { positionalArgs: [], namedArgs: {} }, taskArgs = {} } = {
		cliTaskArgs: { positionalArgs: [], namedArgs: {} },
		taskArgs: {},
	},
	taskTree: TaskTree = {},
) => {
	const layer = makeTestLayer({ cliTaskArgs, taskArgs }, taskTree)
	return ManagedRuntime.make(layer)
}

// const makeTestRuntime = (
// 	{ cliTaskArgs = { positionalArgs: [], namedArgs: {} }, taskArgs = {} } = {
// 		cliTaskArgs: { positionalArgs: [], namedArgs: {} },
// 		taskArgs: {},
// 	},
// 	taskTree: TaskTree = {},
// ) => {
// 	const globalArgs = { network: "local", logLevel: "debug" } as const
// 	const config = {} satisfies Partial<ICEConfig>
// 	// const taskTree = {} satisfies TaskTree
// 	const testICEConfigService = ICEConfigService.of({
// 		config,
// 		taskTree,
// 	})

// 	const DefaultConfigLayer = DefaultConfig.Live.pipe(
// 		Layer.provide(DefaultReplicaService),
// 	)
// 	const ICEConfigLayer = Layer.succeed(ICEConfigService, testICEConfigService)
// 	const CLIFlagsLayer = Layer.succeed(CLIFlags, {
// 		globalArgs,
// 		taskArgs: cliTaskArgs,
// 	})
// 	const TaskArgsLayer = Layer.succeed(TaskArgsService, { taskArgs })
// 	// Layer.succeed(CLIFlags, {
// 	// 	globalArgs,
// 	// 	taskArgs: cliTaskArgs,
// 	// }),
// 	// Layer.succeed(TaskArgsService, { taskArgs }),
// 	const layer = Layer.mergeAll(
// 		telemetryLayer,
// 		NodeContext.layer,
// 		CLIFlagsLayer,
// 		TaskArgsLayer,
// 		ICEConfigLayer,
// 		DefaultConfigLayer,
// 		TaskRegistry.Live.pipe(
// 			// TODO: double-check that this works
// 			// Layer.provide(layerFileSystem(".ice/cache")),
// 			Layer.provide(layerMemory),
// 			Layer.provide(NodeContext.layer),
// 		),
// 		DefaultReplicaService,
// 		Moc.Live.pipe(Layer.provide(NodeContext.layer)),
// 		configLayer,
// 		CanisterIdsService.Test,
// 		Logger.pretty,
// 		Logger.minimumLogLevel(LogLevel.Debug),
// 	)
// 	return ManagedRuntime.make(layer)
// }

const makeTestCanister = () => {
	const canisterConfig = {
		wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
		candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
	}
	const test_canister = customCanister(canisterConfig)
		.installArgs(async ({ ctx }) => {
			return []
		})
		.make()

	return {
		canisterConfig,
		canister: test_canister,
	}
}

const initializeCanister = <T extends CanisterScope>(canister: T) =>
	Effect.gen(function* () {
		const { result: createResult } = yield* runTask(
			canister.children.create,
		)
		const {
			result: { wasmPath, candidPath },
		} = yield* runTask(canister.children.build)
		const {
			result: { didJSPath, didTSPath },
		} = yield* runTask(canister.children.bindings)
		return {
			canisterId: createResult,
			wasmPath,
			candidPath,
			didJSPath,
			didTSPath,
		}
	})

describe("custom builder", () => {
	it("deploy should work", async () => {
		const test_canister = customCanister({
			// TODO: no empty strings!
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		}).make()
		const taskTree = {
			test_canister,
		}
		const progress: Array<string> = []
		const tasks = [test_canister.children.deploy]
		const runtime = makeTestRuntime({}, taskTree)
		// const result = await runtime.runPromise()
		const result = await runtime.runPromise(
			Effect.gen(function* () {
				const result = yield* runTask(test_canister.children.deploy)
				return result
			}),
		)
		expect(result.result).toMatchObject({
			canisterId: expect.any(String),
			canisterName: expect.any(String),
		})
	})

	it("should execute canister tasks in correct dependency order", async () => {
		const { canister: test_canister } = makeTestCanister()
		// Track execution order by wrapping tasks

		// const trackTask = <T extends Task>(task: T) => ({
		// 	...task,
		// 	effect: Effect.gen(function* () {
		// 		executionOrder.push(task.description)
		// 		const result = yield* task.effect
		// 		return result
		// 	}),
		// })

		// const trackingTasks = [
		//     test_canister.children.create,
		//     test_canister.children.build,
		//     test_canister.children.bindings,
		//     test_canister.children.install,
		// ]
		// const tasks = topologicalSortTasks(
		// 	new Map(trackingTasks.map((task) => [task.id, task])),
		// )

		const taskTree = {
			test_canister,
		}

		const runtime = makeTestRuntime({}, taskTree)

		await runtime.runPromise(
			Effect.gen(function* () {
				// const {
				// 	canisterId,
				// 	wasmPath,
				// 	candidPath,
				// 	didJSPath,
				// 	didTSPath,
				// } = yield* initializeCanister(test_canister)

				// // TODO: ctx.runTask doesnt use the same runtime... dynamic tasks problem
				// yield* runTask(test_canister.children.install, {
				//     canisterId,
				//     wasm: wasmPath,
				//     candid: candidPath,
				//     mode: "reinstall",
				//     // didJSPath,
				//     // didTSPath,
				// })
				yield* runTask(test_canister.children.deploy) // TODO: should have length 5 of tasks
				// yield* Metrics

				// TODO: .pipe(span / observe / tracing)
				// const executionOrder: Array<string> = []

				// const taskEffects = yield* executeTasks(tasks)

				// const results = yield* Effect.all(taskEffects, {
				// 	concurrency: "unbounded",
				// })
				// return results
				// return executionOrder
			}),
		)
		const executionOrder = telemetryExporter
			.getFinishedSpans()
			.filter((s) => s.name === "task_execute_effect")
		// .filter((s) => s.attributes?.["result"])

		// telemetryExporter.export()

		console.log(executionOrder)
		console.log(executionOrder.length)
		expect(executionOrder).toHaveLength(4)

		// Should execute in dependency order: create, build, bindings, install_args, install
		expect(
			executionOrder.filter(
				(s) => s.attributes?.["taskPath"] === "test_canister:create",
			).length > 0,
		).toBeTruthy()
		expect(
			executionOrder.filter(
				(s) => s.attributes?.["taskPath"] === "test_canister:build",
			).length > 0,
		).toBeTruthy()
		expect(
			executionOrder.filter(
				(s) => s.attributes?.["taskPath"] === "test_canister:bindings",
			).length > 0,
		).toBeTruthy()
		expect(
			executionOrder.filter(
				(s) => s.attributes?.["taskPath"] === "test_canister:install",
			).length > 0,
		).toBeTruthy()

		// Create should be first
		// expect(executionOrder.indexOf("Create custom canister")).toBeLessThan(
		// 	executionOrder.indexOf("Build custom canister"),
		// )
		// expect(executionOrder.indexOf("Build custom canister")).toBeLessThan(
		// 	executionOrder.indexOf("Install canister code"),
		// )
	})

	it("should handle multiple independent canisters", async () => {
		const canister1 = customCanister({
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		}).make()

		const canister2 = customCanister({
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		}).make()

		const taskTree = {
			canister1,
			canister2,
		}

		const runtime = makeTestRuntime({}, taskTree)

		// Deploy both canisters
		const results = await runtime.runPromise(
			Effect.gen(function* () {
				const result1 = yield* runTask(canister1.children.deploy)
				const result2 = yield* runTask(canister2.children.deploy)
				return [result1, result2]
			}),
		)

		expect(results).toHaveLength(2)
		expect(results[0]!.result).toMatchObject({
			canisterId: expect.any(String),
			canisterName: expect.any(String),
		})
		expect(results[1]!.result).toMatchObject({
			canisterId: expect.any(String),
			canisterName: expect.any(String),
		})

		// Should have different canister IDs
		expect(results[0]!.result.canisterId).not.toBe(
			results[1]!.result.canisterId,
		)
	})

	it("should handle canister dependencies", async () => {
		const dependency_canister = customCanister({
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		}).make()

		const main_canister = customCanister({
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		})
			.dependsOn({
				dependency: dependency_canister.children.install,
			})
			.deps({
				dependency: dependency_canister.children.install,
			})
			.installArgs(async ({ ctx, deps }) => {
				// Use the dependency canister in install args
				expect(deps.dependency.canisterId).toBeTruthy()
				return []
			})
			.make()

		const taskTree = {
			dependency_canister,
			main_canister,
		}

		const runtime = makeTestRuntime({}, taskTree)

		const result = await runtime.runPromise(
			Effect.gen(function* () {
				const result = yield* runTask(main_canister.children.deploy)
				return result
			}),
		)

		expect(result.result).toMatchObject({
			canisterId: expect.any(String),
			canisterName: expect.any(String),
		})
	})

	it("should handle task failure propagation", async () => {
		const failing_canister = customCanister(() => {
			throw new Error("Configuration failed")
		}).make()

		const taskTree = {
			failing_canister,
		}

		const runtime = makeTestRuntime({}, taskTree)

		await expect(
			runtime.runPromise(
				Effect.gen(function* () {
					const result = yield* runTask(
						failing_canister.children.deploy,
					)
					return result
				}),
			),
		).rejects.toThrow()
	})

	it("should handle complex dependency chains", async () => {
		const executionOrder: Array<string> = []

		const canister1 = customCanister({
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		}).make()

		const canister2 = customCanister({
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		})
			.dependsOn({
				canister1: canister1.children.install,
			})
			.deps({
				canister1: canister1.children.install,
			})
			.installArgs(async ({ ctx, deps }) => {
				executionOrder.push("canister2_install_args")
				return []
			})
			.make()

		const canister3 = customCanister({
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		})
			.dependsOn({
				canister2: canister2.children.install,
			})
			.deps({
				canister2: canister2.children.install,
			})
			.installArgs(async ({ ctx, deps }) => {
				executionOrder.push("canister3_install_args")
				return []
			})
			.make()

		const taskTree = {
			canister1,
			canister2,
			canister3,
		}

		const runtime = makeTestRuntime({}, taskTree)

		await runtime.runPromise(
			Effect.gen(function* () {
				const result = yield* runTask(canister3.children.deploy)
				return result
			}),
		)

		// Should execute in dependency order
		expect(executionOrder.indexOf("canister2_install_args")).toBeLessThan(
			executionOrder.indexOf("canister3_install_args"),
		)
	})

	it("should handle concurrent canister deployments with limits", async () => {
		const concurrentCounter = Ref.unsafeMake(0)
		const maxConcurrent = Ref.unsafeMake(0)

		const createTimedCanister = (name: string) => {
			return customCanister({
				wasm: path.resolve(
					__dirname,
					"../fixtures/canister/example.wasm",
				),
				candid: path.resolve(
					__dirname,
					"../fixtures/canister/example.did",
				),
			})
				.installArgs(async ({ ctx }) => {
					const current = await Effect.runPromise(
						Ref.updateAndGet(concurrentCounter, (n) => n + 1),
					)
					await Effect.runPromise(
						Ref.update(maxConcurrent, (max) =>
							Math.max(max, current),
						),
					)
					// Simulate work
					await new Promise((resolve) => setTimeout(resolve, 30))
					await Effect.runPromise(
						Ref.update(concurrentCounter, (n) => n - 1),
					)
					return []
				})
				.make()
		}

		const canister1 = createTimedCanister("canister1")
		const canister2 = createTimedCanister("canister2")
		const canister3 = createTimedCanister("canister3")

		const taskTree = {
			canister1,
			canister2,
			canister3,
		}

		const runtime = makeTestRuntime({}, taskTree)

		await runtime.runPromise(
			Effect.gen(function* () {
				const tasks = [
					canister1.children.install,
					canister2.children.install,
					canister3.children.install,
				]
				// Array.map
				const results = yield* Effect.all(
					tasks.map((t) => runTask(t)),
					{ concurrency: 2 },
				)
				return results
			}),
		)

		const maxReached = runtime.runSync(Ref.get(maxConcurrent))
		expect(maxReached).toBeLessThanOrEqual(2)
	})

	it("should handle cache invalidation with different configurations", async () => {
		let configVersion = 1

		const canisterId = makeCanisterId(subnetRanges.NNS)
		const dynamic_canister = customCanister(({ ctx }) => ({
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
			// Change configuration to invalidate cache
			canisterId,
		}))
			.installArgs(async ({ ctx }) => {
				return []
			})
			.make()

		const taskTree = {
			dynamic_canister,
		}

		const runtime = makeTestRuntime({}, taskTree)

		// First run with configVersion = 1
		const firstResult = await runtime.runPromise(
			Effect.gen(function* () {
				const result = yield* runTask(dynamic_canister.children.install)
				return result
			}),
		)

		expect(firstResult.result).toMatchObject({
			canisterId: expect.any(String),
			canisterName: expect.any(String),
		})

		// Change configuration
		configVersion = 2

		// Second run should re-execute due to configuration change
		const secondResult = await runtime.runPromise(
			Effect.gen(function* () {
				const result = yield* runTask(dynamic_canister.children.install)
				return result
			}),
		)

		expect(secondResult.result).toMatchObject({
			canisterId: expect.any(String),
			canisterName: expect.any(String),
		})
	})

	it("should handle different install modes", async () => {
		const test_canister = customCanister({
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		}).make()

		const taskTree = {
			test_canister,
		}

		// Test with install mode
		const runtime = makeTestRuntime(
			{
				cliTaskArgs: {
					positionalArgs: [],
					namedArgs: { mode: "install" },
				},
			},
			taskTree,
		)

		const result = await runtime.runPromise(
			Effect.gen(function* () {
				const result = yield* runTask(test_canister.children.install)
				return result
			}),
		)

		expect(result.result).toMatchObject({
			canisterId: expect.any(String),
			canisterName: expect.any(String),
			mode: "install",
		})
	})

	it("should handle canister stop and remove tasks", async () => {
		const test_canister = customCanister({
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		}).make()

		const taskTree = {
			test_canister,
		}

		const runtime = makeTestRuntime({}, taskTree)

		// First deploy the canister
		await runtime.runPromise(
			Effect.gen(function* () {
				const result = yield* runTask(test_canister.children.deploy)
				return result
			}),
		)

		// Then stop it
		await runtime.runPromise(
			Effect.gen(function* () {
				const result = yield* runTask(test_canister.children.stop)
				return result
			}),
		)

		// Then remove it
		await runtime.runPromise(
			Effect.gen(function* () {
				const result = yield* runTask(test_canister.children.remove)
				return result
			}),
		)

		// Should complete without errors
		expect(true).toBe(true)
	})

	it("should handle canister status task", async () => {
		const test_canister = customCanister({
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		}).make()

		const taskTree = {
			test_canister,
		}

		const runtime = makeTestRuntime({}, taskTree)

		// Deploy the canister first
		await runtime.runPromise(
			Effect.gen(function* () {
				const result = yield* runTask(test_canister.children.deploy)
				return result
			}),
		)

		// Check status
		const statusResult = await runtime.runPromise(
			Effect.gen(function* () {
				const result = yield* runTask(test_canister.children.status)
				return result
			}),
		)

		expect(statusResult.result).toMatchObject({
			canisterName: expect.any(String),
			canisterId: expect.any(String),
			status: expect.any(String),
		})
	})

	it("should handle mixed cached and non-cached canister tasks", async () => {
		let executionOrder: Array<string> = []

		const test_canister = customCanister({
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		})
			.installArgs(async ({ ctx }) => {
				executionOrder.push("install_executed")
				return []
			})
			.make()

		const taskTree = {
			test_canister,
		}
		const runtime = makeTestRuntime({}, taskTree)

		const res = await runtime.runPromise(
			Effect.gen(function* () {
				const result = yield* runTask(test_canister.children.create, {})
				yield* runTask(test_canister.children.build)
				yield* runTask(test_canister.children.bindings)
				return result
			}),
		)
		const canisterId = res.result

		const canisterConfig = {
			canisterId: canisterId,
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		}

		// First run - should execute install_args
		await runtime.runPromise(
			Effect.gen(function* () {
				const result = yield* runTask(test_canister.children.install, {
					mode: "reinstall",
					...canisterConfig,
				})
				return result
			}),
		)

		// expect(executionOrder).toContain("install_args_executed")

		// Reset execution order
		executionOrder = []

		// Second run - install_args should be cached, but install might run again
		await runtime.runPromise(
			Effect.gen(function* () {
				// TODO: it runs upgrade even though we set "reinstall"
				const result = yield* runTask(test_canister.children.install, {
					mode: "reinstall",
					...canisterConfig,
				})
				return result
			}),
		)

		// install should be cached (not executed again)
		expect(executionOrder).not.toContain("install_executed")
	})

	it("should handle error propagation in canister dependency chains", async () => {
		const failing_canister = customCanister({
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		})
			.installArgs(async ({ ctx }) => {
				throw new Error("Install args failed")
			})
			.make()

		const dependent_canister = customCanister({
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		})
			.dependsOn({
				failing: failing_canister.children.install,
			})
			.deps({
				failing: failing_canister.children.install,
			})
			.installArgs(async ({ ctx, deps }) => {
				return []
			})
			.make()

		const taskTree = {
			failing_canister,
			dependent_canister,
		}

		const runtime = makeTestRuntime({}, taskTree)

		await expect(
			runtime.runPromise(
				Effect.gen(function* () {
					const result = yield* runTask(
						dependent_canister.children.deploy,
					)
					return result
				}),
			),
		).rejects.toThrow()
	})

	it("should handle complex branching with multiple dependencies", async () => {
		const executionOrder: Array<string> = []

		const root_canister = customCanister({
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		})
			.installArgs(async ({ ctx }) => {
				executionOrder.push("root")
				return []
			})
			.make()

		const branch1_canister = customCanister({
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		})
			.dependsOn({
				root: root_canister.children.install,
			})
			.deps({
				root: root_canister.children.install,
			})
			.installArgs(async ({ ctx, deps }) => {
				executionOrder.push("branch1")
				return []
			})
			.make()

		const branch2_canister = customCanister({
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		})
			.dependsOn({
				root: root_canister.children.install,
			})
			.deps({
				root: root_canister.children.install,
			})
			.installArgs(async ({ ctx, deps }) => {
				executionOrder.push("branch2")
				return []
			})
			.make()

		const convergence_canister = customCanister({
			wasm: path.resolve(__dirname, "../fixtures/canister/example.wasm"),
			candid: path.resolve(__dirname, "../fixtures/canister/example.did"),
		})
			.dependsOn({
				branch1: branch1_canister.children.install,
				branch2: branch2_canister.children.install,
			})
			.deps({
				branch1: branch1_canister.children.install,
				branch2: branch2_canister.children.install,
			})
			.installArgs(async ({ ctx, deps }) => {
				executionOrder.push("convergence")
				return []
			})
			.make()

		const taskTree = {
			root_canister,
			branch1_canister,
			branch2_canister,
			convergence_canister,
		}

		const runtime = makeTestRuntime({}, taskTree)

		await runtime.runPromise(
			Effect.gen(function* () {
				const result = yield* runTask(
					convergence_canister.children.deploy,
				)
				return result
			}),
		)

		// Root should be first, convergence should be last
		expect(executionOrder[0]).toBe("root")
		expect(executionOrder[3]).toBe("convergence")
		// Branch1 and branch2 can run in parallel after root
		expect(executionOrder.slice(1, 3).sort()).toEqual([
			"branch1",
			"branch2",
		])
	})
})
