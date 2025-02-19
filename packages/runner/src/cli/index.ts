import { Effect, Layer, Console } from "effect"
import { Command, Options, Args, ValidationError } from "@effect/cli"
import { CommandMismatch, isCommandMismatch } from "@effect/cli/ValidationError"
import {
  canistersBindingsTask,
  canistersBuildTask,
  canistersCreateTask,
  canistersDeployTask,
  canistersInstallTask,
  canistersStatusTask,
  DefaultsLayer,
  listCanistersTask,
  listTasksTask,
  runTaskByPath,
  runtime,
} from "../index.js"
import type { CrystalConfig, TaskTree } from "../types/types.js"
import { uiTask } from "./ui/index.js"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { CrystalConfigService } from "../services/crystalConfig.js"
import { commandMismatch } from "@effect/cli/ValidationError"
import * as p from "@clack/prompts"
import color from "picocolors"
import { defineCommand, createMain } from "citty"
// TODO: not in npm?
// import tab from '@bombsh/tab/citty'

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
    description: "Run a Crystal task",
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
        const { config, taskTree } = yield* CrystalConfigService
        yield* runTaskByPath(args.taskPath)
      }),
    )
    s.stop(`Finished task: ${color.green(color.underline(args.taskPath))}`)
  },
})

const initCommand = defineCommand({
  meta: {
    name: "Init",
    description: "Initialize a new Crystal project",
  },
  run: async ({ args }) => {
    // TODO: prompt which canisters to include
    // await runtime.runPromise(
    //   Effect.gen(function* () {
    //     yield* initTask()
    //   }),
    // )
  },
})
const canistersDeployCommand = defineCommand({
  meta: {
    name: "Canisters deploy",
    description: "Deploys all canisters",
  },
  run: async ({ args }) => {
    const s = p.spinner()
    s.start("Deploying all canisters...")
    await p.tasks([
      {
        title: "Deploying canisters",
        task: async () => {
          await runtime.runPromise(
            // @ts-ignore
            Effect.gen(function* () {
              yield* canistersDeployTask()
            }),
          )
        },
      },
    ])
    s.stop("Deployed all canisters")
  },
})

const canistersCreateCommand = defineCommand({
  meta: {
    name: "Canisters create",
    description: "Creates all canisters",
  },
  run: async ({ args }) => {
    await runtime.runPromise(
      // @ts-ignore
      Effect.gen(function* () {
        yield* canistersCreateTask()
      }),
    )
  },
})

const canistersBuildCommand = defineCommand({
  meta: {
    name: "Canisters build",
    description: "Builds all canisters",
  },
  run: async ({ args }) => {
    await runtime.runPromise(
      // @ts-ignore
      Effect.gen(function* () {
        yield* canistersBuildTask()
      }),
    )
  },
})

const canistersBindingsCommand = defineCommand({
  meta: {
    name: "Canisters bindings",
    description: "Generates bindings for all canisters",
  },
  run: async ({ args }) => {
    await runtime.runPromise(
      // @ts-ignore
      Effect.gen(function* () {
        yield* canistersBindingsTask()
      }),
    )
  },
})

const canistersInstallCommand = defineCommand({
  meta: {
    name: "Canisters install",
    description: "Installs all canisters",
  },
  run: async ({ args }) => {
    await runtime.runPromise(
      // @ts-ignore
      Effect.gen(function* () {
        yield* canistersInstallTask()
      }),
    )
  },
})

const canistersStatusCommand = defineCommand({
  meta: {
    name: "Canisters status",
    description: "Gets the status of all canisters",
  },
  run: async ({ args }) => {

    if (args._.length === 0) {
      await runtime.runPromise(
        Effect.gen(function* () {
          const statuses = yield* canistersStatusTask()
          const statusLog = statuses
            .map((result) =>
              result._tag === "Right"
                ? `
${color.underline(result.right.canisterName)}
  ID: ${result.right.canisterId}
  Status: ${color.green(Object.keys(result.right.status.status)[0])}
  Memory Size: ${result.right.status.memory_size.toLocaleString("en-US").replace(/,/g, "_")}
  Cycles: ${result.right.status.cycles.toLocaleString("en-US").replace(/,/g, "_")}
  Idle Cycles Burned Per Day: ${result.right.status.idle_cycles_burned_per_day.toLocaleString("en-US").replace(/,/g, "_")}
  Module Hash: ${moduleHashToHexString(result.right.status.module_hash)}`
                : `Error for canister: ${result.left.message}`,
            )
            .join("\n")

          console.log(statusLog)
        }),
      )
    }

  },
})

