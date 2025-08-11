import { StandardSchemaV1 } from "@standard-schema/spec"
import { match, type } from "arktype"
import { Effect, Record } from "effect"
import { TaskCtx } from "../tasks/lib.js"
import type { ActorSubclass } from "../types/actor.js"
import type {
	InputNamedParam,
	InputPositionalParam,
	Task,
} from "../types/types.js"
import { NamedParam, PositionalParam } from "../types/types.js"
import { patchGlobals } from "../utils/extension.js"
import { customCanister } from "./custom.js"
import type {
	ExtractScopeSuccesses,
	MergeTaskDependencies,
	MergeTaskDependsOn,
} from "./lib.js"
import {
	AllowedDep,
	NormalizeDeps,
	normalizeDepsMap,
	ValidProvidedDeps,
	type TaskCtxShape,
} from "./lib.js"

type MergeTaskParams<
	T extends Task,
	TP extends AddNameToParams<InputParams>,
> = T & {
	namedParams: ExtractNamedParams<TP>
	positionalParams: ExtractPositionalParams<TP>
	params: TP
}

type ExtractNamedParams<TP extends TaskParams> = {
	[K in keyof TP]: Extract<TP[K], NamedParam>
}

export type ExtractPositionalParams<TP extends TaskParams> = Extract<
	TP[keyof TP],
	PositionalParam
>[]

export type ExtractArgsFromTaskParams<TP extends TaskParams> = {
	// TODO: schema needs to be typed as StandardSchemaV1
	[K in keyof TP]: TP[K] extends { isOptional: true }
		? StandardSchemaV1.InferOutput<TP[K]["type"]> | undefined
		: StandardSchemaV1.InferOutput<TP[K]["type"]>
}

// export type TaskParamsToArgs<T extends Task> = {
// 	[K in keyof T["params"]]: T["params"][K] extends TaskParam
// 		? StandardSchemaV1.InferOutput<T["params"][K]["type"]>
// 		: never
// }

// // TODO: doesnt take into consideration flags like isOptional, isVariadic, etc.
// export type ExtractArgsFromTaskParams<TP extends TaskParams> = {
// 	// TODO: schema needs to be typed as StandardSchemaV1
// 	[K in keyof TP]: StandardSchemaV1.InferOutput<TP[K]["type"]>
// }

export type AddNameToParams<T extends InputParams> = {
	[K in keyof T]: T[K] & {
		name: K
	}
}

type TaskParams = Record<string, NamedParam | PositionalParam>
type InputParams = Record<string, InputPositionalParam | InputNamedParam>

type ValidateInputParams<T extends InputParams> = {
	[K in keyof T]: T[K] extends infer U
		? U extends InputPositionalParam
			? InputPositionalParam<StandardSchemaV1.InferOutput<U["type"]>>
			: U extends InputNamedParam
				? InputNamedParam<StandardSchemaV1.InferOutput<U["type"]>>
				: never
		: never
}

const matchParam = match
	.in<NamedParam | PositionalParam>()
	// NamedParam
	.case(
		{
			// name: string
			// type: StandardSchemaV1<T> // TODO: ship built in types like "string" | "number" etc.
			// description?: string
			// default?: T
			// parse: (value: string) => T
			// isOptional: boolean
			// isVariadic: boolean
			isFlag: "true",
			aliases: "string[]",
			description: "string",
			isOptional: "boolean",
			isVariadic: "boolean",
		},
		(param) => ({ namedParam: param as NamedParam }),
	)
	// PositionalParam
	.case(
		{
			isFlag: "false",
			description: "string",
			isOptional: "boolean",
			isVariadic: "boolean",
		},
		(param) => ({ positionalParam: param as PositionalParam }),
	)
	.default("assert")

type Has<U, T> = [T] extends [U] ? true : false

/* one segment per flag */
type PSeg<S extends BuilderMethods> =
	`${Has<S, "params"> extends true ? "P1-" : "P0-"}`
type DepSeg<S extends BuilderMethods> =
	`${Has<S, "dependsOn"> extends true ? "Dep1-" : "Dep0-"}`
type DSeg<S extends BuilderMethods> =
	`${Has<S, "deps"> extends true ? "D1-" : "D0-"}`
type RSeg<S extends BuilderMethods> =
	`${Has<S, "run"> extends true ? "R1" : "R0"}`

/* final key ✨ */
type CanonKey<S extends BuilderMethods> =
	`${PSeg<S>}${DepSeg<S>}${DSeg<S>}${RSeg<S>}`

