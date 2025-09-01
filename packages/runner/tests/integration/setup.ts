import { NodeContext } from "@effect/platform-node"
import { FileSystem } from "@effect/platform"
// import {} from "@effect/platform-browser"
import { layerMemory } from "@effect/platform/KeyValueStore"
import {
	Effect,
	Layer,
	Logger,
	LogLevel,
	ManagedRuntime,
	Ref,
	Metric,
	Tracer,
	ConfigProvider,
} from "effect"
import { task } from "../../src/builders/task.js"
import { CanisterIdsService } from "../../src/services/canisterIds.js"
import { DefaultConfig } from "../../src/services/defaultConfig.js"
import { ICEConfigService } from "../../src/services/iceConfig.js"
import { Moc } from "../../src/services/moc.js"
import { picReplicaImpl } from "../../src/services/pic/pic.js"
import { DefaultReplica } from "../../src/services/replica.js"
import { TaskRegistry } from "../../src/services/taskRegistry.js"
import { makeTaskEffects, topologicalSortTasks } from "../../src/tasks/lib.js"
import { CachedTask, ICEConfig, Task, TaskTree } from "../../src/types/types.js"
import { NodeSdk as OpenTelemetryNodeSdk } from "@effect/opentelemetry"
import {
	TaskRunnerContext,
	TaskRunnerLive,
} from "../../src/services/taskRunner.js"
import {
	InMemorySpanExporter,
	BatchSpanProcessor,
	SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base"
// import { configLayer } from "../../src/services/config.js"
import {
	makeTelemetryLayer,
	TelemetryConfig,
} from "../../src/services/telemetryConfig.js"
import fs from "node:fs"
import { IceDir } from "../../src/services/iceDir.js"
import { InFlight } from "../../src/services/inFlight.js"

const DefaultReplicaService = Layer.effect(DefaultReplica, picReplicaImpl).pipe(
	Layer.provide(NodeContext.layer),
	// Layer.provide(configLayer),
)

// TODO: this should use a separate pocket-ic / .ice instance for each test.
export const makeTestRuntime = (
	taskTree: TaskTree = {},
	iceDirName: string = ".ice_test",
) => {
	const globalArgs = { network: "local", logLevel: LogLevel.Debug } as const
	const config = {} satisfies Partial<ICEConfig>
	const testICEConfigService = ICEConfigService.of({
		config,
		taskTree,
		globalArgs,
	})

	const DefaultConfigLayer = DefaultConfig.Live.pipe(
		Layer.provide(DefaultReplicaService),
	)
	const ICEConfigLayer = Layer.succeed(ICEConfigService, testICEConfigService)
	const telemetryExporter = new InMemorySpanExporter()
	const telemetryConfig = {
		resource: { serviceName: "ice" },
		spanProcessor: new SimpleSpanProcessor(telemetryExporter),
		shutdownTimeout: undefined,
		metricReader: undefined,
		logRecordProcessor: undefined,
	}

	const telemetryConfigLayer = Layer.succeed(TelemetryConfig, telemetryConfig)
	const telemetryLayer = makeTelemetryLayer(telemetryConfig)
	const KVStorageLayer = layerMemory

	// separate for each test?
	const configMap = new Map([
		["APP_DIR", fs.realpathSync(process.cwd())],
		// ["ICE_DIR_NAME", iceDir],
	])
	const configLayer = Layer.setConfigProvider(
		ConfigProvider.fromMap(configMap),
	)
	const taskRunnerLayer = TaskRunnerLive()
	const taskRunnerContext = Layer.succeed(TaskRunnerContext, {
		isRootTask: true,
	})

	const iceDirLayer = IceDir.Test({ iceDirName: iceDirName }).pipe(
		Layer.provide(NodeContext.layer),
		Layer.provide(configLayer),
	)

	const InFlightLayer = InFlight.Live.pipe(Layer.provide(NodeContext.layer))

	// const testLayer = Layer.provideMerge(
	// 	Layer.mergeAll(
	// 		DefaultConfigLayer,
	// 		TaskRegistry.Live,
	// 		taskRunnerLayer,
	// 		DefaultReplicaService,
	// 		Moc.Live,
	// 		Logger.pretty,
	// 		Logger.minimumLogLevel(LogLevel.Debug),
	// 	),
	// 	Layer.provideMerge(
	// 		Layer.mergeAll(
	// 			configLayer,
	// 			CanisterIdsService.Test,
	// 			KVStorageLayer,
	// 			NodeContext.layer,
	// 			ICEConfigLayer,
	// 			telemetryLayer,
	// 			telemetryConfigLayer,
	// 			taskRunnerContext,
	// 		),
	//         Layer.mergeAll(
	//             iceDirLayer,
	//         )
	// 	),
	// )

	const CanisterIdsLayer = CanisterIdsService.Test.pipe(
		Layer.provide(NodeContext.layer),
		Layer.provide(iceDirLayer),
	)
	const testLayer = Layer.mergeAll(
		DefaultConfigLayer,
		TaskRegistry.Live.pipe(
			Layer.provide(NodeContext.layer),
			Layer.provide(KVStorageLayer),
		),
		taskRunnerLayer.pipe(
			Layer.provide(NodeContext.layer),
			Layer.provide(iceDirLayer),
			Layer.provide(CanisterIdsLayer),
			Layer.provide(ICEConfigLayer),
			Layer.provide(telemetryConfigLayer),
			Layer.provide(KVStorageLayer),
			Layer.provide(InFlightLayer),
		),
		InFlightLayer,
		iceDirLayer,
		DefaultReplicaService,
		Moc.Live.pipe(Layer.provide(NodeContext.layer)),
		Logger.pretty,
		Logger.minimumLogLevel(LogLevel.Debug),
		CanisterIdsLayer,
		configLayer,
		KVStorageLayer,
		NodeContext.layer,
		ICEConfigLayer,
		telemetryLayer,
		telemetryConfigLayer,
		taskRunnerContext,
	)

	return {
		runtime: ManagedRuntime.make(testLayer),
		telemetryExporter,
	}
}

export const getTasks = () =>
	Effect.gen(function* () {
		const { taskTree } = yield* ICEConfigService
		const tasks = Object.values(taskTree).filter(
			(node) => node._tag === "task",
		)
		return tasks
	})

export const makeCachedTask = (task: Task, key: string) => {
	const cachedTask = {
		...task,
		// effect: async () => value,
		computeCacheKey: () => key, // ← always the same key
		input: () => Promise.resolve(undefined),
		encode: async (taskCtx, v) => v as string,
		decode: async (taskCtx, v) => v as string,
		encodingFormat: "string",
	} satisfies CachedTask
	return cachedTask
}
