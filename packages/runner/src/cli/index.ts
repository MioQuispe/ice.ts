import { Effect, Console, Stream, Either } from "effect"
import { runTaskByPath, runTasks } from "../tasks/index.js"
import { makeRuntime } from "../index.js"
import { DeploymentError } from "../canister.js"
import { uiTask } from "./ui/index.js"
import { ICEConfigService } from "../services/iceConfig.js"
import * as p from "@clack/prompts"
import color from "picocolors"
import {
	defineCommand,
	createMain,
	type CommandContext,
	type ArgsDef,
	Resolvable,
} from "citty"
import { isCancel } from "@clack/prompts"
import { cancel } from "@clack/prompts"
import { filterNodes, TaskCtx, type ProgressUpdate } from "../tasks/lib.js"
import { Tags } from "../builders/types.js"
import type { Task } from "../types/types.js"
import { CanisterIdsService } from "../services/canisterIds.js"
import { DefaultReplica } from "../services/replica.js"
import { Ed25519KeyIdentity } from "@dfinity/identity"
// import { runExit, Command, Option, Cli } from "clipanion"

function moduleHashToHexString(moduleHash: [] | [number[]]): string {
	if (moduleHash.length === 0) {
		return "Not Present"
	}
	const bytes = new Uint8Array(moduleHash[0]) // Ensure it's a Uint8Array
	const hexString = Buffer.from(bytes).toString("hex")
	return `0x${hexString}`
}

const globalArgs = {
	network: {
		type: "string",
		required: false,
		// TODO: hmm?
		default: "local",
		// TODO: better description
		description: "Select a network",
	},
	logLevel: {
		type: "string",
		required: false,
		default: "info",
		description: "Select a log level",
	},
} satisfies Resolvable<ArgsDef>

//   // TODO: we need to construct this dynamically if we want space delimited task paths
const runCommand = defineCommand({
	meta: {
		name: "run",
		description:
			"Run an ICE task by its path, e.g. icrc1:build, nns:governance:install",
	},
	args: {
		taskPath: {
			type: "positional",
			required: true,
			description:
				"The task to run. examples: icrc1:build, nns:governance:install",
		},
		// TODO: fix. these get overridden by later args
		...globalArgs,
	},
	run: async ({ args, rawArgs }) => {
		// TODO: also pass in global args like network, logLevel. but handle them separately?
		const taskArgs = rawArgs.slice(1)
		const s = p.spinner()
		s.start(`Running task... ${color.green(color.underline(args.taskPath))}`)
		await makeRuntime({
			globalArgs: {
				network: args.network,
				logLevel: args.logLevel,
			},
			taskArgs,
		}).runPromise(
			// @ts-ignore
			Effect.gen(function* () {
				yield* runTaskByPath(args.taskPath)
			}),
		)
		s.stop(`Finished task: ${color.green(color.underline(args.taskPath))}`)
	},
})

const initCommand = defineCommand({
	meta: {
		name: "Init",
		description: "Initialize a new ICE project",
	},
	run: async ({ args }) => {
		p.text({ message: "Coming soon..." })
		// TODO: prompt which canisters to include
		// await runtime.runPromise(
		//   Effect.gen(function* () {
		//     yield* initTask()
		//   }),
		// )
	},
})

