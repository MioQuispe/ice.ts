import type {
	CanisterConstructor,
	InputNamedParam,
	InputPositionalParam,
	Task,
	TaskParam,
} from "../types/types.js"
import { Effect, Option, Record } from "effect"
import type {
	ExtractTaskEffectSuccess,
	MergeTaskDeps,
	MergeTaskProvide,
	CanisterScope,
} from "./types.js"
import { TaskCtx } from "../tasks/lib.js"
import { TaskInfo } from "../tasks/run.js"
import { DependencyResults } from "../tasks/run.js"
import { patchGlobals } from "../utils/extension.js"
import { Tags, type TaskCtxShape } from "./types.js"
import { NamedParam, PositionalParam } from "../types/types.js"
import { match, type } from "arktype"
import { StandardSchemaV1 } from "@standard-schema/spec"

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

function normalizeDep(dep: Task | CanisterScope | CanisterConstructor): Task {
	if ("_tag" in dep && dep._tag === "task") return dep
	if ("provides" in dep) return dep.provides as Task
	if ("_tag" in dep && dep._tag === "scope" && dep.children?.install)
		return dep.children.install as Task
	throw new Error("Invalid dependency type provided to normalizeDep")
}
//
// Existing types
//

type AllowedDep = Task | CanisterScope | CanisterConstructor

/**
 * If T is already a Task, it stays the same.
 * If T is a CanisterScope, returns its provided Task (assumed to be under the "provides" property).
 */
type NormalizeDep<T> = T extends Task
	? T
	: T extends CanisterConstructor
		? T["provides"] extends Task
			? T["provides"]
			: never
		: T extends CanisterScope
			? T["children"]["install"] extends Task
				? T["children"]["install"]
				: never
			: never

/**
 * Normalizes a record of dependencies.
 */
type NormalizeDeps<Deps extends Record<string, AllowedDep>> = {
	[K in keyof Deps]: NormalizeDep<Deps[K]> extends Task
		? NormalizeDep<Deps[K]>
		: never
}

type ValidProvidedDeps<
	D extends Record<string, AllowedDep>,
	NP extends Record<string, AllowedDep>,
> = CompareTaskEffects<NormalizeDeps<D>, NormalizeDeps<NP>> extends never
	? never
	: NP

type CompareTaskEffects<
	D extends Record<string, Task>,
	P extends Record<string, Task>,
> = (keyof D extends keyof P ? true : false) extends true
	? {
			[K in keyof D & keyof P]: TaskReturnValue<D[K]> extends TaskReturnValue<
				P[K]
			>
				? never
				: K
		}[keyof D & keyof P] extends never
		? P
		: never
	: never

type TaskReturnValue<T extends Task> = T extends {
	effect: Effect.Effect<infer S, any, any>
}
	? S
	: never

//
// Builder Phase Interfaces
//

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

interface TaskBuilder<
	I,
	T extends Task,
	D extends Record<string, Task> = {},
	P extends Record<string, Task> = {},
	TP extends AddNameToParams<InputParams> = {},
> {
	params<const IP extends ValidateInputParams<IP>>(
		params: IP,
	): TaskBuilder<
		I,
		MergeTaskParams<T, AddNameToParams<IP>>,
		D,
		P,
		AddNameToParams<IP>
	>
	dependsOn<ND extends Record<string, AllowedDep>>(
		deps: ND,
	): TaskBuilder<
		I,
		MergeTaskDeps<T, NormalizeDeps<ND>>,
		NormalizeDeps<ND>,
		P,
		TP
	>
	deps<NP extends Record<string, AllowedDep>>(
		providedDeps: ValidProvidedDeps<D, NP>,
	): TaskBuilder<
		I,
		MergeTaskProvide<T, NormalizeDeps<ValidProvidedDeps<D, NP>>>,
		D,
		NormalizeDeps<ValidProvidedDeps<D, NP>>,
		TP
	>
	run<Output>(
		fn: (args: {
			args: ExtractArgsFromTaskParams<TP>
			ctx: TaskCtxShape<ExtractArgsFromTaskParams<TP>>
			deps: ExtractTaskEffectSuccess<P> & ExtractTaskEffectSuccess<D>
		}) => Promise<Output>,
	): TaskBuilder<
		I,
		Omit<T, "effect"> & {
			effect: Effect.Effect<
				Output,
				Error,
				TaskCtx | TaskInfo | DependencyResults
			>
		},
		D,
		P,
		TP
	>
	done(): T
	_tag: "builder"
}

