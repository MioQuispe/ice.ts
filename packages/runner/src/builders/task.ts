import type {
	InputNamedParam,
	InputPositionalParam,
	Task,
} from "../types/types.js"
import { Effect, Option, Record } from "effect"
import type {
	ExtractTaskEffectSuccess,
	MergeTaskDependsOn,
	MergeTaskDependencies,
	CanisterScope,
} from "./lib.js"
import { TaskCtx } from "../tasks/lib.js"
import { TaskInfo } from "../tasks/run.js"
import { DependencyResults } from "../tasks/run.js"
import { patchGlobals } from "../utils/extension.js"
import { Tags, type TaskCtxShape } from "./lib.js"
import { NamedParam, PositionalParam } from "../types/types.js"
import { match, type } from "arktype"
import { StandardSchemaV1 } from "@standard-schema/spec"
import type { ActorSubclass } from "../types/actor.js"
import {
	AllowedDep,
	makeCanisterStatusTask,
	NormalizeDeps,
	ValidProvidedDeps,
} from "./lib.js"
import { normalizeDepsMap } from "./lib.js"

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
	[K in keyof TP]: StandardSchemaV1.InferOutput<TP[K]["type"]>
}

type AddNameToParams<T extends InputParams> = {
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
> = Pick<TaskBuilderClass<S, T, TP>, Next<S>>

class TaskBuilderClass<
	S extends BuilderMethods,
	T extends Task,
	TP extends AddNameToParams<InputParams>,
> {
	#task: T
	constructor(task: T) {
		this.#task = task
	}

	params<const IP extends ValidateInputParams<IP>>(inputParams: IP) {
		const updatedParams = Record.map(inputParams as InputParams, (v, k) => ({
			...v,
			name: k,
		})) as unknown as AddNameToParams<IP>
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
				throw new Error(`Invalid parameter type: ${param}`)
			}
		}
		const updatedTask = {
			...this.#task,
			namedParams,
			positionalParams,
			params: updatedParams,
		} satisfies Task as MergeTaskParams<T, typeof updatedParams>
		return new TaskBuilderClass(updatedTask) as unknown as TaskBuilderOmit<
			S | "params",
			typeof updatedTask,
			typeof updatedParams
		>
	}

	deps<NP extends Record<string, AllowedDep>>(
		providedDeps: ValidProvidedDeps<T["dependsOn"], NP>,
	) {
		const finalDeps = normalizeDepsMap(providedDeps) as NormalizeDeps<NP>
		const updatedTask = {
			...this.#task,
			dependencies: finalDeps,
		} satisfies Task as MergeTaskDependencies<
			T,
			NormalizeDeps<ValidProvidedDeps<T["dependsOn"], NP>>
		>
		return new TaskBuilderClass(updatedTask) as TaskBuilderOmit<
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
		return new TaskBuilderClass(updatedTask) as TaskBuilderOmit<
			S | "dependsOn",
			typeof updatedTask,
			TP
		>
	}

	run<Output>(
		fn: (env: {
			args: ExtractArgsFromTaskParams<TP>
			ctx: TaskCtxShape<ExtractArgsFromTaskParams<TP>>
			deps: ExtractTaskEffectSuccess<T["dependencies"]> &
				ExtractTaskEffectSuccess<T["dependsOn"]>
		}) => Promise<Output>,
	) {
		const newTask = {
			...this.#task,
			effect: Effect.gen(function* () {
				const taskCtx = yield* TaskCtx
				const taskInfo = yield* TaskInfo
				const { dependencies } = yield* DependencyResults
				const deps = Record.map(dependencies, (dep) => dep.result)
				const result = yield* Effect.tryPromise({
					try: () =>
						patchGlobals(() =>
							fn({
								args: taskCtx.args as ExtractArgsFromTaskParams<TP>,
								ctx: taskCtx as TaskCtxShape<ExtractArgsFromTaskParams<TP>>,
								deps: deps as ExtractTaskEffectSuccess<
									T["dependencies"]
								> &
									ExtractTaskEffectSuccess<T["dependsOn"]>,
							}),
						),
					catch: (error) => {
						console.error("Error executing task:", error)
						return error instanceof Error ? error : new Error(String(error))
					},
				})
				return result
			}),
		} satisfies Task

		// TODO: unknown params?
		// newTask.params

		return new TaskBuilderClass(newTask) as TaskBuilderOmit<
			S | "run",
			typeof newTask,
			TP
		>
	}

	make() {
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
	return new TaskBuilderClass<Start, typeof baseTask, {}>(baseTask)
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
	}).make()

const installArgsTask = task()
	.run(async (ctx) => {
		return {
			encodedArgs: new Uint8Array(),
			args: {},
		}
	})
	.make()

const canScope = {
	_tag: "scope",
	id: Symbol("scope"),
	tags: [],
	description: "canScope",
	defaultTask: "deploy",
	children: {
		install: objTask,
		install_args: installArgsTask,
		create: stringTask,
		bindings: bindingsTask,
		build: buildTask,
		stop: objTask,
		remove: objTask,
		deploy: objTask,
		status: makeCanisterStatusTask([]),
	},
} satisfies CanisterScope

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
	} satisfies InputNamedParam,
} satisfies InputParams

const paramTask = task()
	.params(params)
	.run(async ({ args }) => {
		return args.amount
	})
	.make()
// TODO: not working
// paramTask.params.amount

const taskWithParams: MergeTaskParams<
	typeof baseTask2,
	AddNameToParams<typeof params>
> = baseTask2 as MergeTaskParams<
	typeof baseTask2,
	AddNameToParams<typeof params>
>

const typedParams = params as AddNameToParams<typeof params>