const deployRun = async ({
	network,
	logLevel,
}: { network: string; logLevel: string }) => {
	const s = p.spinner()
	s.start("Deploying all canisters...")
	await makeRuntime({
		globalArgs: {
			network,
			logLevel,
		},
		taskArgs: [],
	}).runPromise(
		// @ts-ignore
		Effect.gen(function* () {
			const { taskTree } = yield* ICEConfigService
			const tasksWithPath = (yield* filterNodes(
				taskTree,
				(node) =>
					node._tag === "task" &&
					node.tags.includes(Tags.CANISTER) &&
					node.tags.includes(Tags.DEPLOY),
			)) as Array<{ node: Task; path: string[] }>
			const tasks = tasksWithPath.map(({ node }) => node)
			yield* runTasks(tasks, (update) => {
				if (update.status === "starting") {
					// const s = p.spinner()
					// s.start(`Deploying ${update.taskPath}\n`)
					// spinners.set(update.taskPath, s)
					s.message(`Running ${update.taskPath}`)
					// console.log(`Deploying ${update.taskPath}`)
				}
				if (update.status === "completed") {
					// const s = spinners.get(update.taskPath)
					// s?.stop(`Completed ${update.taskPath}\n`)
					s.message(`Completed ${update.taskPath}`)
					// console.log(`Completed ${update.taskPath}`)
				}
			})
		}),
	)
	s.stop("Deployed all canisters")
}

const canistersCreateCommand = defineCommand({
	meta: {
		name: "create",
		description: "Creates all canisters",
	},
	args: {
		...globalArgs,
	},
	run: async ({ args }) => {
		const { network, logLevel } = args
		// TODO: makeRuntime fn?
		await makeRuntime({
			globalArgs: {
				network,
				logLevel,
			},
			taskArgs: [],
		}).runPromise(
			// @ts-ignore
			Effect.gen(function* () {
				const s = p.spinner()
				s.start("Creating all canisters")

				yield* Effect.logDebug("Running canisters:create")
				const { taskTree } = yield* ICEConfigService
				const tasksWithPath = (yield* filterNodes(
					taskTree,
					(node) =>
						node._tag === "task" &&
						node.tags.includes(Tags.CANISTER) &&
						node.tags.includes(Tags.CREATE),
				)) as Array<{ node: Task; path: string[] }>
				yield* runTasks(
					tasksWithPath.map(({ node }) => node),
					(update) => {
						if (update.status === "starting") {
							s.message(`Running ${update.taskPath}`)
						}
						if (update.status === "completed") {
							s.message(`Completed ${update.taskPath}`)
						}
					},
				)
				s.stop("Finished creating all canisters")
			}),
		)
	},
})

const canistersBuildCommand = defineCommand({
	meta: {
		name: "build",
		description: "Builds all canisters",
	},
	args: {
		...globalArgs,
	},
	run: async ({ args }) => {
		const { network, logLevel } = args
		await makeRuntime({
			globalArgs: {
				network,
				logLevel,
			},
			taskArgs: [],
		}).runPromise(
			// @ts-ignore
			Effect.gen(function* () {
				const s = p.spinner()
				s.start("Building all canisters")

				yield* Effect.logDebug("Running canisters:create")
				const { taskTree } = yield* ICEConfigService
				const tasksWithPath = (yield* filterNodes(
					taskTree,
					(node) =>
						node._tag === "task" &&
						node.tags.includes(Tags.CANISTER) &&
						node.tags.includes(Tags.CREATE),
				)) as Array<{ node: Task; path: string[] }>
				yield* runTasks(
					tasksWithPath.map(({ node }) => node),
					(update) => {
						if (update.status === "starting") {
							s.message(`Running ${update.taskPath}`)
						}
						if (update.status === "completed") {
							s.message(`Completed ${update.taskPath}`)
						}
					},
				)

				s.stop("Finished building all canisters")
			}),
		)
	},
})

const canistersBindingsCommand = defineCommand({
	meta: {
		name: "bindings",
		description: "Generates bindings for all canisters",
	},
	args: {
		...globalArgs,
	},
	run: async ({ args }) => {
		const { network, logLevel } = args
		await makeRuntime({
			globalArgs: {
				network,
				logLevel,
			},
			taskArgs: [],
		}).runPromise(
			// @ts-ignore
			Effect.gen(function* () {
				const s = p.spinner()
				s.start("Generating bindings for all canisters")

				yield* Effect.logDebug("Running canisters:bindings")
				const { taskTree } = yield* ICEConfigService
				const tasksWithPath = (yield* filterNodes(
					taskTree,
					(node) =>
						node._tag === "task" &&
						node.tags.includes(Tags.CANISTER) &&
						node.tags.includes(Tags.BINDINGS),
				)) as Array<{ node: Task; path: string[] }>
				yield* runTasks(
					tasksWithPath.map(({ node }) => node),
					(update) => {
						if (update.status === "starting") {
							s.message(`Running ${update.taskPath}`)
						}
						if (update.status === "completed") {
							s.message(`Completed ${update.taskPath}`)
						}
					},
				)

				s.stop("Finished generating bindings for all canisters")
			}),
		)
	},
})

