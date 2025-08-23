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
import { configLayer } from "../../src/index.js"
import { CanisterIdsService } from "../../src/services/canisterIds.js"
import { CLIFlags } from "../../src/services/cliFlags.js"
import { DefaultConfig } from "../../src/services/defaultConfig.js"
import { ICEConfigService } from "../../src/services/iceConfig.js"
import { Moc } from "../../src/services/moc.js"
import { picReplicaImpl } from "../../src/services/pic/pic.js"
import { DefaultReplica } from "../../src/services/replica.js"
import { TaskArgsService } from "../../src/services/taskArgs.js"
import { TaskRegistry } from "../../src/services/taskRegistry.js"
import { executeTasks, topologicalSortTasks } from "../../src/tasks/lib.js"
import { CachedTask, ICEConfig, Task, TaskTree } from "../../src/types/types.js"
import { NodeSdk as OpenTelemetryNodeSdk } from "@effect/opentelemetry"
import {
	InMemorySpanExporter,
	BatchSpanProcessor,
	SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base"

export const telemetryExporter = new InMemorySpanExporter()
export const telemetryLayer = OpenTelemetryNodeSdk.layer(() => ({
	// traceExporter: telemetryExporter,
	resource: { serviceName: "ice" },
	spanProcessor: new SimpleSpanProcessor(telemetryExporter),
}))

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
	const TaskArgsLayer = Layer.succeed(TaskArgsService, { taskArgs })
	// Layer.succeed(CLIFlags, {
	// 	globalArgs,
	// 	taskArgs: cliTaskArgs,
	// }),
	// Layer.succeed(TaskArgsService, { taskArgs }),
	const testLayer = Layer.mergeAll(
		telemetryLayer,
		NodeContext.layer,
		CLIFlagsLayer,
		TaskArgsLayer,
		ICEConfigLayer,
		DefaultConfigLayer,
		TaskRegistry.Live.pipe(
			// TODO: double-check that this works
			// Layer.provide(layerFileSystem(".ice/cache")),
			Layer.provide(layerMemory),
			Layer.provide(NodeContext.layer),
		),
		DefaultReplicaService,
		Moc.Live.pipe(Layer.provide(NodeContext.layer)),
		configLayer,
		CanisterIdsService.Test,
		// Logger.pretty,
		Logger.minimumLogLevel(LogLevel.Debug),
	)
	return testLayer
}

export const getTasks = () =>
	Effect.gen(function* () {
		const { taskTree } = yield* ICEConfigService
		const tasks = Object.values(taskTree).filter(
			(node) => node._tag === "task",
		)
		return tasks
	})

export const makeCachedTask = (
	name: string,
	value: string,
): CachedTask<string> => {
	const cachedTask = {
		...task().make(),
		effect: async () => value,
		computeCacheKey: () => name, // ← always the same key
		input: () => Effect.succeed(undefined).pipe(Effect.runPromise),
		encode: (taskCtx, v) => Effect.succeed(v).pipe(Effect.runPromise), // identity
		decode: (taskCtx, v) =>
			Effect.succeed(v as string).pipe(Effect.runPromise),
		encodingFormat: "string",
	} satisfies CachedTask<string>
	return cachedTask
}
