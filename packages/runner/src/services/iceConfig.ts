import { Data, Effect, Context, Layer } from "effect"
import type { ICEConfig, ICEConfigFile, TaskTree } from "../types/types.js"
import { Path, FileSystem } from "@effect/platform"
import { deployTaskPlugin } from "../plugins/deploy.js"
import { removeBuilders } from "../index.js"
import { tsImport } from "tsx/esm/api"
// import { removeBuilders } from "../plugins/remove_builders.js"
// import { candidUITaskPlugin } from "../plugins/candid-ui.js"

const applyPlugins = (taskTree: TaskTree) =>
	Effect.gen(function* () {
		yield* Effect.logDebug("Applying plugins...")
		const noBuildersTree = removeBuilders(taskTree) as TaskTree
		const transformedTaskTree = deployTaskPlugin(noBuildersTree)
		// yield* Effect.log("Applied deploy plugin", {
		//   transformedConfig,
		// })
		// const transformedConfig2 = yield* candidUITaskPlugin(transformedConfig)
		return transformedTaskTree
	})

export class ConfigError extends Data.TaggedError("ConfigError")<{
	message: string
}> {}



/**
 * Service to load and process the ICE configuration.
 */
export class ICEConfigService extends Context.Tag("ICEConfigService")<
	ICEConfigService,
	{
		readonly config: ICEConfig
		readonly taskTree: TaskTree
	}
>() {
	static readonly Live = Layer.effect(
		ICEConfigService,
		Effect.gen(function* () {
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
			const config = yield* Effect.tryPromise({
				try: () =>
					tsImport(
						path.resolve(appDirectory, configPath),
						import.meta.url,
					) as Promise<ICEConfigFile>,
				catch: (error) =>
					new ConfigError({
						message: `Failed to get ICE config: ${
							error instanceof Error ? error.message : String(error)
						}`,
					}),
			})

			const taskTree = Object.fromEntries(
				Object.entries(config).filter(([key]) => key !== "default"),
			) as TaskTree
			const transformedTaskTree = yield* applyPlugins(taskTree)
			return {
				taskTree: transformedTaskTree,
				config: config.default,
			}
		}),
	)
}