type NextMap = {
	/* Start ─────────────────────────────────────────────────────── */
	"P0-Dep0-D0-R0": "params" | "dependsOn" | "deps" | "run" | "make"

	/* DO (DependsOn only) ---------------------------------------- */
	"P0-Dep1-D0-R0": "deps" | "run" | "params"

	/* DOD  (DependsOn  ➜ Deps) ----------------------------------- */
	"P0-Dep1-D1-R0": "params" | "run" | "make"

	/* DODR  (DependsOn  ➜ Deps ➜ Run) ---------------------------- */
	"P0-Dep1-D1-R1": "make"

	/* DOR  (DependsOn  ➜ Run) ------------------------------------ */
	"P0-Dep1-D0-R1": "deps"

	/* DR   (Deps ➜ Run) ------------------------------------------ */
	"P0-Dep0-D1-R1": "make"

	/* D    (Deps only) ------------------------------------------- */
	"P0-Dep0-D1-R0": "run" | "make" | "params"

	/* P    (Params only) ----------------------------------------- */
	"P1-Dep0-D0-R0": "dependsOn" | "deps" | "run" | "make"

	/* PD   (Params ➜ Deps) --------------------------------------- */
	"P1-Dep0-D1-R0": "run" | "make"

	/* PDR  (Params ➜ Deps ➜ Run) --------------------------------- */
	"P1-Dep0-D1-R1": "make"

	/* PDO  (Params ➜ DependsOn) ---------------------------------- */
	"P1-Dep1-D0-R0": "deps" | "run"

	/* PDOD (Params ➜ DependsOn ➜ Deps) --------------------------- */
	"P1-Dep1-D1-R0": "run" | "make"

	/* PDODR (… ➜ Run) -------------------------------------------- */
	"P1-Dep1-D1-R1": "make"

	/* PDOR  (Params ➜ DependsOn ➜ Run) --------------------------- */
	"P1-Dep1-D0-R1": "deps"

	/* PR   (Params ➜ Run) ---------------------------------------- */
	"P1-Dep0-D0-R1": "make"

	/* R    (Run only) -------------------------------------------- */
	"P0-Dep0-D0-R1": "make"
}
type Start = never
type Next<S extends BuilderMethods> = NextMap[CanonKey<S> extends keyof NextMap
	? CanonKey<S>
	: never]

type BuilderMethods = "start" | "params" | "dependsOn" | "deps" | "run" | "make"

type TaskBuilderOmit<
	S extends BuilderMethods,
	T extends Task,
	TP extends AddNameToParams<InputParams>,
> = Pick<TaskBuilder<S, T, TP>, Next<S>>

class TaskBuilder<
	S extends BuilderMethods,
	T extends Task,
	TP extends AddNameToParams<InputParams>,
> {
	#task: T
	constructor(task: T) {
		this.#task = task
	}

	params<const IP extends ValidateInputParams<IP>>(inputParams: IP) {
		const updatedParams = Record.map(
			inputParams as InputParams,
			(v, k) => ({
				...v,
				name: k,
			}),
		) as unknown as AddNameToParams<IP>
		// TODO: use arktype?
		const namedParams: Record<string, NamedParam> = {}
		const positionalParams: Array<PositionalParam> = []
		// TODO: use effect records
		for (const kv of Object.entries(updatedParams)) {
			const [name, param] = kv as [string, NamedParam | PositionalParam]
			// TODO: nicer error?

			const result = matchParam(param)
			if ("namedParam" in result) {
				namedParams[name] = result.namedParam
			} else if ("positionalParam" in result) {
				positionalParams.push(result.positionalParam)
			} else {
				// TODO: do this in a better way
				throw new Error(`Invalid parameter type: ${param}`)
			}
		}
		const updatedTask = {
			...this.#task,
			namedParams,
			positionalParams,
			params: updatedParams,
		} satisfies Task as MergeTaskParams<T, typeof updatedParams>
		return new TaskBuilder(updatedTask) as unknown as TaskBuilderOmit<
			S | "params",
			typeof updatedTask,
			typeof updatedParams
		>
	}

	deps<UP extends Record<string, AllowedDep>, NP extends NormalizeDeps<UP>>(
		providedDeps: ValidProvidedDeps<T["dependsOn"], UP>,
	) {
		const updatedDeps = normalizeDepsMap(providedDeps) as NP
		const updatedTask = {
			...this.#task,
			dependencies: updatedDeps,
		} satisfies Task as MergeTaskDependencies<T, NP>
		return new TaskBuilder(updatedTask) as TaskBuilderOmit<
			S | "deps",
			typeof updatedTask,
			TP
		>
	}

	dependsOn<
		UD extends Record<string, AllowedDep>,
		ND extends NormalizeDeps<UD>,
	>(
		dependencies: UD,
	): TaskBuilderOmit<S | "dependsOn", MergeTaskDependsOn<T, ND>, TP> {
		const updatedDeps = normalizeDepsMap(dependencies) as ND
		const updatedTask = {
			...this.#task,
			dependsOn: updatedDeps,
		} satisfies Task as MergeTaskDependsOn<T, ND>
		return new TaskBuilder(updatedTask) as TaskBuilderOmit<
			S | "dependsOn",
			typeof updatedTask,
			TP
		>
	}

	run<Output>(
		fn: (env: {
			args: ExtractArgsFromTaskParams<TP>
			ctx: TaskCtxShape<ExtractArgsFromTaskParams<TP>>
			deps: ExtractScopeSuccesses<T["dependencies"]> &
				ExtractScopeSuccesses<T["dependsOn"]>
		}) => Promise<Output> | Output,
	) {
		const newTask = {
			...this.#task,
			effect: Effect.gen(function* () {
				const taskCtx = yield* TaskCtx
				const deps = Record.map(taskCtx.depResults, (dep) => dep.result)
				const maybePromise = fn({
					args: taskCtx.args as ExtractArgsFromTaskParams<TP>,
					ctx: taskCtx as TaskCtxShape<ExtractArgsFromTaskParams<TP>>,
					deps: deps as ExtractScopeSuccesses<T["dependencies"]> &
						ExtractScopeSuccesses<T["dependsOn"]>,
				})
				const result =
					maybePromise instanceof Promise
						? yield* Effect.tryPromise({
								try: () => patchGlobals(() => maybePromise),
								catch: (error) => {
									console.error(
										"Error executing task:",
										error,
									)
									return error instanceof Error
										? error
										: new Error(String(error))
								},
							})
						: maybePromise
				return result
			}),
			// TODO: create a task constructor for this, which fixes the type errors
		} satisfies Task

		// TODO: unknown params?
		// newTask.params

		return new TaskBuilder(newTask) as TaskBuilderOmit<
			S | "run",
			typeof newTask,
			TP
		>
	}

	make() {
		// TODO: relink dependencies!!!
		return {
			...this.#task,
			id: Symbol("task"),
		} satisfies Task
	}
}