//
// Helper Functions
//

/**
 * Normalizes a record of dependencies.
 */
function normalizeDepsMap(
	dependencies: Record<string, AllowedDep>,
): Record<string, Task> {
	return Object.fromEntries(
		Object.entries(dependencies).map(([key, dep]) => [key, normalizeDep(dep)]),
	)
}

/**
 * Helper for executing the run logic without duplicating code.
 */
function runTask<
	I,
	T extends Task,
	D extends Record<string, Task>,
	P extends Record<string, Task>,
	Output,
	TP extends TaskParams,
>(
	task: T,
	fn: (env: {
		args: ExtractArgsFromTaskParams<TP>
		ctx: TaskCtxShape<ExtractArgsFromTaskParams<TP>>
		deps: ExtractTaskEffectSuccess<P> & ExtractTaskEffectSuccess<D>
	}) => Promise<Output>,
) {
	const newTask = {
		...task,
		effect: Effect.gen(function* () {
			const taskCtx = yield* TaskCtx
			const taskInfo = yield* TaskInfo
			const { dependencies } = yield* DependencyResults
			const result = yield* Effect.tryPromise({
				try: () =>
					patchGlobals(() =>
						fn({
							// TODO: get args how?
							args: taskCtx.args as ExtractArgsFromTaskParams<TP>,
							ctx: taskCtx as TaskCtxShape<ExtractArgsFromTaskParams<TP>>,
							deps: dependencies as ExtractTaskEffectSuccess<P> &
								ExtractTaskEffectSuccess<D>,
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

	// TODO: unknown params
	// newTask.params

	return makeTaskBuilder<I, typeof newTask, D, P, TP>(newTask)
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

function handleParams<
	I,
	T extends Task,
	D extends Record<string, Task>,
	P extends Record<string, Task>,
	IP extends InputParams,
>(task: T, inputParams: IP) {
	const updatedParams = Record.map(inputParams, (v, k) => ({
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
		...task,
		namedParams,
		positionalParams,
		params: updatedParams,
	} satisfies Task as MergeTaskParams<T, typeof updatedParams>
	return makeTaskBuilder<I, typeof updatedTask, D, P, typeof updatedParams>(
		updatedTask,
	)
}

/**
 * Shared handler for the `.deps()` transition.
 */
function handleDeps<
	I,
	T extends Task,
	D extends Record<string, Task>,
	P extends Record<string, Task>,
	ND extends Record<string, AllowedDep>,
	TP extends TaskParams,
>(task: T, dependencies: ND) {
	const updatedDeps = normalizeDepsMap(dependencies) as NormalizeDeps<
		typeof dependencies
	>
	const updatedTask = {
		...task,
		dependencies: updatedDeps,
	} satisfies Task as MergeTaskDeps<T, typeof updatedDeps>
	return makeTaskBuilder<I, typeof updatedTask, typeof updatedDeps, P, TP>(
		updatedTask,
	)
}

/**
 * Shared handler for the `.provide()` transition.
 */
function handleProvide<
	I,
	T extends Task,
	D extends Record<string, Task>,
	NP extends Record<string, AllowedDep>,
	TP extends TaskParams,
>(task: T, providedDeps: NP) {
	const finalDeps = normalizeDepsMap(providedDeps) as NormalizeDeps<
		typeof providedDeps
	>
	const updatedTask = {
		...task,
		provide: finalDeps,
	} satisfies Task as MergeTaskProvide<
		T,
		NormalizeDeps<ValidProvidedDeps<D, typeof providedDeps>>
	>
	return makeTaskBuilder<
		I,
		typeof updatedTask,
		D,
		NormalizeDeps<ValidProvidedDeps<D, typeof providedDeps>>,
		TP
	>(updatedTask)
}

//
// Builder Phase Implementations
//

/**
 * Initial phase: returned by task(). Allows .deps(), .provide(), and .run().
 */
function makeTaskBuilder<
	I,
	T extends Task,
	D extends Record<string, Task>,
	P extends Record<string, Task>,
	TP extends AddNameToParams<InputParams>,
>(task: T): TaskBuilder<I, T, D, P, TP> {
	return {
		params: (params) => handleParams<I, T, D, P, typeof params>(task, params),
		dependsOn: (dependencies) =>
			handleDeps<I, T, D, P, typeof dependencies, TP>(task, dependencies),
		deps: (providedDeps) =>
			handleProvide<I, T, D, typeof providedDeps, TP>(task, providedDeps),
		run: (fn) => runTask<I, T, D, P, any, TP>(task, fn),
		done: () => task,
		_tag: "builder",
	}
}

// TODO:
type ValidateDeps<
	D extends Record<string, Task>,
	NP extends Record<string, AllowedDep>,
> = Record<string, AllowedDep>
// TODO:

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
	"P0-Dep0-D0-R0": "params" | "dependsOn" | "deps" | "run" | "done"

	/* DO (DependsOn only) ---------------------------------------- */
	"P0-Dep1-D0-R0": "deps" | "run" | "params"

	/* DOD  (DependsOn  ➜ Deps) ----------------------------------- */
	"P0-Dep1-D1-R0": "params" | "run" | "done"

	/* DODR  (DependsOn  ➜ Deps ➜ Run) ---------------------------- */
	"P0-Dep1-D1-R1": "done"

	/* DOR  (DependsOn  ➜ Run) ------------------------------------ */
	"P0-Dep1-D0-R1": "deps"

	/* DR   (Deps ➜ Run) ------------------------------------------ */
	"P0-Dep0-D1-R1": "done"

	/* D    (Deps only) ------------------------------------------- */
	"P0-Dep0-D1-R0": "run" | "done" | "params"

	/* P    (Params only) ----------------------------------------- */
	"P1-Dep0-D0-R0": "dependsOn" | "deps" | "run" | "done"

	/* PD   (Params ➜ Deps) --------------------------------------- */
	"P1-Dep0-D1-R0": "run" | "done"

	/* PDR  (Params ➜ Deps ➜ Run) --------------------------------- */
	"P1-Dep0-D1-R1": "done"

	/* PDO  (Params ➜ DependsOn) ---------------------------------- */
	"P1-Dep1-D0-R0": "deps" | "run"

	/* PDOD (Params ➜ DependsOn ➜ Deps) --------------------------- */
	"P1-Dep1-D1-R0": "run" | "done"

	/* PDODR (… ➜ Run) -------------------------------------------- */
	"P1-Dep1-D1-R1": "done"

	/* PDOR  (Params ➜ DependsOn ➜ Run) --------------------------- */
	"P1-Dep1-D0-R1": "deps"

	/* PR   (Params ➜ Run) ---------------------------------------- */
	"P1-Dep0-D0-R1": "done"

	/* R    (Run only) -------------------------------------------- */
	"P0-Dep0-D0-R1": "done"
}
type Start = never
type Next<S extends BuilderMethods> = NextMap[CanonKey<S> extends keyof NextMap
	? CanonKey<S>
	: never]

type BuilderMethods = "start" | "params" | "dependsOn" | "deps" | "run" | "done"

type TaskBuilderOmit<
	S extends BuilderMethods,
	T extends Task,
	D extends Record<string, Task>,
	P extends Record<string, Task>,
	TP extends AddNameToParams<InputParams>,
> = Pick<TaskBuilderClass<S, T, D, P, TP>, Next<S>>

class TaskBuilderClass<
	S extends BuilderMethods,
	T extends Task,
	D extends Record<string, Task>,
	P extends Record<string, Task>,
	TP extends AddNameToParams<InputParams>,
> {
	constructor(private task: T) {}

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
			...this.task,
			namedParams,
			positionalParams,
			params: updatedParams,
		} satisfies Task as MergeTaskParams<typeof this.task, typeof updatedParams>
		return new TaskBuilderClass(updatedTask) as unknown as TaskBuilderOmit<
			S | "params",
			typeof updatedTask,
			D,
			P,
			typeof updatedParams
		>
	}


		// deps<NP extends Record<string, AllowedDep>>(
		// 	providedDeps: ValidProvidedDeps<D, NP>,
		// ): TaskBuilderProvide<

	// deps<NP extends Record<string, AllowedDep>>(providedDeps: NP) {
	deps<NP extends Record<string, AllowedDep>>(providedDeps: ValidProvidedDeps<D, NP>) {
		const finalDeps = normalizeDepsMap(providedDeps) as NormalizeDeps<NP>
		const updatedTask = {
			...this.task,
			provide: finalDeps,
		} satisfies Task as MergeTaskProvide<
			typeof this.task,
			NormalizeDeps<ValidProvidedDeps<D, NP>>
		>
		return new TaskBuilderClass(updatedTask) as TaskBuilderOmit<
			S | "deps",
			typeof updatedTask,
			D,
			P,
			TP
		>
	}

	dependsOn<ND extends Record<string, AllowedDep>>(dependencies: ND) {
		const updatedDeps = normalizeDepsMap(dependencies) as NormalizeDeps<ND>
		const updatedTask = {
			...this.task,
			dependencies: updatedDeps,
		} satisfies Task as MergeTaskDeps<T, typeof updatedDeps>
		return new TaskBuilderClass(updatedTask) as TaskBuilderOmit<
			S | "dependsOn",
			typeof updatedTask,
			typeof updatedDeps,
			P,
			TP
		>
	}

	run<Output>(
		fn: (env: {
			args: ExtractArgsFromTaskParams<TP>
			ctx: TaskCtxShape<ExtractArgsFromTaskParams<TP>>
			deps: ExtractTaskEffectSuccess<P> & ExtractTaskEffectSuccess<D>
		}) => Promise<Output>,
	) {
		const newTask = {
			...this.task,
			effect: Effect.gen(function* () {
				const taskCtx = yield* TaskCtx
				const taskInfo = yield* TaskInfo
				const { dependencies } = yield* DependencyResults
				const result = yield* Effect.tryPromise({
					try: () =>
						patchGlobals(() =>
							fn({
								// TODO: get args how?
								args: taskCtx.args as ExtractArgsFromTaskParams<TP>,
								ctx: taskCtx as TaskCtxShape<ExtractArgsFromTaskParams<TP>>,
								deps: dependencies as ExtractTaskEffectSuccess<P> &
									ExtractTaskEffectSuccess<D>,
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

		// TODO: unknown params
		// newTask.params

		return new TaskBuilderClass(newTask) as TaskBuilderOmit<
			S | "run",
			typeof newTask,
			D,
			P,
			TP
		>
	}

	done() {
		return this.task
	}
}

export function task(description = "description") {
	const baseTask = {
		_tag: "task",
		id: Symbol("task"),
		description,
		computeCacheKey: Option.none(),
		input: Option.none(),
		dependencies: {},
		provide: {},
		tags: [],
		params: {},
		namedParams: {},
		positionalParams: [],
		effect: Effect.gen(function* () {}),
	} satisfies Task
	return new TaskBuilderClass<Start, typeof baseTask, {}, {}, {}>(baseTask)
}

//
// Test Cases
//

/** Example A: task -> deps -> provide -> run -> done */
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
	.done()

type S = ExtractTaskEffectSuccess<{ numberTask: typeof numberTask }>

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
	.done()

const objTask = task()
	.run(async (ctx) => {
		const result = await ctx.ctx.runTask(stringTask, {
			amount: "100",
		})
		return { a: 1, b: 2 }
	})
	.done()

const canScope = {
	_tag: "scope",
	tags: [],
	description: "canScope",
	defaultTask: Option.none(),
	children: {
		install: objTask,
	},
} satisfies CanisterScope

/** Example B: task -> deps -> provide -> run -> done */
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
	.done()

// task().run(async () => {}).

const baseTask2: Task = {
	_tag: "task",
	id: Symbol("task"),
	description: "description",
	computeCacheKey: Option.none(),
	input: Option.none(),
	dependencies: {},
	provide: {},
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
	.done()
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
