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

//   // TODO: we need to construct this dynamically if we want space delimited task paths
const runCommand = defineCommand({
  meta: {
    name: "run",
    description: "Run a Crystal task",
  },
  args: {
    taskPath: { type: "positional", required: true, description: "The task to run. examples: icrc1:build, nns:governance:install" },
  },
  run: async ({ args }) => {
    await runtime.runPromise(
      // @ts-ignore
      Effect.gen(function* () {
        const { config, taskTree } = yield* CrystalConfigService
        yield* runTaskByPath(args.taskPath)
      }),
    )
  },
})

const canistersDeployCommand = defineCommand({
  meta: {
    name: "Canisters deploy",
    description: "Deploys all canisters",
  },
  run: async ({ args }) => {
    await runtime.runPromise(
      // @ts-ignore
      Effect.gen(function* () {
        yield* canistersDeployTask()
      }),
    )
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
    await runtime.runPromise(
      Effect.gen(function* () {
        yield* canistersStatusTask()
      }),
    )
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
      // if no subcommand
      await runtime.runPromise(
        // @ts-ignore
        Effect.gen(function* () {
          const { config, taskTree } = yield* CrystalConfigService
          yield* canistersDeployTask()
        }),
      )
    }
  },
  subCommands: {
    run: runCommand,
    canisters: canistersDeployCommand,
    "canisters:create": canistersCreateCommand,
    "canisters:build": canistersBuildCommand,
    "canisters:bindings": canistersBindingsCommand,
    "canisters:install": canistersInstallCommand,
    "canisters:status": canistersStatusCommand,
    "canisters:remove": canistersRemoveCommand,
    list: listCommand,
    "list:canisters": listCanistersCommand,
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