const canistersInstallCommand = defineCommand({
	meta: {
		name: "install",
		description: "Installs all canisters",
	},
	args: {
		...globalArgs,
	},
	run: async ({ args }) => {
		const { network, logLevel } = args
		await makeRuntime({
			globalArgs: {
				network,
				logLevel,
			},
			taskArgs: [],
		}).runPromise(
			// @ts-ignore
			Effect.gen(function* () {
				const s = p.spinner()
				s.start("Installing all canisters")

				yield* Effect.logDebug("Running canisters:create")
				const { taskTree } = yield* ICEConfigService
				const tasksWithPath = (yield* filterNodes(
					taskTree,
					(node) =>
						node._tag === "task" &&
						node.tags.includes(Tags.CANISTER) &&
						node.tags.includes(Tags.CREATE),
				)) as Array<{ node: Task; path: string[] }>
				yield* runTasks(
					tasksWithPath.map(({ node }) => node),
					(update) => {
						if (update.status === "starting") {
							s.message(`Running ${update.taskPath}`)
						}
						if (update.status === "completed") {
							s.message(`Completed ${update.taskPath}`)
						}
					},
				)

				s.stop("Finished installing all canisters")
			}),
		)
	},
})

const canistersStopCommand = defineCommand({
	meta: {
		name: "stop",
		description: "Stops all canisters",
	},
	args: {
		...globalArgs,
	},
	run: async ({ args }) => {
		const { network, logLevel } = args
		await makeRuntime({
			globalArgs: {
				network,
				logLevel,
			},
			taskArgs: [],
		}).runPromise(
			// @ts-ignore
			Effect.gen(function* () {
				const s = p.spinner()
				s.start("Stopping all canisters")

				yield* Effect.logDebug("Running canisters:stop")
				const { taskTree } = yield* ICEConfigService
				const tasksWithPath = (yield* filterNodes(
					taskTree,
					(node) =>
						node._tag === "task" &&
						node.tags.includes(Tags.CANISTER) &&
						node.tags.includes(Tags.STOP),
				)) as Array<{ node: Task; path: string[] }>
				yield* runTasks(
					tasksWithPath.map(({ node }) => node),
					(update) => {
						if (update.status === "starting") {
							s.message(`Running ${update.taskPath}`)
						}
						if (update.status === "completed") {
							s.message(`Completed ${update.taskPath}`)
						}
					},
				)

				// // TODO: runTask?
				// yield* Effect.forEach(
				// 	Object.keys(canisterIdsMap),
				// 	(canisterId) =>
				// 		Effect.gen(function* () {
				// 			const {
				// 				roles: {
				// 					deployer: { identity },
				// 				},
				// 				replica,
				// 			} = yield* TaskCtx
				// 			yield* replica.stopCanister({
				// 				canisterId,
				// 				identity,
				// 			})
				// 		}),
				// 	{ concurrency: "unbounded" },
				// )

				// (update) => {
				// 				if (update.status === "starting") {
				// 					s.message(`Running ${update.taskPath}`)
				// 				}
				// 				if (update.status === "completed") {
				// 					s.message(`Completed ${update.taskPath}`)
				// 				}
				// 			}

				s.stop("Finished stopping all canisters")
			}),
		)
	},
})