const canistersRemoveCommand = defineCommand({
  meta: {
    name: "Canisters remove",
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

const listCommand = defineCommand({
  meta: {
    name: "List",
    description: "Lists all tasks",
  },
  run: async ({ args }) => {
    await runtime.runPromise(
      Effect.gen(function* () {
        yield* listTasksTask()
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
        yield* listCanistersTask()
      }),
    )
  },
})

const uiCommand = defineCommand({
  meta: {
    name: "UI",
    description: "Open the Crystal UI",
  },
  run: async ({ args }) => {
    await runtime.runPromise(
      Effect.gen(function* () {
        const { config, taskTree } = yield* CrystalConfigService
        yield* uiTask({ config, taskTree })
      }),
    )
  },
})

const main = defineCommand({
  meta: {
    name: "crystal",
    description: "Crystal CLI",
  },
  run: async ({ args }) => {
    if (args._.length === 0) {
      const s = p.spinner()
      s.start("Deploying all canisters...")
      // if no subcommand
      await runtime.runPromise(
        // @ts-ignore
        Effect.gen(function* () {
          const { config, taskTree } = yield* CrystalConfigService
          yield* canistersDeployTask()
        }),
      )
      s.stop("Deployed all canisters")
    }
  },
  subCommands: {
    run: runCommand,
    canisters: canistersDeployCommand,
    "canisters:create": canistersCreateCommand,
    "canisters:build": canistersBuildCommand,
    "canisters:bindings": canistersBindingsCommand,
    "canisters:install": canistersInstallCommand,
    status: canistersStatusCommand,
    "canisters:remove": canistersRemoveCommand,
    list: listCommand,
    "list:canisters": listCanistersCommand,
    init: initCommand,
    ui: uiCommand,
  },
})

// TODO: can we load the crystalConfig before running the cli?
// Prepare and run the CLI application
export const runCli = async () => {
  // TODO: not in npm?
  // const completion = await tab(main);

  p.intro(`${color.bgCyan(color.black(" Crystal CLI "))}`)
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

  // TODO: these are in subcommands
  // const project = await p.group(
  // 	{
  // 		path: () =>
  // 			p.text({
  // 				message: 'Where should we create your project?',
  // 				placeholder: './sparkling-solid',
  // 				validate: (value) => {
  // 					if (!value) return 'Please enter a path.';
  // 					if (value[0] !== '.') return 'Please enter a relative path.';
  // 				},
  // 			}),
  // 		password: () =>
  // 			p.password({
  // 				message: 'Provide a password',
  // 				validate: (value) => {
  // 					if (!value) return 'Please enter a password.';
  // 					if (value.length < 5) return 'Password should have at least 5 characters.';
  // 				},
  // 			}),
  // 		type: ({ results }) =>
  // 			p.select({
  // 				message: `Pick a project type within "${results.path}"`,
  // 				initialValue: 'ts',
  // 				maxItems: 5,
  // 				options: [
  // 					{ value: 'ts', label: 'TypeScript' },
  // 					{ value: 'js', label: 'JavaScript' },
  // 					{ value: 'rust', label: 'Rust' },
  // 					{ value: 'go', label: 'Go' },
  // 					{ value: 'python', label: 'Python' },
  // 					{ value: 'coffee', label: 'CoffeeScript', hint: 'oh no' },
  // 				],
  // 			}),
  // 		tools: () =>
  // 			p.multiselect({
  // 				message: 'Select additional tools.',
  // 				initialValues: ['prettier', 'eslint'],
  // 				options: [
  // 					{ value: 'prettier', label: 'Prettier', hint: 'recommended' },
  // 					{ value: 'eslint', label: 'ESLint', hint: 'recommended' },
  // 					{ value: 'stylelint', label: 'Stylelint' },
  // 					{ value: 'gh-action', label: 'GitHub Action' },
  // 				],
  // 			}),
  // 		install: () =>
  // 			p.confirm({
  // 				message: 'Install dependencies?',
  // 				initialValue: false,
  // 			}),
  // 	},
  // 	{
  // 		onCancel: () => {
  // 			p.cancel('Operation cancelled.');
  // 			process.exit(0);
  // 		},
  // 	}
  // );

  // const s = p.spinner()
  // s.start(`Running task... ${color.green(color.underline("crystal:build"))}`)
  // await new Promise((resolve) => setTimeout(resolve, 2500))
  // s.stop(`Finished task: ${color.green(color.underline("crystal:build"))}`)

  // // const nextSteps = `cd ${project.path}        \n${project.install ? "" : "pnpm install\n"}pnpm dev`

  // p.note("cd ./my-app\npnpm install\npnpm dev", "Next steps.")

  // p.outro(
  //   `Problems? ${color.underline(color.cyan("https://example.com/issues"))}`,
  // )
}