export function task(description = "") {
	const baseTask = {
		_tag: "task",
		id: Symbol("task"),
		description,
		dependsOn: {},
		dependencies: {},
		tags: [],
		params: {},
		namedParams: {},
		positionalParams: [],
		effect: Effect.gen(function* () {}),
	} satisfies Task
	return new TaskBuilder<Start, typeof baseTask, {}>(baseTask)
}

//
// Test Cases
//

/** Example A: task -> deps -> provide -> run -> make */
const numberTask = task()
	// .run
	// .deps()
	// .params({})
	.params({})
	.dependsOn({})
	.deps({})
	.run(async () => {
		// returns a number
		return 12
	})
	.make()

const stringTask = task()
	.params({
		amount: {
			type: type("string"),
			description: "The amount of tokens to mint",
			default: "100",
			isFlag: false,
			parse: (value: string) => value,
			isOptional: false,
			isVariadic: false,
		},
	})
	.run(async () => {
		// returns a string
		return "hello"
	})
	.make()

const objTask = task()
	.run(async (ctx) => {
		const result = await ctx.ctx.runTask(stringTask, {
			amount: "100",
		})
		return {
			canisterId: "123",
			canisterName: "stringTask",
			actor: {} as ActorSubclass<{}>,
			mode: "upgrade" as const,
		}
	})
	.make()

const bindingsTask = task()
	.run(async (ctx) => {
		const result = await ctx.ctx.runTask(stringTask, {
			amount: "100",
		})
		return {
			didJS: "didJS",
			didJSPath: "didJSPath",
			didTSPath: "didTSPath",
		}
	})
	.make()

const buildTask = task()
	.run(async (ctx) => {
		return {
			wasmPath: "wasmPath",
			candidPath: "candidPath",
		}
	})
	.make()

const canScope = customCanister({
	wasm: "",
	candid: "",
}).make()

/** Example B: task -> deps -> provide -> run -> make */
const task2 = task("description of task2")
	.dependsOn({
		depB: numberTask,
		depC: canScope,
	})
	.params({})
	.deps({
		depA: stringTask,
		depC: canScope,
		depB: numberTask,
	})
	// .params({})
	.run(async ({ ctx, deps }) => {
		// use provided dependencies from ctx
		deps.depB
		deps.depC
		return "hello"
	})
	.make()

// task().run(async () => {}).

const baseTask2: Task = {
	_tag: "task",
	id: Symbol("task"),
	description: "description",
	dependsOn: {},
	dependencies: {},
	tags: [],
	params: {},
	namedParams: {},
	positionalParams: [],
	effect: Effect.gen(function* () {}),
}

const params = {
	amount: {
		// TODO: takes either string or standard schema
		type: type("number"),
		description: "The amount of tokens to mint",
		// default: "100",
		default: 100,
		parse: (value: string) => Number(value),
		isOptional: true,
		isVariadic: false,
		isFlag: true,
		aliases: ["a"],
	},
}
const paramTask = task()
	.params({
		amount: {
			// TODO: takes either string or standard schema
			type: type("number"),
			description: "The amount of tokens to mint",
			// default: "100",
			default: 100,
			parse: (value: string) => Number(value),
			isOptional: true,
			isVariadic: false,
			isFlag: true,
			aliases: ["a"],
		},
	})
	.run(async ({ args }) => {
		return args.amount
	})
	.make()
// TODO: not working
paramTask.params.amount

const taskWithParams: MergeTaskParams<
	typeof baseTask2,
	AddNameToParams<typeof params>
> = baseTask2 as MergeTaskParams<
	typeof baseTask2,
	AddNameToParams<typeof params>
>

const typedParams = params as AddNameToParams<typeof params>