const canistersStatusCommand = defineCommand({
	meta: {
		name: "status",
		description: "Show the status of all canisters",
	},
	args: {
		canisterNameOrId: {
			type: "positional",
			required: false,
			description: "The name or ID of the canister to get the status of",
		},
		...globalArgs,
	},
	run: async ({ args }) => {
		// TODO: support canister name or ID
		if (args._.length === 0) {
			const { network, logLevel } = args
			await makeRuntime({
				globalArgs: {
					network,
					logLevel,
				},
				taskArgs: [],
			}).runPromise(
				Effect.gen(function* () {
					const canisterIdsService = yield* CanisterIdsService
					const canisterIdsMap = yield* canisterIdsService.getCanisterIds()
					const replica = yield* DefaultReplica
					const identity = Ed25519KeyIdentity.generate()
					const canisterStatusesEffects = Object.keys(canisterIdsMap).map(
						(canisterName) =>
							Effect.either(
								Effect.gen(function* () {
									// TODO: currentNetwork
									const network = "local"
									const canisterInfo = canisterIdsMap[canisterName]
									const canisterId = canisterInfo[network]
									if (!canisterId) {
										throw new DeploymentError({
											message: `No canister ID found for ${canisterName} on network ${network}`,
										})
									}
									const status = yield* replica.getCanisterInfo({
										canisterId,
										identity,
									})
									return { canisterName, canisterId, status }
								}),
							),
					)

					const canisterStatuses = yield* Effect.all(canisterStatusesEffects, {
						concurrency: "unbounded",
					})

					// TODO: this needs to run as a task
					// TODO: inline
					const statusLog = canisterStatuses
						.map((result) =>
							Either.match(result, {
								onLeft: (left) => `Error for canister: ${left}`,
								onRight: (right) =>
									right.status.status !== "not_installed"
										? `
${color.underline(right.canisterName)}
  ID: ${right.canisterId}
  Status: ${color.green(Object.keys(right.status.status)[0])}
  Memory Size: ${right.status.memory_size.toLocaleString("en-US").replace(/,/g, "_")}
  Cycles: ${right.status.cycles.toLocaleString("en-US").replace(/,/g, "_")}
  Idle Cycles Burned Per Day: ${right.status.idle_cycles_burned_per_day.toLocaleString("en-US").replace(/,/g, "_")}
  Module Hash: ${moduleHashToHexString(right.status.module_hash)}`
										: // TODO: fix?
											`Error for canister: ${result._tag}`,
							}),
						)
						.join("\n")
					// 							result._tag === "Right" && result.right.status.status !== "not_installed"
					// 								? `
					// ${color.underline(result.right.canisterName)}
					//   ID: ${result.right.canisterId}
					//   Status: ${color.green(Object.keys(result.right.status.status)[0])}
					//   Memory Size: ${result.right.status.memory_size.toLocaleString("en-US").replace(/,/g, "_")}
					//   Cycles: ${result.right.status.cycles.toLocaleString("en-US").replace(/,/g, "_")}
					//   Idle Cycles Burned Per Day: ${result.right.status.idle_cycles_burned_per_day.toLocaleString("en-US").replace(/,/g, "_")}
					//   Module Hash: ${moduleHashToHexString(result.right.status.module_hash)}`
					// 								: `Error for canister: ${result._tag}`,
					// 						)
					// 						.join("\n")

					console.log(statusLog)
				}),
			)
		}
	},
})

const canistersRemoveCommand = defineCommand({
	meta: {
		name: "remove",
		description: "Removes all canisters",
	},
	args: {
		...globalArgs,
	},
	run: async ({ args }) => {
		const { network, logLevel } = args
		await makeRuntime({
			globalArgs: {
				network,
				logLevel,
			},
			taskArgs: [],
		}).runPromise(
			Effect.gen(function* () {
				yield* Console.log("Coming soon...")
			}),
		)
	},
})

