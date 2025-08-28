import { NodeContext } from "@effect/platform-node"
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
} from "effect"
import { task } from "../../src/builders/task.js"
import { CanisterIdsService } from "../../src/services/canisterIds.js"
import { CLIFlags } from "../../src/services/cliFlags.js"
import { DefaultConfig } from "../../src/services/defaultConfig.js"
import { ICEConfigService } from "../../src/services/iceConfig.js"
import { Moc } from "../../src/services/moc.js"
import { picReplicaImpl } from "../../src/services/pic/pic.js"
import { DefaultReplica } from "../../src/services/replica.js"
import { TaskRegistry } from "../../src/services/taskRegistry.js"
import { makeTaskEffects, topologicalSortTasks } from "../../src/tasks/lib.js"
import { CachedTask, ICEConfig, Task, TaskTree } from "../../src/types/types.js"
import { NodeSdk as OpenTelemetryNodeSdk } from "@effect/opentelemetry"
import { TaskRunnerContext, TaskRunnerLive } from "../../src/services/taskRunner.js"
import {
	InMemorySpanExporter,
	BatchSpanProcessor,
	SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base"
import { configLayer } from "../../src/services/config.js"
import {
	makeTelemetryLayer,
	TelemetryConfig,
} from "../../src/services/telemetryConfig.js"

export const telemetryExporter = new InMemorySpanExporter()
const telemetryConfig = {
	resource: { serviceName: "ice" },
	spanProcessor: new SimpleSpanProcessor(telemetryExporter),
	shutdownTimeout: undefined,
	metricReader: undefined,
	logRecordProcessor: undefined,
}

const DefaultReplicaService = Layer.effect(DefaultReplica, picReplicaImpl).pipe(
	Layer.provide(NodeContext.layer),
	Layer.provide(configLayer),
)

export const makeTestLayer = (
	{ cliTaskArgs = { positionalArgs: [], namedArgs: {} }, taskArgs = {} } = {
		cliTaskArgs: { positionalArgs: [], namedArgs: {} },
		taskArgs: {},
	},
	taskTree: TaskTree = {},
) => {
	const globalArgs = { network: "local", logLevel: "debug" } as const
	const config = {} satisfies Partial<ICEConfig>
	// const taskTree = {} satisfies TaskTree
	const testICEConfigService = ICEConfigService.of({
		config,
		taskTree,
	})

	const DefaultConfigLayer = DefaultConfig.Live.pipe(
		Layer.provide(DefaultReplicaService),
	)
	const ICEConfigLayer = Layer.succeed(ICEConfigService, testICEConfigService)
	const CLIFlagsLayer = Layer.succeed(CLIFlags, {
		globalArgs,
		taskArgs: cliTaskArgs,
	})
	const telemetryConfigLayer = Layer.succeed(TelemetryConfig, telemetryConfig)
	const telemetryLayer = makeTelemetryLayer(telemetryConfig)
	const taskRunnerLayer = TaskRunnerLive()
	const taskRunnerContext = Layer.succeed(TaskRunnerContext, {
		isRootTask: true,
	})

	const testLayer = Layer.provideMerge(
		Layer.mergeAll(
			DefaultConfigLayer,
			TaskRegistry.Live.pipe(
				// TODO: double-check that this works
				// Layer.provide(layerFileSystem(".ice/cache")),
				Layer.provide(layerMemory),
			),
			taskRunnerLayer,
			DefaultReplicaService,
			Moc.Live,
			// configLayer,
			CanisterIdsService.Test,
			// Logger.pretty,
			Logger.minimumLogLevel(LogLevel.Debug),
		),
		Layer.mergeAll(
			NodeContext.layer,
			CLIFlagsLayer,
			ICEConfigLayer,
			telemetryLayer,
			telemetryConfigLayer,
			taskRunnerContext,
		),
	)
	return testLayer
}

export const makeTestRuntime = (
	{ cliTaskArgs = { positionalArgs: [], namedArgs: {} }, taskArgs = {} } = {
		cliTaskArgs: { positionalArgs: [], namedArgs: {} },
		taskArgs: {},
	},
	taskTree: TaskTree = {},
) => {
	const layer = makeTestLayer({ cliTaskArgs, taskArgs }, taskTree)
	return ManagedRuntime.make(layer)
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
