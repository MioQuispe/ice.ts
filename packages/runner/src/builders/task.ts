import type { CanisterConstructor, Task, TaskParam } from "../types/types.js"
import { Effect, Option } from "effect"
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

// const PositionalParam = positionalParamSchema
// const NamedParam = namedParamSchema("unknown")
// type PositionalParam = typeof PositionalParam.infer
// type NamedParam = typeof NamedParam.infer

type MergeTaskParams<
	T extends Task,
	TP extends Record<string, NamedParam | PositionalParam>,
> = T & {
	// TODO: extract namedParams and positionalParams from TP
	namedParams: ExtractNamedParams<TP>
	positionalParams: ExtractPositionalParams<TP>
	params: TP
}

type ExtractNamedParams<
	TP extends Record<string, NamedParam | PositionalParam>,
> = {
	[K in keyof TP]: TP[K] extends NamedParam ? TP[K] : never
}

export type ExtractPositionalParams<
	TP extends Record<string, NamedParam | PositionalParam>,
> = Extract<TP[keyof TP], PositionalParam>[]

export type ExtractArgsFromTaskParams<
	TP extends Record<string, NamedParam | PositionalParam>,
> = {
	// TODO: schema needs to be typed as StandardSchemaV1
	[K in keyof TP]: StandardSchemaV1.InferOutput<TP[K]["schema"]>
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

/**
 * The builder returned from `task()` which allows:
 * - Adding dependencies (.deps())
 * - Providing dependencies (.provide())
 * - Finalizing the task with an effect (.run())
 */
interface TaskBuilderInitial<
	I,
	T extends Task,
	D extends Record<string, Task> = {},
	P extends Record<string, Task> = {},
	TP extends Record<string, NamedParam | PositionalParam> = {},
> {
	params<TP extends Record<string, NamedParam | PositionalParam>>(
		params: TP,
	): TaskBuilderParams<I, T, D, P, TP>
	dependsOn<ND extends Record<string, AllowedDep>>(
		deps: ND,
	): TaskBuilderDeps<
		I,
		MergeTaskDeps<T, NormalizeDeps<ND>>,
		NormalizeDeps<ND>,
		P,
		TP
	>
	deps<NP extends Record<string, AllowedDep>>(
		providedDeps: ValidProvidedDeps<D, NP>,
	): TaskBuilderProvide<
		I,
		MergeTaskProvide<T, NormalizeDeps<ValidProvidedDeps<D, NP>>>,
		D,
		NormalizeDeps<ValidProvidedDeps<D, NP>>,
		TP
	>
	run<Output>(
		fn: (args: {
			ctx: TaskCtxShape
			deps: ExtractTaskEffectSuccess<P> & ExtractTaskEffectSuccess<D>
		}) => Promise<Output>,
	): TaskBuilderRun<
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
}

interface TaskBuilderParams<
	I,
	T extends Task,
	D extends Record<string, Task>,
	P extends Record<string, Task>,
	TP extends Record<string, NamedParam | PositionalParam>,
> {
	dependsOn<ND extends Record<string, AllowedDep>>(
		deps: ND,
	): TaskBuilderDeps<
		I,
		MergeTaskDeps<T, NormalizeDeps<ND>>,
		NormalizeDeps<ND>,
		P,
		TP
	>
	deps<NP extends Record<string, AllowedDep>>(
		providedDeps: ValidProvidedDeps<D, NP>,
	): TaskBuilderProvide<
		I,
		MergeTaskProvide<T, NormalizeDeps<ValidProvidedDeps<D, NP>>>,
		D,
		NormalizeDeps<ValidProvidedDeps<D, NP>>,
		TP
	>
	run<Output>(
		fn: (args: {
			ctx: TaskCtxShape
			deps: ExtractTaskEffectSuccess<P> & ExtractTaskEffectSuccess<D>
		}) => Promise<Output>,
	): TaskBuilderRun<
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
}

/**
 * Builder phase after calling .deps(). Only .provide() is allowed next.
 */
interface TaskBuilderDeps<
	I,
	T extends Task,
	D extends Record<string, Task>,
	P extends Record<string, Task>,
	TP extends Record<string, NamedParam | PositionalParam>,
> {
	deps<NP extends Record<string, AllowedDep>>(
		providedDeps: ValidProvidedDeps<D, NP>,
	): TaskBuilderProvide<
		I,
		MergeTaskProvide<T, NormalizeDeps<ValidProvidedDeps<D, NP>>>,
		D,
		NormalizeDeps<ValidProvidedDeps<D, NP>>,
		TP
	>
}

/**
 * Builder phase after calling .provide(). Only .run() is allowed next.
 */
interface TaskBuilderProvide<
	I,
	T extends Task,
	D extends Record<string, Task>,
	P extends Record<string, Task>,
	TP extends Record<string, NamedParam | PositionalParam>,
> {
	run<Output>(
		fn: (args: {
			// TODO: get the params type
			args: ExtractArgsFromTaskParams<TP>
			ctx: TaskCtxShape
			deps: ExtractTaskEffectSuccess<P> & ExtractTaskEffectSuccess<D>
		}) => Promise<Output>,
	): TaskBuilderRun<
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
}

/**
 * Builder phase after calling .run(), which is final.
 */
interface TaskBuilderRun<
	I,
	T extends Task,
	D extends Record<string, Task>,
	P extends Record<string, Task>,
	TP extends Record<string, NamedParam | PositionalParam>,
> {
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
	TP extends Record<string, NamedParam | PositionalParam>,
>(
	task: T,
	fn: (env: {
		args: ExtractArgsFromTaskParams<TP>
		ctx: TaskCtxShape
		deps: ExtractTaskEffectSuccess<P> & ExtractTaskEffectSuccess<D>
	}) => Promise<Output>,
): TaskBuilderRun<
	I,
	Omit<T, "effect"> & {
		effect: Effect.Effect<Output, Error, TaskCtx | TaskInfo | DependencyResults>
	},
	D,
	P,
	TP
> {
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
							ctx: taskCtx,
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

	return makeTaskBuilderRun<I, typeof newTask, D, P, TP>(newTask)
}

const matchParam = match({})
	// NamedParam
	.case(
		{
			isFlag: "boolean",
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
	TP extends Record<string, NamedParam | PositionalParam>,
>(task: T, params: TP): TaskBuilderParams<I, T, D, P, TP> {
	// TODO: use arktype?
	const namedParams: Record<string, NamedParam> = {}
	const positionalParams: Array<PositionalParam> = []
	for (const [name, param] of Object.entries(params)) {
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
		params,
	} satisfies Task as MergeTaskParams<T, TP>
	return makeTaskBuilderParams<I, typeof updatedTask, D, P, TP>(updatedTask)
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
	TP extends Record<string, NamedParam | PositionalParam>,
>(
	task: T,
	dependencies: ND,
): TaskBuilderDeps<
	I,
	MergeTaskDeps<T, NormalizeDeps<ND>>,
	NormalizeDeps<ND>,
	P,
	TP
> {
	const finalDeps = normalizeDepsMap(dependencies) as NormalizeDeps<
		typeof dependencies
	>
	const updatedTask = {
		...task,
		dependencies: finalDeps,
	} satisfies Task as MergeTaskDeps<T, NormalizeDeps<typeof dependencies>>
	return makeTaskBuilderDeps<
		I,
		typeof updatedTask,
		NormalizeDeps<typeof dependencies>,
		P,
		TP
	>(updatedTask)
}

/**
 * Shared handler for the `.provide()` transition.
 */
function handleProvide<
	I,
	T extends Task,
	D extends Record<string, Task>,
	NP extends Record<string, AllowedDep>,
	TP extends Record<string, NamedParam | PositionalParam>,
>(
	task: T,
	providedDeps: NP,
): TaskBuilderProvide<
	I,
	MergeTaskProvide<T, NormalizeDeps<ValidProvidedDeps<D, NP>>>,
	D,
	NormalizeDeps<ValidProvidedDeps<D, NP>>,
	TP
> {
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
	return makeTaskBuilderProvide<
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
function makeTaskBuilderInitial<
	I,
	T extends Task,
	D extends Record<string, Task>,
	P extends Record<string, Task>,
	TP extends Record<string, NamedParam | PositionalParam>,
>(task: T): TaskBuilderInitial<I, T, D, P, TP> {
	return {
		params: (params) => handleParams<I, T, D, P, typeof params>(task, params),
		dependsOn: (dependencies) =>
			handleDeps<I, T, D, P, typeof dependencies, TP>(task, dependencies),
		deps: (providedDeps) =>
			handleProvide<I, T, D, typeof providedDeps, TP>(task, providedDeps),
		run: (fn) => runTask<I, T, D, P, any, TP>(task, fn),
	}
}

function makeTaskBuilderParams<
	I,
	T extends Task,
	D extends Record<string, Task>,
	P extends Record<string, Task>,
	TP extends Record<string, NamedParam | PositionalParam>,
>(task: T): TaskBuilderParams<I, T, D, P, TP> {
	return {
		dependsOn: (dependencies) =>
			handleDeps<I, T, D, P, typeof dependencies, TP>(task, dependencies),
		deps: (providedDeps) =>
			handleProvide<I, T, D, typeof providedDeps, TP>(task, providedDeps),
		run: (fn) => runTask<I, T, D, P, any, TP>(task, fn),
	}
}

/**
 * Deps phase: only .provide() is allowed.
 */
function makeTaskBuilderDeps<
	I,
	T extends Task,
	D extends Record<string, Task>,
	P extends Record<string, Task>,
	TP extends Record<string, NamedParam | PositionalParam>,
>(task: T): TaskBuilderDeps<I, T, D, P, TP> {
	return {
		deps: (providedDeps) =>
			handleProvide<I, T, D, typeof providedDeps, TP>(task, providedDeps),
	}
}

/**
 * Provide phase: only .run() is allowed.
 */
function makeTaskBuilderProvide<
	I,
	T extends Task,
	D extends Record<string, Task>,
	P extends Record<string, Task>,
	TP extends Record<string, NamedParam | PositionalParam>,
>(task: T): TaskBuilderProvide<I, T, D, P, TP> {
	return {
		run: (fn) => runTask<I, T, D, P, any, TP>(task, fn),
	}
}

/**
 * Run phase: only .done() is allowed.
 */
function makeTaskBuilderRun<
	I,
	T extends Task,
	D extends Record<string, Task>,
	P extends Record<string, Task>,
	TP extends Record<string, NamedParam | PositionalParam>,
>(task: T): TaskBuilderRun<I, T, D, P, TP> {
	return {
		done: () => task,
		_tag: "builder",
	}
}

//
// Entry Point
//

export function task<I = unknown>(description = "description") {
	const baseTask: Task = {
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
	}
	return makeTaskBuilderInitial<I, typeof baseTask, {}, {}, {}>(baseTask)
}

//
// Test Cases
//

/** Example A: task -> deps -> provide -> run -> done */
const numberTask = task()
	.run(async () => {
		// returns a number
		return 12
	})
	.done()

const stringTask = task()
	.run(async () => {
		// returns a string
		return "hello"
	})
	.done()

const objTask = task()
	.run(async () => {
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
	.deps({
		depA: stringTask,
		depC: canScope,
		depB: numberTask,
	})
	.run(async ({ ctx, deps }) => {
		// use provided dependencies from ctx
		deps.depC
		return "hello"
	})
	.done()