const uiCommand = defineCommand({
	meta: {
		name: "ui",
		description: "Opens the experimental ICE terminal UI",
	},
	run: async ({ args }) => {
		const { network, logLevel } = args
		await makeRuntime({
			globalArgs: {
				network: "local",
				logLevel: "debug",
			},
			taskArgs: [],
		}).runPromise(
			Effect.gen(function* () {
				const { config, taskTree } = yield* ICEConfigService
				yield* uiTask({ config, taskTree })
			}),
		)
	},
})

const canistersDeployCommand = defineCommand({
	meta: {
		name: "deploy",
		description: "Deploys all canisters",
	},
	args: {
		...globalArgs,
	},
	run: async ({ args }) => {
		const { network, logLevel } = args
		await deployRun({ network, logLevel })
	},
})

const canisterCommand = defineCommand({
	meta: {
		name: "canister",
		description:
			"Select a specific canister to run a task on. install, build, deploy, etc.",
	},
	args: {
		...globalArgs,
	},
	run: async ({ args }) => {
		if (args._.length === 0) {
			const { network, logLevel } = args
			await makeRuntime({
				globalArgs: {
					network,
					logLevel,
				},
				taskArgs: [],
			}).runPromise(
				// @ts-ignore
				Effect.gen(function* () {
					const { taskTree } = yield* ICEConfigService
					const canisterScopesWithPath = yield* filterNodes(
						taskTree,
						(node) =>
							node._tag === "scope" && node.tags.includes(Tags.CANISTER),
					)

					// TODO: format nicely
					const canisterList = canisterScopesWithPath.map(({ node, path }) => {
						const scopePath = path.join(":") // Use colon to represent hierarchy
						return `  ${scopePath}` // Indent for better readability
					})
					const canister = (yield* Effect.tryPromise(() =>
						p.select({
							message: "Select a canister",
							options: canisterList.map((canister) => ({
								value: canister,
								// TODO: add a status marker to the canister
								label: canister,
							})),
						}),
					)) as string
					if (isCancel(canister)) {
						cancel("Operation cancelled.")
						process.exit(0)
					}
					if (!canister) {
						return
					}
					const action = (yield* Effect.tryPromise(() =>
						p.select({
							message: "Select an action",
							options: [
								{ value: "deploy", label: "Deploy" },
								{ value: "create", label: "Create" },
								{ value: "build", label: "Build" },
								{ value: "bindings", label: "Bindings" },
								{ value: "install", label: "Install" },
								{ value: "status", label: "Status" },
								{ value: "stop", label: "Stop" },
								{ value: "remove", label: "Remove" },
							],
						}),
					)) as string
					if (isCancel(action)) {
						cancel("Operation cancelled.")
						process.exit(0)
					}
					const s = p.spinner()
					s.start(`Running ${canister}:${action}`)
					const result = yield* runTaskByPath(
						`${canister.trimStart().trimEnd()}:${action.trimStart().trimEnd()}`,
						(update) => {
							if (update.status === "starting") {
								s.message(`Running ${update.taskPath}`)
							}
							if (update.status === "completed") {
								s.message(`Completed ${update.taskPath}`)
							}
						},
					)
					s.stop(`Completed ${canister}:${action}`)
				}),
			)
		}
	},
	subCommands: {
		deploy: canistersDeployCommand,
		create: canistersCreateCommand,
		build: canistersBuildCommand,
		bindings: canistersBindingsCommand,
		stop: canistersStopCommand,
		install: canistersInstallCommand,
		// TODO:
		// status: canistersStatusCommand,
		remove: canistersRemoveCommand,
	},
})

