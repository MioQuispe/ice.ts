import { Effect, Console, Stream, Either } from "effect"
import {
	canistersBindingsTask,
	canistersBuildTask,
	canistersCreateTask,
	canistersDeployTask,
	canistersInstallTask,
	canistersStatusTask,
	canistersStopTask,
	listTasksTask,
	runTaskByPath,
} from "../tasks/index.js"
import { runtime } from "../index.js"
import { listCanistersTask } from "../tasks/list-canisters.js"
import { uiTask } from "./ui/index.js"
import { ICEConfigService } from "../services/iceConfig.js"
import * as p from "@clack/prompts"
import color from "picocolors"
import {
	defineCommand,
	createMain,
	type CommandContext,
	type ArgsDef,
} from "citty"
import { isCancel } from "@clack/prompts"
import { cancel } from "@clack/prompts"

function moduleHashToHexString(moduleHash: [] | [number[]]): string {
	if (moduleHash.length === 0) {
		return "Not Present"
	}
	const bytes = new Uint8Array(moduleHash[0]) // Ensure it's a Uint8Array
	const hexString = Buffer.from(bytes).toString("hex")
	return `0x${hexString}`
}

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
	},
	run: async ({ args }) => {
		const s = p.spinner()
		s.start(`Running task... ${color.green(color.underline(args.taskPath))}`)
		await runtime.runPromise(
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

// export const tasks = async (tasks) => {
//   for (const task of tasks) {
//     if (task.enabled === false) continue

//     const s = spinner()
//     s.start(task.title)
//     const result = await task.task(s.message)
//     s.stop(result || task.title)
//   }
// }

const deployRun = async ({ args }: CommandContext<ArgsDef>) => {
	const s = p.spinner()
	s.start("Deploying all canisters...")
	await runtime.runPromise(
		// @ts-ignore
		Effect.gen(function* () {
			yield* canistersDeployTask((update) => {
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
	run: async ({ args }) => {
		await runtime.runPromise(
			// @ts-ignore
			Effect.gen(function* () {
				const s = p.spinner()
				s.start("Creating all canisters")
				yield* canistersCreateTask((update) => {
					if (update.status === "starting") {
						s.message(`Running ${update.taskPath}`)
					}
					if (update.status === "completed") {
						s.message(`Completed ${update.taskPath}`)
					}
				})
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
	run: async ({ args }) => {
		await runtime.runPromise(
			// @ts-ignore
			Effect.gen(function* () {
				const s = p.spinner()
				s.start("Building all canisters")
				yield* canistersBuildTask((update) => {
					if (update.status === "starting") {
						s.message(`Running ${update.taskPath}`)
					}
					if (update.status === "completed") {
						s.message(`Completed ${update.taskPath}`)
					}
				})
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
	run: async ({ args }) => {
		await runtime.runPromise(
			// @ts-ignore
			Effect.gen(function* () {
				const s = p.spinner()
				s.start("Generating bindings for all canisters")
				yield* canistersBindingsTask((update) => {
					if (update.status === "starting") {
						s.message(`Running ${update.taskPath}`)
					}
					if (update.status === "completed") {
						s.message(`Completed ${update.taskPath}`)
					}
				})
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
	run: async ({ args }) => {
		await runtime.runPromise(
			// @ts-ignore
			Effect.gen(function* () {
				const s = p.spinner()
				s.start("Installing all canisters")
				yield* canistersInstallTask((update) => {
					if (update.status === "starting") {
						s.message(`Running ${update.taskPath}`)
					}
					if (update.status === "completed") {
						s.message(`Completed ${update.taskPath}`)
					}
				})
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
	run: async ({ args }) => {
		await runtime.runPromise(
			// @ts-ignore
			Effect.gen(function* () {
				const s = p.spinner()
				s.start("Stopping all canisters")
				yield* canistersStopTask((update) => {
					if (update.status === "starting") {
						s.message(`Running ${update.taskPath}`)
					}
					if (update.status === "completed") {
						s.message(`Completed ${update.taskPath}`)
					}
				})
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
	run: async ({ args }) => {
		// TODO: support canister name or ID
		if (args._.length === 0) {
			await runtime.runPromise(
				Effect.gen(function* () {
					// TODO: this needs to run as a task
					const statuses = yield* canistersStatusTask()
					const statusLog = statuses
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
	args: {
		canisterNameOrId: {
			type: "positional",
			required: false,
			description: "The name or ID of the canister to get the status of",
		},
	},
})

const canistersRemoveCommand = defineCommand({
	meta: {
		name: "remove",
		description: "Removes all canisters",
	},
	run: async ({ args }) => {
		await runtime.runPromise(
			Effect.gen(function* () {
				yield* Console.log("Coming soon...")
			}),
		)
	},
})

const listCanistersCommand = defineCommand({
	meta: {
		name: "List canisters",
		description: "Lists all canisters",
	},
	run: async ({ args }) => {
		await runtime.runPromise(
			Effect.gen(function* () {
				const taskList = yield* listCanistersTask()
				// p.note(taskList.join("\n"))
				// yield* Console.log(taskList.join("\n"))
				p.select({
					message: "Select a canister",
					options: taskList.map((task) => ({
						value: task,
						label: task,
					})),
				})
			}),
		)
	},
})

const listCommand = defineCommand({
	meta: {
		name: "list",
		description: "Lists all tasks",
	},
	run: async ({ args }) => {
		if (args._.length === 0) {
			await runtime.runPromise(
				Effect.gen(function* () {
					const taskList = yield* listTasksTask()
					// p.text({ message: taskList.join("\n") })
					p.note(taskList.join("\n"))
					// yield* Console.log(taskList.join("\n"))
				}),
			)
		}
	},
	subCommands: {
		canisters: listCanistersCommand,
	},
})

const uiCommand = defineCommand({
	meta: {
		name: "ui",
		description: "Opens the experimental ICE terminal UI",
	},
	run: async ({ args }) => {
		await runtime.runPromise(
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
	run: deployRun,
})

const canisterCommand = defineCommand({
	meta: {
		name: "canister",
		description:
			"Select a specific canister to run a task on. install, build, deploy, etc.",
	},
	run: async ({ args }) => {
		if (args._.length === 0) {
			await runtime.runPromise(
				// @ts-ignore
				Effect.gen(function* () {
					const canisterList = yield* listCanistersTask()
					const canister = (yield* Effect.tryPromise(() =>
						p.select({
							message: "Select a canister",
							options: canisterList.map((canister) => ({
								value: canister,
								label: canister,
							})),
						}),
					)) as string
					if (isCancel(canister)) {
						cancel("Operation cancelled.")
						process.exit(0)
					}
					// if (!canister) {
					//   return
					// }
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
	run: async ({ args }) => {
		if (args._.length === 0) {
			await runtime.runPromise(
				// @ts-ignore
				Effect.gen(function* () {
					const taskList = yield* listTasksTask()
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
	run: async (ctx) => {
		if (ctx.args._.length === 0) {
			await deployRun(ctx)
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
