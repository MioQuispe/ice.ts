import { Data, Effect, Context, Layer, Ref } from "effect"
import type {
	ICEConfig,
	ICEConfigFile,
	TaskTree,
	TaskTreeNode,
} from "../types/types.js"
import { Path, FileSystem } from "@effect/platform"
import { tsImport } from "tsx/esm/api"
import { InstallModes } from "./replica.js"
import { LogLevel } from "effect/LogLevel"
// import { removeBuilders } from "../plugins/remove_builders.js"
// import { candidUITaskPlugin } from "../plugins/candid-ui.js"

export const removeBuilders = (
	taskTree: TaskTree | TaskTreeNode,
): TaskTree | TaskTreeNode => {
	if ("_tag" in taskTree && taskTree._tag === "builder") {
		return removeBuilders(taskTree.make())
	}
	if ("_tag" in taskTree && taskTree._tag === "scope") {
		return {
			...taskTree,
			children: Object.fromEntries(
				Object.entries(taskTree.children).map(([key, value]) => [
					key,
					removeBuilders(value),
				]),
			) as Record<string, TaskTreeNode>,
		}
	}
	if ("_tag" in taskTree && taskTree._tag === "task") {
		return taskTree
	}
	return Object.fromEntries(
		Object.entries(taskTree).map(([key, value]) => [
			key,
			removeBuilders(value),
		]),
	) as TaskTree
}

const applyPlugins = (taskTree: TaskTree) =>
	Effect.gen(function* () {
		yield* Effect.logDebug("Applying plugins...")
		const transformedTaskTree = removeBuilders(taskTree) as TaskTree
		// TODO: deploy should be included directly in the builders
		// candid_ui as well
		// const transformedTaskTree = deployTaskPlugin(noBuildersTree)
		// const transformedConfig2 = yield* candidUITaskPlugin(transformedConfig)
		return transformedTaskTree
	})

export class ICEConfigError extends Data.TaggedError("ICEConfigError")<{
	message: string
}> {}

const createService = (globalArgs: { network: string; logLevel: LogLevel }) =>
	Effect.gen(function* () {
		// TODO: service?
		const { network, logLevel } = globalArgs
		const path = yield* Path.Path
		const fs = yield* FileSystem.FileSystem
		const appDirectory = yield* fs.realPath(process.cwd())
		// TODO: make this configurable if needed
		const configPath = "ice.config.ts"
		yield* Effect.logDebug("Loading config...", {
			configPath,
			appDirectory,
		})

		// Wrap tsImport in a console.log monkey patch.
		const mod = yield* Effect.tryPromise({
			try: () =>
				tsImport(
					path.resolve(appDirectory, configPath),
					import.meta.url,
				) as Promise<ICEConfigFile>,
			catch: (error) =>
				new ICEConfigError({
					message: `Failed to get ICE config: ${
						error instanceof Error ? error.message : String(error)
					}`,
				}),
		})

		const taskTree = Object.fromEntries(
			Object.entries(mod).filter(([key]) => key !== "default"),
		) as TaskTree
		const transformedTaskTree = yield* applyPlugins(taskTree)
		const iceCtx = { network }
		let config: Partial<ICEConfig>
		const d = mod.default
		if (typeof d === "function") {
			// TODO: both sync and async in type signature
			config = yield* Effect.tryPromise({
				try: () => {
					const callResult = d(iceCtx)
					if (callResult instanceof Promise) {
						return callResult
					} else {
						return Promise.resolve(callResult)
					}
				},
				catch: (error) => {
					return new ICEConfigError({
						message: `Failed to get ICE config: ${error instanceof Error ? error.message : String(error)}`,
					})
				},
			})
		} else {
			config = d
		}
		return {
			taskTree: transformedTaskTree,
			config,
			globalArgs,
		}
	})

export class ICEConfigInject extends Context.Tag("ICEConfigInject")<
	ICEConfigInject,
	{
		readonly configRef: Ref.Ref<Partial<ICEConfig>>
		readonly taskTreeRef: Ref.Ref<TaskTree>
	}
>() {
	static readonly Test = Layer.effect(
		ICEConfigInject,
		Effect.gen(function* () {
            let configRef = yield* Ref.make({})
            let taskTreeRef = yield* Ref.make({})
            return {
                configRef,
                taskTreeRef,
            }
        }),
	)
}

/**
 * Service to load and process the ICE configuration.
 */
export class ICEConfigService extends Context.Tag("ICEConfigService")<
	ICEConfigService,
	{
		readonly config: Partial<ICEConfig>
		readonly taskTree: TaskTree
		readonly globalArgs: {
			network: string
			logLevel: LogLevel
		}
	}
>() {
	static readonly Live = (globalArgs: {
		network: string
		logLevel: LogLevel
	}) => Layer.effect(ICEConfigService, createService(globalArgs))

	static readonly Test = (
		globalArgs: {
			network: string
			logLevel: LogLevel
		},
        taskTree: TaskTree,
        config: Partial<ICEConfig>,
	) =>
		Layer.effect(
			ICEConfigService,
			Effect.gen(function* () {
				return {
					taskTree,
					config,
					globalArgs,
				}
			}),
		)
}
