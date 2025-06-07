import { NodeContext } from "@effect/platform-node"
import { CLIFlags } from "./cliFlags"
import { ICEConfigService } from "./iceConfig"
import { Context, Effect, Layer, LogLevel } from "effect"
import { ManagedRuntime } from "effect"
import { Logger } from "effect"
import { StandardSchemaV1 } from "@standard-schema/spec"
import { type } from "arktype"
import { DefaultsLayer } from "../index.js"
import { Runtime } from "effect/Runtime"

const logLevelMap = {
	debug: LogLevel.Debug,
	info: LogLevel.Info,
	error: LogLevel.Error,
}

const GlobalArgs = type({
	network: "string",
	logLevel: "'debug' | 'info' | 'error'",
}) satisfies StandardSchemaV1<Record<string, unknown>>

type MakeRuntimeArgs = {
	globalArgs: { network: string; logLevel: string }
	taskArgs?: {
		positionalArgs: string[]
		namedArgs: Record<string, string>
	}
}

// TODO: make just once
export const makeTaskRuntime = ({
	globalArgs: rawGlobalArgs,
	// These are not used
	taskArgs = { positionalArgs: [], namedArgs: {} },
}: MakeRuntimeArgs) => {
	const globalArgs = GlobalArgs(rawGlobalArgs)
	if (globalArgs instanceof type.errors) {
		throw new Error(globalArgs.summary)
	}
	return ManagedRuntime.make(
		Layer.mergeAll(
			DefaultsLayer,
			// TODO: this has to be instantiated once for the whole program
			// otherwise symbols wont match
			ICEConfigService.Live.pipe(
				Layer.provide(NodeContext.layer),
				Layer.provide(
					Layer.succeed(CLIFlags, {
						globalArgs,
						taskArgs,
					}),
				),
			),
			Layer.succeed(CLIFlags, {
				globalArgs,
				taskArgs,
			}),
			Logger.pretty,
			Logger.minimumLogLevel(logLevelMap[globalArgs.logLevel]),
		),
	)
}

export class TaskRuntime extends Context.Tag("TaskRuntime")<
	TaskRuntime,
	{
		readonly runtime: Runtime<// | NodeContext
		// | TaskRegistry
		// | DefaultReplica
		// | DefaultConfig
		// | Moc
		// | CanisterIdsService
		// | ICEConfigService
		// | CLIFlags
		any>
	}
>() {
	static Live = ({
		globalArgs: rawGlobalArgs,
		taskArgs = { positionalArgs: [], namedArgs: {} },
	}: MakeRuntimeArgs) =>
		Layer.effect(
			TaskRuntime,
			Effect.gen(function* () {
                // TODO: handle with cli?
				const globalArgs = GlobalArgs(rawGlobalArgs)
				if (globalArgs instanceof type.errors) {
					throw new Error(globalArgs.summary)
				}
				const runtime = yield* ManagedRuntime.make(
					Layer.mergeAll(
						DefaultsLayer,
						// TODO: this has to be instantiated once for the whole program
						// otherwise symbols wont match
						ICEConfigService.Live.pipe(
							Layer.provide(NodeContext.layer),
							Layer.provide(
								Layer.succeed(CLIFlags, {
									globalArgs,
									taskArgs,
								}),
							),
						),
						Layer.succeed(CLIFlags, {
							globalArgs,
							taskArgs,
						}),
						Logger.pretty,
						Logger.minimumLogLevel(logLevelMap[globalArgs.logLevel]),
					),
				)
				return TaskRuntime.of({ runtime })
			}),
		)
}

// export const TaskRuntime = TaskRuntime.of(makeTaskRuntime)
// 	const globalArgs = GlobalArgs(rawGlobalArgs)
// 	if (globalArgs instanceof type.errors) {
// 		throw new Error(globalArgs.summary)
// 	}
// 	return ManagedRuntime.make(
// 		Layer.mergeAll(
// 			DefaultsLayer,
// 			// TODO: this has to be instantiated once for the whole program
// 			// otherwise symbols wont match
// 			ICEConfigService.Live.pipe(
// 				Layer.provide(NodeContext.layer),
// 				Layer.provide(
// 					Layer.succeed(CLIFlags, {
// 						globalArgs,
// 						taskArgs,
// 					}),
// 				),
// 			),
// 			Layer.succeed(CLIFlags, {
// 				globalArgs,
// 				taskArgs,
// 			}),
// 			Logger.pretty,
// 			Logger.minimumLogLevel(logLevelMap[globalArgs.logLevel]),
// 		),
// 	)
// }