const taskCommand = defineCommand({
	meta: {
		name: "task",
		description: `Select and run a task from the available tasks`,
	},
	args: {
		...globalArgs,
	},
	run: async ({ args }) => {
		if (args._.length === 0) {
			const { network, logLevel } = args
			await makeRuntime({
				globalArgs: {
					network,
					logLevel,
				},
				taskArgs: [],
			}).runPromise(
				// @ts-ignore
				Effect.gen(function* () {
					const { taskTree } = yield* ICEConfigService
					const tasksWithPath = yield* filterNodes(
						taskTree,
						(node) =>
							node._tag === "task" && !node.tags.includes(Tags.CANISTER),
					)
					// TODO: format nicely
					const taskList = tasksWithPath.map(({ node: task, path }) => {
						const taskPath = path.join(":") // Use colon to represent hierarchy
						return `  ${taskPath}` // Indent for better readability
					})
					const task = (yield* Effect.tryPromise(() =>
						p.select({
							message: "Select a task",
							options: taskList.map((task) => ({
								value: task,
								label: task,
							})),
						}),
					)) as string
					if (isCancel(task)) {
						cancel("Operation cancelled.")
						process.exit(0)
					}
					const s = p.spinner()
					s.start(`Running ${task}`)
					const result = yield* runTaskByPath(
						`${task.trimStart().trimEnd()}`,
						(update) => {
							if (update.status === "starting") {
								s.message(`Running ${update.taskPath}`)
							}
							if (update.status === "completed") {
								s.message(`Completed ${update.taskPath}`)
							}
						},
					)
					s.stop(`Completed ${task}`)
				}),
			)
		}
	},
	subCommands: {},
})

const generateCommand = defineCommand({
	meta: {
		name: "generate",
		description: "Generate canisters",
	},
	run: async ({ args }) => {
		p.text({ message: "Coming soon..." })
		p.multiselect({
			message: "Select canisters to include",
			options: [
				{ value: "icrc1", label: "ICRC1" },
				{ value: "nns", label: "NNS" },
				{ value: "sns", label: "SNS" },
			],
		})
	},
})

const main = defineCommand({
	meta: {
		name: "ice",
		description: "ICE CLI",
	},
	args: {
		...globalArgs,
	},
	run: async (ctx) => {
		const { network, logLevel } = ctx.args
		if (ctx.args._.length === 0) {
			await deployRun({
				network,
				logLevel,
			})
		}
	},
	subCommands: {
		run: runCommand,
		// ls: listCommand,
		task: taskCommand,
		canister: canisterCommand,
		// init: initCommand,
		// g: generateCommand,
		status: canistersStatusCommand,
		ui: uiCommand,
		// w: watchCommand,
	},
})


// TODO: can we load the iceConfig before running the cli?
// Prepare and run the CLI application
export const runCli = async () => {
	// TODO: not in npm?
	// const completion = await tab(main);
	p.intro(`${color.bgCyan(color.black(" ICE CLI "))}`)
	p.updateSettings({
		aliases: {
			w: "up",
			s: "down",
			a: "left",
			d: "right",
			j: "down",
			k: "up",
			h: "left",
			l: "right",
		},
	})
	const cli = createMain(main)
	cli()
}

// class RootCmd extends Command {
// 	static paths = [Command.Default]
// 	// static subCommands = [RunCmd, CanisterRoot, TaskPickerCommand];

// 	network = Option.String("--network", "local")
// 	logLevel = Option.String("--log-level", "info")

// 	async execute() {
// 		await deployRun({ network: this.network, logLevel: this.logLevel })
// 	}
// }
// export const runCli = async () => {
// 	// TODO: not in npm?
// 	// const completion = await tab(main);
// 	p.intro(`${color.bgCyan(color.black(" ICE CLI "))}`)
// 	p.updateSettings({
// 		aliases: {
// 			w: "up",
// 			s: "down",
// 			a: "left",
// 			d: "right",
// 			j: "down",
// 			k: "up",
// 			h: "left",
// 			l: "right",
// 		},
// 	})
// 	const [node, app, ...args] = process.argv;
// 	const cli = new Cli({
// 		// binaryLabel: `ICE CLI`,
// 		binaryName: `ice`,
// 		// binaryVersion: `0.0.1`,
// 		enableColors: true,
// 	})
// 	cli.register(RootCmd)
// 	cli.runExit(args)
// 	// runExit(cli, RootCmd)
// 	// , { binaryName: "ICE CLI" }
// }
